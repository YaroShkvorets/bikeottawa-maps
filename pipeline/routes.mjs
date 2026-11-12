// Signed bike routes (Trans Canada Trail, Route Verte, NCC pathways, Crosstown
// Bikeways...) and mountain-bike routes, from route relations in osmium's OPL
// format. Routes nest: the Ottawa River Pathway is part of both the Capital
// Pathway and the Trans Canada Trail, so a way takes the rank of the most
// important route it is part of, however deep.

import { parseRelation } from './stations.mjs'

/** National, regional, local: from the `network` tag; mountain-bike routes rarely have one. */
const LEVELS = { icn: 'national', ncn: 'national', rcn: 'regional', lcn: 'local' }
/** Best first. */
export const ROUTE_LEVELS = ['national', 'regional', 'local', 'mtb']
/** Refs longer than this are spelled-out names, not numbers to label a line with. */
const SHORT_REF = 5

function levelOf(tags) {
  for (const network of (tags.network ?? '').split(';')) if (LEVELS[network]) return LEVELS[network]
  return tags.route === 'mtb' ? 'mtb' : 'local'
}

const better = (a, b) => (ROUTE_LEVELS.indexOf(a) <= ROUTE_LEVELS.indexOf(b) ? a : b)

/**
 * @param {Iterable<string>} lines OPL lines of route=bicycle and route=mtb relations
 * @returns {{
 *   routes: Map<string, {name?: string, ref?: string, level: string, mtb?: true, operator?: string, website?: string, parents: string[]}>,
 *   wayRoutes: Map<string, string[]>,
 *   wayProps: (wayId: string) => {routes: string, all: string, level: string, label?: string} | null,
 * }} routes by relation id; the routes each way is directly part of; and a way's props for the
 *   tiles: the routes it is directly on, and all of them with the routes those are part of, the
 *   latter wrapped in commas (",1,2,3,") so that a route can be found in it as ",2,".
 */
export function routeIndex(lines) {
  const routes = new Map()
  const wayRoutes = new Map()
  const children = new Map()
  for (const line of lines) {
    if (!line.startsWith('r')) continue
    const id = line.slice(1, line.indexOf(' '))
    const { tags, members } = parseRelation(line)
    if (tags.route !== 'bicycle' && tags.route !== 'mtb') continue
    routes.set(id, {
      ...(tags.name && { name: tags.name }),
      ...(tags.ref && { ref: tags.ref }),
      level: levelOf(tags),
      ...(tags.route === 'mtb' && { mtb: true }),
      ...(tags.operator && { operator: tags.operator }),
      ...((tags.website ?? tags.url) && { website: tags.website ?? tags.url }),
      parents: [],
    })
    for (const member of members) {
      const [type, ref] = member.split('/')
      if (type === 'way') {
        if (!wayRoutes.has(ref)) wayRoutes.set(ref, [])
        wayRoutes.get(ref).push(id)
      } else if (type === 'relation') {
        if (!children.has(id)) children.set(id, [])
        children.get(id).push(ref)
      }
    }
  }
  for (const [parent, kids] of children) for (const kid of kids) routes.get(kid)?.parents.push(parent)

  // A route's rank is the best of its own and of every route it is part of.
  const rank = new Map()
  const rankOf = (id, seen = new Set()) => {
    if (rank.has(id)) return rank.get(id)
    const route = routes.get(id)
    if (!route || seen.has(id)) return 'mtb'
    seen.add(id)
    let level = route.level
    // A mountain-bike trail inside a cycling network stays a mountain-bike trail.
    if (!route.mtb) for (const parent of route.parents) level = better(level, rankOf(parent, seen))
    rank.set(id, level)
    return level
  }

  const withParents = (id, out = new Set()) => {
    if (out.has(id) || !routes.has(id)) return out
    out.add(id)
    for (const parent of routes.get(id).parents) withParents(parent, out)
    return out
  }

  const wayProps = (wayId) => {
    // Best first; the best names the line: its number if it has a short one, else its name.
    const order = (id) => ROUTE_LEVELS.indexOf(rankOf(id))
    const ids = wayRoutes
      .get(wayId)
      ?.filter((id) => routes.has(id))
      .sort((a, b) => order(a) - order(b))
    if (!ids?.length) return null
    const best = ids[0]
    const { ref, name } = routes.get(best)
    const label = ref && ref.length <= SHORT_REF ? ref : name
    const all = new Set()
    for (const id of ids) withParents(id, all)
    return { routes: ids.join(','), all: `,${[...all].join(',')},`, level: rankOf(best), ...(label && { label }) }
  }
  return { routes, wayRoutes, wayProps }
}
