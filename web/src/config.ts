import region from '../../region.json'

export const REGION = {
  name: region.name,
  bbox: region.bbox as [number, number, number, number],
  center: region.center as [number, number],
  /** Opening hours are read in the region's time, wherever the viewer is. */
  timeZone: region.timeZone,
}

/** Where the pipeline output is served from. Override with VITE_ASSETS_BASE to use a CDN. */
export const ASSETS_BASE: string = new URL(
  import.meta.env.VITE_ASSETS_BASE ?? import.meta.env.BASE_URL,
  window.location.href,
).href.replace(/\/$/, '')

/** BRouter endpoint for the route planner; the planner is hidden when unset. */
export const ROUTER_URL: string | null = import.meta.env.VITE_ROUTER_URL
  ? new URL(import.meta.env.VITE_ROUTER_URL, window.location.href).href
  : null
