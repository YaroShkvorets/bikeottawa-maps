// Turns raw OSM tags into the small set of properties the map tiles carry.
import stressmodel from 'stressmodel/stressmodel.js'

const PATH_HIGHWAYS = new Set(['path', 'footway', 'cycleway'])
const MAJOR_HIGHWAYS = new Set(['trunk', 'primary', 'secondary', 'tertiary'])
const LOCAL_HIGHWAYS = new Set(['residential', 'unclassified', 'living_street'])
const SKIPPED_HIGHWAYS = new Set([
  'proposed',
  'construction',
  'platform',
  'bus_stop',
  'rest_area',
  'services',
  'elevator',
  'corridor',
  'raceway',
  'abandoned',
  'razed',
  'steps',
])

/** Copies `keys` from tags into `out`, skipping missing values. */
function pick(tags, keys, out) {
  for (const key of keys) {
    if (tags[key] !== undefined && tags[key] !== '') out[key] = tags[key]
  }
  return out
}

/**
 * @param {Record<string, string>} tags OSM tags of a way
 * @returns {{props: Record<string, string|number>, minzoom: number} | null} null when the way is not shown
 */
export function classifyWay(tags) {
  const highway = tags.highway
  if (!highway || SKIPPED_HIGHWAYS.has(highway)) return null

  // Pedestrian crossings belong to the sidewalk network. The stress model rates
  // them like the street they cross, so they are dropped here unless bikes are
  // explicitly allowed (a shared crossing on a pathway).
  const bikesAllowed = tags.bicycle === 'yes' || tags.bicycle === 'designated'
  if (highway === 'footway' && tags.footway === 'crossing' && !bikesAllowed) return null

  const lts = stressmodel.evaluateLTS({ tags }).lts
  const isPath = PATH_HIGHWAYS.has(highway)
  const isSidewalk = tags.footway === 'sidewalk' || tags.footway === 'crossing'
  // Streets closed to bikes are dropped; off-street paths are kept for the winter layer.
  if (lts === 0 && (!isPath || isSidewalk)) return null

  const props = { lts, kind: isPath ? 'path' : 'street', highway }
  pick(tags, ['name', 'surface', 'smoothness', 'width', 'lit', 'maxspeed', 'lanes'], props)
  if (isPath) {
    const ws = tags.winter_service
    props.winter = ws === 'yes' || ws === 'no' ? ws : 'unknown'
  }

  let minzoom = 13
  if (MAJOR_HIGHWAYS.has(highway)) minzoom = 9
  else if (highway === 'cycleway' || (highway === 'path' && lts > 0)) minzoom = 10
  else if (LOCAL_HIGHWAYS.has(highway)) minzoom = 12
  return { props, minzoom }
}

/**
 * [OSM key, value, our kind, zoom from which it shows, needs a name?]. Dense kinds
 * appear later. Beaches need a name: unnamed ones are strips of sand, not places to stop.
 */
const PLACE_KINDS = [
  ['amenity', 'bicycle_parking', 'parking', 13],
  ['shop', 'bicycle', 'shop', 10],
  ['amenity', 'bicycle_repair_station', 'repair', 10],
  ['amenity', 'compressed_air', 'air', 10],
  ['amenity', 'drinking_water', 'water', 11],
  ['amenity', 'toilets', 'toilets', 11],
  ['amenity', 'shelter', 'shelter', 12],
  ['amenity', 'telephone', 'telephone', 12],
  ['tourism', 'information', 'information', 13],
  ['amenity', 'bench', 'bench', 14],
  ['leisure', 'picnic_table', 'picnic', 13],
  ['amenity', 'bbq', 'bbq', 12],
  ['tourism', 'viewpoint', 'viewpoint', 11],
  ['playground', 'splash_pad', 'splash', 11],
  ['leisure', 'splash_pad', 'splash', 11],
  ['natural', 'beach', 'beach', 11, true],
  ['amenity', 'cafe', 'cafe', 12],
  ['amenity', 'restaurant', 'restaurant', 13],
  ['amenity', 'fast_food', 'fast_food', 13],
  ['amenity', 'ice_cream', 'ice_cream', 11],
  ['amenity', 'pub', 'pub', 11],
  ['craft', 'brewery', 'brewery', 10],
]

const PLACE_TAGS = [
  'name',
  'description',
  'bicycle_parking',
  'capacity',
  'covered',
  'service:bicycle:repair',
  'service:bicycle:pump',
  'service:bicycle:chain_tool',
  'information',
  'indoor',
  'bottle',
  'backrest',
  'material',
  'fuel',
  'cuisine',
  'outdoor_seating',
  'takeaway',
  'fee',
  'seasonal',
  'opening_hours',
  'phone',
  'website',
]

/**
 * @param {Record<string, string>} tags OSM tags of a node or area
 * @returns {{props: Record<string, string>, minzoom: number} | null}
 */
export function classifyPlace(tags) {
  const match = PLACE_KINDS.find(([key, value]) => tags[key] === value)
  if (!match) return null
  if (tags.access === 'private' || tags.access === 'no') return null
  const [, , kind, minzoom, needsName] = match
  if (needsName && !tags.name) return null
  return { props: pick(tags, PLACE_TAGS, { kind }), minzoom }
}

/** The `osmium tags-filter` expressions that select every place kind. */
export function placeFilters() {
  const byKey = new Map()
  for (const [key, value] of PLACE_KINDS) byKey.set(key, [...(byKey.get(key) ?? []), value])
  return [...byKey].map(([key, values]) => `nw/${key}=${values.join(',')}`)
}

/**
 * Splits osmium's unique id ("n123", "w123", "a246") into an OSM type and id.
 * Area ids are 2*way_id for ways and 2*relation_id+1 for relations.
 */
export function parseOsmId(uid) {
  const n = Number(uid.slice(1))
  switch (uid[0]) {
    case 'n':
      return { type: 'node', id: n }
    case 'w':
      return { type: 'way', id: n }
    case 'a':
      return n % 2 === 0 ? { type: 'way', id: n / 2 } : { type: 'relation', id: (n - 1) / 2 }
    default:
      throw new Error(`Unknown OSM id: ${uid}`)
  }
}

/** Rough centre of a Polygon or MultiPolygon: the middle of its bounding box. */
export function centreOf(geometry) {
  const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const round = (v) => Math.round(v * 1e6) / 1e6
  return [round((minX + maxX) / 2), round((minY + maxY) / 2)]
}
