import { describe, expect, it } from 'vitest'
import { translator } from './i18n'
import { wayType } from './wayType'

const t = translator('en')

describe('wayType', () => {
  it('names the road type', () => {
    expect(wayType({ highway: 'residential' }, t)).toBe('Residential street')
    expect(wayType({ highway: 'trunk' }, t)).toBe('Trunk road')
  })
  it('adds the service road kind and the sidewalk', () => {
    expect(wayType({ highway: 'service', service: 'driveway' }, t)).toBe('Service road · Driveway')
    expect(wayType({ highway: 'service', service: 'parking_aisle' }, t)).toBe('Service road · Parking aisle')
    expect(wayType({ highway: 'footway', footway: 'sidewalk' }, t)).toBe('Footpath · Sidewalk')
  })
  it('marks ramps and reads unknown values', () => {
    expect(wayType({ highway: 'primary_link' }, t)).toBe('Primary road · Ramp')
    expect(wayType({ highway: 'service', service: 'loading_dock' }, t)).toBe('Service road · Loading dock')
    expect(wayType({}, t)).toBe('')
  })
})
