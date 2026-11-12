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
/** Grid cell for the area, in metres. Bigger for a very large reach, to stay quick. */
const CELL = 25
const MAX_CELLS = 16_000_000
/** A place this close to the area counts as within reach: it may stand back from the street. */
const NEAR = 50

export interface ReachCover {
  /** Square metres. */
  area: number
  /** Whether a point is in the area, or near enough to it. */
  covers: (lon: number, lat: number) => boolean
}

const NOTHING: ReachCover = { area: 0, covers: () => false }

/**
 * What the reach covers: on a 25 m grid, every cell a reached way passes
 * through, and every cell those ways close off from the outside (city blocks,
 * parks, the river between two bridges). Dead ends and bays open to the
 * outside are left out.
 */
export function reachCover(reach: Reach): ReachCover {
  const first = reach.features[0]?.geometry.coordinates[0]?.[0]
  if (!first) return NOTHING
  const kx = M_PER_DEG * Math.cos((first[1] * Math.PI) / 180)
  const lines = reach.features.flatMap((feature) =>
    feature.geometry.coordinates.map((line) => line.map((p) => [p[0] * kx, p[1] * M_PER_DEG])),
  )
  let [minX, minY, maxX, maxY] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]
  for (const line of lines)
    for (const [x, y] of line) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  const cell = Math.max(CELL, Math.sqrt(((maxX - minX) * (maxY - minY)) / MAX_CELLS))
  // A free cell all round, so the outside is one piece to flood from a corner.
  const width = Math.floor((maxX - minX) / cell) + 3
  const height = Math.floor((maxY - minY) / cell) + 3
  const OUTSIDE = 2
  const grid = new Uint8Array(width * height)
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]]
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (cell / 2)))
      for (let k = 0; k <= steps; k++) {
        const x = Math.floor((a[0] + ((b[0] - a[0]) * k) / steps - minX) / cell) + 1
        const y = Math.floor((a[1] + ((b[1] - a[1]) * k) / steps - minY) / cell) + 1
        grid[y * width + x] = 1
      }
    }
  }
  const stack = [0]
  grid[0] = OUTSIDE
  let outside = 1
  while (stack.length) {
    const i = stack.pop() as number
    const x = i % width
    for (const next of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
      if (next >= 0 && next < grid.length && grid[next] === 0) {
        grid[next] = OUTSIDE
        outside++
        stack.push(next)
      }
    }
  }
  const near = Math.ceil(NEAR / cell)
  const covers = (lon: number, lat: number) => {
    const cx = Math.floor((lon * kx - minX) / cell) + 1
    const cy = Math.floor((lat * M_PER_DEG - minY) / cell) + 1
    for (let y = Math.max(0, cy - near); y <= Math.min(height - 1, cy + near); y++)
      for (let x = Math.max(0, cx - near); x <= Math.min(width - 1, cx + near); x++)
        if (grid[y * width + x] !== OUTSIDE) return true
    return false
  }
  return { area: (grid.length - outside) * cell * cell, covers }
}

/** The places in a flat [lon, lat, lon, lat, ...] list that the reach covers. */
export function coveredPoints(flat: readonly number[], cover: ReachCover): LngLat[] {
  const points: LngLat[] = []
  for (let i = 0; i < flat.length; i += 2) if (cover.covers(flat[i], flat[i + 1])) points.push([flat[i], flat[i + 1]])
  return points
}
