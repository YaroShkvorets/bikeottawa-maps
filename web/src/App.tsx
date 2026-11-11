import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type CollisionFilters,
  collisionSpots,
  formatCollisionFilters,
  parseCollisionFilters,
  spotsGeoJSON,
} from './collisions'
import { CollisionCard } from './components/CollisionCard'
import { FeatureCard } from './components/FeatureCard'
import { LayerPicker } from './components/LayerPicker'
import { Legend } from './components/Legend'
import { type Mode, ModeSwitch } from './components/ModeSwitch'
import { ReachForm } from './components/ReachForm'
import { ReachResult } from './components/ReachResult'
import { RouteForm } from './components/RouteForm'
import { RouteResult } from './components/RouteResult'
import { ASSETS_BASE, ROUTER_URL } from './config'
import { osmViewUrl, parseHash, withHashParam } from './hash'
import { initialLang, type Lang, LangContext, rememberLang, translator } from './i18n'
import { type BasemapId, isBasemapId, isLayerId, type LayerId } from './layers'
import { MapView } from './map/MapView'
import type { Selected, StyleState } from './map/style'
import { isPlaceKind, type PlaceKind } from './places'
import type { LngLat, RouteHighlight } from './route/brouter'
import { reverseLabel } from './route/geocode'
import { DEFAULT_REACH_MINUTES, isReachMinutes, type ReachMinutes } from './route/reach'
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
  isTravel,
  isWalkStyleId,
  type ParamKey,
  PRESETS,
  paramsFor,
  profileFor,
  type RouteParams,
  type StyleId,
  type Travel,
  type WalkStyleId,
} from './route/styles'
import { useReach, visibleReach } from './route/useReach'
import { useRoute, visibleRoute } from './route/useRoute'
import { useCollisionData } from './useCollisions'

const DEFAULT_LAYER: LayerId = 'places'
const PHONE_LAYOUT = '(max-width: 720px)'
const ignoreSelection = () => {}
const ignore = () => {}

function followMap(event: { currentTarget: HTMLAnchorElement }) {
  event.currentTarget.href = osmViewUrl(window.location.hash)
}

/** Everything the URL hash carries besides the map position. */
interface UrlState {
  layer: LayerId
  /** Place kinds switched on in the Places layer; none to start with. */
  placeKinds: readonly PlaceKind[]
  /** Which collisions the collisions layer shows. */
  collisions: CollisionFilters
  mode: Mode
  points: RoutePoints
  /** Places the route must pass through, in riding order. */
  vias: readonly LngLat[]
  /** Riding or walking, for routes and how far you get. */
  travel: Travel
  style: StyleId
  custom: RouteParams
  walkStyle: WalkStyleId
  /** Riding time shown in the How far mode. */
  minutes: ReachMinutes
}

function readUrl(): UrlState {
  const hash = parseHash(window.location.hash)
  return {
    layer: isLayerId(hash.layer) ? hash.layer : DEFAULT_LAYER,
    placeKinds: (hash.places ?? '').split(',').filter(isPlaceKind),
    collisions: parseCollisionFilters(hash.collisions),
    mode: hash.mode === 'route' || hash.mode === 'reach' ? hash.mode : 'explore',
    points: parsePoints(hash.route),
    vias: parseVias(hash.via),
    travel: isTravel(hash.travel) ? hash.travel : 'bike',
    style: isStyleId(hash.style) ? hash.style : DEFAULT_STYLE,
    custom: parseParams(hash.custom, PRESETS.balanced),
    walkStyle: isWalkStyleId(hash.walk) ? hash.walk : 'normal',
    minutes: isReachMinutes(hash.minutes) ? (Number(hash.minutes) as ReachMinutes) : DEFAULT_REACH_MINUTES,
  }
}

