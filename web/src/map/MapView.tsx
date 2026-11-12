import {
  addProtocol,
  type GeoJSONSource,
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol } from 'pmtiles'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BasemapSwitch } from '../components/BasemapSwitch'
import { ASSETS_BASE, REGION } from '../config'
import type { BasemapId } from '../layers'
import { isPlaceKind, placeImageId } from '../places'
import { comfortKeyOf, type LngLat, type RouteHighlight } from '../route/brouter'
import { nearestOnRoute, pointAtDistance, routeProfile } from '../route/profile'
import type { Reach } from '../route/reach'
import type { RoutePoints } from '../route/state'
import { renderPlaceImage } from './placeImage'
import { renderStopImage } from './stopImage'
import { buildStyle, INTERACTIVE_LAYERS, REACH_SOURCE, type Selected, type StyleState, stopImageId } from './style'

// MapLibre finds its worker relative to its own file, which bundling breaks, so point it at the bundled copy.
setWorkerUrl(workerUrl)
addProtocol('pmtiles', new Protocol().tile)

/** How far around a click or tap, in pixels, a feature still counts as hit. */
const HIT_RADIUS = 8
/** How close to the route, in pixels, the pointer has to be to mark a spot on it. */
const ROUTE_HOVER_RADIUS = 16
/** The basemap only covers the region, so panning stops a little beyond it. */
const BOUNDS_MARGIN = 0.05
const PHONE_LAYOUT = '(max-width: 720px)'

