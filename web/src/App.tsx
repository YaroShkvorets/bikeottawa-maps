import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeatureCard } from './components/FeatureCard'
import { LayerPicker } from './components/LayerPicker'
import { Legend } from './components/Legend'
import { type Mode, ModeSwitch } from './components/ModeSwitch'
import { RouteForm } from './components/RouteForm'
import { RouteResult } from './components/RouteResult'
import { ASSETS_BASE, ROUTER_URL } from './config'
import { parseHash, withHashParam } from './hash'
import { initialLang, type Lang, LangContext, rememberLang, translator } from './i18n'
import { type BasemapId, isBasemapId, isLayerId, type LayerId } from './layers'
import { MapView } from './map/MapView'
import type { Selected, StyleState } from './map/style'
import { isPlaceKind, type PlaceKind } from './places'
import type { LngLat, RouteHighlight } from './route/brouter'
import { reverseLabel } from './route/geocode'
import {
  formatParams,
  formatPoints,
  formatVias,
  parseParams,
  parsePoints,
  parseVias,
  type RoutePoint,
  type RoutePoints,
} from './route/state'
import {
  DEFAULT_STYLE,
  isStyleId,
  type ParamKey,
  PRESETS,
  paramsFor,
  type RouteParams,
  type StyleId,
} from './route/styles'
import { useRoute, visibleRoute } from './route/useRoute'

const DEFAULT_LAYER: LayerId = 'comfort'
const PHONE_LAYOUT = '(max-width: 720px)'
const ignoreSelection = () => {}

/** Everything the URL hash carries besides the map position. */
interface UrlState {
  layer: LayerId
  /** Place kinds switched on in the Places layer; none to start with. */
  placeKinds: readonly PlaceKind[]
  mode: Mode
  points: RoutePoints
  /** Places the route must pass through, in riding order. */
  vias: readonly LngLat[]
  style: StyleId
  custom: RouteParams
}

function readUrl(): UrlState {
  const hash = parseHash(window.location.hash)
  return {
    layer: isLayerId(hash.layer) ? hash.layer : DEFAULT_LAYER,
    placeKinds: (hash.places ?? '').split(',').filter(isPlaceKind),
    mode: hash.mode === 'route' ? 'route' : 'explore',
    points: parsePoints(hash.route),
    vias: parseVias(hash.via),
    style: isStyleId(hash.style) ? hash.style : DEFAULT_STYLE,
    custom: parseParams(hash.custom, PRESETS.balanced),
  }
}

function writeUrl(state: UrlState): void {
  const routing = state.mode === 'route'
  const entries: [string, string | null][] = [
    ['layer', state.layer === DEFAULT_LAYER ? null : state.layer],
    ['places', state.placeKinds.length ? state.placeKinds.join(',') : null],
    ['mode', routing ? 'route' : null],
    ['route', routing ? formatPoints(state.points) : null],
    ['via', routing ? formatVias(state.vias) : null],
    ['style', routing && state.style !== DEFAULT_STYLE ? state.style : null],
    ['custom', routing && state.style === 'custom' ? formatParams(state.custom) : null],
  ]
  // MapLibre keeps its own `map=` entry in the hash; only ours are touched.
  const hash = entries.reduce((h, [key, value]) => withHashParam(h, key, value), window.location.hash)
  if (hash !== window.location.hash) {
    window.history.replaceState(null, '', hash || window.location.pathname + window.location.search)
  }
}

const BASEMAP_KEY = 'basemap'

/** The map style is a personal preference, so it is remembered per browser rather than put in links. */
function initialBasemap(): BasemapId {
  try {
    const stored = localStorage.getItem(BASEMAP_KEY)
    if (isBasemapId(stored)) return stored
  } catch {
    // Storage can be blocked; use the default.
  }
  return 'light'
}

/** Whether the phone layout is in effect, kept current as the window is resized or rotated. */
function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_LAYOUT).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE_LAYOUT)
    const update = () => setPhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}

