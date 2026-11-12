/**
 * Riding styles. Each is a set of weights (0 = don't care, 1 = avoid as much
 * as possible) passed to the `ottbike` BRouter profile in routing/profiles.
 */

/** Weights shown as sliders in the Custom style. */
export const WEIGHT_KEYS = ['roadsPen', 'sidewalkPen', 'surfacePen', 'plowPen', 'litPen'] as const
/**
 * Every profile parameter. `noWalk` is a switch (0 or 1): the bike is never
 * pushed or carried, so no stairs, no dismount sections and no sidewalks that
 * are closed to bikes. Start and end points do not snap to those either.
 * `stopSignPen` (how hard to avoid stops and signals) is set by each style and
 * has no slider. `cruiseSpeed` is the riding speed on the flat in km/h; it
 * changes travel times and how far you get, not which way is taken.
 */
export const PARAM_KEYS = [...WEIGHT_KEYS, 'stopSignPen', 'noWalk', 'cruiseSpeed'] as const
export type ParamKey = (typeof PARAM_KEYS)[number]
export type RouteParams = Record<ParamKey, number>

/** Riding speeds the Custom style can be set to, km/h. */
export const SPEED_RANGE = { min: 10, max: 35 } as const

/** Values a parameter can take. */
export function paramRange(key: ParamKey): { min: number; max: number } {
  return key === 'cruiseSpeed' ? SPEED_RANGE : { min: 0, max: 1 }
}

export const PRESET_IDS = ['relaxed', 'balanced', 'fast', 'winter', 'cargo'] as const
export type PresetId = (typeof PRESET_IDS)[number]
export type StyleId = PresetId | 'custom'
export const STYLE_IDS: readonly StyleId[] = [...PRESET_IDS, 'custom']

export const PRESETS: Record<PresetId, RouteParams> = {
  relaxed: {
    roadsPen: 1,
    sidewalkPen: 0.5,
    surfacePen: 0.3,
    plowPen: 0,
    litPen: 0,
    stopSignPen: 0.1,
    noWalk: 0,
    cruiseSpeed: 15,
  },
  balanced: {
    roadsPen: 0.3,
    sidewalkPen: 0.5,
    surfacePen: 0.2,
    plowPen: 0,
    litPen: 0,
    stopSignPen: 0.2,
    noWalk: 0,
    cruiseSpeed: 20,
  },
  fast: {
    roadsPen: 0.05,
    sidewalkPen: 1,
    surfacePen: 0.6,
    plowPen: 0,
    litPen: 0,
    stopSignPen: 0.5,
    noWalk: 0,
    cruiseSpeed: 25,
  },
  winter: {
    roadsPen: 0.4,
    sidewalkPen: 0.3,
    surfacePen: 1,
    plowPen: 1,
    litPen: 0.3,
    stopSignPen: 0.1,
    noWalk: 0,
    cruiseSpeed: 15,
  },
  // A loaded bike or a trailer: smooth surfaces, few stops, and never off the saddle.
  cargo: {
    roadsPen: 0.5,
    sidewalkPen: 1,
    surfacePen: 0.6,
    plowPen: 0,
    litPen: 0,
    stopSignPen: 0.4,
    noWalk: 1,
    cruiseSpeed: 16,
  },
}

export const DEFAULT_STYLE: PresetId = 'balanced'

export function isStyleId(value: unknown): value is StyleId {
  return STYLE_IDS.includes(value as StyleId)
}

export function paramsFor(style: StyleId, custom: RouteParams): RouteParams {
  return style === 'custom' ? custom : PRESETS[style]
}

/** How the trip is made: riding, or on foot. */
export const TRAVEL_MODES = ['bike', 'foot'] as const
export type Travel = (typeof TRAVEL_MODES)[number]

export function isTravel(value: unknown): value is Travel {
  return TRAVEL_MODES.includes(value as Travel)
}

/** Walking styles, for the `ottwalk` profile: winter avoids unplowed paths and walks them slowly. */
export const WALK_STYLE_IDS = ['normal', 'winter'] as const
export type WalkStyleId = (typeof WALK_STYLE_IDS)[number]

export function isWalkStyleId(value: unknown): value is WalkStyleId {
  return WALK_STYLE_IDS.includes(value as WalkStyleId)
}

/** What the router is asked to use: a profile in routing/profiles and its parameters. */
export interface Profile {
  name: 'ottbike' | 'ottwalk'
  params: Readonly<Record<string, number>>
}

export function profileFor(travel: Travel, style: StyleId, custom: RouteParams, walkStyle: WalkStyleId): Profile {
  return travel === 'foot'
    ? { name: 'ottwalk', params: { winter: walkStyle === 'winter' ? 1 : 0 } }
    : { name: 'ottbike', params: paramsFor(style, custom) }
}
