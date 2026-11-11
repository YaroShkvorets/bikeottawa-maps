import type { Route } from '../route/brouter'

const WIDTH = 320
const HEIGHT = 56
/** Keeps a flat route from looking like a mountain stage. */
const MIN_RANGE_M = 20

type Point = Route['coords'][number]

function metresBetween([lon1, lat1]: Point, [lon2, lat2]: Point): number {
  const rad = Math.PI / 180
  const x = (lon2 - lon1) * rad * Math.cos(((lat1 + lat2) / 2) * rad)
  const y = (lat2 - lat1) * rad
  return Math.hypot(x, y) * 6371000
}

/** Elevation against distance, or null when the route has no elevation data. */
export function elevationProfile(coords: Route['coords']): { x: number; ele: number }[] | null {
  const profile: { x: number; ele: number }[] = []
  let travelled = 0
  coords.forEach((point, i) => {
    if (i > 0) travelled += metresBetween(coords[i - 1], point)
    if (point[2] !== undefined) profile.push({ x: travelled, ele: point[2] })
  })
  return profile.length > 1 && travelled > 0 ? profile : null
}

export function ElevationChart({ route, label }: { route: Route; label: string }) {
  const profile = elevationProfile(route.coords)
  if (!profile) return null
  const low = Math.min(...profile.map((p) => p.ele))
  const high = Math.max(...profile.map((p) => p.ele))
  const range = Math.max(high - low, MIN_RANGE_M)
  const length = profile[profile.length - 1].x
  const line = profile.map(
    (p) => `${((p.x / length) * WIDTH).toFixed(1)},${(HEIGHT - 4 - ((p.ele - low) / range) * (HEIGHT - 8)).toFixed(1)}`,
  )
  return (
    <figure className="elevation">
      <figcaption>
        <span>{label}</span>
        <span>
          {Math.round(low)}–{Math.round(high)} m
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${Math.round(low)}–${Math.round(high)} m`}
      >
        <path d={`M0,${HEIGHT} L${line.join(' L')} L${WIDTH},${HEIGHT} Z`} className="elevation-area" />
        <path d={`M${line.join(' L')}`} className="elevation-line" />
      </svg>
    </figure>
  )
}
