import {
  addProtocol,
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol } from 'pmtiles'
import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ASSETS_BASE, REGION } from '../config'
import { buildStyle, INTERACTIVE_LAYERS, type Selected, type StyleState } from './style'

// MapLibre finds its worker relative to its own file, which bundling breaks, so point it at the bundled copy.
setWorkerUrl(workerUrl)
addProtocol('pmtiles', new Protocol().tile)

/** How far around a click or tap, in pixels, a feature still counts as hit. */
const HIT_RADIUS = 8
/** The basemap only covers the region, so panning stops a little beyond it. */
const BOUNDS_MARGIN = 0.05

interface Props {
  state: StyleState
  onSelect: (selected: Selected | null) => void
}

export function MapView({ state, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const latest = useRef({ state, onSelect })
  const applied = useRef(state)
  latest.current = { state, onSelect }

  // biome-ignore lint/correctness/useExhaustiveDependencies: the map is created once; later state goes through setStyle below
  useEffect(() => {
    if (!container.current) return
    const [west, south, east, north] = REGION.bbox
    const map = new MapLibreMap({
      container: container.current,
      style: buildStyle(state, ASSETS_BASE),
      center: REGION.center,
      zoom: 12.5,
      minZoom: 9,
      maxZoom: 20,
      maxBounds: [
        [west - BOUNDS_MARGIN, south - BOUNDS_MARGIN],
        [east + BOUNDS_MARGIN, north + BOUNDS_MARGIN],
      ],
      hash: 'map',
      dragRotate: false,
      attributionControl: { compact: true },
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'top-right',
    )
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')

    const featureAt = (point: { x: number; y: number }): Selected | null => {
      const layers = INTERACTIVE_LAYERS[latest.current.state.layer].filter((id) => map.getLayer(id))
      const [feature] = map.queryRenderedFeatures(
        [
          [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
          [point.x + HIT_RADIUS, point.y + HIT_RADIUS],
        ],
        { layers },
      )
      if (!feature) return null
      if (feature.sourceLayer === 'places')
        return { kind: 'place', osm: String(feature.properties.osm), props: feature.properties }
      return { kind: 'way', id: Number(feature.id), props: feature.properties }
    }
    map.on('click', (e) => latest.current.onSelect(featureAt(e.point)))
    map.on('mousemove', (e) => {
      map.getCanvas().style.cursor = featureAt(e.point) ? 'pointer' : ''
    })

    mapRef.current = map
    applied.current = state
    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || applied.current === state) return
    applied.current = state
    mapRef.current.setStyle(buildStyle(state, ASSETS_BASE))
  }, [state])

  return <div ref={container} className="map" />
}
