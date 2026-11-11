import { useState } from 'react'
import { type MessageKey, useI18n } from '../i18n'
import { LTS_COLORS, NO_BIKES_COLOR } from '../layers'
import { distanceByLts, type Route } from '../route/brouter'
import { downloadText, toGpx } from '../route/gpx'
import type { RouteState } from '../route/useRoute'
import { visibleRoute } from '../route/useRoute'
import { ElevationChart } from './ElevationChart'

const LEVEL_COLORS = [NO_BIKES_COLOR, ...LTS_COLORS]
/** Most comfortable first, walking stretches last. */
const LEVEL_ORDER = [1, 2, 3, 4, 0]

function ComfortBar({ route }: { route: Route }) {
  const { t } = useI18n()
  const totals = distanceByLts(route)
  const sum = totals.reduce((a, b) => a + b, 0) || 1
  const levels = LEVEL_ORDER.filter((level) => totals[level] > 0)
  return (
    <div className="comfort">
      <p className="footnote">{t('comfortAlong')}</p>
      <div className="comfort-bar" aria-hidden="true">
        {levels.map((level) => (
          <span key={level} style={{ flexGrow: totals[level], background: LEVEL_COLORS[level] }} />
        ))}
      </div>
      <ul>
        {levels.map((level) => (
          <li key={level}>
            <span className="swatch line" style={{ background: LEVEL_COLORS[level] }} />
            <span>{level === 0 ? t('walk') : t(`lts.${level}` as MessageKey)}</span>
            <span className="share">{Math.max(1, Math.round((totals[level] / sum) * 100))}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RouteResult({ state }: { state: RouteState }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const route = visibleRoute(state)

  if (state.status === 'error') return <p className="route-message error">{t('routeError')}</p>
  if (!route) return <p className="route-message">{state.status === 'loading' ? t('routeLoading') : t('routeHint')}</p>

  const copyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => setCopied(false))
  }

  return (
    <section className={`route-result ${state.status === 'loading' ? 'stale' : ''}`} aria-live="polite">
      <dl className="route-stats">
        <div className="route-stat">
          <dd>{(route.distance / 1000).toFixed(1)} km</dd>
          <dt>{t('distance')}</dt>
        </div>
        <div className="route-stat">
          <dd>{Math.max(1, Math.round(route.time / 60))} min</dd>
          <dt>{t('time')}</dt>
        </div>
        <div className="route-stat">
          <dd>{Math.round(route.ascent)} m</dd>
          <dt>{t('climb')}</dt>
        </div>
      </dl>
      <ComfortBar route={route} />
      <ElevationChart route={route} label={t('elevation')} />
      <div className="route-actions">
        <button
          type="button"
          className="primary"
          onClick={() => downloadText('bike-route.gpx', toGpx(route, t('gpxName')), 'application/gpx+xml')}
        >
          {t('exportGpx')}
        </button>
        <button type="button" onClick={copyLink}>
          {copied ? t('copied') : t('copyLink')}
        </button>
      </div>
    </section>
  )
}
