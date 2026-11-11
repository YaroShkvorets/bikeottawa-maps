import assert from 'node:assert/strict'
import { test } from 'node:test'
import { centreOf, classifyPlace, classifyWay, parseOsmId, placeFilters } from './classify.mjs'

test('cycleways are low-stress paths shown from far out', () => {
  const { props, minzoom } = classifyWay({ highway: 'cycleway', surface: 'asphalt', winter_service: 'yes' })
  assert.deepEqual(props, { lts: 1, kind: 'path', highway: 'cycleway', surface: 'asphalt', winter: 'yes' })
  assert.equal(minzoom, 10)
})

test('pathways without a usable winter_service tag are unknown', () => {
  assert.equal(classifyWay({ highway: 'path' }).props.winter, 'unknown')
  assert.equal(classifyWay({ highway: 'path', winter_service: 'sometimes' }).props.winter, 'unknown')
  assert.equal(classifyWay({ highway: 'path', winter_service: 'no' }).props.winter, 'no')
})

test('streets get a stress level and no winter property', () => {
  const { props, minzoom } = classifyWay({ highway: 'primary', maxspeed: '60', lanes: '4', name: 'Bank Street' })
  assert.equal(props.kind, 'street')
  assert.equal(props.lts, 4)
  assert.equal(props.name, 'Bank Street')
  assert.equal('winter' in props, false)
  assert.equal(minzoom, 9)
})

test('ways closed to bikes are dropped unless they are off-street paths', () => {
  assert.equal(classifyWay({ highway: 'motorway' }), null)
  assert.equal(classifyWay({ highway: 'residential', bicycle: 'no' }), null)
  assert.equal(classifyWay({ highway: 'footway', footway: 'sidewalk' }), null)
  assert.equal(classifyWay({ highway: 'steps' }), null)
  assert.equal(classifyWay({ building: 'yes' }), null)
  const closedPath = classifyWay({ highway: 'footway', bicycle: 'no' })
  assert.equal(closedPath.props.lts, 0)
  assert.equal(closedPath.props.kind, 'path')
})

test('pedestrian crossings are dropped unless bikes are explicitly allowed', () => {
  assert.equal(classifyWay({ highway: 'footway', footway: 'crossing' }), null)
  assert.equal(classifyWay({ highway: 'footway', footway: 'crossing', crossing: 'traffic_signals' }), null)
  assert.equal(classifyWay({ highway: 'footway', footway: 'crossing', bicycle: 'yes' }).props.kind, 'path')
  assert.equal(classifyWay({ highway: 'cycleway', cycleway: 'crossing' }).props.lts, 1)
})

test('places are recognised by kind and private ones skipped', () => {
  assert.deepEqual(classifyPlace({ amenity: 'bicycle_parking', capacity: '10', bicycle_parking: 'stands' }).props, {
    kind: 'parking',
    capacity: '10',
    bicycle_parking: 'stands',
  })
  assert.equal(classifyPlace({ shop: 'bicycle', name: 'Shop' }).props.kind, 'shop')
  assert.equal(classifyPlace({ amenity: 'bicycle_parking', access: 'private' }), null)
  assert.equal(classifyPlace({ amenity: 'bank' }), null)
})

test('every place kind from the original amenities map is recognised', () => {
  const cases = [
    [{ amenity: 'compressed_air' }, 'air'],
    [{ amenity: 'shelter' }, 'shelter'],
    [{ amenity: 'telephone' }, 'telephone'],
    [{ leisure: 'picnic_table' }, 'picnic'],
    [{ amenity: 'bench', backrest: 'yes' }, 'bench'],
    [{ amenity: 'bbq' }, 'bbq'],
    [{ amenity: 'pub' }, 'pub'],
    [{ craft: 'brewery' }, 'brewery'],
    [{ amenity: 'restaurant', cuisine: 'thai' }, 'restaurant'],
    [{ amenity: 'fast_food' }, 'fast_food'],
    [{ amenity: 'cafe' }, 'cafe'],
    [{ amenity: 'ice_cream' }, 'ice_cream'],
    [{ leisure: 'playground', playground: 'splash_pad' }, 'splash'],
    [{ leisure: 'splash_pad' }, 'splash'],
    [{ tourism: 'information', information: 'map' }, 'information'],
    [{ tourism: 'viewpoint' }, 'viewpoint'],
  ]
  for (const [tags, kind] of cases) assert.equal(classifyPlace(tags)?.props.kind, kind, JSON.stringify(tags))
  assert.equal(classifyPlace({ amenity: 'restaurant', cuisine: 'thai' }).props.cuisine, 'thai')
})

test('beaches are places only when they have a name', () => {
  assert.equal(classifyPlace({ natural: 'beach', name: 'Westboro Beach' }).props.kind, 'beach')
  assert.equal(classifyPlace({ natural: 'beach' }), null)
  assert.equal(classifyPlace({ natural: 'beach', name: 'Private Beach', access: 'private' }), null)
})

test('the osmium filter covers every place kind, grouped by key', () => {
  const filters = placeFilters()
  assert.ok(filters.includes('nw/shop=bicycle'))
  assert.ok(filters.includes('nw/craft=brewery'))
  assert.ok(filters.includes('nw/natural=beach'))
  assert.ok(filters.some((f) => f.startsWith('nw/amenity=') && f.includes('bench') && f.includes('bicycle_parking')))
  assert.ok(filters.includes('nw/leisure=picnic_table,splash_pad'))
})

test('osmium ids map back to OSM types', () => {
  assert.deepEqual(parseOsmId('n12'), { type: 'node', id: 12 })
  assert.deepEqual(parseOsmId('w34'), { type: 'way', id: 34 })
  assert.deepEqual(parseOsmId('a68'), { type: 'way', id: 34 })
  assert.deepEqual(parseOsmId('a69'), { type: 'relation', id: 34 })
})

test('centreOf returns the middle of the bounding box', () => {
  const square = [
    [
      [0, 0],
      [2, 0],
      [2, 4],
      [0, 4],
      [0, 0],
    ],
  ]
  assert.deepEqual(centreOf({ type: 'Polygon', coordinates: square }), [1, 2])
  assert.deepEqual(
    centreOf({
      type: 'MultiPolygon',
      coordinates: [
        square,
        [
          [
            [4, 0],
            [6, 0],
            [6, 2],
            [4, 0],
          ],
        ],
      ],
    }),
    [3, 2],
  )
})
