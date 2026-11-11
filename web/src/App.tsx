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
import type { LngLat } from './route/brouter'
import { formatParams, formatPoints, parseParams, parsePoints, type RoutePoint, type RoutePoints } from './route/state'
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

/** Everything the URL hash carries besides the map position. */
interface UrlState {
  layer: LayerId
  /** Place kinds switched on in the Places layer; none to start with. */
  placeKinds: readonly PlaceKind[]
  mode: Mode
  points: RoutePoints
  style: StyleId
  custom: RouteParams
}

function readUrl(): UrlState {
  const hash = parseHash(window.location.hash)
  return {
    layer: isLayerId(hash.layer) ? hash.layer : DEFAULT_LAYER,
    placeKinds: (hash.places ?? '').split(',').filter(isPlaceKind),
    mode: ROUTER_URL && hash.mode === 'route' ? 'route' : 'explore',
    points: parsePoints(hash.route),
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

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [url, setUrl] = useState<UrlState>(readUrl)
  const [basemap, setBasemap] = useState<BasemapId>(initialBasemap)
  const [selected, setSelected] = useState<Selected | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const i18n = useMemo(() => ({ lang, t: translator(lang) }), [lang])
  const { t } = i18n
  const dataDate = useDataDate(lang)
  const { layer, placeKinds, mode, points, style, custom } = url
  const routing = mode === 'route'
  const routeState = useRoute(ROUTER_URL, points, paramsFor(style, custom), routing)
  const route = routing ? visibleRoute(routeState) : null

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

  // Lets the map's bottom controls sit above the sheet on phones.
  useEffect(() => {
    if (!sheet.current) return
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--sheet-height', `${entry.target.getBoundingClientRect().height}px`)
    })
    observer.observe(sheet.current)
    return () => observer.disconnect()
  }, [])

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
      return { ...current, points: next }
    })
  }, [])

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
    () => ({ lang, basemap, layer, placeKinds, selected, route }),
    [lang, basemap, layer, placeKinds, selected, route],
  )
  const mapRouting = useMemo(
    () => (routing ? { points, onMapClick: placePoint, onMovePoint: movePoint } : null),
    [routing, points, placePoint, movePoint],
  )
  const hasResult = routing && routeState.status !== 'idle'

  return (
    <LangContext.Provider value={i18n}>
      <MapView state={styleState} onSelect={setSelected} onBasemapChange={setBasemap} routing={mapRouting} />
      <div className="sidebar">
        <div className={`card topbar ${ROUTER_URL ? '' : 'no-router'}`}>
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
            {ROUTER_URL && <ModeSwitch mode={mode} onChange={changeMode} />}
            <button
              type="button"
              className="lang-button"
              aria-label={t('switchLang')}
              onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
            >
              {t('switchLangShort')}
            </button>
          </div>
          {routing ? (
            <RouteForm
              points={points}
              style={style}
              params={paramsFor(style, custom)}
              onPointChange={setPoint}
              onReverse={() => update({ points: [points[1], points[0]] })}
              onStyleChange={changeStyle}
              onParamChange={changeParam}
            />
          ) : (
            <LayerPicker active={layer} onChange={changeLayer} />
          )}
        </div>
        <div className="card sheet" ref={sheet}>
          {routing && <RouteResult state={routeState} />}
          {!routing && selected && <FeatureCard selected={selected} onClose={() => setSelected(null)} />}
          <div className={selected || hasResult ? 'sheet-rest when-selected' : 'sheet-rest'}>
            {!routing && <Legend layer={layer} placeKinds={placeKinds} onTogglePlaceKind={togglePlaceKind} />}
            <p className="footnote">
              {!routing && `${t('hint')} `}
              {t('dataFrom')}
              {dataDate && `, ${t('updated')} ${dataDate}`}.
            </p>
          </div>
        </div>
      </div>
    </LangContext.Provider>
  )
}
