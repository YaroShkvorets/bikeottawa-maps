import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import { LAYER_IDS, PLACE_KINDS } from '../layers'
import { buildStyle, INTERACTIVE_LAYERS, type StyleState } from './style'

const state: StyleState = { lang: 'en', layer: 'comfort', placeKinds: PLACE_KINDS, selected: null, route: null }
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
    const firstSymbol = layers.findIndex((l) => l.type === 'symbol')
    const lastOverlay = layers.findLastIndex((l) => 'source' in l && (l.source === 'overlays' || l.source === 'route'))
    expect(firstSymbol).toBeGreaterThan(-1)
    expect(lastOverlay).toBeLessThan(firstSymbol)
  })

  it('filters the selection and the place kinds', () => {
    const style = build({ layer: 'places', placeKinds: ['water'], selected: { kind: 'way', id: 42, props: {} } })
    expect(layer(style, 'selected-way').filter).toEqual(['==', ['id'], 42])
    expect(layer(style, 'selected-place').filter).toEqual(['==', ['get', 'osm'], ''])
    expect(layer(style, 'places-circle').filter).toEqual(['in', ['get', 'kind'], ['literal', ['water']]])
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
          tags: {},
        },
      ],
    }
    const source = build({ route }).sources.route as { data: FeatureCollection }
    expect(source.data.features).toHaveLength(1)
    expect(source.data.features[0].properties).toEqual({ lts: 3 })
    expect((build().sources.route as { data: FeatureCollection }).data.features).toHaveLength(0)
  })

  it('keeps layer ids unique', () => {
    const ids = build().layers.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
