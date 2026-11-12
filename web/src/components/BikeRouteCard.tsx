import { useEffect, useState } from 'react'
import { ASSETS_BASE } from '../config'
import { useI18n } from '../i18n'
import { isRouteLevelId, ROUTE_COLORS, ROUTE_LEVEL_IDS, type RouteLevelId } from '../layers'
import type { Selected } from '../map/style'

/** A signed route as the pipeline writes it to routes.json, by relation id. */
interface BikeRoute {
  name?: string
  ref?: string
  level: RouteLevelId
  operator?: string
  website?: string
  /** Length within the map area. */
  km: number
  parents?: string[]
}

let index: Promise<Record<string, BikeRoute>> | null = null
function routeIndex(): Promise<Record<string, BikeRoute>> {
  index ??= fetch(`${ASSETS_BASE}/tiles/routes.json`)
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => {
      index = null
      return {}
    })
  return index
}

/** Every route a route is part of, nearest first. */
function ancestors(id: string, routes: Record<string, BikeRoute>, seen = new Set<string>()): string[] {
  const out: string[] = []
  for (const parent of routes[id]?.parents ?? []) {
    if (seen.has(parent) || !routes[parent]) continue
    seen.add(parent)
    out.push(parent, ...ancestors(parent, routes, seen))
  }
  return out
}

interface Props {
  selected: Extract<Selected, { kind: 'route' }>
  onClose: () => void
  /** Picks out another of the routes on the map. */
  onFocus: (id: string) => void
}

/** The signed routes a clicked way is on, with the larger routes they are part of. */
export function BikeRouteCard({ selected, onClose, onFocus }: Props) {
  const { t, lang } = useI18n()
  const [routes, setRoutes] = useState<Record<string, BikeRoute> | null>(null)
  useEffect(() => {
    let current = true
    routeIndex().then((loaded) => current && setRoutes(loaded))
    return () => {
      current = false
    }
  }, [])
  if (!routes) return null

  const rank = (id: string) => ROUTE_LEVEL_IDS.indexOf(routes[id]?.level ?? 'mtb')
  const direct = selected.routes.filter((id) => routes[id]).sort((a, b) => rank(a) - rank(b))
  const nameOf = (id: string) => routes[id]?.name ?? routes[id]?.ref ?? t('routeUnnamed')
  const km = (n: number) => `${n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 1 })} km`
  const focused = routes[selected.focus]

  const routeButton = (id: string) => {
    const route = routes[id]
    const level = isRouteLevelId(route.level) ? route.level : 'local'
    return (
      <button
        key={id}
        type="button"
        className="comfort-part bike-route"
        aria-pressed={selected.focus === id}
        title={t('showOnMap')}
        onClick={() => onFocus(id)}
      >
        <span className="swatch line" style={{ background: ROUTE_COLORS[level] }} />
        <span className="bike-route-name">
          {nameOf(id)}
          <small>
            {t(`routeLevel.${level}`)} · {km(route.km)}
          </small>
        </span>
      </button>
    )
  }

  return (
    <section className="feature-card" aria-live="polite">
      <header>
        <div className="feature-title">
          <h2>{direct[0] ? nameOf(direct[0]) : t('bikeRoutes')}</h2>
          <p>{t('bikeRoutes')}</p>
        </div>
        <button type="button" className="feature-close" aria-label={t('close')} onClick={onClose}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
      </header>
      <ul className="bike-routes">
        {direct.map((id) => {
          const parents = ancestors(id, routes)
          return (
            <li key={id}>
              {routeButton(id)}
              {parents.length > 0 && (
                <div className="bike-route-parents">
                  <span>{t('partOf')}</span>
                  {parents.map(routeButton)}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {focused && (
        <p className="feature-links">
          {focused.operator && <span>{focused.operator}</span>}
          <a
            href={`https://www.openstreetmap.org/relation/${selected.focus}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            OSM
          </a>
          {focused.website && /^https?:\/\//.test(focused.website) && (
            <a href={focused.website} target="_blank" rel="noopener noreferrer">
              {new URL(focused.website).hostname.replace(/^www\./, '')}
            </a>
          )}
        </p>
      )}
    </section>
  )
}
