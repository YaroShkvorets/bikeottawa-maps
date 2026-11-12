// Reads `osmium export` output (one GeoJSON feature per line) and writes
// ways, places, lamps and lit (lit ways, for the night layer) .geojsonseq files
// ready for tippecanoe.
// Usage: node pipeline/transform.mjs <input.geojsonseq> <output-dir> [transit.opl]

import { once } from 'node:events'
import { createReadStream, createWriteStream, readFileSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { bikewayProps, centreOf, classifyPlace, classifyWay, isStreetLamp, middleOf, parseOsmId } from './classify.mjs'
import { isLit, lampIndex } from './lamps.mjs'
import { sidepathIndex } from './sidepaths.mjs'
import { stationLines } from './stations.mjs'

const [input, outDir, transit] = process.argv.slice(2)
if (!input || !outDir) {
  console.error('Usage: node pipeline/transform.mjs <input.geojsonseq> <output-dir> [transit.opl]')
  process.exit(1)
}
/** Lines stopping at each station, from route and stop-area relations. */
const linesAt = transit ? stationLines(readFileSync(transit, 'utf8').split('\n')) : new Map()

const ways = createWriteStream(path.join(outDir, 'ways.geojsonseq'))
const places = createWriteStream(path.join(outDir, 'places.geojsonseq'))
const lamps = createWriteStream(path.join(outDir, 'lamps.geojsonseq'))
const lit = createWriteStream(path.join(outDir, 'lit.geojsonseq'))
const counts = { ways: 0, lit: 0, places: 0, lamps: 0, byLts: [0, 0, 0, 0, 0] }

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
await Promise.all([ways, places, lamps, lit].map((stream) => once(stream, 'finish')))
console.log(
  `ways: ${counts.ways} (LTS 1-4: ${counts.byLts.slice(1).join(', ')}; paths closed to bikes: ${counts.byLts[0]}; lit: ${counts.lit}), places: ${counts.places}, street lamps: ${counts.lamps}`,
)
