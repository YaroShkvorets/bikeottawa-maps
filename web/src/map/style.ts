import { layers as basemapLayers, namedFlavor } from '@protomaps/basemaps'
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { Lang } from '../i18n'
import { INK, type LayerId, LTS_COLORS, PLACE_COLORS, type PlaceKind, WINTER_COLORS } from '../layers'

export type Selected =
  | { kind: 'way'; id: number; props: Record<string, unknown> }
  | { kind: 'place'; osm: string; props: Record<string, unknown> }

export interface StyleState {
  lang: Lang
  layer: LayerId
  /** Place kinds shown on the places layer. */
  placeKinds: readonly PlaceKind[]
  selected: Selected | null
}

/** Layers a click can hit, per data layer. */
export const INTERACTIVE_LAYERS: Record<LayerId, string[]> = {
  comfort: ['comfort-line'],
  winter: ['winter-line', 'winter-unknown'],
  places: ['places-circle'],
}

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>'

/** Protomaps' light basemap, muted so the data layers carry the colour, and without its own place icons. */
const FLAVOR = {
  ...namedFlavor('light'),
  background: '#EEF0EA',
  earth: '#EEF0EA',
  water: '#BBD6E6',
  park_a: '#DFE9D6',
  park_b: '#D3E2C7',
  wood_a: '#DFE9D6',
  wood_b: '#CFDEC3',
  scrub_a: '#E3EBDA',
  scrub_b: '#D6E3CB',
  buildings: '#E0E2DC',
  pois: undefined,
  landcover: undefined,
}

function lineWidth(extra = 0): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.8 + extra, 13, 2.2 + extra, 16, 5 + extra, 19, 12 + extra]
}

const placeColor: ExpressionSpecification = [
  'match',
  ['get', 'kind'],
  'parking',
  PLACE_COLORS.parking,
  'repair',
  PLACE_COLORS.repair,
  'shop',
  PLACE_COLORS.shop,
  'water',
  PLACE_COLORS.water,
  PLACE_COLORS.toilets,
]

function overlayLayers(state: StyleState): LayerSpecification[] {
  const show = (layer: LayerId) => ({ visibility: state.layer === layer ? ('visible' as const) : ('none' as const) })
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const }
  const bikeable: FilterSpecification = ['>', ['get', 'lts'], 0]
  const pathway: FilterSpecification = ['==', ['get', 'kind'], 'path']
  const plowKnown: FilterSpecification = ['all', pathway, ['!=', ['get', 'winter'], 'unknown']]
  const plowUnknown: FilterSpecification = ['all', pathway, ['==', ['get', 'winter'], 'unknown']]
  const selectedWay: FilterSpecification = ['==', ['id'], state.selected?.kind === 'way' ? state.selected.id : -1]
  const selectedPlace: FilterSpecification = [
    '==',
    ['get', 'osm'],
    state.selected?.kind === 'place' ? state.selected.osm : '',
  ]
  const way = { type: 'line' as const, source: 'overlays', 'source-layer': 'ways' }
  const place = { type: 'circle' as const, source: 'overlays', 'source-layer': 'places' }

  return [
    {
      ...way,
      id: 'comfort-casing',
      filter: bikeable,
      layout: { ...round, ...show('comfort') },
      paint: { 'line-color': '#FFFFFF', 'line-width': lineWidth(1.5), 'line-opacity': 0.7 },
    },
    {
      ...way,
      id: 'winter-casing',
      filter: pathway,
      layout: { ...round, ...show('winter') },
      paint: { 'line-color': '#FFFFFF', 'line-width': lineWidth(1.5), 'line-opacity': 0.7 },
    },
    {
      ...way,
      id: 'selected-way',
      filter: selectedWay,
      layout: round,
      paint: { 'line-color': INK, 'line-width': lineWidth(7) },
    },
    {
      ...way,
      id: 'comfort-line',
      filter: bikeable,
      layout: { ...round, ...show('comfort') },
      paint: {
        'line-color': ['match', ['get', 'lts'], 1, LTS_COLORS[0], 2, LTS_COLORS[1], 3, LTS_COLORS[2], LTS_COLORS[3]],
        'line-width': lineWidth(),
      },
    },
    {
      ...way,
      id: 'winter-line',
      filter: plowKnown,
      layout: { ...round, ...show('winter') },
      paint: {
        'line-color': ['match', ['get', 'winter'], 'yes', WINTER_COLORS.yes, WINTER_COLORS.no],
        'line-width': lineWidth(0.5),
      },
    },
    {
      ...way,
      id: 'winter-unknown',
      filter: plowUnknown,
      layout: { 'line-join': 'round', ...show('winter') },
      paint: { 'line-color': WINTER_COLORS.unknown, 'line-width': lineWidth(), 'line-dasharray': [2, 2] },
    },
    {
      ...place,
      id: 'selected-place',
      filter: selectedPlace,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 12, 17, 16],
        'circle-color': INK,
        'circle-opacity': 0.25,
      },
    },
    {
      ...place,
      id: 'places-circle',
      filter: ['in', ['get', 'kind'], ['literal', [...state.placeKinds]]],
      layout: show('places'),
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 6, 17, 9],
        'circle-color': placeColor,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2],
      },
    },
  ]
}

/**
 * The whole map style as a function of app state. MapLibre diffs successive
 * styles, so switching layer, language or selection only touches what changed.
 */
export function buildStyle(state: StyleState, assetsBase: string): StyleSpecification {
  const base = basemapLayers('basemap', FLAVOR, { lang: state.lang })
  // Data goes under the basemap's labels so street names stay readable.
  const firstLabel = base.findIndex((l) => l.type === 'symbol')
  const at = firstLabel === -1 ? base.length : firstLabel
  return {
    version: 8,
    glyphs: `${assetsBase}/basemap-assets/fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsBase}/basemap-assets/sprites/v4/light`,
    sources: {
      basemap: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/basemap.pmtiles`, attribution: ATTRIBUTION },
      overlays: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/overlays.pmtiles` },
    },
    layers: [...base.slice(0, at), ...overlayLayers(state), ...base.slice(at)],
  }
}
