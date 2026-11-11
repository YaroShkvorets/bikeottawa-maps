import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeatureCard } from './components/FeatureCard'
import { LayerPicker } from './components/LayerPicker'
import { Legend } from './components/Legend'
import { ASSETS_BASE } from './config'
import { parseHash, withHashParam } from './hash'
import { initialLang, type Lang, LangContext, rememberLang, translator } from './i18n'
import { isLayerId, type LayerId, PLACE_KINDS, type PlaceKind } from './layers'
import { MapView } from './map/MapView'
import type { Selected, StyleState } from './map/style'

const DEFAULT_LAYER: LayerId = 'comfort'

function layerFromHash(): LayerId {
  const { layer } = parseHash(window.location.hash)
  return isLayerId(layer) ? layer : DEFAULT_LAYER
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
  const [layer, setLayer] = useState<LayerId>(layerFromHash)
  const [placeKinds, setPlaceKinds] = useState<readonly PlaceKind[]>(PLACE_KINDS)
  const [selected, setSelected] = useState<Selected | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const i18n = useMemo(() => ({ lang, t: translator(lang) }), [lang])
  const { t } = i18n
  const dataDate = useDataDate(lang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('title')
    rememberLang(lang)
  }, [lang, t])

  // Back/forward and pasted links change the hash without going through React.
  useEffect(() => {
    const onHashChange = () => {
      setLayer(layerFromHash())
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

  const changeLayer = useCallback((next: LayerId) => {
    setLayer(next)
    setSelected(null)
    const hash = withHashParam(window.location.hash, 'layer', next === DEFAULT_LAYER ? null : next)
    window.history.replaceState(null, '', hash || window.location.pathname + window.location.search)
  }, [])

  const togglePlaceKind = useCallback((kind: PlaceKind) => {
    setPlaceKinds((kinds) => (kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind]))
    setSelected(null)
  }, [])

  const styleState = useMemo<StyleState>(
    () => ({ lang, layer, placeKinds, selected }),
    [lang, layer, placeKinds, selected],
  )

  return (
    <LangContext.Provider value={i18n}>
      <MapView state={styleState} onSelect={setSelected} />
      <div className="sidebar">
        <div className="card topbar">
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
          <LayerPicker active={layer} onChange={changeLayer} />
          <button
            type="button"
            className="lang-button"
            aria-label={t('switchLang')}
            onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
          >
            {t('switchLangShort')}
          </button>
        </div>
        <div className="card sheet" ref={sheet}>
          {selected && <FeatureCard selected={selected} onClose={() => setSelected(null)} />}
          <div className={selected ? 'sheet-rest when-selected' : 'sheet-rest'}>
            <Legend layer={layer} placeKinds={placeKinds} onTogglePlaceKind={togglePlaceKind} />
            <p className="footnote">
              {t('hint')} {t('dataFrom')}
              {dataDate && `, ${t('updated')} ${dataDate}`}.
            </p>
          </div>
        </div>
      </div>
    </LangContext.Provider>
  )
}
