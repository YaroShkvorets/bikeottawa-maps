/**
 * Riding styles. Each is a set of weights (0 = don't care, 1 = avoid as much
 * as possible) passed to the `ottbike` BRouter profile in routing/profiles.
 */

/** Weights shown as sliders in the Custom style. */
export const WEIGHT_KEYS = ['roadsPen', 'sidewalkPen', 'surfacePen', 'plowPen', 'litPen', 'stopSignPen'] as const
/**
 * Every profile parameter. `noWalk` is a switch (0 or 1): the bike is never
 * pushed or carried, so no stairs, no dismount sections and no sidewalks that
 * are closed to bikes. Start and end points do not snap to those either.
 * `cruiseSpeed` is the riding speed on the flat in km/h; it changes travel
 * times and how far you get, not which way is taken.
 */
export const PARAM_KEYS = [...WEIGHT_KEYS, 'noWalk', 'cruiseSpeed'] as const
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

export const DEFAULT_STYLE: PresetId = 'relaxed'

export function isStyleId(value: unknown): value is StyleId {
  return STYLE_IDS.includes(value as StyleId)
}

export function paramsFor(style: StyleId, custom: RouteParams): RouteParams {
  return style === 'custom' ? custom : PRESETS[style]
}
