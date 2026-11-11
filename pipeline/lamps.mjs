// Works out which streets and paths are lit, from the street lamps mapped along them.

const EARTH_RADIUS_M = 6371000
const RAD = Math.PI / 180
/** A lamp this close to a point on a way lights it: across a wide road, or just off a path. */
export const LAMP_REACH_M = 22
/** How often along a way to look for a lamp. */
const STEP_M = 10

/**
 * An index of lamp positions that answers "is there a lamp within reach of this point?".
 * Positions are flattened to metres around the first lamp, which is plenty at city scale.
 * @param {[number, number][]} lamps [lon, lat] of each lamp
 */
export function lampIndex(lamps, reach = LAMP_REACH_M) {
  const [lon0, lat0] = lamps[0] ?? [0, 0]
  const kx = RAD * EARTH_RADIUS_M * Math.cos(lat0 * RAD)
  const ky = RAD * EARTH_RADIUS_M
  const toMetres = ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky]
  const cellOf = (v) => Math.floor(v / reach)

  // Lamps bucketed into square cells one reach wide, so a lookup checks nine cells.
  const cells = new Map()
  for (const lamp of lamps) {
    const [x, y] = toMetres(lamp)
    const key = `${cellOf(x)},${cellOf(y)}`
    const cell = cells.get(key)
    if (cell) cell.push(x, y)
    else cells.set(key, [x, y])
  }

  const near = (x, y) => {
    const cx = cellOf(x)
    const cy = cellOf(y)
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cy - 1; j <= cy + 1; j++) {
        const cell = cells.get(`${i},${j}`)
        if (!cell) continue
        for (let k = 0; k < cell.length; k += 2) {
          if ((cell[k] - x) ** 2 + (cell[k + 1] - y) ** 2 <= reach * reach) return true
        }
      }
    }
    return false
  }

  /**
   * The share of a line's length, 0 to 1, that has a lamp within reach.
   * @param {[number, number][]} coordinates
   */
  const litShare = (coordinates) => {
    if (lamps.length === 0 || coordinates.length === 0) return 0
    let samples = 0
    let lit = 0
    let previous = toMetres(coordinates[0])
    const look = (x, y) => {
      samples++
      if (near(x, y)) lit++
    }
    look(previous[0], previous[1])
    for (let i = 1; i < coordinates.length; i++) {
      const next = toMetres(coordinates[i])
      const length = Math.hypot(next[0] - previous[0], next[1] - previous[1])
      const steps = Math.max(1, Math.round(length / STEP_M))
      for (let s = 1; s <= steps; s++) {
        look(previous[0] + ((next[0] - previous[0]) * s) / steps, previous[1] + ((next[1] - previous[1]) * s) / steps)
      }
      previous = next
    }
    return lit / samples
  }

  return { litShare }
}

/** A way counts as lit when lamps cover at least this share of it, or it is tagged as lit. */
export const LIT_SHARE = 0.5

/** Whether a way is lit: its `lit` tag settles it, otherwise the lamps along it do. */
export function isLit(tags, share) {
  if (tags.lit === 'no') return false
  if (tags.lit !== undefined) return true
  return share >= LIT_SHARE
}
