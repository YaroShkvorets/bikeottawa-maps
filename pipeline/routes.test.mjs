import assert from 'node:assert/strict'
import { test } from 'node:test'
import { routeIndex } from './routes.mjs'

const head = 'v1 dV c0 t2024-01-01T00:00:00Z i0 u'
const OPL = [
  `r1 ${head} Tname=Ottawa%20%River%20%Pathway,network=lcn,route=bicycle,type=route Mw10@,w11@`,
  `r2 ${head} Tname=Capital%20%Pathway,network=rcn,operator=NCC,route=bicycle,type=superroute Mr1@`,
  `r3 ${head} Tname=Trans%20%Canada%20%Trail,network=ncn,ref=TCT,route=bicycle,type=superroute Mr2@`,
  `r4 ${head} Tname=Crosstown%20%Bikeway%20%3,network=lcn,ref=3,route=bicycle,type=route Mw11@,w12@`,
  `r5 ${head} Tname=Sentier%20%vélo%20%de%20%Montagne,route=mtb,type=route Mw20@`,
  `r6 ${head} Tname=Rideau%20%Trail,network=rwn,route=hiking,type=route Mw10@,w30@`,
]

test('routes are read with their rank and what they are part of', () => {
  const { routes } = routeIndex(OPL)
  assert.deepEqual(routes.get('1'), { name: 'Ottawa River Pathway', level: 'local', parents: ['2'] })
  assert.deepEqual(routes.get('2').parents, ['3'])
  assert.equal(routes.get('5').level, 'mtb')
  assert.equal(routes.has('6'), false, 'hiking routes are left out')
})

test('a way takes the rank of the most important route it is part of, however deep', () => {
  const { wayProps } = routeIndex(OPL)
  // In the Ottawa River Pathway, so in the Capital Pathway and the Trans Canada Trail.
  assert.deepEqual(wayProps('10'), { routes: '1', all: ',1,2,3,', level: 'national', label: 'Ottawa River Pathway' })
  // Also in Crosstown Bikeway 3; the national route still names it.
  assert.deepEqual(wayProps('11'), {
    routes: '1,4',
    all: ',1,2,3,4,',
    level: 'national',
    label: 'Ottawa River Pathway',
  })
  // Only on the bikeway: labelled with its number.
  assert.deepEqual(wayProps('12'), { routes: '4', all: ',4,', level: 'local', label: '3' })
  assert.deepEqual(wayProps('20'), { routes: '5', all: ',5,', level: 'mtb', label: 'Sentier vélo de Montagne' })
  assert.equal(wayProps('30'), null)
})
