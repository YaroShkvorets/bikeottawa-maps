import {
  addProtocol,
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol } from 'pmtiles'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BasemapSwitch } from '../components/BasemapSwitch'
import { ASSETS_BASE, REGION } from '../config'
import type { BasemapId } from '../layers'
import type { LngLat } from '../route/brouter'
import type { RoutePoints } from '../route/state'
import { buildStyle, INTERACTIVE_LAYERS, type Selected, type StyleState } from './style'

// MapLibre finds its worker relative to its own file, which bundling breaks, so point it at the bundled copy.
setWorkerUrl(workerUrl)
addProtocol('pmtiles', new Protocol().tile)

/** How far around a click or tap, in pixels, a feature still counts as hit. */
const HIT_RADIUS = 8
/** The basemap only covers the region, so panning stops a little beyond it. */
const BOUNDS_MARGIN = 0.05
const PHONE_LAYOUT = '(max-width: 720px)'

interface Props {
  state: StyleState
  onSelect: (selected: Selected | null) => void
  onBasemapChange: (basemap: BasemapId) => void
  /** When set, clicks place route points instead of selecting features. */
  routing: {
    points: RoutePoints
    onMapClick: (lngLat: LngLat) => void
    onMovePoint: (index: 0 | 1, lngLat: LngLat) => void
  } | null
}

function markerElement(index: 0 | 1): HTMLElement {
  const el = document.createElement('div')
  el.className = `route-marker ${index === 0 ? 'start' : 'end'}`
  el.textContent = index === 0 ? 'A' : 'B'
  return el
}

/** Room the panels take, so a fitted route is not hidden under them. */
function panelPadding() {
  if (window.matchMedia(PHONE_LAYOUT).matches) {
    const sheet = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-height')) || 0
    return { top: 200, bottom: sheet + 24, left: 30, right: 30 }
  }
  return { top: 50, bottom: 50, left: 420, right: 70 }
}

export function MapView({ state, onSelect, onBasemapChange, routing }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef<(Marker | null)[]>([null, null])
  // Home of the map-style switcher, placed by MapLibre among its own controls.
  const [styleControl, setStyleControl] = useState<HTMLElement | null>(null)
  const latest = useRef({ state, onSelect, routing })
  const applied = useRef(state)
  latest.current = { state, onSelect, routing }

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
    const switcher = document.createElement('div')
    switcher.className = 'maplibregl-ctrl maplibregl-ctrl-group basemap-ctrl'
    map.addControl({ onAdd: () => switcher, onRemove: () => switcher.remove() }, 'top-right')
    setStyleControl(switcher)
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
    map.on('click', (e) => {
      const { routing, onSelect } = latest.current
      if (routing) routing.onMapClick([e.lngLat.lng, e.lngLat.lat])
      else onSelect(featureAt(e.point))
    })
    map.on('mousemove', (e) => {
      const { routing } = latest.current
      if (routing) map.getCanvas().style.cursor = routing.points.includes(null) ? 'crosshair' : ''
      else map.getCanvas().style.cursor = featureAt(e.point) ? 'pointer' : ''
    })

    mapRef.current = map
    applied.current = state
    return () => {
      mapRef.current = null
      markers.current = [null, null]
      // MapLibre deletes its position from the URL when removed. Put it back so a
      // remount (React does one in development) starts where the link pointed.
      const { hash, pathname, search } = window.location
      map.remove()
      window.history.replaceState(window.history.state, '', hash || pathname + search)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || applied.current === state) return
    const routeChanged = applied.current.route !== state.route
    applied.current = state
    // A style can only be diffed once the current one has loaded; until then wait
    // rather than restart loading from scratch.
    const apply = () => map.setStyle(buildStyle(latest.current.state, ASSETS_BASE))
    if (map.isStyleLoaded()) apply()
    else map.once('idle', apply)

    // Bring a new route into view, unless all of it already shows clear of the panels.
    if (routeChanged && state.route && state.route.coords.length > 1) {
      const bounds = new LngLatBounds()
      for (const [lon, lat] of state.route.coords) bounds.extend([lon, lat])
      const padding = panelPadding()
      const { width, height } = map.getContainer().getBoundingClientRect()
      const visible = [bounds.getSouthWest(), bounds.getNorthEast()].every((corner) => {
        const { x, y } = map.project(corner)
        return x >= padding.left && x <= width - padding.right && y >= padding.top && y <= height - padding.bottom
      })
      if (!visible) map.fitBounds(bounds, { padding, maxZoom: 16, duration: 600 })
    }
  }, [state])

  // Draggable A and B markers follow the route points.
  const points = routing?.points
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const index of [0, 1] as const) {
      const point = points?.[index] ?? null
      let marker = markers.current[index]
      if (!point) {
        marker?.remove()
        markers.current[index] = null
        continue
      }
      if (!marker) {
        marker = new Marker({ element: markerElement(index), draggable: true }).setLngLat(point.lngLat).addTo(map)
        const created = marker
        created.on('dragend', () => {
          const { lng, lat } = created.getLngLat()
          latest.current.routing?.onMovePoint(index, [lng, lat])
        })
        markers.current[index] = marker
      } else {
        marker.setLngLat(point.lngLat)
      }
    }
  }, [points])

  return (
    <>
      <div ref={container} className="map" />
      {styleControl && createPortal(<BasemapSwitch basemap={state.basemap} onChange={onBasemapChange} />, styleControl)}
    </>
  )
}
