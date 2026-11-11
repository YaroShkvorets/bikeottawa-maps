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