/** Date of the OpenStreetMap data in the tiles, written by the pipeline. */
function useDataDate(lang: Lang): string | null {
  const [timestamp, setTimestamp] = useState<string | null>(null)
  useEffect(() => {
    fetch(`${ASSETS_BASE}/tiles/meta.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((meta) => setTimestamp(meta?.osmTimestamp ?? null))
      .catch(() => setTimestamp(null))
  }, [])
  if (!timestamp) return null
  return new Date(timestamp).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'long' })
}

/** Looks up the address of a point that has no name yet (picked on the map, dragged, or from a link). */
function useAddressLabel(
  point: RoutePoint | null,
  lang: Lang,
  enabled: boolean,
  onLabel: (lngLat: LngLat, label: string) => void,
): void {
  const pending = enabled && point && !point.label ? point.lngLat : null
  const [lon, lat] = pending ?? [null, null]
  useEffect(() => {
    if (lon === null || lat === null) return
    const controller = new AbortController()
    reverseLabel([lon, lat], lang, controller.signal)
      .then((label) => label && onLabel([lon, lat], label))
      // No address is not an error worth showing; the field keeps its coordinates.
      .catch(() => {})
    return () => controller.abort()
  }, [lon, lat, lang, onLabel])
}

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [url, setUrl] = useState<UrlState>(readUrl)
  const [basemap, setBasemap] = useState<BasemapId>(initialBasemap)
  const [selected, setSelected] = useState<Selected | null>(null)
  // Metres along the route under the pointer, shared by the map and the elevation chart.
  const [routeHover, setRouteHover] = useState<number | null>(null)
  // Legend item picked out on the route: pointed at for now, or pinned by a click.
  const [pointedPart, setPointedPart] = useState<RouteHighlight | null>(null)
  const [pinnedPart, setPinnedPart] = useState<RouteHighlight | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const topbar = useRef<HTMLDivElement>(null)
  // On phones the bottom sheet starts folded away so the map gets the screen.
  const phone = usePhoneLayout()
  const [sheetOpen, setSheetOpen] = useState(() => !window.matchMedia(PHONE_LAYOUT).matches)
  const i18n = useMemo(() => ({ lang, t: translator(lang) }), [lang])
  const { t } = i18n
  const dataDate = useDataDate(lang)
  const { layer, placeKinds, mode, points, vias, style, custom } = url
  const routing = mode === 'route'
  // Planning needs a router; without one the route page only says so.
  const planning = routing && ROUTER_URL !== null
  const routeHighlight = planning ? (pointedPart ?? pinnedPart) : null
  const routeState = useRoute(ROUTER_URL, points, vias, paramsFor(style, custom), planning)
  const route = planning ? visibleRoute(routeState) : null

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('title')
    rememberLang(lang)
  }, [lang, t])

  useEffect(() => writeUrl(url), [url])

  useEffect(() => {
    try {
      localStorage.setItem(BASEMAP_KEY, basemap)
    } catch {
      // Not remembered when storage is blocked.
    }
  }, [basemap])

  // Back/forward and pasted links change the hash without going through React.
  useEffect(() => {
    const onHashChange = () => {
      setUrl(readUrl())
      setSelected(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Lets the map's own controls sit clear of the top bar and the bottom sheet on phones.
  useEffect(() => {
    const track = (element: HTMLElement | null, name: string) => {
      if (!element) return () => {}
      const observer = new ResizeObserver(([entry]) => {
        document.documentElement.style.setProperty(name, `${entry.target.getBoundingClientRect().height}px`)
      })
      observer.observe(element)
      return () => observer.disconnect()
    }
    const stopSheet = track(sheet.current, '--sheet-height')
    const stopTopbar = track(topbar.current, '--topbar-height')
    return () => {
      stopSheet()
      stopTopbar()
    }
  }, [])

  // Details of something just tapped should not stay folded away.
  useEffect(() => {
    if (selected) setSheetOpen(true)
  }, [selected])

  const update = useCallback((patch: Partial<UrlState>) => setUrl((current) => ({ ...current, ...patch })), [])

  const changeLayer = useCallback(
    (next: LayerId) => {
      update({ layer: next })
      setSelected(null)
    },
    [update],
  )

  const changeMode = useCallback(
    (next: Mode) => {
      update({ mode: next })
      setSelected(null)
    },
    [update],
  )

  const togglePlaceKind = useCallback((kind: PlaceKind) => {
    setUrl((current) => {
      const kinds = current.placeKinds
      return { ...current, placeKinds: kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind] }
    })
    setSelected(null)
  }, [])

  const setPoint = useCallback((index: 0 | 1, point: RoutePoint | null) => {
    setUrl((current) => {
      const next: RoutePoints = [...current.points]
      next[index] = point
      // Via points only make sense between a start and an end.
      return { ...current, points: next, vias: point ? current.vias : [] }
    })
  }, [])

  const editVias = useCallback((edit: (vias: LngLat[]) => void) => {
    setUrl((current) => {
      const next = [...current.vias]
      edit(next)
      return { ...current, vias: next }
    })
  }, [])
  const addVia = useCallback((index: number, lngLat: LngLat) => editVias((v) => v.splice(index, 0, lngLat)), [editVias])
  const moveVia = useCallback(
    (index: number, lngLat: LngLat) => editVias((v) => v.splice(index, 1, lngLat)),
    [editVias],
  )
  const removeVia = useCallback((index: number) => editVias((v) => v.splice(index, 1)), [editVias])

  // A click on the map fills the first point that is still missing.
  const placePoint = useCallback((lngLat: LngLat) => {
    setUrl((current) => {
      const index = current.points.indexOf(null)
      if (index === -1) return current
      const next: RoutePoints = [...current.points]
      next[index] = { lngLat }
      return { ...current, points: next }
    })
  }, [])

  // Names a point once its address arrives, unless it has moved on in the meantime.
  const labelPoint = useCallback((index: 0 | 1, lngLat: LngLat, label: string) => {
    setUrl((current) => {
      const point = current.points[index]
      if (!point || point.label || point.lngLat[0] !== lngLat[0] || point.lngLat[1] !== lngLat[1]) return current
      const next: RoutePoints = [...current.points]
      next[index] = { ...point, label }
      return { ...current, points: next }
    })
  }, [])
  const labelStart = useCallback((lngLat: LngLat, label: string) => labelPoint(0, lngLat, label), [labelPoint])
  const labelEnd = useCallback((lngLat: LngLat, label: string) => labelPoint(1, lngLat, label), [labelPoint])
  useAddressLabel(points[0], lang, planning, labelStart)
  useAddressLabel(points[1], lang, planning, labelEnd)

  const movePoint = useCallback((index: 0 | 1, lngLat: LngLat) => setPoint(index, { lngLat }), [setPoint])

  const changeParam = useCallback((key: ParamKey, value: number) => {
    setUrl((current) => ({ ...current, custom: { ...current.custom, [key]: value } }))
  }, [])

  // Custom starts from whatever style was active, so the sliders show how that style is made.
  const changeStyle = useCallback((next: StyleId) => {
    setUrl((current) => ({
      ...current,
      style: next,
      custom: next === 'custom' && current.style !== 'custom' ? PRESETS[current.style] : current.custom,
    }))
  }, [])

  const styleState = useMemo<StyleState>(
    () => ({ lang, basemap, layer, placeKinds, selected, route, routeHighlight }),
    [lang, basemap, layer, placeKinds, selected, route, routeHighlight],
  )
  const mapRouting = useMemo(
    () =>
      planning
        ? {
            points,
            vias,
            onMapClick: placePoint,
            onMovePoint: movePoint,
            onAddVia: addVia,
            onMoveVia: moveVia,
            onRemoveVia: removeVia,
            hover: routeHover,
            onHover: setRouteHover,
            zoomTo: pinnedPart,
          }
        : null,
    [planning, points, vias, placePoint, movePoint, addVia, moveVia, removeVia, routeHover, pinnedPart],
  )

  // A spot pointed at on the old route means nothing on a new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the route changes
  useEffect(() => {
    setRouteHover(null)
    setPointedPart(null)
    setPinnedPart(null)
  }, [route])
  const hasResult = planning && routeState.status !== 'idle'
  // What the folded sheet says it holds.
  const sheetSummary = route
    ? `${(route.distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(route.time / 60))} min`
    : routing
      ? t('mode.route')
      : t('legend')

  // Details of the selection: a popup beside it on the map, or the bottom sheet on phones.
  const details = !routing && selected ? <FeatureCard selected={selected} onClose={() => setSelected(null)} /> : null

  return (
    <LangContext.Provider value={i18n}>
      <MapView
        state={styleState}
        onSelect={routing ? ignoreSelection : setSelected}
        popup={details && !phone ? details : null}
        onBasemapChange={setBasemap}
        routing={mapRouting}
      />
      <div className="sidebar">
        <div className="card topbar" ref={topbar}>
          <header className="brand">
            <svg
              aria-hidden="true"
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="21" r="6" />
              <circle cx="24" cy="21" r="6" />
              <path d="M8 21 13 10h8l3 11M13 10l4 11H8M11 6h4" />
            </svg>
            <h1>{t('title')}</h1>
          </header>
          <div className="topbar-row">
            <ModeSwitch mode={mode} onChange={changeMode} />
            <button
              type="button"
              className="lang-button"
              aria-label={t('switchLang')}
              onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
            >
              {t('switchLangShort')}
            </button>
          </div>
          {!routing ? (
            <LayerPicker active={layer} onChange={changeLayer} />
          ) : !planning ? (
            <p className="route-message">{t('noRouter')}</p>
          ) : (
            <RouteForm
              points={points}
              style={style}
              params={paramsFor(style, custom)}
              onPointChange={setPoint}
              viaCount={vias.length}
              onReverse={() => update({ points: [points[1], points[0]], vias: [...vias].reverse() })}
              onClearVias={() => update({ vias: [] })}
              onStyleChange={changeStyle}
              onParamChange={changeParam}
            />
          )}
        </div>
        <div
          className={`card sheet ${sheetOpen ? '' : 'collapsed'} ${routing && !planning ? 'empty' : ''}`}
          ref={sheet}
        >
          <button
            type="button"
            className="sheet-toggle"
            aria-expanded={sheetOpen}
            aria-label={t('toggleSheet')}
            onClick={() => setSheetOpen(!sheetOpen)}
          >
            <span className="sheet-handle" aria-hidden="true" />
            <span className="sheet-summary">{sheetSummary}</span>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={sheetOpen ? 'M4 7l5 5 5-5' : 'M4 11l5-5 5 5'} />
            </svg>
          </button>
          <div className="sheet-body">
            {planning && (
              <RouteResult
                state={routeState}
                hover={routeHover}
                onHover={setRouteHover}
                highlight={routeHighlight}
                pinned={pinnedPart}
                onPointPart={setPointedPart}
                onPinPart={setPinnedPart}
              />
            )}
            {phone && details}
            <div className={(phone && details) || hasResult ? 'sheet-rest when-selected' : 'sheet-rest'}>
              {!routing && <Legend layer={layer} placeKinds={placeKinds} onTogglePlaceKind={togglePlaceKind} />}
              {dataDate && (
                <p className="footnote">
                  {t('updated')} {dataDate}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </LangContext.Provider>
  )
}
