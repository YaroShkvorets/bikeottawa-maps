import { describe, expect, it } from 'vitest'
import { isPlaceKind, kindsInGroup, PLACE_GROUP_IDS, PLACE_KINDS, placeIconPaths, svgPaths } from './places'

describe('places', () => {
  it('has the 20 kinds of the original amenities map, each in exactly one group', () => {
    expect(PLACE_KINDS).toHaveLength(20)
    expect(PLACE_GROUP_IDS.flatMap(kindsInGroup).sort()).toEqual([...PLACE_KINDS].sort())
  })

  it('has a drawable icon for every kind', () => {
    for (const kind of PLACE_KINDS) {
      const paths = placeIconPaths(kind)
      expect(paths.length, kind).toBeGreaterThan(0)
      for (const d of paths) expect(d, kind).toMatch(/^[Mm][\d\s.,\-a-zA-Z]+$/)
    }
  })

  it('reads paths out of SVG source and drops encoded whitespace', () => {
    expect(svgPaths('<svg><path id="a" d="&#xA;&#x9;M1,2L3,4"/><path d="M5 6z"/></svg>')).toEqual(['M1,2L3,4', 'M5 6z'])
  })

  it('recognises kinds', () => {
    expect(isPlaceKind('bench')).toBe(true)
    expect(isPlaceKind('bank')).toBe(false)
  })
})
