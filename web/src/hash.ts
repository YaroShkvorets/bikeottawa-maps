/**
 * App state lives in the URL hash next to MapLibre's own `map=zoom/lat/lng` entry,
 * e.g. `#map=13/45.42/-75.69&layer=winter`. Values are kept unencoded so the
 * map entry stays readable.
 */

export function parseHash(hash: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of hash.replace(/^#/, '').split('&')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1)
  }
  return out
}

/** Returns `hash` with `key` set to `value` (or removed when null), leaving other entries untouched. */
export function withHashParam(hash: string, key: string, value: string | null): string {
  const parts = hash.replace(/^#/, '').split('&').filter(Boolean)
  const entry = value === null ? null : `${key}=${value}`
  const i = parts.findIndex((p) => p.startsWith(`${key}=`))
  if (i >= 0) {
    if (entry) parts[i] = entry
    else parts.splice(i, 1)
  } else if (entry) {
    parts.push(entry)
  }
  return parts.length ? `#${parts.join('&')}` : ''
}

/**
 * openstreetmap.org at the map's current view, read from the `map=zoom/lat/lng`
 * entry. OSM zooms count 256 px tiles, MapLibre's 512 px ones, hence the +1.
 */
export function osmViewUrl(hash: string): string {
  const [zoom, lat, lng] = (parseHash(hash).map ?? '').split('/').map(Number)
  if (![zoom, lat, lng].every(Number.isFinite)) return 'https://www.openstreetmap.org/'
  const z = Math.min(19, Math.max(0, Math.round(zoom + 1)))
  return `https://www.openstreetmap.org/#map=${z}/${lat}/${lng}`
}
