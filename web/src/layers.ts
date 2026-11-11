/** The switchable data layers and their colours. Shared by the map style and the legend. */

export const LAYER_IDS = ['comfort', 'winter', 'places'] as const
export type LayerId = (typeof LAYER_IDS)[number]

export const PLACE_KINDS = ['parking', 'repair', 'shop', 'water', 'toilets'] as const
export type PlaceKind = (typeof PLACE_KINDS)[number]

export const INK = '#16242B'

/** Level of traffic stress 1 to 4. */
export const LTS_COLORS = ['#1B5FAE', '#62B0E8', '#F2A33A', '#B5341F'] as const

/** Where cycling is not permitted, e.g. a sidewalk on a route. */
export const NO_BIKES_COLOR = '#8A949A'

export const WINTER_COLORS = { yes: '#1B5FAE', no: '#E07B1A', unknown: '#6F7B80' } as const

export const PLACE_COLORS: Record<PlaceKind, string> = {
  parking: INK,
  repair: '#E07B1A',
  shop: '#8E3B8E',
  water: '#1B5FAE',
  toilets: '#4F7A32',
}

export function isLayerId(value: unknown): value is LayerId {
  return LAYER_IDS.includes(value as LayerId)
}
