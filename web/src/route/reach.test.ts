import { describe, expect, it } from 'vitest'
import { coveredPoints, isReachMinutes, type Reach, reachCover, reachUrl } from './reach'
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
    expect(isReachMinutes('5')).toBe(true)
    expect(isReachMinutes('25')).toBe(false)
    expect(isReachMinutes('45')).toBe(false)
    expect(isReachMinutes(undefined)).toBe(false)
  })
})

describe('reachCover', () => {
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
    expect(reachCover(loop).area / side ** 2).toBeCloseTo(1, 1)
    // Inside the loop, just outside one side, and well away.
    expect(reachCover(loop).covers(0.005, 0.005)).toBe(true)
    expect(reachCover(loop).covers(0.005, -0.0003)).toBe(true)
    expect(reachCover(loop).covers(0.005, -0.002)).toBe(false)
    expect(reachCover(loop).covers(0.5, 0.5)).toBe(false)
  })

  it('counts only the ways themselves where nothing is closed off', () => {
    const corner = reach([
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
      ],
    ])
    // Two sides about 1.1 km long, each a strip a cell or two (25 m) wide.
    const { area, covers } = reachCover(corner)
    // The open side of the corner is not covered.
    expect(covers(0.003, 0.007)).toBe(false)
    expect(area).toBeGreaterThan(2 * side * 20)
    expect(area).toBeLessThan(2 * side * 60)
  })

  it('is zero with nothing reached', () => {
    expect(reachCover({ type: 'FeatureCollection', features: [] }).area).toBe(0)
  })
})

describe('coveredPoints', () => {
  it('keeps the [lon, lat] pairs the reach covers', () => {
    const cover = { area: 1, covers: (lon: number) => lon < 0 }
    expect(coveredPoints([-1, 45, 1, 45, -2, 46], cover)).toEqual([
      [-1, 45],
      [-2, 46],
    ])
    expect(coveredPoints([], cover)).toEqual([])
  })
})
