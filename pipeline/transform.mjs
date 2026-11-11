// Reads `osmium export` output (one GeoJSON feature per line) and writes
// ways.geojsonseq and places.geojsonseq ready for tippecanoe.
// Usage: node pipeline/transform.mjs <input.geojsonseq> <output-dir>

import { once } from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { centreOf, classifyPlace, classifyWay, middleOf, parseOsmId } from './classify.mjs'

const [input, outDir] = process.argv.slice(2)
if (!input || !outDir) {
  console.error('Usage: node pipeline/transform.mjs <input.geojsonseq> <output-dir>')
  process.exit(1)
}

const ways = createWriteStream(path.join(outDir, 'ways.geojsonseq'))
const places = createWriteStream(path.join(outDir, 'places.geojsonseq'))
const counts = { ways: 0, places: 0, byLts: [0, 0, 0, 0, 0] }

async function write(stream, feature) {
  if (!stream.write(`${JSON.stringify(feature)}\n`)) await once(stream, 'drain')
}

for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
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
    counts.ways++
    counts.byLts[way.props.lts]++
    await write(ways, {
      type: 'Feature',
      id,
      tippecanoe: { minzoom: way.minzoom },
      properties: way.props,
      geometry: feature.geometry,
    })
  } else if (geomType === 'Point' || geomType === 'Polygon' || geomType === 'MultiPolygon') {
    const place = classifyPlace(tags)
    if (!place || place.line) continue
    counts.places++
    const geometry =
      geomType === 'Point' ? feature.geometry : { type: 'Point', coordinates: centreOf(feature.geometry) }
    await write(places, {
      type: 'Feature',
      tippecanoe: { minzoom: place.minzoom },
      properties: { ...place.props, osm: `${type}/${id}` },
      geometry,
    })
  }
}

ways.end()
places.end()
await Promise.all([once(ways, 'finish'), once(places, 'finish')])
console.log(
  `ways: ${counts.ways} (LTS 1-4: ${counts.byLts.slice(1).join(', ')}; paths closed to bikes: ${counts.byLts[0]}), places: ${counts.places}`,
)