interface Props {
  state: StyleState
  onSelect: (selected: Selected | null) => void
  onBasemapChange: (basemap: BasemapId) => void
  onBikeLanesChange: (on: boolean) => void
  /** Details of the selection, shown in a popup beside it. Null where they go elsewhere (phones). */
  popup: ReactNode | null
  /** How far you get, drawn when the style has a reach source. */
  reach: Reach | null
  /** When set, clicks place route points instead of selecting features; places can still be picked. */
  routing: {
    points: RoutePoints
    onMapClick: (lngLat: LngLat) => void
    /** Places the route must pass through, in riding order. */
    vias: readonly LngLat[]
    onMovePoint: (index: 0 | 1, lngLat: LngLat) => void
    onAddVia: (index: number, lngLat: LngLat) => void
    onMoveVia: (index: number, lngLat: LngLat) => void
    onRemoveVia: (index: number) => void
    /** Metres along the route being pointed at, here or on the elevation chart. */
    hover: number | null
    onHover: (distance: number | null) => void
    /** Legend item to bring into view when it changes. */
    zoomTo: RouteHighlight | null
    /** Marker that shows a spinner while its result is on the way: B for a route, A for how far. */
    busy?: 0 | 1 | null
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

/** The reach data last handed to the map, and the source object it went to. */
interface ReachShown {
  source: unknown
  data: Reach | null
}

const NO_REACH: Reach = { type: 'FeatureCollection', features: [] }

/** Puts the reach lines on the map's reach source, if it has one and they are not there yet. */
function showReach(map: MapLibreMap, data: Reach | null, shown: { current: ReachShown }) {
  const source = map.getSource<GeoJSONSource>(REACH_SOURCE)
  if (!source || (shown.current.source === source && shown.current.data === data)) return
  if (shown.current.source !== source) {
    // A style update compares each source as the map reports it with the new
    // style, where the reach source is always empty: told the lines, it would
    // empty the source, to be cut into tiles all over again when refilled. So
    // the source reports itself as the style has it, and is left alone.
    const serialize = source.serialize.bind(source)
    source.serialize = () => ({ ...serialize(), data: NO_REACH })
  }
  source.setData(data ?? NO_REACH)
  shown.current = { source, data }
}

export function MapView({ state, onSelect, onBasemapChange, onBikeLanesChange, popup, reach, routing }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef<(Marker | null)[]>([null, null])
  const hoverMarker = useRef<Marker | null>(null)
  const viaMarkers = useRef<Marker[]>([])
  // True while the hover dot is being dragged out into a via point.
  const dragging = useRef(false)
  const profile = useMemo(() => (state.route ? routeProfile(state.route.coords) : []), [state.route])
  // Home of the map-style switcher, placed by MapLibre among its own controls.
  const [styleControl, setStyleControl] = useState<HTMLElement | null>(null)
  // The popup's content element lives as long as the map view; React renders into it.
  const popupElement = useMemo(() => document.createElement('div'), [])
  const popupRef = useRef<Popup | null>(null)
  const latest = useRef({ state, onSelect, routing, profile, reach })
  const applied = useRef(state)
  latest.current = { state, onSelect, routing, profile, reach }
  const reachShown = useRef<ReachShown>({ source: null, data: null })

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
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')

    // Markers are drawn the first time a style asks for them; a style rebuilt
    // from scratch (new basemap) simply asks again.
    map.setMissingStyleImageResolver((id) => {
      if (map.hasImage(id)) return
      const place = id.slice(placeImageId('').length)
      const marker =
        id === stopImageId('stop') || id === stopImageId('light')
          ? renderStopImage(id === stopImageId('stop') ? 'stop' : 'light')
          : id.startsWith(placeImageId('')) && isPlaceKind(place)
            ? renderPlaceImage(place)
            : null
      if (marker) map.addImage(id, marker.image, { pixelRatio: marker.pixelRatio })
    })

    const featureAt = (point: { x: number; y: number }, lngLat: { lng: number; lat: number }): Selected | null => {
      // Planning a route or how far, only places are picked; a click anywhere else is a route point.
      const { routing, state } = latest.current
      const layers = INTERACTIVE_LAYERS[state.layer].filter(
        (id) => map.getLayer(id) && (!routing || INTERACTIVE_LAYERS.places.includes(id)),
      )
      if (!layers.length) return null
      const hits = map.queryRenderedFeatures(
        [
          [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
          [point.x + HIT_RADIUS, point.y + HIT_RADIUS],
        ],
        { layers },
      )
      const [feature] = hits
      if (!feature) return null
      if (feature.layer.id === 'collisions-point' && feature.geometry.type === 'Point') {
        const [x, y] = feature.geometry.coordinates
        return { kind: 'collision', spot: String(feature.properties.key), at: [x, y] }
      }
      if (feature.sourceLayer === 'places') {
        // A place is anchored at its own position, a street where it was clicked.
        const at = feature.geometry.type === 'Point' ? (feature.geometry.coordinates as [number, number]) : null
        return {
          kind: 'place',
          osm: String(feature.properties.osm),
          props: feature.properties,
          at: at ?? [lngLat.lng, lngLat.lat],
        }
      }
      return { kind: 'way', id: Number(feature.id), props: feature.properties, at: [lngLat.lng, lngLat.lat] }
    }
    map.on('click', (e) => {
      const { routing, onSelect } = latest.current
      const feature = featureAt(e.point, e.lngLat)
      onSelect(feature)
      if (routing && !feature) routing.onMapClick([e.lngLat.lng, e.lngLat.lat])
    })
    map.on('mousemove', (e) => {
      const { routing, profile } = latest.current
      const overFeature = featureAt(e.point, e.lngLat) !== null
      if (!routing) {
        map.getCanvas().style.cursor = overFeature ? 'pointer' : ''
        return
      }
      if (dragging.current) return
      map.getCanvas().style.cursor = overFeature ? 'pointer' : routing.points.includes(null) ? 'crosshair' : ''
      // Pointing near the route marks that spot on the elevation chart.
      const hit = nearestOnRoute(profile, [e.lngLat.lng, e.lngLat.lat])
      const metresPerPixel = (40075016.686 * Math.cos((e.lngLat.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom())
      const near = hit !== null && hit.off <= ROUTE_HOVER_RADIUS * metresPerPixel
      if (near || routing.hover !== null) routing.onHover(near ? hit.point.distance : null)
    })
    map.on('mouseout', (e) => {
      // Moving onto the hover dot itself is not leaving the route.
      const onto = e.originalEvent.relatedTarget
      const ontoDot = onto instanceof Node && hoverMarker.current?.getElement().contains(onto)
      if (!dragging.current && !ontoDot) latest.current.routing?.onHover(null)
    })

    // A rebuilt style brings an empty reach source; fill it again.
    map.on('styledata', () => showReach(map, latest.current.reach, reachShown))

    mapRef.current = map
    applied.current = state
    return () => {
      mapRef.current = null
      markers.current = [null, null]
      hoverMarker.current = null
      viaMarkers.current = []
      popupRef.current = null
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
    const apply = () => {
      map.setStyle(buildStyle(latest.current.state, ASSETS_BASE))
      // A style rebuilt from scratch has a new, empty reach source to fill.
      showReach(map, latest.current.reach, reachShown)
    }
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

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // While a style is still loading its source may not exist yet; try again once it settles.
    showReach(map, reach, reachShown)
    const retry = () => showReach(map, reach, reachShown)
    map.once('idle', retry)
    return () => {
      map.off('idle', retry)
    }
  }, [reach])

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

  // A spinner around a marker while the result for it is on its way.
  const busy = routing?.busy ?? null
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new point can bring a new marker, which needs the class too
  useEffect(() => {
    for (const [index, marker] of markers.current.entries()) {
      marker?.getElement().classList.toggle('busy', busy === index)
    }
  }, [busy, points])

  // Clicking an item of the route legend brings its stretches or signs into view. The
  // route is read at that moment, so a new route alone does not move the map.
  const zoomTo = routing?.zoomTo ?? null
  useEffect(() => {
    const map = mapRef.current
    const route = latest.current.state.route
    if (!map || !route || !zoomTo) return
    const bounds = new LngLatBounds()
    for (const segment of route.segments) {
      if (comfortKeyOf(segment) === zoomTo) for (const point of segment.coords) bounds.extend(point)
    }
    for (const stop of route.stops) {
      if (stop.kind === zoomTo) bounds.extend(stop.lngLat)
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: panelPadding(), maxZoom: 17, duration: 600 })
  }, [zoomTo])

  // The details popup follows the selection. It is shown only when there is content for it.
  const anchor = popup ? (state.selected?.at ?? null) : null
  const [anchorLng, anchorLat] = anchor ?? [null, null]
  useEffect(() => {
    const map = mapRef.current
    if (!map || anchorLng === null || anchorLat === null) {
      popupRef.current?.remove()
      popupRef.current = null
      return
    }
    if (!popupRef.current) {
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '340px',
        offset: 14,
        className: 'feature-popup',
      }).setDOMContent(popupElement)
    }
    popupRef.current.setLngLat([anchorLng, anchorLat]).addTo(map)

    // MapLibre keeps the popup inside the map but knows nothing of the side panel; nudge the map if they overlap.
    const frame = requestAnimationFrame(() => {
      const box = popupRef.current?.getElement()?.getBoundingClientRect()
      const panel = document.querySelector('.sidebar')?.getBoundingClientRect()
      if (box && panel && box.left < panel.right + 12) map.panBy([box.left - panel.right - 12, 0], { duration: 300 })
    })
    return () => cancelAnimationFrame(frame)
  }, [anchorLng, anchorLat, popupElement])

  // Via points: drag to move, click to remove.
  const vias = routing?.vias
  useEffect(() => {
    const map = mapRef.current
    for (const marker of viaMarkers.current) marker.remove()
    viaMarkers.current = []
    if (!map || !vias) return
    viaMarkers.current = vias.map((lngLat, index) => {
      const el = document.createElement('div')
      el.className = 'route-marker via'
      const marker = new Marker({ element: el, draggable: true }).setLngLat(lngLat).addTo(map)
      let moved = false
      marker.on('dragstart', () => {
        moved = true
      })
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat()
        latest.current.routing?.onMoveVia(index, [lng, lat])
      })
      // The browser also reports a click at the end of a drag; only a plain click removes.
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!moved) latest.current.routing?.onRemoveVia(index)
        moved = false
      })
      return marker
    })
  }, [vias])

  // A dot on the route at the spot being pointed at, on the map or on the elevation
  // chart. Dragging it off the route anchors a via point where it is dropped.
  const hover = routing?.hover ?? null
  useEffect(() => {
    const map = mapRef.current
    if (dragging.current) return
    const spot = hover === null ? null : pointAtDistance(profile, hover)
    if (!map || !spot) {
      hoverMarker.current?.remove()
      hoverMarker.current = null
      return
    }
    if (hoverMarker.current) {
      hoverMarker.current.setLngLat(spot.lngLat)
      return
    }
    const el = document.createElement('div')
    el.className = 'route-hover'
    const marker = new Marker({ element: el, draggable: true }).setLngLat(spot.lngLat).addTo(map)
    let grabbedAt = 0
    marker.on('dragstart', () => {
      dragging.current = true
      grabbedAt = latest.current.routing?.hover ?? 0
    })
    marker.on('dragend', () => {
      dragging.current = false
      const { routing, profile } = latest.current
      if (!routing) return
      // The new point goes after every via point the route reaches before the grabbed spot.
      const before = routing.vias.filter((via) => (nearestOnRoute(profile, via)?.point.distance ?? 0) < grabbedAt)
      const { lng, lat } = marker.getLngLat()
      routing.onAddVia(before.length, [lng, lat])
      routing.onHover(null)
    })
    // Leaving the dot for anything but the map (a panel, say) ends the hover.
    el.addEventListener('mouseleave', (e) => {
      if (!dragging.current && !(e.relatedTarget instanceof HTMLCanvasElement)) latest.current.routing?.onHover(null)
    })
    hoverMarker.current = marker
  }, [hover, profile])

  return (
    <>
      <div ref={container} className="map" />
      {styleControl &&
        createPortal(
          <BasemapSwitch
            basemap={state.basemap}
            onChange={onBasemapChange}
            bikeLanes={Boolean(state.bikeLanes)}
            onBikeLanesChange={onBikeLanesChange}
          />,
          styleControl,
        )}
      {popup && createPortal(popup, popupElement)}
    </>
  )
}
