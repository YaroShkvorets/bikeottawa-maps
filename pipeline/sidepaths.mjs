// Whether a street has a cycleway drawn alongside it. OSM marks that with
// `cycleway=separate`, but some streets say `cycleway=track` while the track is
// also mapped as a way of its own; drawing both would show the track twice.

const CELL = 0.001 // degrees, about 80 m east-west and 110 m north-south here
const M_PER_DEG_LAT = 111_000

const cellOf = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`

/** Distance in metres from point p to segment ab, all [lng, lat]. */
function distance(p, a, b) {
  const kx = M_PER_DEG_LAT * Math.cos((p[1] * Math.PI) / 180)
  const [px, py, ax, ay, bx, by] = [
    p[0] * kx,
    p[1] * M_PER_DEG_LAT,
    a[0] * kx,
    a[1] * M_PER_DEG_LAT,
    b[0] * kx,
    b[1] * M_PER_DEG_LAT,
  ]
  const dx = bx - ax
  const dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/** Points along a line no more than about `step` metres apart. */
function samples(coords, step = 10) {
  const out = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    const [a, b] = [coords[i - 1], coords[i]]
    const n = Math.max(1, Math.ceil(distance(a, b, b) / step))
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

/**
 * @param {number[][][]} cycleways the lines of every cycleway
 * @returns {(coords: number[][], within?: number) => boolean} whether most of a
 *   line lies within `within` metres (20 by default) of one of them
 */
export function sidepathIndex(cycleways) {
  const cells = new Map()
  for (const line of cycleways) {
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]]
      for (let x = Math.floor(Math.min(a[0], b[0]) / CELL); x <= Math.floor(Math.max(a[0], b[0]) / CELL); x++) {
        for (let y = Math.floor(Math.min(a[1], b[1]) / CELL); y <= Math.floor(Math.max(a[1], b[1]) / CELL); y++) {
          const key = `${x},${y}`
          if (!cells.has(key)) cells.set(key, [])
          cells.get(key).push([a, b])
        }
      }
    }
  }
  const near = (p, within) => {
    const [cx, cy] = cellOf(p[0], p[1]).split(',').map(Number)
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (const [a, b] of cells.get(`${x},${y}`) ?? []) if (distance(p, a, b) <= within) return true
      }
    }
    return false
  }
  return (coords, within = 20) => {
    const points = samples(coords)
    return points.filter((p) => near(p, within)).length / points.length >= 0.5
  }
}
