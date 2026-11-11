/**
 * Riding styles. Each is a set of weights (0 = don't care, 1 = avoid as much
 * as possible) passed to the `ottbike` BRouter profile in routing/profiles.
 */

export const PARAM_KEYS = ['roadsPen', 'sidewalkPen', 'surfacePen', 'plowPen', 'litPen', 'stopSignPen'] as const
export type ParamKey = (typeof PARAM_KEYS)[number]
export type RouteParams = Record<ParamKey, number>

export const PRESET_IDS = ['relaxed', 'balanced', 'fast', 'winter'] as const
export type PresetId = (typeof PRESET_IDS)[number]
export type StyleId = PresetId | 'custom'
export const STYLE_IDS: readonly StyleId[] = [...PRESET_IDS, 'custom']

export const PRESETS: Record<PresetId, RouteParams> = {
  relaxed: { roadsPen: 1, sidewalkPen: 0.5, surfacePen: 0.3, plowPen: 0, litPen: 0, stopSignPen: 0.1 },
  balanced: { roadsPen: 0.3, sidewalkPen: 0.5, surfacePen: 0.2, plowPen: 0, litPen: 0, stopSignPen: 0.2 },
  fast: { roadsPen: 0.05, sidewalkPen: 1, surfacePen: 0.6, plowPen: 0, litPen: 0, stopSignPen: 0.5 },
  winter: { roadsPen: 0.4, sidewalkPen: 0.3, surfacePen: 1, plowPen: 1, litPen: 0.3, stopSignPen: 0.1 },
}

export const DEFAULT_STYLE: PresetId = 'relaxed'

export function isStyleId(value: unknown): value is StyleId {
  return STYLE_IDS.includes(value as StyleId)
}

export function paramsFor(style: StyleId, custom: RouteParams): RouteParams {
  return style === 'custom' ? custom : PRESETS[style]
}
