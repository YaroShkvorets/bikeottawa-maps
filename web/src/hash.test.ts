import { describe, expect, it } from 'vitest'
import { osmViewUrl, parseHash, withHashParam } from './hash'

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

describe('osmViewUrl', () => {
  it('opens the same view, one zoom level further in', () => {
    expect(osmViewUrl('#map=12.7/45.4125/-75.6765/30/45&layer=night')).toBe(
      'https://www.openstreetmap.org/#map=14/45.4125/-75.6765',
    )
  })
  it('falls back to the home page without a map entry', () => {
    expect(osmViewUrl('#layer=night')).toBe('https://www.openstreetmap.org/')
  })
})
