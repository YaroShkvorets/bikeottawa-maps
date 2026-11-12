// Reads `osmium export` output (one GeoJSON feature per line) and writes
// ways, places, lamps, lit (lit ways, for the night layer) and routes (ways on
// signed bike routes) .geojsonseq files ready for tippecanoe, and routes.json,
// the routes themselves.
// Usage: node pipeline/transform.mjs <input.geojsonseq> <output-dir> [transit.opl] [routes.opl]

import { once } from 'node:events'
import { createReadStream, createWriteStream, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { bikewayProps, centreOf, classifyPlace, classifyWay, isStreetLamp, middleOf, parseOsmId } from './classify.mjs'
import { isLit, lampIndex } from './lamps.mjs'
import { ROUTE_LEVELS, routeIndex } from './routes.mjs'
import { sidepathIndex } from './sidepaths.mjs'
import { stationLines } from './stations.mjs'

const [input, outDir, transit, routesOpl] = process.argv.slice(2)
if (!input || !outDir) {
  console.error('Usage: node pipeline/transform.mjs <input.geojsonseq> <output-dir> [transit.opl] [routes.opl]')
  process.exit(1)
}
/** Lines stopping at each station, from route and stop-area relations. */
const linesAt = transit ? stationLines(readFileSync(transit, 'utf8').split('\n')) : new Map()
/** Signed bike and mountain-bike routes, and the ways on them. */
const bikeRoutes = routeIndex(routesOpl ? readFileSync(routesOpl, 'utf8').split('\n') : [])
/** Routes from far out by rank; local and mountain-bike ones once closer in. */
const ROUTE_MINZOOM = { national: 9, regional: 9, local: 11, mtb: 11 }

const ways = createWriteStream(path.join(outDir, 'ways.geojsonseq'))
const places = createWriteStream(path.join(outDir, 'places.geojsonseq'))
const lamps = createWriteStream(path.join(outDir, 'lamps.geojsonseq'))
const lit = createWriteStream(path.join(outDir, 'lit.geojsonseq'))
const routeWays = createWriteStream(path.join(outDir, 'routes.geojsonseq'))
const counts = { ways: 0, lit: 0, places: 0, lamps: 0, routeWays: 0, byLts: [0, 0, 0, 0, 0] }
/** Metres of each way on a route, within the map area. */
const routeWayLength = new Map()

function metres(coords) {
  let sum = 0
  for (let i = 1; i < coords.length; i++) {
    const [a, b] = [coords[i - 1], coords[i]]
    const kx = 111_320 * Math.cos((a[1] * Math.PI) / 180)
    sum += Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 111_320)
  }
  return sum
}

async function write(stream, feature) {
  if (!stream.write(`${JSON.stringify(feature)}\n`)) await once(stream, 'drain')
}

/** Further out than this the night layer shows lit streets, not single lamps. */
const LAMPS_MINZOOM = 12

const lines = () => createInterface({ input: createReadStream(input), crlfDelay: Infinity })

// First pass: where the street lamps are, so that ways can be told whether they
// are lit; and the cycleways, so that streets can be told they have one alongside.
const lampPositions = []
const cycleways = []
for await (const line of lines()) {
  const lamp = line.includes('"street_lamp"')
  if (!lamp && !line.includes('"cycleway"')) continue
  const feature = JSON.parse(line)
  if (lamp && feature.geometry.type === 'Point' && isStreetLamp(feature.properties))
    lampPositions.push(feature.geometry.coordinates)
  else if (feature.properties.highway === 'cycleway' && feature.geometry.type === 'LineString')
    cycleways.push(feature.geometry.coordinates)
}
const { litShare } = lampIndex(lampPositions)
const hasSidepath = sidepathIndex(cycleways)

