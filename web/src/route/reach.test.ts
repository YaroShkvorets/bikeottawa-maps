import { describe, expect, it } from 'vitest'
import { isReachMinutes, reachUrl } from './reach'
import { PRESETS } from './styles'

describe('reachUrl', () => {
  it('asks BRouter for an isochrone with the style weights', () => {
    const url = new URL(reachUrl('http://router.test/brouter', [-75.6972, 45.4215], 15, PRESETS.cargo))
    expect(url.searchParams.get('lonlats')).toBe('-75.697200,45.421500')
    expect(url.searchParams.get('engineMode')).toBe('5')
    expect(url.searchParams.get('isochroneTime')).toBe('900')
    expect(url.searchParams.get('profile:noWalk')).toBe('1')
  })
})

describe('isReachMinutes', () => {
  it('accepts only the times on offer', () => {
    expect(isReachMinutes('15')).toBe(true)
    expect(isReachMinutes('45')).toBe(false)
    expect(isReachMinutes(undefined)).toBe(false)
  })
})
