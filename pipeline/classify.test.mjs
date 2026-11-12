import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bikeway,
  centreOf,
  classifyPlace,
  classifyWay,
  isStreetLamp,
  middleOf,
  parseOsmId,
  placeFilters,
} from './classify.mjs'

test('cycleways are low-stress paths shown from far out', () => {
  const { props, minzoom } = classifyWay({ highway: 'cycleway', surface: 'asphalt', winter_service: 'yes' })
  assert.deepEqual(props, {
    lts: 1,
    kind: 'path',
    highway: 'cycleway',
    surface: 'asphalt',
    bikeway: 'dedicated',
    winter: 'yes',
  })
  assert.equal(minzoom, 10)
})

test('pathways without a usable winter_service tag are unknown', () => {
  assert.equal(classifyWay({ highway: 'path' }).props.winter, 'unknown')
  assert.equal(classifyWay({ highway: 'path', winter_service: 'sometimes' }).props.winter, 'unknown')
  assert.equal(classifyWay({ highway: 'path', winter_service: 'no' }).props.winter, 'no')
})

test('unpaved pathways count as unplowed unless tagged otherwise', () => {
  for (const surface of ['gravel', 'fine_gravel', 'ground', 'unpaved', 'sand', 'grass', 'dirt']) {
    assert.equal(classifyWay({ highway: 'path', surface }).props.winter, 'no', surface)
  }
  assert.equal(classifyWay({ highway: 'path', surface: 'fine_gravel', winter_service: 'yes' }).props.winter, 'yes')
  assert.equal(classifyWay({ highway: 'path', surface: 'asphalt' }).props.winter, 'unknown')
  assert.equal(classifyWay({ highway: 'path', surface: 'wood' }).props.winter, 'unknown')
})

test('indoor walkways have no winter status', () => {
  assert.equal('winter' in classifyWay({ highway: 'footway', indoor: 'yes' }).props, false)
  assert.equal('winter' in classifyWay({ highway: 'footway', indoor: 'yes', winter_service: 'no' }).props, false)
  assert.equal(classifyWay({ highway: 'footway', indoor: 'no' }).props.winter, 'unknown')
})

test('streets get a stress level and no winter property', () => {
  const { props, minzoom } = classifyWay({ highway: 'primary', maxspeed: '60', lanes: '4', name: 'Bank Street' })
  assert.equal(props.kind, 'street')
  assert.equal(props.lts, 4)
  assert.equal(props.name, 'Bank Street')
  assert.equal('winter' in props, false)
  assert.equal(minzoom, 9)
})