for await (const line of lines()) {
  if (!line) continue
  const feature = JSON.parse(line)
  const { type, id } = parseOsmId(feature.id)
  const geomType = feature.geometry.type
  const tags = feature.properties

  if (geomType === 'LineString' && type === 'way') {
    // A few places are mapped as lines (stairs with a bike ramp); they become a point.
    const linePlace = classifyPlace(tags)
    if (linePlace?.line) {
      counts.places++
      await write(places, {
        type: 'Feature',
        tippecanoe: { minzoom: linePlace.minzoom },
        properties: { ...linePlace.props, osm: `${type}/${id}` },
        geometry: { type: 'Point', coordinates: middleOf(feature.geometry.coordinates) },
      })
    }
    // Ways on signed routes go to a file of their own, whatever else they are.
    const onRoute = bikeRoutes.wayProps(String(id))
    if (onRoute) {
      counts.routeWays++
      routeWayLength.set(String(id), metres(feature.geometry.coordinates))
      await write(routeWays, {
        type: 'Feature',
        tippecanoe: { minzoom: ROUTE_MINZOOM[onRoute.level] },
        properties: onRoute,
        geometry: feature.geometry,
      })
    }
    const way = classifyWay(tags)
    if (!way) continue
    // A street's track that is also mapped on its own is drawn once, as that way.
    if (way.props.kind === 'street' && way.props.bikeway === 'dedicated' && hasSidepath(feature.geometry.coordinates)) {
      for (const key of Object.keys(way.props)) if (key.startsWith('bikeway')) delete way.props[key]
      Object.assign(way.props, bikewayProps(tags, { ignoreTrack: true }))
    }
    counts.ways++
    counts.byLts[way.props.lts]++
    // Lit ways glow on the night layer. They go in a file of their own, bare, so
    // that all of them can show however far out the map is zoomed.
    if (isLit(tags, litShare(feature.geometry.coordinates))) {
      counts.lit++
      await write(lit, { type: 'Feature', properties: {}, geometry: feature.geometry })
    }
    await write(ways, {
      type: 'Feature',
      id,
      tippecanoe: { minzoom: way.minzoom },
      properties: way.props,
      geometry: feature.geometry,
    })
  } else if (geomType === 'Point' && isStreetLamp(tags)) {
    counts.lamps++
    await write(lamps, {
      type: 'Feature',
      tippecanoe: { minzoom: LAMPS_MINZOOM },
      properties: {},
      geometry: feature.geometry,
    })
  } else if (geomType === 'Point' || geomType === 'Polygon' || geomType === 'MultiPolygon') {
    const place = classifyPlace(tags)
    if (!place || place.line) continue
    counts.places++
    const geometry =
      geomType === 'Point' ? feature.geometry : { type: 'Point', coordinates: centreOf(feature.geometry) }
    const lines = place.props.kind === 'station' ? linesAt.get(`${type}/${id}`) : undefined
    await write(places, {
      type: 'Feature',
      tippecanoe: { minzoom: place.minzoom },
      properties: { ...place.props, ...(lines && { lines }), osm: `${type}/${id}` },
      geometry,
    })
  }
}

ways.end()
places.end()
lamps.end()
lit.end()
routeWays.end()
await Promise.all([ways, places, lamps, lit, routeWays].map((stream) => once(stream, 'finish')))

// The routes with any length in the map area, and the routes those are part of,
// each with its length here: that of every way on it or on a route within it.
const waysOf = new Map()
for (const [way, ids] of bikeRoutes.wayRoutes) {
  if (!routeWayLength.has(way)) continue
  const climb = (id, seen) => {
    if (seen.has(id) || !bikeRoutes.routes.has(id)) return
    seen.add(id)
    if (!waysOf.has(id)) waysOf.set(id, new Set())
    waysOf.get(id).add(way)
    for (const parent of bikeRoutes.routes.get(id).parents) climb(parent, seen)
  }
  for (const id of ids) climb(id, new Set())
}
const routesOut = {}
for (const [id, wayIds] of waysOf) {
  const { parents, ...route } = bikeRoutes.routes.get(id)
  let sum = 0
  for (const way of wayIds) sum += routeWayLength.get(way)
  routesOut[id] = { ...route, km: Math.round(sum / 100) / 10, ...(parents.length && { parents }) }
}
writeFileSync(path.join(outDir, 'routes.json'), JSON.stringify(routesOut))
const byLevel = ROUTE_LEVELS.map((level) => Object.values(routesOut).filter((r) => r.level === level).length)
console.log(
  `ways: ${counts.ways} (LTS 1-4: ${counts.byLts.slice(1).join(', ')}; paths closed to bikes: ${counts.byLts[0]}; lit: ${counts.lit}), places: ${counts.places}, street lamps: ${counts.lamps}, routes: ${Object.keys(routesOut).length} (national, regional, local, mtb: ${byLevel.join(', ')}) over ${counts.routeWays} ways`,
)
