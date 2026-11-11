import type { LngLat, Route } from './brouter'

/** A point of the route with how far along it is. */
export interface ProfilePoint {
  /** Metres from the start. */
  distance: number
  lngLat: LngLat
  /** Metres above sea level, when known. */
  ele?: number
}

const EARTH_RADIUS_M = 6371000
const RAD = Math.PI / 180

/** Offset of `b` from `a` in metres, east and north. Accurate enough at city scale. */
function offset(a: LngLat, b: LngLat): [number, number] {
  return [
    (b[0] - a[0]) * RAD * Math.cos(((a[1] + b[1]) / 2) * RAD) * EARTH_RADIUS_M,
    (b[1] - a[1]) * RAD * EARTH_RADIUS_M,
  ]
}

/** The route's points with their distance along it. */
export function routeProfile(coords: Route['coords']): ProfilePoint[] {
  let travelled = 0
  return coords.map(([lon, lat, ele], i) => {
    if (i > 0) travelled += Math.hypot(...offset([coords[i - 1][0], coords[i - 1][1]], [lon, lat]))
    return { distance: travelled, lngLat: [lon, lat], ele }
  })
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Where the route is `distance` metres from the start, clamped to its ends. */
export function pointAtDistance(profile: ProfilePoint[], distance: number): ProfilePoint | null {
  if (profile.length === 0) return null
  if (distance <= 0) return profile[0]
  const last = profile[profile.length - 1]
  if (distance >= last.distance) return last
  // Binary search for the stretch that contains the distance.
  let low = 0
  let high = profile.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (profile[mid].distance <= distance) low = mid
    else high = mid
  }
  const a = profile[low]
  const b = profile[high]
  const t = b.distance > a.distance ? (distance - a.distance) / (b.distance - a.distance) : 0
  return {
    distance,
    lngLat: [lerp(a.lngLat[0], b.lngLat[0], t), lerp(a.lngLat[1], b.lngLat[1], t)],
    ele: a.ele !== undefined && b.ele !== undefined ? lerp(a.ele, b.ele, t) : (a.ele ?? b.ele),
  }
}

/** The point of the route closest to `lngLat`, and how many metres off the route that is. */
export function nearestOnRoute(profile: ProfilePoint[], lngLat: LngLat): { point: ProfilePoint; off: number } | null {
  let best: { distance: number; off: number } | null = null
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1]
    const b = profile[i]
    const [bx, by] = offset(a.lngLat, b.lngLat)
    const [px, py] = offset(a.lngLat, lngLat)
    const length2 = bx * bx + by * by
    const t = length2 > 0 ? Math.min(1, Math.max(0, (px * bx + py * by) / length2)) : 0
    const off = Math.hypot(px - bx * t, py - by * t)
    if (!best || off < best.off) best = { distance: lerp(a.distance, b.distance, t), off }
  }
  if (!best) return null
  const point = pointAtDistance(profile, best.distance)
  return point && { point, off: best.off }
}

/** Half-width of the stretch each smoothed elevation is averaged over, in metres. */
const SMOOTHING_RADIUS_M = 100

/**
 * The profile with its elevations averaged over the surrounding stretch of route.
 * The elevation data is a 30 m grid that catches buildings and trees, which shows
 * up as a sawtooth; this keeps the hills and drops the noise.
 */
export function smoothElevation(profile: ProfilePoint[], radius = SMOOTHING_RADIUS_M): ProfilePoint[] {
  const known = profile.filter((p): p is ProfilePoint & { ele: number } => p.ele !== undefined)
  if (known.length < 2) return profile
  const start = known[0].distance
  const end = known[known.length - 1].distance
  // Short routes get a narrower window so they are not flattened altogether.
  const r = Math.min(radius, (end - start) / 10)
  if (r <= 0) return profile

  // Running integral of elevation over distance, so any window's average is one subtraction.
  const area = [0]
  for (let i = 1; i < known.length; i++) {
    area.push(area[i - 1] + ((known[i - 1].ele + known[i].ele) / 2) * (known[i].distance - known[i - 1].distance))
  }
  let cursor = 0
  const areaUpTo = (distance: number) => {
    // Windows only ever move forward a little or back by one width, so a cursor finds the stretch quickly.
    while (cursor > 0 && known[cursor].distance > distance) cursor--
    while (cursor < known.length - 2 && known[cursor + 1].distance <= distance) cursor++
    const a = known[cursor]
    const b = known[cursor + 1]
    const span = b.distance - a.distance
    const x = distance - a.distance
    const slope = span > 0 ? (b.ele - a.ele) / span : 0
    return area[cursor] + a.ele * x + (slope * x * x) / 2
  }

  return profile.map((point) => {
    if (point.ele === undefined) return point
    const from = Math.max(start, point.distance - r)
    const to = Math.min(end, point.distance + r)
    return to > from ? { ...point, ele: (areaUpTo(to) - areaUpTo(from)) / (to - from) } : point
  })
}
