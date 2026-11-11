/**
 * Street-level photos of places, from the image a mapper linked in OSM:
 * `mapillary=<image id>` (often several, separated by ;) or `image=<url>`.
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

export function mapillaryViewerUrl(id: string): string {
  return `https://www.mapillary.com/app/?pKey=${id}&focus=photo`
}

export interface Photo {
  /** The image, sized for the card. Mapillary's links expire, so they are fetched when needed. */
  url: string
  /** A larger copy, for viewing it over the map. */
  largeUrl: string
  /** Who took it, for the credit line. */
  by: string | null
  /** Where to see it full size. */
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
  return {
    url: data.thumb_1024_url,
    largeUrl: data.thumb_2048_url ?? data.thumb_1024_url,
    by: data.creator?.username ?? null,
    link: mapillaryViewerUrl(id),
  }
}
