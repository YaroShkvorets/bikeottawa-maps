// Downloads the City of Ottawa's traffic collisions that involve a cyclist or a
// pedestrian and writes them, trimmed to what the map shows, to
// web/public/data/collisions.geojson. The file is committed; run this again
// (npm run collisions) when the city publishes a new year, usually each summer.
// Data: Open Government Licence – Ottawa.

import { writeFile } from 'node:fs/promises'

const SERVICE =
  'https://services.arcgis.com/G6F8XLCl5KtAlZ2G/arcgis/rest/services/Traffic_Collisions_by_Location_2017-2024_(excluding_2023)/FeatureServer/0'
const OUT = new URL('../web/public/data/collisions.geojson', import.meta.url)
const PAGE = 1000

/** "02 - Non-fatal injury" → "Non-fatal injury"; the city's codes carry a number in front. */
const label = (value) =>
  value
    ? String(value)
        .replace(/^\d+\s*-\s*/, '')
        .trim()
    : undefined

const SEVERITIES = { Fatal: 'fatal', Major: 'major', Minor: 'minor', Minimal: 'minimal' }

async function page(offset) {
  const params = new URLSearchParams({
    where: 'num_of_bicycles > 0 OR num_of_pedestrians > 0',
    outFields:
      'ID,Accident_Year,Accident_Date,Location,Initial_Impact_Type,Road_1_Surface_Condition,Environment_Condition,Light,Traffic_Control,num_of_vehicles,num_of_pedestrians,num_of_bicycles,Max_injury,Lat,Long',
    returnGeometry: 'false',
    orderByFields: 'ObjectId',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: 'json',
  })
  const res = await fetch(`${SERVICE}/query?${params}`)
  if (!res.ok) throw new Error(`City of Ottawa service: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`City of Ottawa service: ${data.error.message}`)
  return data.features.map((f) => f.attributes)
}

const rows = []
for (let offset = 0; ; offset += PAGE) {
  const batch = await page(offset)
  rows.push(...batch)
  if (batch.length < PAGE) break
}

const features = rows
  .filter((r) => Number.isFinite(r.Lat) && Number.isFinite(r.Long))
  .map((r) => {
    const properties = {
      id: r.ID,
      year: r.Accident_Year,
      date: r.Accident_Date,
      // Worst injury: fatal, major, minor, minimal, or none (damage only).
      severity: SEVERITIES[r.Max_injury] ?? 'none',
      // Counts come as numbers or as text, depending on the year.
      bicycles: Number(r.num_of_bicycles ?? 0),
      pedestrians: Number(r.num_of_pedestrians ?? 0),
      vehicles: Number(r.num_of_vehicles ?? 0),
      location: r.Location?.replace(/\s*\([^)]*\)\s*$/, ''),
      impact: label(r.Initial_Impact_Type),
      light: label(r.Light),
      surface: label(r.Road_1_Surface_Condition),
      weather: label(r.Environment_Condition),
      control: label(r.Traffic_Control),
    }
    for (const key of Object.keys(properties)) if (properties[key] === undefined) delete properties[key]
    return {
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [Math.round(r.Long * 1e6) / 1e6, Math.round(r.Lat * 1e6) / 1e6] },
    }
  })
  // The worst ones drawn last, on top.
  .sort((a, b) => order(a) - order(b))

function order(feature) {
  return ['none', 'minimal', 'minor', 'major', 'fatal'].indexOf(feature.properties.severity)
}

const years = [...new Set(features.map((f) => f.properties.year))].sort()
const collection = {
  type: 'FeatureCollection',
  properties: {
    source: 'City of Ottawa, Traffic Collisions by Location (Open Government Licence – Ottawa)',
    years,
    fetched: new Date().toISOString().slice(0, 10),
  },
  features,
}
await writeFile(OUT, `${JSON.stringify(collection)}\n`)
const cyclists = features.filter((f) => f.properties.bicycles > 0).length
console.log(`collisions: ${features.length} (cyclists ${cyclists}), years ${years.join(', ')}`)
