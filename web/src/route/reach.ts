import type { FeatureCollection, MultiLineString } from 'geojson'
import { type LngLat, RouteError } from './brouter'
import { PARAM_KEYS, type RouteParams } from './styles'

/**
 * How far you get by bike in a given time: every way reachable from a start
 * point, following the routes a riding style would take. The router answers
 * with one MultiLineString per minute of riding (property `minutes`).
 */
export type Reach = FeatureCollection<MultiLineString, { minutes: number }>

/** Riding times on offer, in minutes. The router stops at 30. */
export const REACH_MINUTES = [10, 15, 20, 30] as const
export type ReachMinutes = (typeof REACH_MINUTES)[number]
export const DEFAULT_REACH_MINUTES: ReachMinutes = 15

export function isReachMinutes(value: unknown): value is ReachMinutes {
  return REACH_MINUTES.includes(Number(value) as ReachMinutes)
}

/** BRouter's isochrone mode, added by routing/brouter/isochrone.patch. */
const ISOCHRONE_MODE = 5

export function reachUrl(base: string, start: LngLat, minutes: number, params: RouteParams): string {
  const tuning = PARAM_KEYS.map((key) => `profile:${key}=${params[key]}`).join('&')
  return `${base}?lonlats=${start[0].toFixed(6)},${start[1].toFixed(6)}&profile=ottbike&engineMode=${ISOCHRONE_MODE}&isochroneTime=${minutes * 60}&format=geojson&${tuning}`
}

export async function fetchReach(
  base: string,
  start: LngLat,
  minutes: number,
  params: RouteParams,
  signal?: AbortSignal,
): Promise<Reach> {
  const res = await fetch(reachUrl(base, start, minutes, params), { signal })
  if (!res.ok) throw new RouteError((await res.text()).trim() || `Routing failed (${res.status})`)
  const data = await res.json()
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new RouteError('This routing server cannot show how far you get.')
  }
  return data as Reach
}