function writeUrl(state: UrlState): void {
  const routing = state.mode === 'route'
  const reaching = state.mode === 'reach'
  const riding = routing || reaching
  const entries: [string, string | null][] = [
    ['layer', state.layer === DEFAULT_LAYER ? null : state.layer],
    ['places', state.placeKinds.length ? state.placeKinds.join(',') : null],
    ['collisions', state.layer === 'collisions' ? formatCollisionFilters(state.collisions) : null],
    ['mode', riding ? state.mode : null],
    // How far starts from the route's start, so the two modes share it.
    ['route', routing ? formatPoints(state.points) : reaching ? formatPoints([state.points[0], null]) : null],
    ['via', routing ? formatVias(state.vias) : null],
    ['minutes', reaching && state.minutes !== DEFAULT_REACH_MINUTES ? String(state.minutes) : null],
    ['travel', riding && state.travel === 'foot' ? 'foot' : null],
    ['style', riding && state.travel === 'bike' && state.style !== DEFAULT_STYLE ? state.style : null],
    ['custom', riding && state.travel === 'bike' && state.style === 'custom' ? formatParams(state.custom) : null],
    ['walk', riding && state.travel === 'foot' && state.walkStyle !== 'normal' ? state.walkStyle : null],
  ]
  // MapLibre keeps its own `map=` entry in the hash; only ours are touched.
  const hash = entries.reduce((h, [key, value]) => withHashParam(h, key, value), window.location.hash)
  if (hash !== window.location.hash) {
    window.history.replaceState(null, '', hash || window.location.pathname + window.location.search)
  }
}

const BASEMAP_KEY = 'basemap'
const NIGHT_BASEMAP_KEY = 'basemap-night'

/** The map style is a personal preference, so it is remembered per browser rather than put in links. */
function storedBasemap(key: string, fallback: BasemapId): BasemapId {
  try {
    const stored = localStorage.getItem(key)
    if (isBasemapId(stored)) return stored
  } catch {
    // Storage can be blocked; use the default.
  }
  return fallback
}

