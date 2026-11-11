import { describe, expect, it, vi } from 'vitest'

// The module reads the region and the page address at import time.
vi.mock('../config', () => ({ REGION: { bbox: [-76.4, 44.95, -75.2, 45.65], center: [-75.7, 45.42] } }))

const { addressLabel, placeLabel } = await import('./geocode')

describe('placeLabel', () => {
  it('leads with the name and skips repeated or missing parts', () => {
    expect(
      placeLabel({
        name: 'Lansdowne Park',
        housenumber: '450',
        street: 'Queen Elizabeth Driveway',
        district: 'Capital',
      }),
    ).toBe('Lansdowne Park, 450 Queen Elizabeth Driveway, Capital')
    expect(placeLabel({ name: 'Bank Street', street: 'Bank Street', city: 'Ottawa' })).toBe('Bank Street, Ottawa')
    expect(placeLabel({})).toBe('')
  })
})

describe('addressLabel', () => {
  it('prefers the address to the name of whatever is nearest', () => {
    expect(
      addressLabel({
        name: 'Some Shop',
        housenumber: '111',
        street: 'Albert Street',
        district: 'Centretown',
        city: 'Ottawa',
      }),
    ).toBe('111 Albert Street, Centretown')
    expect(addressLabel({ housenumber: '1086', street: 'Barwell Avenue', city: 'Ottawa' })).toBe(
      '1086 Barwell Avenue, Ottawa',
    )
  })
  it('falls back to a street or a name', () => {
    expect(addressLabel({ street: 'Colonel By Drive' })).toBe('Colonel By Drive')
    expect(addressLabel({ name: 'Rideau Canal Western Pathway', city: 'Ottawa' })).toBe(
      'Rideau Canal Western Pathway, Ottawa',
    )
    expect(addressLabel({})).toBe('')
  })
})
