import type { FeatureCollection, MultiLineString } from 'geojson'
import { type LngLat, profileQuery, RouteError } from './brouter'
import type { Profile } from './styles'

/**
 * How far you get by bike in a given time: every way reachable from a start
 * point, following the routes a riding or walking style would take. The router answers
 * with one MultiLineString per minute of riding (property `minutes`).
 */
export type Reach = FeatureCollection<MultiLineString, { minutes: number }>

/** Riding times on offer, in minutes. The router stops at 30. */
export const REACH_MINUTES = [10, 20, 30] as const
export type ReachMinutes = (typeof REACH_MINUTES)[number]
export const DEFAULT_REACH_MINUTES: ReachMinutes = 20

export function isReachMinutes(value: unknown): value is ReachMinutes {
  return REACH_MINUTES.includes(Number(value) as ReachMinutes)
}

/** BRouter's isochrone mode, from our fork's isochrone branch (see routing/Dockerfile). */
const ISOCHRONE_MODE = 5

export function reachUrl(base: string, start: LngLat, minutes: number, profile: Profile): string {
  const lonlats = `${start[0].toFixed(6)},${start[1].toFixed(6)}`
  return `${base}?lonlats=${lonlats}&engineMode=${ISOCHRONE_MODE}&isochroneTime=${minutes * 60}&format=geojson&${profileQuery(profile)}`
}

export async function fetchReach(
  base: string,
  start: LngLat,
  minutes: number,
  profile: Profile,
  signal?: AbortSignal,
): Promise<Reach> {
  const res = await fetch(reachUrl(base, start, minutes, profile), { signal })
  if (!res.ok) throw new RouteError((await res.text()).trim() || `Routing failed (${res.status})`)
  const data = await res.json()
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new RouteError('This routing server cannot show how far you get.')
  }
  return data as Reach
}

const M_PER_DEG = 111_320
const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/**
 * The area the reach covers, in square metres: that of the convex hull around
 * every way reached. Points inside the quadrilateral of the four outermost ones
 * cannot be on the hull, so they are dropped before the sort; that keeps it to
 * a few tens of milliseconds for the 30-minute reach.
 */
export function reachArea(reach: Reach): number {
  const first = reach.features[0]?.geometry.coordinates[0]?.[0]
  if (!first) return 0
  const kx = M_PER_DEG * Math.cos((first[1] * Math.PI) / 180)
  let points: number[][] = []
  for (const feature of reach.features)
    for (const line of feature.geometry.coordinates) for (const p of line) points.push([p[0] * kx, p[1] * M_PER_DEG])
  let [west, south, east, north] = [points[0], points[0], points[0], points[0]]
  for (const p of points) {
    if (p[0] < west[0]) west = p
    if (p[1] < south[1]) south = p
    if (p[0] > east[0]) east = p
    if (p[1] > north[1]) north = p
  }
  points = points.filter(
    (p) =>
      !(
        cross(west, south, p) > 0 &&
        cross(south, east, p) > 0 &&
        cross(east, north, p) > 0 &&
        cross(north, west, p) > 0
      ),
  )
  // Andrew's monotone chain: the lower half of the hull, then the upper.
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const half = (list: number[][]) => {
    const out: number[][] = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  const hull = [...half(points), ...half(points.reverse())]
  let twice = 0
  for (let i = 0; i < hull.length; i++) {
    const [p, q] = [hull[i], hull[(i + 1) % hull.length]]
    twice += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(twice) / 2
}
