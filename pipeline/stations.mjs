// Which lines stop at each station. Stations seldom say so themselves: route
// relations list stop positions and platforms, and stop-area relations tie those
// to the station. Reads relations in osmium's OPL format, one per line.

const TYPES = { n: 'node', w: 'way', r: 'relation' }

/** OPL escapes ' ', ',', '=', '@' and non-ASCII as %hex%. */
const decode = (text) => text.replace(/%([0-9a-f]+)%/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))

/** One OPL relation line: its tags, and its members as "node/123" paths. */
export function parseRelation(line) {
  let tags = {}
  let members = []
  for (const field of line.split(' ').slice(1)) {
    const body = field.slice(1)
    if (!body) continue
    if (field[0] === 'T') {
      tags = Object.fromEntries(
        body.split(',').map((pair) => {
          const at = pair.indexOf('=')
          return [decode(pair.slice(0, at)), decode(pair.slice(at + 1))]
        }),
      )
    } else if (field[0] === 'M') {
      members = body.split(',').map((member) => `${TYPES[member[0]]}/${member.slice(1, member.indexOf('@'))}`)
    }
  }
  return { tags, members }
}

/**
 * Line names of each station, keyed by its OSM path ("node/123"): "O-Train 1, 2".
 * A short `ref` is a line number; longer ones (VIA's lists of train numbers) are
 * left out and the network alone names the line.
 * @param {Iterable<string>} lines OPL lines
 * @returns {Map<string, string>}
 */
export function stationLines(lines) {
  const routes = []
  const areas = []
  for (const line of lines) {
    if (!line.startsWith('r')) continue
    const { tags, members } = parseRelation(line)
    const network = tags.network ?? tags.operator
    if (tags.type === 'route' && network) {
      const ref = tags.ref && /^[\w-]{1,3}$/.test(tags.ref) ? tags.ref : null
      routes.push({ network, ref, members: new Set(members) })
    } else if (tags.public_transport === 'stop_area') {
      areas.push(members)
    }
  }
  /** @type {Map<string, Map<string, Set<string>>>} member → network → line numbers */
  const found = new Map()
  for (const members of areas) {
    const served = routes.filter((route) => members.some((member) => route.members.has(member)))
    for (const member of members) {
      for (const { network, ref } of served) {
        const networks = found.get(member) ?? new Map()
        const refs = networks.get(network) ?? new Set()
        if (ref) refs.add(ref)
        networks.set(network, refs)
        found.set(member, networks)
      }
    }
  }
  const byNumber = (a, b) => a.localeCompare(b, 'en', { numeric: true })
  return new Map(
    [...found].map(([member, networks]) => [
      member,
      [...networks]
        .sort(([a], [b]) => byNumber(a, b))
        .map(([network, refs]) => (refs.size ? `${network} ${[...refs].sort(byNumber).join(', ')}` : network))
        .join(' / '),
    ]),
  )
}
