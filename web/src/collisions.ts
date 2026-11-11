import type { FeatureCollection, Point } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Traffic collisions involving cyclists or pedestrians, from the City of
 * Ottawa's open data (pipeline/fetch-collisions.mjs writes public/data/collisions.geojson).
 */

/** Worst injury in the collision, least to most severe. */
export const SEVERITIES = ['none', 'minimal', 'minor', 'major', 'fatal'] as const
export type Severity = (typeof SEVERITIES)[number]

/** Who was hurt or involved, besides people in vehicles. */
export const COLLISION_PARTIES = ['bike', 'foot'] as const
export type CollisionParty = (typeof COLLISION_PARTIES)[number]

/** The years in the data. 2023 was never published by the city. */
export const COLLISION_YEARS = { first: 2017, last: 2024, missing: [2023] } as const

export interface CollisionFilters {
  parties: readonly CollisionParty[]
  from: number
  to: number
  severities: readonly Severity[]
}

/** Cyclists only, every year, every injury level. */
export const DEFAULT_COLLISION_FILTERS: CollisionFilters = {
  parties: ['bike'],
  from: COLLISION_YEARS.first,
  to: COLLISION_YEARS.last,
  severities: SEVERITIES,
}

export interface CollisionProps {
  id: string
  year: number
  date: string
  severity: Severity
  bicycles: number
  pedestrians: number
  vehicles: number
  location?: string
  impact?: string
  light?: string
  surface?: string
  weather?: string
  control?: string
}

/** Whether a collision passes the filters. */
export function matchesCollision(p: CollisionProps, f: CollisionFilters): boolean {
  const party = (f.parties.includes('bike') && p.bicycles > 0) || (f.parties.includes('foot') && p.pedestrians > 0)
  return party && p.year >= f.from && p.year <= f.to && f.severities.includes(p.severity)
}

/** The same test as a map filter. */
export function collisionFilter(f: CollisionFilters): ExpressionSpecification {
  const parties: ExpressionSpecification[] = []
  if (f.parties.includes('bike')) parties.push(['>', ['get', 'bicycles'], 0])
  if (f.parties.includes('foot')) parties.push(['>', ['get', 'pedestrians'], 0])
  return [
    'all',
    parties.length ? ['any', ...parties] : false,
    ['>=', ['get', 'year'], f.from],
    ['<=', ['get', 'year'], f.to],
    ['in', ['get', 'severity'], ['literal', [...f.severities]]],
  ]
}

/** How many collisions at each injury level pass the filters (ignoring the severity filter). */
export function countBySeverity(all: readonly CollisionProps[], f: CollisionFilters): Record<Severity, number> {
  const counts = { none: 0, minimal: 0, minor: 0, major: 0, fatal: 0 }
  const everySeverity = { ...f, severities: SEVERITIES }
  for (const p of all) if (matchesCollision(p, everySeverity)) counts[p.severity]++
  return counts
}

/**
 * In the URL as `collisions=bike,foot;2019-2024;major,fatal`, each part left
 * out when it is the default.
 */
export function formatCollisionFilters(f: CollisionFilters): string | null {
  const d = DEFAULT_COLLISION_FILTERS
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v) => b.includes(v))
  const parts = [
    same(f.parties, d.parties) ? '' : f.parties.join(','),
    f.from === d.from && f.to === d.to ? '' : `${f.from}-${f.to}`,
    same(f.severities, d.severities) ? '' : f.severities.join(','),
  ]
  return parts.some(Boolean) ? parts.join(';').replace(/;+$/, '') : null
}

export function parseCollisionFilters(text: string | undefined): CollisionFilters {
  const d = DEFAULT_COLLISION_FILTERS
  const [partyText, yearText, severityText] = (text ?? '').split(';')
  const parties = (partyText ?? '')
    .split(',')
    .filter((v): v is CollisionParty => COLLISION_PARTIES.includes(v as never))
  const severities = (severityText ?? '').split(',').filter((v): v is Severity => SEVERITIES.includes(v as never))
  const [from, to] = (yearText ?? '').split('-').map(Number)
  const inRange = (y: number) => Number.isInteger(y) && y >= COLLISION_YEARS.first && y <= COLLISION_YEARS.last
  const years = inRange(from) && inRange(to) && from <= to ? { from, to } : { from: d.from, to: d.to }
  return {
    parties: parties.length ? parties : d.parties,
    ...years,
    severities: severities.length ? severities : d.severities,
  }
}

