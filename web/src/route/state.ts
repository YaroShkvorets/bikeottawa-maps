import type { LngLat } from './brouter'
import { PARAM_KEYS, type RouteParams } from './styles'

/** A start or end of the route; `label` is the place name when it came from search. */
export interface RoutePoint {
  lngLat: LngLat
  label?: string
}

/** Start and end, either of which may still be unset. */
export type RoutePoints = [RoutePoint | null, RoutePoint | null]

const round = (v: number) => Math.round(v * 1e5) / 1e5

/** `-75.7,45.41;-75.66,45.43`, with an empty slot for a point not set yet. */
export function formatPoints(points: RoutePoints): string | null {
  if (!points[0] && !points[1]) return null
  return points.map((p) => (p ? `${round(p.lngLat[0])},${round(p.lngLat[1])}` : '')).join(';')
}

export function parsePoints(text: string | undefined): RoutePoints {
  const [a, b] = (text ?? '').split(';').map((part): RoutePoint | null => {
    const [lon, lat] = part.split(',').map(Number)
    const valid =
      part.includes(',') && Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90
    return valid ? { lngLat: [lon, lat] } : null
  })
  return [a ?? null, b ?? null]
}

export function formatParams(params: RouteParams): string {
  return PARAM_KEYS.map((key) => params[key]).join(',')
}

/** Reads custom weights, falling back to `fallback` for anything missing or out of range. */
export function parseParams(text: string | undefined, fallback: RouteParams): RouteParams {
  const values = (text ?? '').split(',').map(Number)
  const params = { ...fallback }
  PARAM_KEYS.forEach((key, i) => {
    const value = values[i]
    if (text && Number.isFinite(value) && value >= 0 && value <= 1) params[key] = value
  })
  return params
}
