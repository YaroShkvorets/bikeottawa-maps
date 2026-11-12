import { describe, expect, it } from 'vitest'
import { isReachMinutes, type Reach, reachArea, reachUrl } from './reach'
import { PRESETS } from './styles'

describe('reachUrl', () => {
  it('asks BRouter for an isochrone with the style weights', () => {
    const url = new URL(
      reachUrl('http://router.test/brouter', [-75.6972, 45.4215], 15, { name: 'ottbike', params: PRESETS.cargo }),
    )
    expect(url.searchParams.get('lonlats')).toBe('-75.697200,45.421500')
    expect(url.searchParams.get('engineMode')).toBe('5')
    expect(url.searchParams.get('isochroneTime')).toBe('900')
    expect(url.searchParams.get('profile:noWalk')).toBe('1')
  })
})

describe('isReachMinutes', () => {
  it('accepts only the times on offer', () => {
    expect(isReachMinutes('20')).toBe(true)
    expect(isReachMinutes('15')).toBe(false)
    expect(isReachMinutes('45')).toBe(false)
    expect(isReachMinutes(undefined)).toBe(false)
  })
})

describe('reachArea', () => {
  const reach = (lines: number[][][]): Reach => ({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { minutes: 1 }, geometry: { type: 'MultiLineString', coordinates: lines } },
    ],
  })

  it('is the convex hull around every way reached, in square metres', () => {
    // A cross 0.01° each way at the equator: its hull is a diamond of about 2.48 km².
    const cross = reach([
      [
        [-0.01, 0],
        [0, 0],
        [0.01, 0],
      ],
      [
        [0, -0.01],
        [0, 0.005],
        [0, 0.01],
      ],
    ])
    expect(reachArea(cross) / 1e6).toBeCloseTo((2 * (0.02 * 111.32) ** 2) / 4, 3)
  })

  it('is zero with nothing reached', () => {
    expect(reachArea({ type: 'FeatureCollection', features: [] })).toBe(0)
  })
})
