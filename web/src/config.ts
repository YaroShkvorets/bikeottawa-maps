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

/**
 * Mapillary client token, to show the street-level photo a place links to.
 * Without one, place cards link to the photo instead.
 */
export const MAPILLARY_TOKEN: string | null = import.meta.env.VITE_MAPILLARY_TOKEN || null

/** Where the app's own data files (public/data) are served: always next to the app. */
export const DATA_BASE: string = new URL(import.meta.env.BASE_URL, window.location.href).href.replace(/\/$/, '')

/** BRouter endpoint for the route planner; the planner is hidden when unset. */
export const ROUTER_URL: string | null = import.meta.env.VITE_ROUTER_URL
  ? new URL(import.meta.env.VITE_ROUTER_URL, window.location.href).href
  : null
