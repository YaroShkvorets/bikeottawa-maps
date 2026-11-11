/**
 * Photos of places, from what a mapper linked in OSM: `mapillary=<image id>`
 * (often several, separated by ;), `image=<url>` or `wikimedia_commons=<page>`.
 */

/** The first Mapillary image id in a place's `mapillary` tag. */
export function mapillaryId(value: unknown): string | null {
  const first = String(value ?? '')
    .split(';')[0]
    .trim()
  return /^\d{6,}$/.test(first) ? first : null
}

/** A web link from a place's `image` tag, if it is one. */
export function imageLink(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return /^https?:\/\/\S+$/.test(text) ? text : null
}

/** An `image` link that is itself a picture (many are web pages, e.g. Google Photos albums). */
export function directImage(value: unknown): string | null {
  const link = imageLink(value)
  return link && /\.(jpe?g|png|webp)(\?\S*)?$/i.test(link) ? link : null
}

/** The Wikimedia Commons page a `wikimedia_commons` tag names (a file or a category). */
export function commonsLink(value: unknown): string | null {
  const page = String(value ?? '').trim()
  return /^(File|Category):\S/.test(page)
    ? `https://commons.wikimedia.org/wiki/${encodeURI(page.replaceAll(' ', '_'))}`
    : null
}

export function mapillaryViewerUrl(id: string): string {
  return `https://www.mapillary.com/app/?pKey=${id}&focus=photo`
}

/** Google Street View at the panorama nearest a point. */
export function streetViewUrl([lon, lat]: readonly [number, number]): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}`
}

export interface Photo {
  /** The image, sized for the card. Mapillary's links expire, so they are fetched when needed. */
  url: string
  /** A larger copy, for viewing it over the map. */
  largeUrl: string
  /** Who or where it is from, for the credit line. */
  credit: string
  /** Where to see it at its source. */
  link: string
}

export async function fetchMapillaryPhoto(id: string, token: string, signal?: AbortSignal): Promise<Photo | null> {
  const params = new URLSearchParams({ fields: 'thumb_1024_url,thumb_2048_url,creator', access_token: token })
  const res = await fetch(`https://graph.mapillary.com/${id}?${params}`, { signal })
  if (!res.ok) return null
  const data = (await res.json()) as {
    thumb_1024_url?: string
    thumb_2048_url?: string
    creator?: { username?: string }
  }
  if (!data.thumb_1024_url) return null
  const by = data.creator?.username
  return {
    url: data.thumb_1024_url,
    largeUrl: data.thumb_2048_url ?? data.thumb_1024_url,
    credit: by ? `© ${by} · Mapillary` : '© Mapillary',
    link: mapillaryViewerUrl(id),
  }
}

/** A picture linked directly, credited to the site it is on. */
export function directPhoto(url: string): Photo {
  const host = new URL(url).hostname.replace(/^(www|storage\d*)\./, '')
  return { url, largeUrl: url, credit: host, link: url }
}
