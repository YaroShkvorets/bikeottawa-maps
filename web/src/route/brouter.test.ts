import { describe, expect, it } from 'vitest'
import { distanceByComfort, findStops, parseRoute, RouteError, rateStretch, routeUrl } from './brouter'
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
    expect(url).toContain('profile:noWalk=0')
    expect(
      routeUrl(
        'https://router.test/brouter',
        [
          [-75.7, 45.41],
          [-75.66, 45.43],
        ],
        PRESETS.cargo,
      ),
    ).toContain('profile:noWalk=1')
  })
})

describe('rateStretch', () => {
  it('tells sidewalks, stairs and other walking apart', () => {
    expect(rateStretch({ highway: 'footway', footway: 'sidewalk' })).toEqual({ lts: 0, walk: 'sidewalk' })
    expect(rateStretch({ highway: 'steps' })).toEqual({ lts: 0, walk: 'stairs' })
    expect(rateStretch({ highway: 'footway', bicycle: 'dismount' })).toEqual({ lts: 0, walk: 'other' })
    expect(rateStretch({ highway: 'path', bicycle: 'no' })).toEqual({ lts: 0, walk: 'other' })
  })
  it('rates rideable ways with the stress model', () => {
    expect(rateStretch({ highway: 'cycleway' })).toEqual({ lts: 1, walk: null })
    expect(rateStretch({ highway: 'footway', footway: 'sidewalk', bicycle: 'yes' })).toEqual({ lts: 1, walk: null })
    expect(rateStretch({ highway: 'primary', maxspeed: '60', lanes: '4' }).lts).toBe(4)
  })
})

describe('findStops', () => {
  const header = [
    'Longitude',
    'Latitude',
    'Elevation',
    'Distance',
    'CostPerKm',
    'ElevCost',
    'TurnCost',
    'NodeCost',
    'InitialCost',
    'WayTags',
    'NodeTags',
  ]
  const row = (distance: number, node: string, way = 'highway=residential') => [
    '-75700000',
    '45400000',
    '70',
    String(distance),
    '0',
    '0',
    '0',
    '0',
    '0',
    way,
    node,
  ]
  const kinds = (rows: string[][]) => findStops(header, rows).map((stop) => stop.kind)

  it('finds stop signs and traffic lights and where they are', () => {
    const stops = findStops(header, [
      row(100, 'highway=stop'),
      row(200, ''),
      row(150, 'highway=traffic_signals'),
      row(90, 'crossing=traffic_signals'),
    ])
    expect(stops.map((stop) => stop.kind)).toEqual(['stop', 'light', 'light'])
    expect(stops[0].lngLat).toEqual([-75.7, 45.4])
  })

  it('counts the signal heads of one junction once', () => {
    expect(
      kinds([
        row(100, 'highway=traffic_signals'),
        row(15, 'crossing=traffic_signals'),
        row(20, 'highway=traffic_signals'),
      ]),
    ).toEqual(['light'])
    expect(kinds([row(100, 'highway=stop'), row(10, 'highway=stop'), row(40, 'highway=stop')])).toEqual([
      'stop',
      'stop',
    ])
  })

  it('counts a signalled crossing that is only tagged on the crossing way', () => {
    const crossing = 'highway=cycleway cycleway=crossing crossing=traffic_signals'
    expect(kinds([row(200, '', crossing)])).toEqual(['light'])
    // The same crossing tagged on its node as well is still one set of lights.
    expect(kinds([row(200, 'highway=crossing crossing=traffic_signals', crossing), row(12, '', crossing)])).toEqual([
      'light',
    ])
    expect(kinds([row(200, '', 'highway=footway footway=crossing crossing=uncontrolled')])).toEqual([])
  })

  it('ignores stop signs that face the other way', () => {
    expect(kinds([row(100, 'highway=stop direction=forward')])).toEqual(['stop'])
    expect(kinds([row(100, 'highway=stop direction=backward')])).toEqual([])
    expect(kinds([row(100, 'highway=stop direction=backward', 'reversedirection=yes highway=residential')])).toEqual([
      'stop',
    ])
    expect(kinds([row(100, 'highway=stop direction=forward', 'reversedirection=yes highway=residential')])).toEqual([])
  })

  it('copes with other node tags and with answers that have none', () => {
    expect(kinds([row(100, 'entrance=yes'), row(100, 'barrier=bollard highway=stop')])).toEqual(['stop'])
    expect(findStops(['Longitude', 'Latitude', 'Distance', 'WayTags'], [['1', '2', '3', 'highway=path']])).toEqual([])
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
    const total = Object.values(distanceByComfort(route)).reduce((a, b) => a + b, 0)
    expect(Math.abs(total - route.distance)).toBeLessThan(route.distance * 0.05)
  })

  it('lists the stops along the way', () => {
    expect(Array.isArray(route.stops)).toBe(true)
    for (const stop of route.stops) expect(['stop', 'light']).toContain(stop.kind)
  })

  it('rejects a response without a route', () => {
    expect(() => parseRoute({ features: [] })).toThrow(RouteError)
  })
})
