import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import { BASEMAP_IDS, LAYER_IDS } from '../layers'
import { PLACE_KINDS } from '../places'
import { buildStyle, INTERACTIVE_LAYERS, type StyleState } from './style'

const state: StyleState = {
  lang: 'en',
  basemap: 'light',
  layer: 'comfort',
  placeKinds: PLACE_KINDS,
  selected: null,
  route: null,
  routeHighlight: null,
}
const build = (patch: Partial<StyleState> = {}) => buildStyle({ ...state, ...patch }, 'https://example.test')
const layer = (style: ReturnType<typeof build>, id: string) => {
  const found = style.layers.find((l) => l.id === id)
  if (!found) throw new Error(`no layer ${id}`)
  return found as { layout?: { visibility?: string }; filter?: unknown }
}

describe('buildStyle', () => {
  it('shows only the active data layer', () => {
    for (const active of LAYER_IDS) {
      const style = build({ layer: active })
      for (const id of LAYER_IDS) {
        for (const mapLayer of INTERACTIVE_LAYERS[id]) {
          expect(layer(style, mapLayer).layout?.visibility, `${mapLayer} when ${active}`).toBe(
            id === active ? 'visible' : 'none',
          )
        }
      }
    }
  })

  it('draws data below the basemap labels', () => {
    const { layers } = build()
    const firstSymbol = layers.findIndex((l) => l.type === 'symbol' && l.source === 'basemap')
    const lastOverlay = layers.findLastIndex((l) => 'source' in l && (l.source === 'overlays' || l.source === 'route'))
    expect(firstSymbol).toBeGreaterThan(-1)
    expect(lastOverlay).toBeLessThan(firstSymbol)
  })

  it('filters the selection and the place kinds', () => {
    const style = build({ layer: 'places', placeKinds: ['water'], selected: { kind: 'way', id: 42, props: {} } })
    expect(layer(style, 'selected-way').filter).toEqual(['==', ['id'], 42])
    expect(layer(style, 'selected-place').filter).toEqual(['==', ['get', 'osm'], ''])
    expect(layer(style, 'places-icon').filter).toEqual(['in', ['get', 'kind'], ['literal', ['water']]])
  })

  it('draws the planned route as one line per segment with its stress level', () => {
    const route = {
      coords: [],
      distance: 10,
      time: 5,
      ascent: 0,
      segments: [
        {
          coords: [
            [-75.7, 45.4],
            [-75.69, 45.41],
          ] as [number, number][],
          distance: 10,
          lts: 3,
          walk: null,
          tags: {},
        },
      ],
      stops: [{ kind: 'light' as const, lngLat: [-75.69, 45.41] as [number, number] }],
    }
    const source = build({ route }).sources.route as { data: FeatureCollection }
    expect(source.data.features).toHaveLength(1)
    expect(source.data.features[0].properties).toEqual({ lts: 3, part: 'lts3' })
    expect((build().sources.route as { data: FeatureCollection }).data.features).toHaveLength(0)
    const stops = build({ route }).sources['route-stops'] as { data: FeatureCollection }
    expect(stops.data.features.map((f) => f.properties)).toEqual([{ kind: 'light' }])
  })

  it('picks out one part of the route and fades the rest', () => {
    const plain = build()
    expect(layer(plain, 'route-highlight').filter).toEqual(['==', ['get', 'part'], ''])
    const picked = build({ routeHighlight: 'sidewalk' })
    expect(layer(picked, 'route-highlight').filter).toEqual(['==', ['get', 'part'], 'sidewalk'])
    const line = picked.layers.find((l) => l.id === 'route-line') as { paint: Record<string, unknown> }
    expect(line.paint['line-opacity']).toEqual(['case', ['==', ['get', 'part'], 'sidewalk'], 1, 0.3])
  })

  it('restyles the same tiles for each drawn basemap', () => {
    for (const basemap of ['light', 'grey', 'dark'] as const) {
      const style = build({ basemap })
      expect(style.sources.imagery, basemap).toBeUndefined()
      expect(
        style.layers.some((l) => l.type === 'fill'),
        basemap,
      ).toBe(true)
    }
    expect(build({ basemap: 'dark' }).sprite).toMatch(/dark$/)
    expect(build({ basemap: 'grey' }).sprite).toMatch(/grayscale$/)
  })

  it('puts imagery under the data and keeps only labels from the basemap for satellite', () => {
    const { layers, sources } = build({ basemap: 'satellite' })
    expect(sources.imagery).toMatchObject({ type: 'raster' })
    expect(layers[0]).toMatchObject({ id: 'imagery', type: 'raster' })
    expect(layers.filter((l) => 'source' in l && l.source === 'basemap').every((l) => l.type === 'symbol')).toBe(true)
    const firstData = layers.findIndex((l) => 'source' in l && l.source === 'overlays')
    expect(firstData).toBe(1)
  })

  it('keeps layer ids unique', () => {
    for (const basemap of BASEMAP_IDS) {
      const ids = build({ basemap }).layers.map((l) => l.id)
      expect(new Set(ids).size, basemap).toBe(ids.length)
    }
  })
})
