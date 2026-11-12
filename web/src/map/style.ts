import { layers as basemapLayers, type Flavor, namedFlavor } from '@protomaps/basemaps'
import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { SEVERITIES } from '../collisions'
import type { Lang } from '../i18n'
import {
  type BasemapId,
  collisionColors,
  INK,
  LAMP_COLOR,
  LAMP_COLOR_ON_PALE,
  type LayerId,
  LTS_COLORS,
  NO_BIKES_COLOR,
  reachRamp,
  WINTER_COLORS,
} from '../layers'
import { type PlaceKind, placeImageId } from '../places'
import { comfortKeyOf, type Route, type RouteHighlight } from '../route/brouter'

/** What was clicked on the map; `at` is where its details are anchored. */
export type Selected =
  | { kind: 'way'; id: number; props: Record<string, unknown>; at: [number, number] }
  | { kind: 'place'; osm: string; props: Record<string, unknown>; at: [number, number] }
  /** A spot on the collisions layer, by its key (see collisionSpots). */
  | { kind: 'collision'; spot: string; at: [number, number] }

export interface StyleState {
  lang: Lang
  basemap: BasemapId
  layer: LayerId
  /** Place kinds shown on the places layer. */
  placeKinds: readonly PlaceKind[]
  selected: Selected | null
  /** Planned route to draw, coloured by comfort. */
  route: Route | null
  /** Legend item to pick out on the route, the rest of it stepping back. */
  routeHighlight: RouteHighlight | null
  /** A walking route is one colour; cycling comfort means nothing on foot. */
  routeOnFoot?: boolean
  /**
   * Showing how far you get in this many minutes. The lines themselves are too
   * many to diff with every style change, so the map view sets them on the
   * source directly.
   */
  reach: { minutes: number } | null
  /** The collisions layer's spots, built from the filters; null until loaded. */
  collisions: FeatureCollection | null
}

/** Layers a click can hit, per data layer. */
export const INTERACTIVE_LAYERS: Record<LayerId, string[]> = {
  comfort: ['comfort-line'],
  winter: ['winter-line', 'winter-unknown'],
  places: ['places-icon'],
  night: [],
  collisions: ['collisions-point'],
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
  /** Strong outline for the selection and the planned route; also the colour of our own labels. */
  contrast: string
  /** Outline that keeps our labels readable over the ground. */
  halo: string
  /** Aerial imagery under the labels instead of the drawn map. */
  imagery?: boolean
  /** Colours of the night layer on this ground. */
  lights: Lights
}

interface Lights {
  /** Core of a lit street, and the lamp dots. */
  lamp: string
  /** Soft line around a lit street. */
  glow: string
  /** Blur around the lamps, from its faint edge to its brightest middle. */
  heat: [string, string, string, string, string]
}

/** Soft warm white, like LED street lights, for dark ground. */
const LIGHTS_ON_DARK: Lights = {
  lamp: LAMP_COLOR,
  glow: '#F2D3A0',
  heat: [
    'rgba(250, 210, 155, 0)',
    'rgba(250, 212, 160, 0.25)',
    'rgba(252, 226, 190, 0.7)',
    'rgba(255, 239, 215, 0.92)',
    'rgba(255, 250, 240, 1)',
  ],
}

/** Pale ground would swallow that, so there the light is a deeper amber. */
const LIGHTS_ON_PALE: Lights = {
  lamp: LAMP_COLOR_ON_PALE,
  glow: '#F2A33A',
  heat: [
    'rgba(242, 163, 58, 0)',
    'rgba(242, 163, 58, 0.3)',
    'rgba(232, 135, 20, 0.65)',
    'rgba(217, 115, 13, 0.85)',
    'rgba(190, 90, 5, 0.95)',
  ],
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
    halo: '#FFFFFF',
    lights: LIGHTS_ON_PALE,
  },
  grey: {
    flavor: plain(namedFlavor('grayscale')),
    sprite: 'grayscale',
    casing: '#FFFFFF',
    contrast: INK,
    halo: '#FFFFFF',
    lights: LIGHTS_ON_PALE,
  },
  // A pale outline keeps the darkest data colour visible on the dark ground.
  dark: {
    flavor: plain(namedFlavor('dark')),
    sprite: 'dark',
    casing: '#AEBBC4',
    contrast: '#FFFFFF',
    halo: '#14191C',
    lights: LIGHTS_ON_DARK,
  },
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
    halo: '#101010',
    imagery: true,
    lights: LIGHTS_ON_DARK,
  },
}

