import { describe, expect, it } from 'vitest'
import { distanceByLts, parseRoute, RouteError, routeUrl } from './brouter'
import fixture from './fixture.route.json'
import { PRESETS } from './styles'

describe('routeUrl', () => {
  it('passes the points and every style weight to the ottbike profile', () => {
    const url = routeUrl(
      'https://router.test/brouter',
      [
        [-75.7, 45.41],
        [-75.66, 45.43],
      ],
      PRESETS.winter,
    )
    expect(url).toContain('lonlats=-75.700000,45.410000|-75.660000,45.430000')
    expect(url).toContain('profile=ottbike')
    expect(url).toContain('profile:plowPen=1')
    expect(url).toContain('profile:roadsPen=0.4')
    expect(url).toContain('format=geojson')
  })
})

describe('parseRoute', () => {
  const route = parseRoute(fixture)

  it('reads the totals', () => {
    expect(route.distance).toBeGreaterThan(300)
    expect(route.time).toBeGreaterThan(30)
    expect(route.coords.length).toBe(fixture.features[0].geometry.coordinates.length)
    expect(route.coords[0][2]).toBeTypeOf('number')
  })

  it('splits the line into connected segments that cover it end to end', () => {
    expect(route.segments.length).toBeGreaterThan(3)
    expect(route.segments[0].coords[0]).toEqual(route.coords[0].slice(0, 2))
    expect(route.segments.at(-1)?.coords.at(-1)).toEqual(route.coords.at(-1)?.slice(0, 2))
    for (let i = 1; i < route.segments.length; i++) {
      expect(route.segments[i].coords[0]).toEqual(route.segments[i - 1].coords.at(-1))
    }
  })

  it('rates each segment and accounts for the whole distance', () => {
    for (const segment of route.segments) {
      expect(segment.lts).toBeGreaterThanOrEqual(0)
      expect(segment.lts).toBeLessThanOrEqual(4)
      expect(segment.tags.highway).toBeTruthy()
      expect(segment.tags.reversedirection).toBeUndefined()
    }
    const total = distanceByLts(route).reduce((a, b) => a + b, 0)
    expect(Math.abs(total - route.distance)).toBeLessThan(route.distance * 0.05)
  })

  it('rejects a response without a route', () => {
    expect(() => parseRoute({ features: [] })).toThrow(RouteError)
  })
})
