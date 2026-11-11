import type { PointerEvent } from 'react'
import { type ProfilePoint, pointAtDistance } from '../route/profile'

const WIDTH = 320
const HEIGHT = 56
/** Keeps a flat route from looking like a mountain stage. */
const MIN_RANGE_M = 20

interface Props {
  profile: ProfilePoint[]
  label: string
  /** Metres along the route being pointed at, here or on the map. */
  hover: number | null
  onHover: (distance: number | null) => void
}

/** Elevation against distance. Pointing at it marks the spot on the map, and the other way round. */
export function ElevationChart({ profile, label, hover, onHover }: Props) {
  const points = profile.filter((p): p is ProfilePoint & { ele: number } => p.ele !== undefined)
  const length = profile.at(-1)?.distance ?? 0
  if (points.length < 2 || length === 0) return null

  const low = Math.min(...points.map((p) => p.ele))
  const high = Math.max(...points.map((p) => p.ele))
  const range = Math.max(high - low, MIN_RANGE_M)
  const yOf = (ele: number) => HEIGHT - 4 - ((ele - low) / range) * (HEIGHT - 8)
  const line = points.map((p) => `${((p.distance / length) * WIDTH).toFixed(1)},${yOf(p.ele).toFixed(1)}`)

  const spot = hover === null ? null : pointAtDistance(profile, hover)
  const pointTo = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    onHover(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * length)
  }

  return (
    <figure className="elevation">
      <figcaption>
        <span>{label}</span>
        <span>
          {spot?.ele !== undefined
            ? `${(spot.distance / 1000).toFixed(1)} km · ${Math.round(spot.ele)} m`
            : `${Math.round(low)}–${Math.round(high)} m`}
        </span>
      </figcaption>
      <div
        className="elevation-plot"
        onPointerMove={pointTo}
        onPointerDown={pointTo}
        onPointerLeave={() => onHover(null)}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${label}: ${Math.round(low)}–${Math.round(high)} m`}
        >
          <path d={`M0,${HEIGHT} L${line.join(' L')} L${WIDTH},${HEIGHT} Z`} className="elevation-area" />
          <path d={`M${line.join(' L')}`} className="elevation-line" />
        </svg>
        {spot?.ele !== undefined && (
          <>
            <span className="elevation-cursor" style={{ left: `${(spot.distance / length) * 100}%` }} />
            <span
              className="elevation-dot"
              style={{ left: `${(spot.distance / length) * 100}%`, top: `${(yOf(spot.ele) / HEIGHT) * 100}%` }}
            />
          </>
        )}
      </div>
    </figure>
  )
}