/** The dark map as the night layer shows it: near black, so the street lights carry the picture. */
const NIGHT_THEME: Theme = {
  flavor: plain({
    ...namedFlavor('black'),
    background: '#05070A',
    earth: '#0A0D11',
    water: '#03050A',
    buildings: '#10141A',
  }),
  sprite: 'dark',
  casing: '#0E1316',
  contrast: '#FFFFFF',
  halo: '#05070A',
  lights: LIGHTS_ON_DARK,
}

const IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const IMAGERY_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics'

function lineWidth(extra = 0): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.8 + extra, 13, 2.2 + extra, 16, 5 + extra, 19, 12 + extra]
}

function routeData(route: Route | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (route?.segments ?? []).map((segment) => ({
      type: 'Feature',
      properties: { lts: segment.lts, part: comfortKeyOf(segment) },
      geometry: { type: 'LineString', coordinates: segment.coords },
    })),
  }
}

function stopsData(route: Route | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (route?.stops ?? []).map((stop) => ({
      type: 'Feature',
      properties: { kind: stop.kind },
      geometry: { type: 'Point', coordinates: stop.lngLat },
    })),
  }
}

/** Name of the map image for a stop sign or traffic light on the route. */
export function stopImageId(kind: 'stop' | 'light' | ''): string {
  return `route-${kind}`
}

/** Marks the stretches picked out from the comfort breakdown. */
const HIGHLIGHT_COLOR = '#FFD60A'

/** Colour of a walking route. */
const WALK_ROUTE_COLOR = '#0B6E6E'

function routeLayers(theme: Theme, highlight: RouteHighlight | null, onFoot: boolean): LayerSpecification[] {
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const }
  // With something picked out, everything else on the route fades so it is easy to find.
  const rest: ExpressionSpecification | number = highlight ? ['case', ['==', ['get', 'part'], highlight], 1, 0.3] : 1
  const otherStops: ExpressionSpecification | number = highlight
    ? ['case', ['==', ['get', 'kind'], highlight], 1, 0.3]
    : 1
  return [
    {
      id: 'route-highlight',
      type: 'line',
      source: 'route',
      filter: ['==', ['get', 'part'], highlight ?? ''],
      layout: round,
      paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': lineWidth(16) },
    },
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: round,
      paint: { 'line-color': theme.contrast, 'line-width': lineWidth(8), 'line-opacity': rest },
    },
    {
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: round,
      paint: {
        'line-color': onFoot
          ? WALK_ROUTE_COLOR
          : [
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
        'line-opacity': rest,
      },
    },
    {
      id: 'route-stops-highlight',
      type: 'circle',
      source: 'route-stops',
      filter: ['==', ['get', 'kind'], highlight ?? ''],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 7, 15, 14, 18, 18],
        'circle-color': HIGHLIGHT_COLOR,
        'circle-stroke-color': theme.contrast,
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'route-stops',
      type: 'symbol',
      source: 'route-stops',
      // Too many to show from far out, unless they are what is being looked for.
      minzoom: highlight === 'stop' || highlight === 'light' ? 0 : 12,
      layout: {
        // Drawn on demand by the map view.
        'icon-image': ['concat', stopImageId(''), ['get', 'kind']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.55, 15, 0.9, 18, 1.2],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': otherStops },
    },
  ]
}

/** Source of the reach lines, filled in by the map view. */
export const REACH_SOURCE = 'reach'

function reachLayers(reach: StyleState['reach'], basemap: BasemapId): LayerSpecification[] {
  if (!reach) return []
  const ramp = reachRamp(basemap)
  const last = ramp.length - 1
  return [
    {
      id: 'reach-line',
      type: 'line',
      source: REACH_SOURCE,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        // The closest minutes are drawn on top.
        'line-sort-key': ['-', ['get', 'minutes']],
      },
      paint: {
        'line-color': [
          'interpolate',
          ['linear'],
          ['get', 'minutes'],
          ...ramp.flatMap((color, i) => [1 + ((reach.minutes - 1) * i) / last, color]),
        ] as ExpressionSpecification,
        'line-width': lineWidth(),
      },
    },
  ]
}

