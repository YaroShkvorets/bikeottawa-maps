import { useMemo, useState } from 'react'
import { type MessageKey, useI18n } from '../i18n'
import { LTS_COLORS, NO_BIKES_COLOR } from '../layers'
import { LIGHT_BODY, LIGHT_COLORS, STOP_RED } from '../map/stopImage'
import { COMFORT_KEYS, type ComfortKey, distanceByComfort, type Route } from '../route/brouter'
import { downloadText, toGpx } from '../route/gpx'
import { routeProfile, smoothElevation } from '../route/profile'
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

/** Stop signs and traffic lights on the route, counted on one line. */
function StopCounts({ route }: { route: Route }) {
  const { t } = useI18n()
  const count = (kind: 'stop' | 'light') => route.stops.filter((stop) => stop.kind === kind).length
  return (
    <p className="stop-counts">
      <span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20">
          <path d="M6.5 1.5h7l5 5v7l-5 5h-7l-5-5v-7z" fill={STOP_RED} />
          <rect x="5.5" y="8.75" width="9" height="2.5" fill="#fff" />
        </svg>
        {t('stopSigns')} <b>{count('stop')}</b>
      </span>
      <span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20">
          <rect x="5.5" y="1" width="9" height="18" rx="3" fill={LIGHT_BODY} />
          {LIGHT_COLORS.map((color, i) => (
            <circle key={color} cx="10" cy={4.8 + i * 5.2} r="2" fill={color} />
          ))}
        </svg>
        {t('trafficLights')} <b>{count('light')}</b>
      </span>
    </p>
  )
}

interface ComfortProps {
  route: Route
  /** The part currently picked out on the map, by pointing or by a click. */
  highlight: ComfortKey | null
  /** The part kept picked out by a click. */
  pinned: ComfortKey | null
  onPoint: (part: ComfortKey | null) => void
  onPin: (part: ComfortKey | null) => void
}

/** How the route splits by comfort. Pointing at a part picks it out on the map; a click keeps it and zooms there. */
function ComfortBar({ route, highlight, pinned, onPoint, onPin }: ComfortProps) {
  const { t } = useI18n()
  const totals = distanceByComfort(route)
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1
  const parts = COMFORT_KEYS.filter((key) => totals[key] > 0)
  return (
    <div className="comfort">
      <p className="footnote">{t('comfortAlong')}</p>
      <div className="comfort-bar" aria-hidden="true">
        {parts.map((key) => (
          <span
            key={key}
            className={highlight && highlight !== key ? 'comfort-bar-part faded' : 'comfort-bar-part'}
            style={{ flexGrow: totals[key], background: COMFORT[key].color }}
            onPointerEnter={() => onPoint(key)}
            onPointerLeave={() => onPoint(null)}
          />
        ))}
      </div>
      <ul>
        {parts.map((key) => (
          <li key={key}>
            <button
              type="button"
              className="comfort-part"
              aria-pressed={pinned === key}
              title={t('showOnRoute')}
              onPointerEnter={() => onPoint(key)}
              onPointerLeave={() => onPoint(null)}
              onFocus={() => onPoint(key)}
              onBlur={() => onPoint(null)}
              onClick={() => onPin(pinned === key ? null : key)}
            >
              <span className="swatch line" style={{ background: COMFORT[key].color }} />
              <span>{t(COMFORT[key].label)}</span>
              <span className="share">{Math.max(1, Math.round((totals[key] / sum) * 100))}%</span>
            </button>
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
  /** Part of the comfort breakdown picked out on the map. */
  highlight: ComfortKey | null
  pinned: ComfortKey | null
  onPointPart: (part: ComfortKey | null) => void
  onPinPart: (part: ComfortKey | null) => void
}

export function RouteResult({ state, hover, onHover, highlight, pinned, onPointPart, onPinPart }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const route = visibleRoute(state)
  const profile = useMemo(() => (route ? smoothElevation(routeProfile(route.coords)) : []), [route])

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
      <ComfortBar route={route} highlight={highlight} pinned={pinned} onPoint={onPointPart} onPin={onPinPart} />
      <StopCounts route={route} />
      <ElevationChart profile={profile} label={t('elevation')} hover={hover} onHover={onHover} />
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
