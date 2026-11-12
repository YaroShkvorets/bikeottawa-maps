/** The switchable data layers and their colours. Shared by the map style and the legend. */

export const LAYER_IDS = ['places', 'comfort', 'winter', 'night', 'collisions'] as const
export type LayerId = (typeof LAYER_IDS)[number]

export const BASEMAP_IDS = ['light', 'grey', 'dark', 'satellite'] as const
export type BasemapId = (typeof BASEMAP_IDS)[number]

export const INK = '#16242B'

/** Level of traffic stress 1 to 4. */
export const LTS_COLORS = ['#1B5FAE', '#62B0E8', '#F2A33A', '#B5341F'] as const

/** Where cycling is not permitted, e.g. a sidewalk on a route. */
export const NO_BIKES_COLOR = '#8A949A'

/** Street light, for the night layer: soft warm white (LED) on dark ground, a deeper amber where the ground is pale. */
export const LAMP_COLOR = '#FFF0D2'
export const LAMP_COLOR_ON_PALE = '#D9730D'

export function lampColor(basemap: BasemapId): string {
  return basemap === 'light' || basemap === 'grey' ? LAMP_COLOR_ON_PALE : LAMP_COLOR
}

/**
 * How far you get: minutes of riding, closest first. One blue, strongest where
 * it is closest, so it fades out against pale ground and lights up on dark.
 */
export const REACH_RAMP_ON_PALE = ['#104281', '#1C5CAB', '#2A78D6', '#5598E7', '#86B6EF'] as const
export const REACH_RAMP_ON_DARK = ['#CDE2FB', '#9EC5F4', '#6DA7EC', '#3987E5', '#256ABF'] as const

export function reachRamp(basemap: BasemapId): readonly string[] {
  return basemap === 'light' || basemap === 'grey' ? REACH_RAMP_ON_PALE : REACH_RAMP_ON_DARK
}

/**
 * Collisions by worst injury, none to fatal. Damage only is grey; injuries run
 * through one red, the worst standing out most: darkest on pale ground,
 * brightest on dark ground. Size carries severity too.
 */
const COLLISIONS_ON_PALE = { none: '#9AA1A6', minimal: '#F29470', minor: '#E2603A', major: '#BC2F1F', fatal: '#741012' }
const COLLISIONS_ON_DARK = { none: '#6F777B', minimal: '#7A3B2E', minor: '#B5442C', major: '#EE6A45', fatal: '#FFB199' }

export function collisionColors(basemap: BasemapId): Record<'none' | 'minimal' | 'minor' | 'major' | 'fatal', string> {
  return basemap === 'light' || basemap === 'grey' ? COLLISIONS_ON_PALE : COLLISIONS_ON_DARK
}

/**
 * The bike lanes overlay, drawn as on Google Maps: dedicated ways dark green,
 * painted lanes a lighter green, shared lanes (painted too) the same green dotted.
 * Brighter on dark ground.
 */
export const BIKEWAY_IDS = ['dedicated', 'lane', 'shared'] as const
export type BikewayId = (typeof BIKEWAY_IDS)[number]
const BIKEWAYS_ON_PALE: Record<BikewayId, string> = { dedicated: '#1E7B34', lane: '#5DBB63', shared: '#5DBB63' }
const BIKEWAYS_ON_DARK: Record<BikewayId, string> = { dedicated: '#3FB560', lane: '#A3E3A6', shared: '#A3E3A6' }

export function bikewayColors(basemap: BasemapId): Record<BikewayId, string> {
  return basemap === 'light' || basemap === 'grey' ? BIKEWAYS_ON_PALE : BIKEWAYS_ON_DARK
}

export function isBikewayId(value: unknown): value is BikewayId {
  return BIKEWAY_IDS.includes(value as BikewayId)
}

export const WINTER_COLORS = { yes: '#1B5FAE', no: '#E07B1A', unknown: '#6F7B80' } as const

export function isBasemapId(value: unknown): value is BasemapId {
  return BASEMAP_IDS.includes(value as BasemapId)
}

export function isLayerId(value: unknown): value is LayerId {
  return LAYER_IDS.includes(value as LayerId)
}
