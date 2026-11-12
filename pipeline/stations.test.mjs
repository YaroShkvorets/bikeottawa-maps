import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRelation, stationLines } from './stations.mjs'

const OPL = [
  'r1 v1 dV c0 t2024-01-01T00:00:00Z i0 u Tname=O-Train%20%Line%20%2,network=O-Train,ref=2,route=light_rail,type=route Mn11@stop,n21@stop',
  'r2 v1 dV c0 t2024-01-01T00:00:00Z i0 u Tnetwork=O-Train,ref=1,route=light_rail,type=route Mn12@stop',
  'r3 v1 dV c0 t2024-01-01T00:00:00Z i0 u Tnetwork=VIA%20%Rail,ref=40;42;44,route=train,type=route Mn31@stop',
  'r10 v1 dV c0 t2024-01-01T00:00:00Z i0 u Tname=Bayview,public_transport=stop_area,type=public_transport Mn1@,n11@stop,n12@stop',
  'r20 v1 dV c0 t2024-01-01T00:00:00Z i0 u Tpublic_transport=stop_area,type=public_transport Mw2@,n21@stop',
  'r30 v1 dV c0 t2024-01-01T00:00:00Z i0 u Tpublic_transport=stop_area,type=public_transport Mn3@,n31@stop',
  'r40 v1 dV c0 t2024-01-01T00:00:00Z i0 u Tpublic_transport=stop_area,type=public_transport Mn4@',
]

test('OPL relations are read with their escapes undone', () => {
  const { tags, members } = parseRelation(OPL[0])
  assert.equal(tags.name, 'O-Train Line 2')
  assert.deepEqual(members, ['node/11', 'node/21'])
})

test('stations get the lines of their stop area, numbered lines grouped by network', () => {
  const lines = stationLines(OPL)
  assert.equal(lines.get('node/1'), 'O-Train 1, 2')
  assert.equal(lines.get('way/2'), 'O-Train 2')
  // Train numbers are not line names: the network alone names it.
  assert.equal(lines.get('node/3'), 'VIA Rail')
  assert.equal(lines.has('node/4'), false)
})
