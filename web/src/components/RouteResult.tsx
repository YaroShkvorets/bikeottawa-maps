import { useMemo, useState } from 'react'
import { type MessageKey, useI18n } from '../i18n'
import { LTS_COLORS, NO_BIKES_COLOR } from '../layers'
import { COMFORT_KEYS, type ComfortKey, distanceByComfort, type Route } from '../route/brouter'
import { downloadText, toGpx } from '../route/gpx'
import { routeProfile } from '../route/profile'
import type { RouteState } from '../route/useRoute'
import { visibleRoute } from '../route/useRoute'
import { ElevationChart } from './ElevationChart'

const COMFORT: Record<ComfortKey, { color: string; label: MessageKey }> = {
  lts1: { color: LTS_COLORS[0], label: 'lts.1' },
  lts2: { color: LTS_COLORS[1], label: 'lts.2' },
  lts3: { color: LTS_COLORS[2], label: 'lts.3' },
  lts4: { color: LTS_COLORS[3], label: 'lts.4' },
  sidewalk: { color: NO_BIKES_COLOR, label: 'sidewalk' },
  stairs: { color: NO_BIKES_COLOR, label: 'stairs' },
  other: { color: NO_BIKES_COLOR, label: 'walk' },
}

function ComfortBar({ route }: { route: Route }) {
  const { t } = useI18n()
  const totals = distanceByComfort(route)
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1
  const parts = COMFORT_KEYS.filter((key) => totals[key] > 0)
  return (
    <div className="comfort">
      <p className="footnote">{t('comfortAlong')}</p>
      <div className="comfort-bar" aria-hidden="true">
        {parts.map((key) => (
          <span key={key} style={{ flexGrow: totals[key], background: COMFORT[key].color }} />
        ))}
      </div>
      <ul>
        {parts.map((key) => (
          <li key={key}>
            <span className="swatch line" style={{ background: COMFORT[key].color }} />
            <span>{t(COMFORT[key].label)}</span>
            <span className="share">{Math.max(1, Math.round((totals[key] / sum) * 100))}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Props {
  state: RouteState
  /** Metres along the route being pointed at, on the chart or on the map. */
  hover: number | null
  onHover: (distance: number | null) => void
}

export function RouteResult({ state, hover, onHover }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const route = visibleRoute(state)
  const profile = useMemo(() => (route ? routeProfile(route.coords) : []), [route])

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
      <ElevationChart profile={profile} label={t('elevation')} hover={hover} onHover={onHover} />
      <p className="footnote via-hint">{t('viaHint')}</p>
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
