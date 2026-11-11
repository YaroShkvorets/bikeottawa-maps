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
  reach: null,
}
const build = (patch: Partial<StyleState> = {}) => buildStyle({ ...state, ...patch }, 'https://example.test')
const layer = (style: ReturnType<typeof build>, id: string) => {
  const found = style.layers.find((l) => l.id === id)
  if (!found) throw new Error(`no layer ${id}`)
  return found as { layout?: { visibility?: string }; filter?: unknown }
}

describe('buildStyle', () => {
  it('gives the reach map the street lines to itself', () => {
    const style = build({ layer: 'comfort', reach: { minutes: 15 } })
    expect(style.sources.reach).toBeDefined()
    expect(layer(style, 'reach-line')).toBeDefined()
    expect(layer(style, 'comfort-line').layout?.visibility).toBe('none')
    expect(build().sources.reach).toBeUndefined()
  })

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

  it('draws lines below the basemap labels and place markers above them', () => {
    const { layers } = build()
    const firstLabel = layers.findIndex((l) => l.type === 'symbol' && l.source === 'basemap')
    const lastLabel = layers.findLastIndex((l) => l.type === 'symbol' && l.source === 'basemap')
    const lines = layers.flatMap((l, i) => (l.type === 'line' && l.source !== 'basemap' ? [i] : []))
    expect(firstLabel).toBeGreaterThan(-1)
    expect(Math.max(...lines)).toBeLessThan(firstLabel)
    expect(layers.findIndex((l) => l.id === 'places-icon')).toBeGreaterThan(lastLabel)
  })

  it('names places from zoom 15, in a colour that suits the basemap', () => {
    const places = (basemap: 'light' | 'dark') =>
      build({ basemap }).layers.find((l) => l.id === 'places-icon') as {
        layout: Record<string, unknown>
        paint: Record<string, unknown>
      }
    expect(places('light').layout['text-field']).toEqual(['step', ['zoom'], '', 15, ['coalesce', ['get', 'name'], '']])
    expect(places('light').layout['text-optional']).toBe(true)
    expect(places('light').paint['text-color']).not.toBe(places('dark').paint['text-color'])
    expect(places('dark').paint['text-color']).toBe('#FFFFFF')
  })

  it('filters the selection and the place kinds', () => {
    const style = build({
      layer: 'places',
      placeKinds: ['water'],
      selected: { kind: 'way', id: 42, props: {}, at: [-75.7, 45.4] },
    })
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

  it('picks out stop signs or traffic lights and fades the route', () => {
    const picked = build({ routeHighlight: 'light' })
    expect(layer(picked, 'route-stops-highlight').filter).toEqual(['==', ['get', 'kind'], 'light'])
    const icons = picked.layers.find((l) => l.id === 'route-stops') as {
      paint: Record<string, unknown>
      minzoom: number
    }
    expect(icons.paint['icon-opacity']).toEqual(['case', ['==', ['get', 'kind'], 'light'], 1, 0.3])
    expect(icons.minzoom).toBe(0)
    expect((build().layers.find((l) => l.id === 'route-stops') as { minzoom: number }).minzoom).toBe(12)
    // No stretch of the route is a "light", so all of it fades.
    expect(layer(picked, 'route-highlight').filter).toEqual(['==', ['get', 'part'], 'light'])
  })

  it('lights the street lamps for the night layer', () => {
    const night = build({ layer: 'night', basemap: 'dark' })
    expect(night.sources.night).toMatchObject({ type: 'vector' })
    expect(night.layers.find((l) => l.id === 'night-glow')).toMatchObject({ type: 'heatmap', 'source-layer': 'lamps' })
    expect(night.layers.find((l) => l.id === 'night-streets')).toMatchObject({
      type: 'line',
      source: 'night',
      'source-layer': 'streets',
    })
    expect(night.layers.find((l) => l.id === 'night-lamps')).toMatchObject({ type: 'circle', minzoom: 14 })
    // Other layers neither load the lamps nor draw them.
    const day = build({ layer: 'comfort' })
    expect(day.sources.night).toBeUndefined()
    expect(day.layers.some((l) => l.id.startsWith('night-'))).toBe(false)
  })

  it('draws the night layer on whichever basemap is chosen', () => {
    const colorOf = (basemap: 'light' | 'dark' | 'satellite') => {
      const style = build({ layer: 'night', basemap })
      const streets = style.layers.find((l) => l.id === 'night-streets')
      return { style, color: streets?.type === 'line' ? streets.paint?.['line-color'] : undefined }
    }
    const dark = colorOf('dark')
    const light = colorOf('light')
    expect(light.style.sprite).toMatch(/light$/)
    // Pale ground gets a deeper light than dark ground.
    expect(light.color).not.toBe(dark.color)
    // Dark is darker still at night than by day.
    expect(dark.style.layers[0]).not.toEqual(build({ layer: 'comfort', basemap: 'dark' }).layers[0])
    expect(colorOf('satellite').style.sources.imagery).toBeDefined()
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
