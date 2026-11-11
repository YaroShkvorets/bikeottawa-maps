import { layers as basemapLayers, type Flavor, namedFlavor } from '@protomaps/basemaps'
import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { Lang } from '../i18n'
import {
  type BasemapId,
  INK,
  type LayerId,
  LTS_COLORS,
  NO_BIKES_COLOR,
  PLACE_COLORS,
  type PlaceKind,
  WINTER_COLORS,
} from '../layers'
import type { Route } from '../route/brouter'

export type Selected =
  | { kind: 'way'; id: number; props: Record<string, unknown> }
  | { kind: 'place'; osm: string; props: Record<string, unknown> }

export interface StyleState {
  lang: Lang
  basemap: BasemapId
  layer: LayerId
  /** Place kinds shown on the places layer. */
  placeKinds: readonly PlaceKind[]
  selected: Selected | null
  /** Planned route to draw, coloured by comfort. */
  route: Route | null
}

/** Layers a click can hit, per data layer. */
export const INTERACTIVE_LAYERS: Record<LayerId, string[]> = {
  comfort: ['comfort-line'],
  winter: ['winter-line', 'winter-unknown'],
  places: ['places-circle'],
}

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>'

/** Without the basemap's own place icons and land-cover tint, which compete with the data. */
const plain = (flavor: Flavor): Flavor => ({ ...flavor, pois: undefined, landcover: undefined })

interface Theme {
  flavor: Flavor
  /** Sprite sheet for road shields, matching the flavor. */
  sprite: string
  /** Outline that separates data lines from the ground. */
  casing: string
  /** Strong outline for the selection and the planned route. */
  contrast: string
  /** Aerial imagery under the labels instead of the drawn map. */
  imagery?: boolean
}

const THEMES: Record<BasemapId, Theme> = {
  // Protomaps' light basemap, muted so the data layers carry the colour.
  light: {
    flavor: plain({
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
    }),
    sprite: 'light',
    casing: '#FFFFFF',
    contrast: INK,
  },
  grey: { flavor: plain(namedFlavor('grayscale')), sprite: 'grayscale', casing: '#FFFFFF', contrast: INK },
  // A pale outline keeps the darkest data colour visible on the dark ground.
  dark: { flavor: plain(namedFlavor('dark')), sprite: 'dark', casing: '#AEBBC4', contrast: '#FFFFFF' },
  // Only the labels are drawn, so they are brightened to read over photos.
  satellite: {
    flavor: plain({
      ...namedFlavor('dark'),
      city_label: '#FFFFFF',
      city_label_halo: '#101010',
      subplace_label: '#F2F2F2',
      subplace_label_halo: '#101010',
      roads_label_major: '#FFFFFF',
      roads_label_major_halo: '#101010',
      roads_label_minor: '#F2F2F2',
      roads_label_minor_halo: '#101010',
      ocean_label: '#DCEBFF',
      address_label: '#F2F2F2',
      address_label_halo: '#101010',
    }),
    sprite: 'dark',
    casing: '#0E1316',
    contrast: '#FFFFFF',
    imagery: true,
  },
}

const IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const IMAGERY_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics'

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

function routeData(route: Route | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (route?.segments ?? []).map((segment) => ({
      type: 'Feature',
      properties: { lts: segment.lts },
      geometry: { type: 'LineString', coordinates: segment.coords },
    })),
  }
}

function routeLayers(theme: Theme): LayerSpecification[] {
  return [
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': theme.contrast, 'line-width': lineWidth(8) },
    },
    {
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'lts'],
          1,
          LTS_COLORS[0],
          2,
          LTS_COLORS[1],
          3,
          LTS_COLORS[2],
          4,
          LTS_COLORS[3],
          NO_BIKES_COLOR,
        ],
        'line-width': lineWidth(3.5),
      },
    },
  ]
}

function overlayLayers(state: StyleState, theme: Theme): LayerSpecification[] {
  // The data steps back when a planned route is drawn over it.
  const fade = state.route ? 0.35 : 1
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
      paint: { 'line-color': theme.casing, 'line-width': lineWidth(1.5), 'line-opacity': 0.7 * fade },
    },
    {
      ...way,
      id: 'winter-casing',
      filter: pathway,
      layout: { ...round, ...show('winter') },
      paint: { 'line-color': theme.casing, 'line-width': lineWidth(1.5), 'line-opacity': 0.7 * fade },
    },
    {
      ...way,
      id: 'selected-way',
      filter: selectedWay,
      layout: round,
      paint: { 'line-color': theme.contrast, 'line-width': lineWidth(7) },
    },
    {
      ...way,
      id: 'comfort-line',
      filter: bikeable,
      layout: { ...round, ...show('comfort') },
      paint: {
        'line-color': ['match', ['get', 'lts'], 1, LTS_COLORS[0], 2, LTS_COLORS[1], 3, LTS_COLORS[2], LTS_COLORS[3]],
        'line-width': lineWidth(),
        'line-opacity': fade,
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
        'line-opacity': fade,
      },
    },
    {
      ...way,
      id: 'winter-unknown',
      filter: plowUnknown,
      layout: { 'line-join': 'round', ...show('winter') },
      paint: {
        'line-color': WINTER_COLORS.unknown,
        'line-width': lineWidth(),
        'line-dasharray': [2, 2],
        'line-opacity': fade,
      },
    },
    {
      ...place,
      id: 'selected-place',
      filter: selectedPlace,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 12, 17, 16],
        'circle-color': theme.contrast,
        'circle-opacity': 0.3,
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
  const theme = THEMES[state.basemap]
  const drawn = basemapLayers('basemap', theme.flavor, { lang: state.lang, labelsOnly: theme.imagery })
  const base: LayerSpecification[] = theme.imagery
    ? [{ id: 'imagery', type: 'raster', source: 'imagery' }, ...drawn]
    : drawn
  // Data goes under the basemap's labels so street names stay readable.
  const firstLabel = base.findIndex((l) => l.type === 'symbol')
  const at = firstLabel === -1 ? base.length : firstLabel
  return {
    version: 8,
    glyphs: `${assetsBase}/basemap-assets/fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsBase}/basemap-assets/sprites/v4/${theme.sprite}`,
    sources: {
      basemap: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/basemap.pmtiles`, attribution: ATTRIBUTION },
      ...(theme.imagery && {
        imagery: {
          type: 'raster',
          tiles: [IMAGERY_TILES],
          tileSize: 256,
          maxzoom: 19,
          attribution: IMAGERY_ATTRIBUTION,
        },
      }),
      overlays: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/overlays.pmtiles` },
      route: { type: 'geojson', data: routeData(state.route) },
    },
    layers: [...base.slice(0, at), ...overlayLayers(state, theme), ...routeLayers(theme), ...base.slice(at)],
  }
}
