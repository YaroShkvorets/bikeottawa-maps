import { describe, expect, it } from 'vitest'
import {
  type CollisionProps,
  collisionLocation,
  collisionSpots,
  countBySeverity,
  DEFAULT_COLLISION_FILTERS,
  formatCollisionFilters,
  matchesCollision,
  parseCollisionFilters,
  worstFirst,
} from './collisions'

const collision = (patch: Partial<CollisionProps>): CollisionProps => ({
  id: '1',
  year: 2022,
  date: '2022-06-01',
  severity: 'minor',
  bicycles: 1,
  pedestrians: 0,
  vehicles: 1,
  ...patch,
})

describe('collision filters', () => {
  it('shows cyclists in every year by default', () => {
    expect(matchesCollision(collision({}), DEFAULT_COLLISION_FILTERS)).toBe(true)
    expect(matchesCollision(collision({ bicycles: 0, pedestrians: 1 }), DEFAULT_COLLISION_FILTERS)).toBe(false)
  })
  it('filters by year and injury', () => {
    const f = { ...DEFAULT_COLLISION_FILTERS, from: 2020, to: 2021, severities: ['fatal', 'major'] as const }
    expect(matchesCollision(collision({ year: 2021, severity: 'major' }), f)).toBe(true)
    expect(matchesCollision(collision({ year: 2022, severity: 'major' }), f)).toBe(false)
    expect(matchesCollision(collision({ year: 2021, severity: 'minor' }), f)).toBe(false)
  })
  it('counts each injury level, whatever the injury filter', () => {
    const all = [collision({ severity: 'fatal' }), collision({ severity: 'fatal' }), collision({ severity: 'none' })]
    const counts = countBySeverity(all, { ...DEFAULT_COLLISION_FILTERS, severities: ['minor'] })
    expect(counts.fatal).toBe(2)
    expect(counts.none).toBe(1)
  })
})

describe('collision filters in the URL', () => {
  it('leaves the defaults out', () => {
    expect(formatCollisionFilters(DEFAULT_COLLISION_FILTERS)).toBeNull()
    expect(parseCollisionFilters(undefined)).toEqual(DEFAULT_COLLISION_FILTERS)
  })
  it('round-trips', () => {
    const f = {
      parties: ['bike', 'foot'] as const,
      from: 2019,
      to: 2024,
      severities: ['major', 'fatal'] as const,
    }
    const text = formatCollisionFilters(f)
    expect(text).toBe('bike,foot;2019-2024;major,fatal')
    expect(parseCollisionFilters(text ?? undefined)).toEqual(f)
  })
  it('ignores junk', () => {
    expect(parseCollisionFilters('cars;1990-3000;bad')).toEqual(DEFAULT_COLLISION_FILTERS)
  })
})

describe('collisionLocation', () => {
  it('reads like a street name', () => {
    expect(collisionLocation('ALBERT ST @ BANK ST', 'between')).toBe('Albert St & Bank St')
    expect(collisionLocation('MERIVALE RD btwn CALDWELL AVE & 3RD AVE', 'entre')).toBe(
      'Merivale Rd entre Caldwell Ave & 3rd Ave',
    )
  })
})

describe('worstFirst', () => {
  it('puts the worst injury first, then the most recent', () => {
    const order = worstFirst([
      { id: 'a', severity: 'minor', date: '2024-05-01' },
      { id: 'b', severity: 'fatal', date: '2018-01-01' },
      { id: 'c', severity: 'minor', date: '2021-05-01' },
      { id: 'd', severity: 'none', date: '2024-06-01' },
    ])
    expect(order.map((c) => c.id)).toEqual(['b', 'a', 'c', 'd'])
  })
})

describe('collisionSpots', () => {
  const at = (dLat: number): [number, number] => [-75.68578, 45.428754 + dLat]
  const c = (id: string, location: string, dLat: number, severity: CollisionProps['severity'] = 'minor') => ({
    props: collision({ id, location, severity }),
    at: at(dLat),
  })
  it('groups an intersection recorded a few metres apart, worst first', () => {
    const spots = collisionSpots(
      [c('a', 'KING EDWARD AVE @ RIDEAU ST', 0), c('b', 'KING EDWARD AVE @ RIDEAU ST', 0.00003, 'fatal')],
      DEFAULT_COLLISION_FILTERS,
    )
    expect(spots).toHaveLength(1)
    expect(spots[0].items.map((p) => p.id)).toEqual(['b', 'a'])
    expect(spots[0].worst).toBe('fatal')
  })
  it('groups by distance, whatever the name, and keeps far points apart', () => {
    const spots = collisionSpots(
      [
        c('a', 'KING EDWARD AVE @ RIDEAU ST', 0),
        c('b', 'KING EDWARD AVE @ RIDEAU ST', 0),
        // A street segment's collision recorded 7 m from the intersection.
        c('c', 'RIDEAU ST btwn CUMBERLAND ST & KING EDWARD AVE', 0.000063),
        // 110 m away: another spot.
        c('d', 'RIDEAU ST btwn KING EDWARD AVE & NELSON ST', 0.001),
      ],
      DEFAULT_COLLISION_FILTERS,
    )
    expect(spots.map((s) => s.items.length).sort()).toEqual([1, 3])
    // The spot sits where most of its collisions were recorded.
    expect(spots.find((s) => s.items.length === 3)?.at).toEqual(at(0))
  })
  it('counts only what the filters show', () => {
    const spots = collisionSpots([c('a', 'X', 0, 'fatal'), c('b', 'X', 0, 'minor')], {
      ...DEFAULT_COLLISION_FILTERS,
      severities: ['minor'],
    })
    expect(spots[0].items).toHaveLength(1)
    expect(spots[0].worst).toBe('minor')
  })
})