function overlayLayers(state: StyleState, theme: Theme): LayerSpecification[] {
  // The data steps back when a planned route is drawn over it.
  const fade = state.route ? 0.35 : 1
  // The reach map has the street lines to itself; the data lines share its blues.
  const show = (layer: LayerId) => ({
    visibility: state.layer === layer && !state.reach ? ('visible' as const) : ('none' as const),
  })
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const }
  const bikeable: FilterSpecification = ['>', ['get', 'lts'], 0]
  // Paths with a winter status; indoor walkways have none and are left out.
  const pathway: FilterSpecification = ['all', ['==', ['get', 'kind'], 'path'], ['has', 'winter']]
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
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 16, 17, 20],
        'circle-color': theme.contrast,
        'circle-opacity': 0.35,
      },
    },
  ]
}

/** Lit streets hand over to the individual lamps between these zooms. */
const STREETS_UNTIL = 14.5
const LAMPS_FROM = 12.5

/**
 * The city by its street lights. Zoomed out, streets with lamps along them glow
 * as lines; zooming in, the lines fade and the lamps themselves take over, first
 * as a blur and from zoom 14 as dots too.
 */
const nightLayers = ({ lights }: Theme): LayerSpecification[] => [
  {
    id: 'night-streets-glow',
    type: 'line',
    source: 'night',
    'source-layer': 'streets',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': lights.glow,
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 12, 6, 14, 11],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 9, 3, 12, 5, 14, 9],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12, 0.5, 13, 0.4, STREETS_UNTIL, 0],
    },
  },
  {
    id: 'night-streets',
    type: 'line',
    source: 'night',
    'source-layer': 'streets',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': lights.lamp,
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 12, 1.2, 14, 2],
      'line-blur': 0.6,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.95, 13, 0.85, STREETS_UNTIL, 0],
    },
  },
  {
    id: 'night-glow',
    type: 'heatmap',
    source: 'night',
    'source-layer': 'lamps',
    minzoom: 12,
    paint: {
      // Per-lamp brightness, raised as the map zooms in and lamps spread apart.
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.12, 13, 0.3, 14, 0.45, 16, 0.6],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 13, 9, 14, 12, 16, 26, 18, 50],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        lights.heat[0],
        0.08,
        lights.heat[1],
        0.35,
        lights.heat[2],
        0.7,
        lights.heat[3],
        1,
        lights.heat[4],
      ],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], LAMPS_FROM, 0, 13.5, 1, 15, 1, 18, 0.6],
    },
  },
  {
    id: 'night-lamps',
    type: 'circle',
    source: 'night',
    'source-layer': 'lamps',
    minzoom: 14,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 1.2, 16, 2.4, 18, 4.5],
      'circle-color': lights.lamp,
      'circle-blur': 0.3,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.5, 16, 1],
    },
  },
]

/** Zoom from which places show their name beside the marker. */
const PLACE_LABEL_ZOOM = 15

/**
 * Markers for the places layer, named when zoomed in. Kept apart from the other
 * data layers because it sits above the basemap's labels: MapLibre gives the
 * topmost labels first pick, and here a shop's name matters more than the street's.
 */
export const COLLISIONS_SOURCE = 'collisions'
const COLLISIONS_ATTRIBUTION =
  'Collisions: <a href="https://open.ottawa.ca/" target="_blank" rel="noopener">City of Ottawa</a>'

/** Zoom from which single collisions show; further out they make a heat map. */
const COLLISION_POINTS_FROM = 12.5

/**
 * Collisions involving cyclists or pedestrians: where they cluster, zoomed
 * out, and each spot zoomed in, sized by how many happened there and coloured
 * by the worst injury among them.
 */
