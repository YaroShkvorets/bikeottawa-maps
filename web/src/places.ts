/** The place kinds of the Places layer: their grouping, colours and icons. */
import alcoholShop from '@mapbox/maki/icons/alcohol-shop.svg?raw'
import bbq from '@mapbox/maki/icons/bbq.svg?raw'
import beach from '@mapbox/maki/icons/beach.svg?raw'
import beer from '@mapbox/maki/icons/beer.svg?raw'
import bicycle from '@mapbox/maki/icons/bicycle.svg?raw'
import cafe from '@mapbox/maki/icons/cafe.svg?raw'
import drinkingWater from '@mapbox/maki/icons/drinking-water.svg?raw'
import fastFood from '@mapbox/maki/icons/fast-food.svg?raw'
import iceCream from '@mapbox/maki/icons/ice-cream.svg?raw'
import information from '@mapbox/maki/icons/information.svg?raw'
import picnicSite from '@mapbox/maki/icons/picnic-site.svg?raw'
import restaurant from '@mapbox/maki/icons/restaurant.svg?raw'
import shelter from '@mapbox/maki/icons/shelter.svg?raw'
import telephone from '@mapbox/maki/icons/telephone.svg?raw'
import toilet from '@mapbox/maki/icons/toilet.svg?raw'
import viewpoint from '@mapbox/maki/icons/viewpoint.svg?raw'
import bench from '@rapideditor/temaki/icons/bench.svg?raw'
import bicycleParked from '@rapideditor/temaki/icons/bicycle_parked.svg?raw'
import bicycleRepair from '@rapideditor/temaki/icons/bicycle_repair.svg?raw'
import splashPad from '@rapideditor/temaki/icons/splash_pad.svg?raw'
import tire from '@rapideditor/temaki/icons/tire.svg?raw'

export const PLACE_GROUP_IDS = ['cycling', 'facilities', 'rest', 'food'] as const
export type PlaceGroupId = (typeof PLACE_GROUP_IDS)[number]

export const GROUP_COLORS: Record<PlaceGroupId, string> = {
  cycling: '#0B6E6E',
  facilities: '#1B5FAE',
  rest: '#4F7A32',
  food: '#A8480C',
}

/** Kind ids match the `kind` property written by pipeline/classify.mjs. Icons are 15x15 SVGs. */
const DEFS = {
  parking: { group: 'cycling', svg: bicycleParked },
  shop: { group: 'cycling', svg: bicycle },
  repair: { group: 'cycling', svg: bicycleRepair },
  air: { group: 'cycling', svg: tire },
  water: { group: 'facilities', svg: drinkingWater },
  toilets: { group: 'facilities', svg: toilet },
  shelter: { group: 'facilities', svg: shelter },
  telephone: { group: 'facilities', svg: telephone },
  information: { group: 'facilities', svg: information },
  bench: { group: 'rest', svg: bench },
  picnic: { group: 'rest', svg: picnicSite },
  bbq: { group: 'rest', svg: bbq },
  viewpoint: { group: 'rest', svg: viewpoint },
  splash: { group: 'rest', svg: splashPad },
  beach: { group: 'rest', svg: beach },
  cafe: { group: 'food', svg: cafe },
  restaurant: { group: 'food', svg: restaurant },
  fast_food: { group: 'food', svg: fastFood },
  ice_cream: { group: 'food', svg: iceCream },
  pub: { group: 'food', svg: beer },
  brewery: { group: 'food', svg: alcoholShop },
} as const satisfies Record<string, { group: PlaceGroupId; svg: string }>

export type PlaceKind = keyof typeof DEFS
export const PLACE_KINDS = Object.keys(DEFS) as PlaceKind[]

export function isPlaceKind(value: unknown): value is PlaceKind {
  return typeof value === 'string' && value in DEFS
}

export function placeGroup(kind: PlaceKind): PlaceGroupId {
  return DEFS[kind].group
}

export function placeColor(kind: PlaceKind): string {
  return GROUP_COLORS[DEFS[kind].group]
}

export function kindsInGroup(group: PlaceGroupId): PlaceKind[] {
  return PLACE_KINDS.filter((kind) => DEFS[kind].group === group)
}

/** Name of the map image for a kind's marker; with '' it is the prefix shared by all of them. */
export function placeImageId(kind: PlaceKind | ''): string {
  return `place-${kind}`
}

/** Size of the icons' coordinate system. */
export const ICON_SIZE = 15

/** The `d` of every path in an icon's SVG source. */
export function svgPaths(svg: string): string[] {
  return [...svg.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1].replace(/&#x[0-9A-Fa-f]+;/g, ' ').trim())
}

export function placeIconPaths(kind: PlaceKind): string[] {
  return svgPaths(DEFS[kind].svg)
}
