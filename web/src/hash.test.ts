import { describe, expect, it } from 'vitest'
import { parseHash, withHashParam } from './hash'

describe('parseHash', () => {
  it('reads entries and keeps slashes in the map entry', () => {
    expect(parseHash('#map=13/45.42/-75.69&layer=winter')).toEqual({ map: '13/45.42/-75.69', layer: 'winter' })
  })
  it('ignores empty and malformed parts', () => {
    expect(parseHash('')).toEqual({})
    expect(parseHash('#foo&=x&layer=places')).toEqual({ layer: 'places' })
  })
})

describe('withHashParam', () => {
  it('adds, replaces and removes an entry without touching the others', () => {
    expect(withHashParam('#map=13/45.42/-75.69', 'layer', 'winter')).toBe('#map=13/45.42/-75.69&layer=winter')
    expect(withHashParam('#layer=winter&map=13/45.42/-75.69', 'layer', 'places')).toBe(
      '#layer=places&map=13/45.42/-75.69',
    )
    expect(withHashParam('#map=13/45.42/-75.69&layer=winter', 'layer', null)).toBe('#map=13/45.42/-75.69')
  })
  it('handles an empty hash', () => {
    expect(withHashParam('', 'layer', 'winter')).toBe('#layer=winter')
    expect(withHashParam('#layer=winter', 'layer', null)).toBe('')
  })
})