function collisionLayers(state: StyleState): { under: LayerSpecification[]; over: LayerSpecification[] } {
  if (state.layer !== 'collisions' || state.reach) return { under: [], over: [] }
  const colors = collisionColors(state.basemap)
  const byWorst = [
    'match',
    ['get', 'worst'],
    ...SEVERITIES.flatMap((s) => [s, colors[s]]),
    colors.none,
  ] as unknown as ExpressionSpecification
  // Area grows with the number of collisions: radius with its square root.
  const radius = (one: number, step: number): ExpressionSpecification => [
    '+',
    one,
    ['*', step, ['sqrt', ['-', ['get', 'count'], 1]]],
  ]
  const pale = state.basemap === 'light' || state.basemap === 'grey'
  const fadeIn: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    COLLISION_POINTS_FROM,
    0,
    COLLISION_POINTS_FROM + 0.7,
    1,
  ]
  return {
    under: [
      {
        id: 'collisions-heat',
        type: 'heatmap',
        source: COLLISIONS_SOURCE,
        maxzoom: COLLISION_POINTS_FROM + 1,
        paint: {
          // Each spot weighs its injuries, worse ones more.
          'heatmap-weight': ['get', 'weight'],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 12, 14, 13.5, 22],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0, 0, 0, 0)',
            0.15,
            pale ? 'rgba(242, 148, 112, 0.45)' : 'rgba(122, 59, 46, 0.5)',
            0.4,
            colors.minor,
            0.7,
            colors.major,
            1,
            colors.fatal,
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            COLLISION_POINTS_FROM,
            0.85,
            COLLISION_POINTS_FROM + 1,
            0,
          ],
        },
      },
    ],
    over: [
      {
        id: 'collisions-point',
        type: 'circle',
        source: COLLISIONS_SOURCE,
        minzoom: COLLISION_POINTS_FROM,
        paint: {
          'circle-color': byWorst,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            COLLISION_POINTS_FROM,
            radius(3, 1.4),
            17,
            radius(6, 3),
          ],
          'circle-stroke-color': pale ? '#ffffff' : '#111417',
          'circle-stroke-width': 1,
          'circle-opacity': fadeIn,
          'circle-stroke-opacity': fadeIn,
        },
      },
    ],
  }
}

function placesLayer(state: StyleState, theme: Theme): LayerSpecification {
  return {
    id: 'places-icon',
    type: 'symbol',
    source: 'overlays',
    'source-layer': 'places',
    filter: ['in', ['get', 'kind'], ['literal', [...state.placeKinds]]],
    layout: {
      visibility: state.layer === 'places' ? 'visible' : 'none',
      // Drawn on demand by the map view, one image per kind.
      'icon-image': ['concat', placeImageId(''), ['get', 'kind']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0.85, 17, 1.1],
      // Every marker shows, and names steer clear of them.
      'icon-allow-overlap': true,
      // Names never push a marker off the map; where they would collide they are left out.
      'text-field': ['step', ['zoom'], '', PLACE_LABEL_ZOOM, ['coalesce', ['get', 'name'], '']],
      'text-optional': true,
      'text-font': ['Noto Sans Medium'],
      'text-size': 12,
      'text-max-width': 8,
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 1.25,
      'text-justify': 'auto',
    },
    paint: {
      'text-color': theme.contrast,
      'text-halo-color': theme.halo,
      'text-halo-width': 1.5,
    },
  }
}

/**
 * The whole map style as a function of app state. MapLibre diffs successive
 * styles, so switching layer, language or selection only touches what changed.
 */
export function buildStyle(state: StyleState, assetsBase: string): StyleSpecification {
  const night = state.layer === 'night'
  const collisions = collisionLayers(state)
  const theme = night && state.basemap === 'dark' ? NIGHT_THEME : THEMES[state.basemap]
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
      // Loaded only while the night layer is on.
      ...(night && { night: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/night.pmtiles` } }),
      route: { type: 'geojson', data: routeData(state.route) },
      'route-stops': { type: 'geojson', data: stopsData(state.route) },
      ...(state.reach && { [REACH_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }),
      // Loaded only while the collisions layer is on.
      ...(collisions.over.length && {
        [COLLISIONS_SOURCE]: {
          type: 'geojson',
          data: state.collisions ?? { type: 'FeatureCollection', features: [] },
          attribution: COLLISIONS_ATTRIBUTION,
        },
      }),
    },
    layers: [
      ...base.slice(0, at),
      ...overlayLayers(state, theme),
      ...(night && !state.reach ? nightLayers(theme) : []),
      ...reachLayers(state.reach, state.basemap),
      ...collisions.under,
      ...routeLayers(theme, state.routeHighlight, state.routeOnFoot ?? false),
      ...base.slice(at),
      placesLayer(state, theme),
      ...collisions.over,
    ],
  }
}
