import { REGION } from '../config'
import type { Lang } from '../i18n'
import type { LngLat } from './brouter'

export interface Place {
  label: string
  lngLat: LngLat
}

/** A Photon server, the OpenStreetMap search engine; Komoot's public one unless VITE_GEOCODER_URL says otherwise. */
const GEOCODER_URL: string = (import.meta.env.VITE_GEOCODER_URL ?? 'https://photon.komoot.io').replace(/\/$/, '')
/** How far from a point, in kilometres, an address still counts as being there. */
const REVERSE_RADIUS_KM = 0.3

export interface PhotonProperties {
  name?: string
  housenumber?: string
  street?: string
  city?: string
  district?: string
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: PhotonProperties
}

/** "Name, 123 Street, District" from whatever parts a search result has. */
export function placeLabel({ name, housenumber, street, city, district }: PhotonProperties): string {
  const address = [housenumber, street].filter(Boolean).join(' ')
  return [name, address, district ?? city].filter((part, i, all) => part && all.indexOf(part) === i).join(', ')
}

/**
 * Label for a point picked on the map: the nearest address rather than the
 * nearest named place, since the point is beside the shop, not in it.
 */
export function addressLabel({ name, housenumber, street, city, district }: PhotonProperties): string {
  const address = [housenumber, street].filter(Boolean).join(' ')
  return [address || name, district ?? city].filter(Boolean).join(', ')
}

/** Places matching `query` inside the region, nearest to its centre first. */
export async function searchPlaces(query: string, lang: Lang, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    lang,
    limit: '5',
    bbox: REGION.bbox.join(','),
    lon: String(REGION.center[0]),
    lat: String(REGION.center[1]),
  })
  const res = await fetch(`${GEOCODER_URL}/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const { features } = (await res.json()) as { features: PhotonFeature[] }
  return features
    .map((f) => ({ label: placeLabel(f.properties), lngLat: f.geometry.coordinates }))
    .filter((place, i, all) => place.label && all.findIndex((other) => other.label === place.label) === i)
}

/** The address nearest to a point, or null when there is none close by. */
/**
 * The public Photon server refuses more than about four requests at a time, and
 * a route with via points asks for several addresses at once, so lookups wait
 * their turn.
 */
const MAX_PARALLEL_LOOKUPS = 2
let lookupsRunning = 0
const lookupsWaiting: (() => void)[] = []

async function inTurn<T>(task: () => Promise<T>): Promise<T> {
  while (lookupsRunning >= MAX_PARALLEL_LOOKUPS) await new Promise<void>((resolve) => lookupsWaiting.push(resolve))
  lookupsRunning++
  try {
    return await task()
  } finally {
    lookupsRunning--
    lookupsWaiting.shift()?.()
  }
}

export function reverseLabel(lngLat: LngLat, lang: Lang, signal?: AbortSignal): Promise<string | null> {
  return inTurn(() => lookUpAddress(lngLat, lang, signal))
}

async function lookUpAddress(lngLat: LngLat, lang: Lang, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    lon: String(lngLat[0]),
    lat: String(lngLat[1]),
    lang,
    limit: '1',
    radius: String(REVERSE_RADIUS_KM),
  })
  const res = await fetch(`${GEOCODER_URL}/reverse?${params}`, { signal })
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`)
  const { features } = (await res.json()) as { features: PhotonFeature[] }
  return (features[0] && addressLabel(features[0].properties)) || null
}
