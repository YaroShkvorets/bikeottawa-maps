import { describe, expect, it } from 'vitest'
import { nearestOnRoute, pointAtDistance, routeProfile } from './profile'

// About 786 m east, then about 1112 m north.
const profile = routeProfile([
  [-75.7, 45.4, 60],
  [-75.69, 45.4, 80],
  [-75.69, 45.41, 70],
])

describe('routeProfile', () => {
  it('accumulates distance along the route', () => {
    expect(profile[0].distance).toBe(0)
    expect(profile[1].distance).toBeGreaterThan(770)
    expect(profile[1].distance).toBeLessThan(800)
    expect(profile[2].distance - profile[1].distance).toBeGreaterThan(1100)
    expect(profile[2].distance - profile[1].distance).toBeLessThan(1120)
  })
})

describe('pointAtDistance', () => {
  it('interpolates position and elevation', () => {
    const half = pointAtDistance(profile, profile[1].distance / 2)
    expect(half?.lngLat[0]).toBeCloseTo(-75.695, 5)
    expect(half?.lngLat[1]).toBeCloseTo(45.4, 5)
    expect(half?.ele).toBeCloseTo(70, 5)
  })
  it('clamps to the ends', () => {
    expect(pointAtDistance(profile, -5)).toBe(profile[0])
    expect(pointAtDistance(profile, 1e9)).toBe(profile[2])
    expect(pointAtDistance([], 10)).toBeNull()
  })
})

describe('nearestOnRoute', () => {
  it('projects a nearby point onto the route', () => {
    // 100-odd metres north of the middle of the first leg.
    const hit = nearestOnRoute(profile, [-75.695, 45.401])
    expect(hit?.point.lngLat[0]).toBeCloseTo(-75.695, 4)
    expect(hit?.point.lngLat[1]).toBeCloseTo(45.4, 5)
    expect(hit?.off).toBeGreaterThan(100)
    expect(hit?.off).toBeLessThan(120)
    expect(hit?.point.distance).toBeCloseTo(profile[1].distance / 2, -1)
  })
  it('picks the right leg near the corner and beyond the end', () => {
    expect(nearestOnRoute(profile, [-75.6899, 45.405])?.point.distance).toBeGreaterThan(profile[1].distance)
    expect(nearestOnRoute(profile, [-75.69, 45.42])?.point.distance).toBeCloseTo(profile[2].distance, 5)
  })
  it('has nothing to offer for an empty route', () => {
    expect(nearestOnRoute([], [-75.7, 45.4])).toBeNull()
  })
})
