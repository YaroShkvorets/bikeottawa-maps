/** The switchable data layers and their colours. Shared by the map style and the legend. */

export const LAYER_IDS = ['comfort', 'winter', 'places'] as const
export type LayerId = (typeof LAYER_IDS)[number]

export const BASEMAP_IDS = ['light', 'grey', 'dark', 'satellite'] as const
export type BasemapId = (typeof BASEMAP_IDS)[number]

export const INK = '#16242B'

/** Level of traffic stress 1 to 4. */
export const LTS_COLORS = ['#1B5FAE', '#62B0E8', '#F2A33A', '#B5341F'] as const

/** Where cycling is not permitted, e.g. a sidewalk on a route. */
export const NO_BIKES_COLOR = '#8A949A'

export const WINTER_COLORS = { yes: '#1B5FAE', no: '#E07B1A', unknown: '#6F7B80' } as const

export function isBasemapId(value: unknown): value is BasemapId {
  return BASEMAP_IDS.includes(value as BasemapId)
}

export function isLayerId(value: unknown): value is LayerId {
  return LAYER_IDS.includes(value as LayerId)
}