test('ways keep the sub-type that names them', () => {
  assert.equal(classifyWay({ highway: 'service', service: 'driveway' }).props.service, 'driveway')
  assert.equal(classifyWay({ highway: 'footway', footway: 'sidewalk', bicycle: 'yes' }).props.footway, 'sidewalk')
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

test('private and closed ways are dropped unless bikes or people on foot are let in', () => {
  assert.equal(classifyWay({ highway: 'footway', access: 'private' }), null)
  assert.equal(classifyWay({ highway: 'service', access: 'private' }), null)
  assert.equal(classifyWay({ highway: 'path', access: 'no' }), null)
  assert.equal(classifyWay({ highway: 'path', access: 'private', bicycle: 'yes' }).props.kind, 'path')
  assert.equal(classifyWay({ highway: 'footway', access: 'no', foot: 'designated' }).props.kind, 'path')
  assert.notEqual(classifyWay({ highway: 'service', access: 'destination' }), null)
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

test('beaches need a name; swimming spots count as beaches', () => {
  assert.equal(classifyPlace({ natural: 'beach', name: 'Westboro Beach' }).props.kind, 'beach')
  assert.equal(classifyPlace({ natural: 'beach' }), null)
  assert.equal(classifyPlace({ natural: 'beach', name: 'Private Beach', access: 'private' }), null)
  assert.equal(classifyPlace({ leisure: 'swimming_area' }).props.kind, 'beach')
})

test('stations say what runs through them and whether they are still being built', () => {
  const light = { railway: 'station', station: 'light_rail', light_rail: 'yes', wheelchair: 'yes' }
  assert.deepEqual(classifyPlace(light).props, { kind: 'station', wheelchair: 'yes', station: 'light_rail' })
  assert.equal(classifyPlace({ railway: 'station', train: 'yes' }).props.station, 'train')
  assert.equal('station' in classifyPlace({ railway: 'station' }).props, false)
  const built = classifyPlace({ ...light, 'construction:railway': 'station', opening_date: '2026' }).props
  assert.equal(built.construction, 'yes')
  assert.equal(built.opening_date, '2026')
  // A station that has opened keeps its opening date to itself.
  assert.equal('opening_date' in classifyPlace({ ...light, opening_date: '2024-11' }).props, false)
})

test('stops, connections and obstacles useful on a ride are recognised', () => {
  const cases = [
    [{ amenity: 'bicycle_rental' }, 'rental'],
    [{ shop: 'bakery', name: 'Boulangerie' }, 'bakery'],
    [{ amenity: 'marketplace' }, 'market'],
    [{ shop: 'supermarket' }, 'grocery'],
    [{ shop: 'convenience' }, 'convenience'],
    [{ amenity: 'fuel', brand: 'Esso' }, 'convenience'],
    [{ tourism: 'camp_site' }, 'camping'],
    [{ railway: 'station', station: 'light_rail' }, 'station'],
    [{ amenity: 'ferry_terminal' }, 'ferry'],
    [{ barrier: 'cycle_barrier' }, 'barrier'],
    [{ barrier: 'kissing_gate' }, 'barrier'],
    [{ highway: 'elevator' }, 'elevator'],
  ]
  for (const [tags, kind] of cases) assert.equal(classifyPlace(tags)?.props.kind, kind, JSON.stringify(tags))
  assert.equal(classifyPlace({ barrier: 'gate' }), null)
})

test('general stores are dollar stores plus a few department store chains', () => {
  assert.equal(classifyPlace({ shop: 'variety_store', brand: 'Dollarama' }).props.kind, 'general')
  assert.equal(classifyPlace({ shop: 'department_store', brand: 'Canadian Tire' }).props.kind, 'general')
  assert.equal(classifyPlace({ shop: 'department_store', name: 'Tigre Géant' }).props.kind, 'general')
  assert.equal(classifyPlace({ shop: 'department_store', brand: 'Winners' }), null)
  assert.equal(classifyPlace({ shop: 'department_store' }), null)
  assert.equal(classifyPlace({ amenity: 'pharmacy', name: 'Pharmasave' }).props.kind, 'pharmacy')
})

test('stairs are a place only with a bike ramp, placed at their middle', () => {
  const ramp = classifyPlace({ highway: 'steps', 'ramp:bicycle': 'yes' })
  assert.equal(ramp.props.kind, 'ramp')
  assert.equal(ramp.line, true)
  assert.equal(classifyPlace({ highway: 'steps' }), null)
  assert.equal(classifyPlace({ highway: 'steps', 'ramp:bicycle': 'no' }), null)
  assert.equal(classifyPlace({ amenity: 'cafe' }).line, false)
  assert.deepEqual(
    middleOf([
      [0, 0],
      [1, 1],
      [2, 2],
    ]),
    [1, 1],
  )
  assert.deepEqual(
    middleOf([
      [0, 0],
      [1, 1],
    ]),
    [0, 0],
  )
})

test('the osmium filter covers every place kind, grouped by key', () => {
  const filters = placeFilters()
  assert.ok(filters.some((f) => f.startsWith('nw/shop=') && f.includes('bicycle') && f.includes('bakery')))
  assert.ok(filters.includes('nw/craft=brewery'))
  assert.ok(filters.includes('nw/natural=beach'))
  assert.ok(filters.includes('nw/railway=station'))
  assert.ok(filters.some((f) => f.startsWith('nw/barrier=') && f.includes('cycle_barrier')))
  assert.ok(filters.includes('nw/leisure=picnic_table,splash_pad,swimming_area'))
  assert.ok(filters.some((f) => f.startsWith('nw/amenity=') && f.includes('bench') && f.includes('bicycle_parking')))
})

test('street lamps are recognised and are not places', () => {
  assert.equal(isStreetLamp({ highway: 'street_lamp', lamp_type: 'led' }), true)
  assert.equal(isStreetLamp({ highway: 'crossing' }), false)
  assert.equal(classifyPlace({ highway: 'street_lamp' }), null)
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

test('bike lanes: dedicated ways, painted lanes and shared lanes', () => {
  const cases = [
    [{ highway: 'cycleway', foot: 'designated', segregated: 'no' }, 'dedicated'],
    [{ highway: 'cycleway', foot: 'no' }, 'dedicated'],
    [{ highway: 'path', bicycle: 'designated' }, 'dedicated'],
    [{ highway: 'path', bicycle: 'yes' }, undefined],
    [{ highway: 'footway', footway: 'sidewalk' }, undefined],
    [{ highway: 'secondary', 'cycleway:right': 'lane', 'cycleway:left': 'no' }, 'lane'],
    [{ highway: 'secondary', 'cycleway:left': 'shared_lane', 'cycleway:right': 'lane' }, 'lane'],
    [{ highway: 'residential', 'cycleway:both': 'shared_lane' }, 'shared'],
    [{ highway: 'primary', cycleway: 'track' }, 'dedicated'],
    [{ highway: 'primary', 'cycleway:both': 'separate' }, undefined],
    [{ highway: 'tertiary', cycleway: 'shoulder' }, undefined],
  ]
  for (const [tags, kind] of cases) assert.equal(bikeway(tags), kind, JSON.stringify(tags))
  assert.equal(classifyWay({ highway: 'tertiary', cycleway: 'lane' }).props.bikeway, 'lane')
  assert.equal('bikeway' in classifyWay({ highway: 'residential' }).props, false)
})
