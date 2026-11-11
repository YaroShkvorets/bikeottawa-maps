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
