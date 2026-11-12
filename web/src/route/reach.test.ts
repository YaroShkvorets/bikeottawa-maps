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
  // 0.01° at the equator is about 1.11 km.
  const side = 0.01 * 111_320

  it('counts what a loop of ways closes off', () => {
    const loop = reach([
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0],
      ],
    ])
    expect(reachArea(loop) / side ** 2).toBeCloseTo(1, 1)
  })

  it('counts only the ways themselves where nothing is closed off', () => {
    const corner = reach([
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
      ],
    ])
    // Two sides about 1.1 km long, each a strip a cell or two wide.
    const area = reachArea(corner)
    expect(area).toBeGreaterThan(2 * side * 10)
    expect(area).toBeLessThan(2 * side * 25)
  })

  it('is zero with nothing reached', () => {
    expect(reachArea({ type: 'FeatureCollection', features: [] })).toBe(0)
  })
})
