import region from '../../region.json'

export const REGION = {
  name: region.name,
  bbox: region.bbox as [number, number, number, number],
  center: region.center as [number, number],
}

/** Where the pipeline output is served from. Override with VITE_ASSETS_BASE to use a CDN. */
export const ASSETS_BASE: string = new URL(
  import.meta.env.VITE_ASSETS_BASE ?? import.meta.env.BASE_URL,
  window.location.href,
).href.replace(/\/$/, '')