function rememberBasemap(key: string, basemap: BasemapId) {
  try {
    localStorage.setItem(key, basemap)
  } catch {
    // Not remembered when storage is blocked.
  }
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

const viaKey = ([lon, lat]: LngLat) => `${lon},${lat}`

/**
 * Addresses of the via points, looked up as they are placed or moved, keyed by
 * position. Empty where none was found, so it is not asked for again.
 */
function useViaLabels(
  vias: readonly LngLat[],
  lang: Lang,
  enabled: boolean,
): [Record<string, string>, (lngLat: LngLat, label: string) => void] {
  const [labels, setLabels] = useState<Record<string, string>>({})
  const missing = enabled
    ? vias
        .map(viaKey)
        .filter((key) => !(key in labels))
        .join(';')
    : ''
  useEffect(() => {
    if (!missing) return
    const controller = new AbortController()
    for (const key of missing.split(';')) {
      const [lon, lat] = key.split(',').map(Number)
      reverseLabel([lon, lat], lang, controller.signal)
        .then((label) => setLabels((current) => ({ ...current, [key]: label ?? '' })))
        // Without an address the field shows the coordinates.
        .catch(() => {})
    }
    return () => controller.abort()
  }, [missing, lang])
  const remember = useCallback(
    (lngLat: LngLat, label: string) => setLabels((current) => ({ ...current, [viaKey(lngLat)]: label })),
    [],
  )
  return [labels, remember]
}

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [url, setUrl] = useState<UrlState>(readUrl)
  const [dayBasemap, setDayBasemap] = useState<BasemapId>(() => storedBasemap(BASEMAP_KEY, 'light'))
  // The night layer keeps a map style of its own: dark unless another is picked while it is on.
  const [nightBasemap, setNightBasemap] = useState<BasemapId>(() => storedBasemap(NIGHT_BASEMAP_KEY, 'dark'))
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
  const { layer, placeKinds, collisions, mode, points, vias, travel, style, custom, walkStyle, minutes } = url
  const profile = useMemo(() => profileFor(travel, style, custom, walkStyle), [travel, style, custom, walkStyle])
  const basemap = layer === 'night' ? nightBasemap : dayBasemap
  // Not exploring: planning a route, or seeing how far you get.
  const routing = mode !== 'explore'
  // Both need a router; without one their page only says so.
  const planning = mode === 'route' && ROUTER_URL !== null
  const reaching = mode === 'reach' && ROUTER_URL !== null
  const routeHighlight = planning ? (pointedPart ?? pinnedPart) : null
  const routeState = useRoute(ROUTER_URL, points, vias, profile, planning)
  const route = planning ? visibleRoute(routeState) : null
  const reachState = useReach(ROUTER_URL, points[0]?.lngLat ?? null, minutes, profile, reaching)
  const reach = reaching ? visibleReach(reachState) : null

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('title')
    rememberLang(lang)
  }, [lang, t])

  useEffect(() => writeUrl(url), [url])

  useEffect(() => rememberBasemap(BASEMAP_KEY, dayBasemap), [dayBasemap])
  useEffect(() => rememberBasemap(NIGHT_BASEMAP_KEY, nightBasemap), [nightBasemap])

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

  const changeCollisions = useCallback(
    (next: CollisionFilters) => {
      update({ collisions: next })
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
  const [viaLabels, rememberViaLabel] = useViaLabels(vias, lang, planning)
  const viaPoints = useMemo(
    () => vias.map((lngLat): RoutePoint => ({ lngLat, label: viaLabels[viaKey(lngLat)] || undefined })),
    [vias, viaLabels],
  )
  // A via field cleared removes that point; a place picked from search moves it there.
  const changeVia = useCallback(
    (index: number, point: RoutePoint | null) => {
      if (!point) return removeVia(index)
      if (point.label) rememberViaLabel(point.lngLat, point.label)
      moveVia(index, point.lngLat)
    },
    [removeVia, moveVia, rememberViaLabel],
  )

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
  useAddressLabel(points[0], lang, planning || reaching, labelStart)
  useAddressLabel(points[1], lang, planning, labelEnd)

  const movePoint = useCallback((index: 0 | 1, lngLat: LngLat) => setPoint(index, { lngLat }), [setPoint])
  // How far has only a start, and a click moves it.
  const placeStart = useCallback((lngLat: LngLat) => setPoint(0, { lngLat }), [setPoint])
  const setStart = useCallback((point: RoutePoint | null) => setPoint(0, point), [setPoint])
  const changeMinutes = useCallback((next: ReachMinutes) => update({ minutes: next }), [update])

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

  const picker = {
    travel,
    style,
    walkStyle,
    params: paramsFor(style, custom),
    onTravelChange: (next: Travel) => update({ travel: next }),
    onStyleChange: changeStyle,
    onWalkStyleChange: (next: WalkStyleId) => update({ walkStyle: next }),
    onParamChange: changeParam,
  }

  const reachStyle = useMemo(() => (reaching ? { minutes } : null), [reaching, minutes])
  // Collisions: loaded once the layer is first shown, grouped into spots by the filters.
  const collisionData = useCollisionData(layer === 'collisions')
  const allSpots = useMemo(
    () => (collisionData ? collisionSpots(collisionData, collisions) : null),
    [collisionData, collisions],
  )
  // The slider's top: the busiest spot under the other filters.
  const busiestSpot = useMemo(() => Math.max(1, ...(allSpots ?? []).map((s) => s.items.length)), [allSpots])
  const spots = useMemo(
    () => allSpots?.filter((s) => s.items.length >= collisions.minCount) ?? null,
    [allSpots, collisions.minCount],
  )
  const collisionGeo = useMemo(() => (spots ? spotsGeoJSON(spots) : null), [spots])
  const spotByKey = useMemo(() => new Map((spots ?? []).map((spot) => [spot.key, spot])), [spots])

  const styleState = useMemo<StyleState>(
    () => ({
      lang,
      basemap,
      layer,
      placeKinds,
      selected,
      route,
      routeHighlight,
      routeOnFoot: travel === 'foot',
      reach: reachStyle,
      collisions: layer === 'collisions' ? collisionGeo : null,
    }),
    [lang, basemap, layer, placeKinds, selected, route, routeHighlight, travel, reachStyle, collisionGeo],
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
            busy: routeState.status === 'loading' ? (1 as const) : null,
          }
        : reaching
          ? {
              points: [points[0], null] as RoutePoints,
              vias: [],
              onMapClick: placeStart,
              onMovePoint: movePoint,
              onAddVia: ignore,
              onMoveVia: ignore,
              onRemoveVia: ignore,
              hover: null,
              onHover: ignore,
              zoomTo: null,
              busy: reachState.status === 'loading' ? (0 as const) : null,
            }
          : null,
    [
      planning,
      reaching,
      reachState.status,
      routeState.status,
      points,
      vias,
      placePoint,
      placeStart,
      movePoint,
      addVia,
      moveVia,
      removeVia,
      routeHover,
      pinnedPart,
    ],
  )

  // A spot pointed at on the old route means nothing on a new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the route changes
  useEffect(() => {
    setRouteHover(null)
    setPointedPart(null)
    setPinnedPart(null)
  }, [route])
  const hasResult = (planning && routeState.status !== 'idle') || (reaching && reachState.status !== 'idle')
  // What the folded sheet says it holds.
  const sheetSummary = route
    ? `${(route.distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(route.time / 60))} min`
    : routing
      ? reaching && points[0]
        ? `${t('mode.reach')} · ${minutes} min`
        : t(`mode.${mode}`)
      : t('legend')

  // Details of the selection: a popup beside it on the map, or the bottom sheet on phones.
  const details =
    routing || !selected ? null : selected.kind === 'collision' ? (
      <CollisionCard
        items={spotByKey.get(selected.spot)?.items ?? []}
        at={selected.at}
        basemap={basemap}
        onClose={() => setSelected(null)}
      />
    ) : (
      <FeatureCard selected={selected} onClose={() => setSelected(null)} />
    )

  return (
    <LangContext.Provider value={i18n}>
      <MapView
        state={styleState}
        onSelect={routing ? ignoreSelection : setSelected}
        popup={details && !phone ? details : null}
        onBasemapChange={layer === 'night' ? setNightBasemap : setDayBasemap}
        routing={mapRouting}
        reach={reach}
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
          ) : !planning && !reaching ? (
            <p className="route-message">{t('noRouter')}</p>
          ) : reaching ? (
            <ReachForm
              start={points[0]}
              minutes={minutes}
              picker={picker}
              onStartChange={setStart}
              onMinutesChange={changeMinutes}
            />
          ) : (
            <RouteForm
              points={points}
              picker={picker}
              onPointChange={setPoint}
              vias={viaPoints}
              onViaChange={changeVia}
              onReverse={() => update({ points: [points[1], points[0]], vias: [...vias].reverse() })}
            />
          )}
        </div>
        <div
          className={`card sheet ${sheetOpen ? '' : 'collapsed'} ${routing && !planning && !reaching ? 'empty' : ''}`}
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
                travel={travel}
                state={routeState}
                hover={routeHover}
                onHover={setRouteHover}
                highlight={routeHighlight}
                pinned={pinnedPart}
                onPointPart={setPointedPart}
                onPinPart={setPinnedPart}
              />
            )}
            {reaching && <ReachResult state={reachState} minutes={minutes} basemap={basemap} />}
            {phone && details}
            <div className={(phone && details) || hasResult ? 'sheet-rest when-selected' : 'sheet-rest'}>
              {!routing && (
                <Legend
                  layer={layer}
                  basemap={basemap}
                  placeKinds={placeKinds}
                  onTogglePlaceKind={togglePlaceKind}
                  collisionSpots={spots}
                  busiestSpot={busiestSpot}
                  collisionFilters={collisions}
                  onCollisionFiltersChange={changeCollisions}
                />
              )}
              {dataDate && (
                <p className="footnote">
                  {t('updated')} {dataDate}
                  {phone ? '.' : ' · '}
                  {!phone && (
                    // The map moves without re-rendering this, so the link is
                    // pointed at the current view just before it is used.
                    <a
                      href="https://www.openstreetmap.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onPointerEnter={followMap}
                      onFocus={followMap}
                    >
                      {t('viewOnOsm')}
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </LangContext.Provider>
  )
}
