import { REGION } from '../config'
import type { Lang } from '../i18n'
import type { LngLat } from './brouter'

export interface Place {
  label: string
  lngLat: LngLat
}

/** Photon, the OpenStreetMap search engine run by Komoot. Override with VITE_GEOCODER_URL. */
const GEOCODER_URL: string = import.meta.env.VITE_GEOCODER_URL ?? 'https://photon.komoot.io/api/'

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; housenumber?: string; street?: string; city?: string; district?: string }
}

function labelOf({ name, housenumber, street, city, district }: PhotonFeature['properties']): string {
  const address = [housenumber, street].filter(Boolean).join(' ')
  return [name, address, district ?? city].filter((part, i, all) => part && all.indexOf(part) === i).join(', ')
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
  const res = await fetch(`${GEOCODER_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const { features } = (await res.json()) as { features: PhotonFeature[] }
  return features
    .map((f) => ({ label: labelOf(f.properties), lngLat: f.geometry.coordinates }))
    .filter((place, i, all) => place.label && all.findIndex((other) => other.label === place.label) === i)
}
