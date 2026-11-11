import { describe, expect, it } from 'vitest'
import { LAYER_IDS, PLACE_KINDS } from '../layers'
import { buildStyle, INTERACTIVE_LAYERS, type StyleState } from './style'

const state: StyleState = { lang: 'en', layer: 'comfort', placeKinds: PLACE_KINDS, selected: null }
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
    const lastOverlay = layers.findLastIndex((l) => 'source' in l && l.source === 'overlays')
    expect(firstSymbol).toBeGreaterThan(-1)
    expect(lastOverlay).toBeLessThan(firstSymbol)
  })

  it('filters the selection and the place kinds', () => {
    const style = build({ layer: 'places', placeKinds: ['water'], selected: { kind: 'way', id: 42, props: {} } })
    expect(layer(style, 'selected-way').filter).toEqual(['==', ['id'], 42])
    expect(layer(style, 'selected-place').filter).toEqual(['==', ['get', 'osm'], ''])
    expect(layer(style, 'places-circle').filter).toEqual(['in', ['get', 'kind'], ['literal', ['water']]])
  })

  it('keeps layer ids unique', () => {
    const ids = build().layers.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
