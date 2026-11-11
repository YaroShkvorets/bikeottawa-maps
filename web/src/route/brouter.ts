import stressmodel from 'stressmodel/stressmodel.js'
import { PARAM_KEYS, type RouteParams } from './styles'

export type LngLat = [lon: number, lat: number]

/** A stretch of the route along one kind of way. */
/** Why a stretch is walked: a sidewalk closed to bikes, stairs, or anything else (dismount signs, no-bike paths). */
export type WalkKind = 'sidewalk' | 'stairs' | 'other'

export interface RouteSegment {
  coords: [number, number][]
  /** Metres. */
  distance: number
  /** Level of traffic stress 1-4, or 0 where the bike is walked. */
  lts: number
  /** What kind of walking a level-0 stretch is. */
  walk: WalkKind | null
  tags: Record<string, string>
}

export interface Route {
  /** [lon, lat, elevation in metres], elevation missing where unknown. */
  coords: [number, number, number?][]
  /** Metres. */
  distance: number
  /** Seconds. */
  time: number
  /** Metres climbed. */
  ascent: number
  segments: RouteSegment[]
}

export class RouteError extends Error {}

const PROFILE = 'ottbike'

export function routeUrl(base: string, points: readonly LngLat[], params: RouteParams): string {
  const lonlats = points.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join('|')
  const tuning = PARAM_KEYS.map((key) => `profile:${key}=${params[key]}`).join('&')
  return `${base}?lonlats=${lonlats}&profile=${PROFILE}&alternativeidx=0&format=geojson&${tuning}`
}

function parseTags(text: string): Record<string, string> {
  const tags: Record<string, string> = {}
  for (const pair of text.split(' ')) {
    const i = pair.indexOf('=')
    // reversedirection is BRouter's own marker, not an OSM tag.
    if (i > 0 && !pair.startsWith('reversedirection=')) tags[pair.slice(0, i)] = pair.slice(i + 1)
  }
  return tags
}

/**
 * Stress level of a stretch of route (0 = the bike is walked) and, for walked
 * stretches, why. The stress model rates stairs and dismount sections as
 * paths, so those are caught here.
 */
export function rateStretch(tags: Record<string, string>): { lts: number; walk: WalkKind | null } {
  if (tags.highway === 'steps') return { lts: 0, walk: 'stairs' }
  if (tags.bicycle === 'dismount') return { lts: 0, walk: 'other' }
  const lts = stressmodel.evaluateLTS({ tags }).lts
  if (lts > 0) return { lts, walk: null }
  return { lts, walk: tags.footway === 'sidewalk' ? 'sidewalk' : 'other' }
}

/** Turns BRouter's GeoJSON answer into a route split into segments by way. */
export function parseRoute(geojson: unknown): Route {
  const feature = (
    geojson as { features?: { properties: Record<string, unknown>; geometry: { coordinates: number[][] } }[] }
  ).features?.[0]
  if (!feature) throw new RouteError('No route in response')
  const props = feature.properties
  const coords = feature.geometry.coordinates as [number, number, number?][]

  // The first row names the columns; each later row describes the stretch
  // ending at its Longitude/Latitude (in millionths of a degree).
  const [header, ...rows] = (props.messages ?? [[]]) as string[][]
  const col = (name: string) => header.indexOf(name)
  const [iLon, iLat, iDist, iTags] = [col('Longitude'), col('Latitude'), col('Distance'), col('WayTags')]

  const segments: RouteSegment[] = []
  let start = 0
  for (const row of rows) {
    const lon = Number(row[iLon])
    const lat = Number(row[iLat])
    let end = start
    while (
      end < coords.length &&
      (Math.round(coords[end][0] * 1e6) !== lon || Math.round(coords[end][1] * 1e6) !== lat)
    )
      end++
    // A row that matches no point is skipped rather than guessed at.
    if (end >= coords.length || end === start) continue
    const tags = parseTags(row[iTags] ?? '')
    segments.push({
      coords: coords.slice(start, end + 1).map(([x, y]) => [x, y]),
      distance: Number(row[iDist]),
      ...rateStretch(tags),
      tags,
    })
    start = end
  }

  return {
    coords,
    distance: Number(props['track-length']),
    time: Number(props['total-time']),
    ascent: Math.max(0, Number(props['filtered ascend'])),
    segments,
  }
}

export async function fetchRoute(
  base: string,
  points: readonly LngLat[],
  params: RouteParams,
  signal?: AbortSignal,
): Promise<Route> {
  const res = await fetch(routeUrl(base, points, params), { signal })
  // BRouter answers failures (no road nearby, outside the covered area) as plain text.
  if (!res.ok) throw new RouteError((await res.text()).trim() || `Routing failed (${res.status})`)
  const text = await res.text()
  try {
    return parseRoute(JSON.parse(text))
  } catch (cause) {
    throw cause instanceof RouteError ? cause : new RouteError(text.slice(0, 200))
  }
}

/** The parts of the comfort breakdown, most comfortable first. */
export const COMFORT_KEYS = ['lts1', 'lts2', 'lts3', 'lts4', 'sidewalk', 'stairs', 'other'] as const
export type ComfortKey = (typeof COMFORT_KEYS)[number]

/** Metres of the route in each part of the comfort breakdown. */
export function distanceByComfort(route: Route): Record<ComfortKey, number> {
  const totals: Record<ComfortKey, number> = { lts1: 0, lts2: 0, lts3: 0, lts4: 0, sidewalk: 0, stairs: 0, other: 0 }
  for (const segment of route.segments) {
    totals[segment.walk ?? (`lts${segment.lts}` as ComfortKey)] += segment.distance
  }
  return totals
}
