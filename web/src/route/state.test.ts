import { describe, expect, it } from 'vitest'
import { formatParams, formatPoints, parseParams, parsePoints } from './state'
import { PRESETS } from './styles'

describe('route points in the URL', () => {
  it('round-trips both points', () => {
    const text = formatPoints([{ lngLat: [-75.700312, 45.411234] }, { lngLat: [-75.666, 45.429] }])
    expect(text).toBe('-75.70031,45.41123;-75.666,45.429')
    expect(parsePoints(text ?? undefined).map((p) => p?.lngLat)).toEqual([
      [-75.70031, 45.41123],
      [-75.666, 45.429],
    ])
  })
  it('keeps the slot of a point that is not set', () => {
    expect(formatPoints([null, { lngLat: [-75.6, 45.4] }])).toBe(';-75.6,45.4')
    expect(parsePoints(';-75.6,45.4')).toEqual([null, { lngLat: [-75.6, 45.4] }])
    expect(formatPoints([null, null])).toBeNull()
  })
  it('ignores junk', () => {
    expect(parsePoints(undefined)).toEqual([null, null])
    expect(parsePoints('abc;999,999')).toEqual([null, null])
  })
})

describe('custom weights in the URL', () => {
  it('round-trips', () => {
    expect(parseParams(formatParams(PRESETS.winter), PRESETS.relaxed)).toEqual(PRESETS.winter)
  })
  it('falls back for missing or out-of-range values', () => {
    expect(parseParams(undefined, PRESETS.fast)).toEqual(PRESETS.fast)
    expect(parseParams('0.5,7,x', PRESETS.fast)).toEqual({ ...PRESETS.fast, roadsPen: 0.5 })
  })
})
