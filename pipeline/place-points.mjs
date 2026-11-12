// Writes where the places of each kind are, one small file per kind, so that
// the How far map can count the places within reach without loading tiles.
// Each file is a flat array: [lon, lat, lon, lat, ...], to the metre.
// Usage: node pipeline/place-points.mjs <places.geojsonseq> <output-dir>

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [input, outDir] = process.argv.slice(2)
if (!input || !outDir) {
  console.error('Usage: node pipeline/place-points.mjs <places.geojsonseq> <output-dir>')
  process.exit(1)
}

/** @returns {Map<string, number[]>} each kind's coordinates, flat */
function pointsByKind(lines) {
  const byKind = new Map()
  for (const line of lines) {
    if (!line) continue
    const { properties, geometry } = JSON.parse(line)
    if (!byKind.has(properties.kind)) byKind.set(properties.kind, [])
    const [lon, lat] = geometry.coordinates
    byKind.get(properties.kind).push(Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5)
  }
  return byKind
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
const byKind = pointsByKind(readFileSync(input, 'utf8').split('\n'))
for (const [kind, points] of byKind) writeFileSync(path.join(outDir, `${kind}.json`), JSON.stringify(points))
console.log(`place points: ${byKind.size} kinds`)