/**
 * "ALBERT ST @ BANK ST" → "Albert St & Bank St"; "btwn" becomes the word for
 * between. The city writes locations in capitals.
 */
export function collisionLocation(text: string, between: string): string {
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n: string, suffix: string) => n + suffix.toLowerCase())
    .replace(/ @ /g, ' & ')
    .replace(/\bBtwn\b/g, between)
}

/** Collisions at one spot, worst injury first, then the most recent. */
export function worstFirst<T extends { severity?: unknown; date?: unknown }>(items: readonly T[]): T[] {
  const rank = (s: unknown) => SEVERITIES.indexOf(s as Severity)
  return [...items].sort((a, b) => rank(b.severity) - rank(a.severity) || String(b.date).localeCompare(String(a.date)))
}

/** A collision and where it happened. */
export interface Collision {
  props: CollisionProps
  at: [number, number]
}

/** Collisions this close to a spot's centre, in metres, belong to it. */
export const SAME_SPOT_M = 25

/** How much each injury adds to a spot's weight in the heat map. */
const HEAT_WEIGHTS: Record<Severity, number> = { none: 0.15, minimal: 0.3, minor: 0.45, major: 0.8, fatal: 1 }

/** A place where collisions happened: often an intersection, recorded a few metres apart each time. */
export interface CollisionSpot {
  key: string
  at: [number, number]
  /** Worst injury first, then the most recent. */
  items: CollisionProps[]
  worst: Severity
  /** For the heat map: the injuries added up. */
  weight: number
}

function metresBetween([lon1, lat1]: readonly [number, number], [lon2, lat2]: readonly [number, number]): number {
  return Math.hypot((lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * 111320)
}

/**
 * The collisions that pass the filters, grouped into spots: everything within
 * SAME_SPOT_M of where a spot is centred. The city records one intersection
 * under several names (the intersection, and the street segments meeting
 * there) a few metres apart, so names are not used. The places with the most
 * collisions start spots first, so an intersection's main point gathers the
 * others around it.
 */
export function collisionSpots(all: readonly Collision[], f: CollisionFilters): CollisionSpot[] {
  // Collisions recorded at exactly the same point, busiest points first.
  const byPoint = new Map<string, Collision[]>()
  for (const c of all) {
    if (!matchesCollision(c.props, f)) continue
    const key = c.at.join(',')
    byPoint.set(key, [...(byPoint.get(key) ?? []), c])
  }
  const points = [...byPoint.values()].sort((a, b) => b.length - a.length)

  // Spots in a grid of cells about SAME_SPOT_M across, to look only at nearby ones.
  const cellDeg = SAME_SPOT_M / 111320
  const cellOf = ([lon, lat]: readonly [number, number]) => [Math.floor(lon / cellDeg), Math.floor(lat / cellDeg)]
  const grid = new Map<string, { at: [number, number]; members: Collision[] }[]>()
  const spots: { at: [number, number]; members: Collision[] }[] = []
  for (const members of points) {
    const at = members[0].at
    const [cx, cy] = cellOf(at)
    let home: (typeof spots)[number] | undefined
    for (let dx = -2; dx <= 2 && !home; dx++) {
      for (let dy = -1; dy <= 1 && !home; dy++) {
        home = grid.get(`${cx + dx},${cy + dy}`)?.find((s) => metresBetween(s.at, at) <= SAME_SPOT_M)
      }
    }
    if (home) {
      home.members.push(...members)
      continue
    }
    const spot = { at, members: [...members] }
    spots.push(spot)
    const key = `${cx},${cy}`
    grid.set(key, [...(grid.get(key) ?? []), spot])
  }

  return spots.map((spot) => {
    const items = worstFirst(spot.members.map((m) => m.props))
    return {
      key: spot.at.join(','),
      at: spot.at,
      items,
      worst: items[0].severity,
      weight: items.reduce((sum, p) => sum + HEAT_WEIGHTS[p.severity], 0),
    }
  })
}

/** Spots for the map: bigger ones first, so smaller ones are drawn on top of them. */
export function spotsGeoJSON(spots: readonly CollisionSpot[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: [...spots]
      .sort((a, b) => b.items.length - a.items.length)
      .map((spot) => ({
        type: 'Feature',
        properties: { key: spot.key, count: spot.items.length, worst: spot.worst, weight: spot.weight },
        geometry: { type: 'Point', coordinates: spot.at },
      })),
  }
}
