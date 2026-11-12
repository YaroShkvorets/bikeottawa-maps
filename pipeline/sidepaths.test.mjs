import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sidepathIndex } from './sidepaths.mjs'

// O'Connor-like: a street and a cycleway about 8 m east of it, 300 m long.
const street = [
  [-75.693, 45.408],
  [-75.6945, 45.4106],
]
const track = [
  [-75.6929, 45.408],
  [-75.6944, 45.4106],
]

test('a street with a cycleway alongside is told so; one far from any is not', () => {
  const alongside = sidepathIndex([track])
  assert.equal(alongside(street), true)
  const away = street.map(([x, y]) => [x + 0.003, y])
  assert.equal(alongside(away), false)
})

test('a cycleway that only crosses the street does not count', () => {
  const crossing = [
    [-75.696, 45.4093],
    [-75.692, 45.4093],
  ]
  assert.equal(sidepathIndex([crossing])(street), false)
})
