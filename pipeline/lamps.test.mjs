import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isLit, lampIndex } from './lamps.mjs'

// A street running east for about 400 m at Ottawa's latitude, with a lamp every ~39 m along its first half.
const street = [
  [-75.7, 45.4],
  [-75.6949, 45.4],
]
const lamps = Array.from({ length: 6 }, (_, i) => [-75.7 + i * 0.0005, 45.40008])

test('a street with lamps along half of it is half lit', () => {
  const share = lampIndex(lamps).litShare(street)
  assert.ok(share > 0.45 && share < 0.65, `share was ${share}`)
})

test('lamps only count within reach of the way', () => {
  const index = lampIndex(lamps)
  const parallel = street.map(([lon, lat]) => [lon, lat + 0.0005]) // about 55 m north
  assert.equal(index.litShare(parallel), 0)
  const alongside = street.map(([lon, lat]) => [lon, lat + 0.0001]) // about 11 m north
  assert.ok(index.litShare(alongside) > 0.45)
})

test('short ways and missing lamps are handled', () => {
  const index = lampIndex(lamps)
  assert.equal(index.litShare([[-75.7, 45.4]]), 1)
  assert.equal(index.litShare([[-75.69, 45.4]]), 0)
  assert.equal(lampIndex([]).litShare(street), 0)
  assert.equal(index.litShare([]), 0)
})

test('the lit tag overrides what the lamps suggest', () => {
  assert.equal(isLit({ highway: 'residential' }, 0.8), true)
  assert.equal(isLit({ highway: 'residential' }, 0.2), false)
  assert.equal(isLit({ highway: 'path', lit: 'yes' }, 0), true)
  assert.equal(isLit({ highway: 'path', lit: 'no' }, 1), false)
})
