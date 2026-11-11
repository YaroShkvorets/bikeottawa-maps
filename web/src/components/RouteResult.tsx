import { useMemo, useState } from 'react'
import { type MessageKey, useI18n } from '../i18n'
import { LTS_COLORS, NO_BIKES_COLOR } from '../layers'
import { LIGHT_BODY, LIGHT_COLORS, STOP_RED } from '../map/stopImage'
import {
  COMFORT_KEYS,
  type ComfortKey,
  distanceByComfort,
  type Route,
  type RouteHighlight,
  type RouteStop,
} from '../route/brouter'
import { downloadText, toGpx } from '../route/gpx'
import { routeProfile, smoothElevation } from '../route/profile'
import { stressLevel, stressScore } from '../route/stress'
import type { Travel } from '../route/styles'
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

/** What the legend needs to pick things out on the map: pointing shows them, a click keeps them and zooms there. */
interface Picking {
  /** The item currently picked out, by pointing or by a click. */
  highlight: RouteHighlight | null
  /** The item kept picked out by a click. */
  pinned: RouteHighlight | null
  onPoint: (item: RouteHighlight | null) => void
  onPin: (item: RouteHighlight | null) => void
}

function pickingProps(item: RouteHighlight, { pinned, onPoint, onPin }: Picking) {
  return {
    'aria-pressed': pinned === item,
    onPointerEnter: () => onPoint(item),
    onPointerLeave: () => onPoint(null),
    onFocus: () => onPoint(item),
    onBlur: () => onPoint(null),
    onClick: () => onPin(pinned === item ? null : item),
  }
}

const STOP_LABELS: Record<RouteStop['kind'], MessageKey> = { stop: 'stopSigns', light: 'trafficLights' }

function StopIcon({ kind }: { kind: RouteStop['kind'] }) {
  return kind === 'stop' ? (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20">
      <path d="M6.5 1.5h7l5 5v7l-5 5h-7l-5-5v-7z" fill={STOP_RED} />
      <rect x="5.5" y="8.75" width="9" height="2.5" fill="#fff" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20">
      <rect x="5.5" y="1" width="9" height="18" rx="3" fill={LIGHT_BODY} />
      {LIGHT_COLORS.map((color, i) => (
        <circle key={color} cx="10" cy={4.8 + i * 5.2} r="2" fill={color} />
      ))}
    </svg>
  )
}

/** Stop signs and traffic lights on the route, counted on one line. */
function StopCounts({ route, picking }: { route: Route; picking: Picking }) {
  const { t } = useI18n()
  return (
    <p className="stop-counts">
      {(['stop', 'light'] as const).map((kind) => {
        const count = route.stops.filter((stop) => stop.kind === kind).length
        return (
          <button
            key={kind}
            type="button"
            className="stop-count"
            title={t('showOnRoute')}
            disabled={count === 0}
            {...pickingProps(kind, picking)}
          >
            <StopIcon kind={kind} />
            {t(STOP_LABELS[kind])} <b>{count}</b>
          </button>
        )
      })}
    </p>
  )
}

/** How the route splits by comfort. Pointing at a part picks it out on the map; a click keeps it and zooms there. */
function ComfortBar({ route, picking }: { route: Route; picking: Picking }) {
  const { highlight, onPoint } = picking
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
            <button type="button" className="comfort-part" title={t('showOnRoute')} {...pickingProps(key, picking)}>
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
  /** On foot, the cycling-only parts (comfort, stress, stops) are left out. */
  travel: Travel
  state: RouteState
  /** Metres along the route being pointed at, on the chart or on the map. */
  hover: number | null
  onHover: (distance: number | null) => void
  /** Legend item picked out on the map. */
  highlight: RouteHighlight | null
  pinned: RouteHighlight | null
  onPointPart: (item: RouteHighlight | null) => void
  onPinPart: (item: RouteHighlight | null) => void
}

export function RouteResult({ travel, state, hover, onHover, highlight, pinned, onPointPart, onPinPart }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const route = visibleRoute(state)
  const picking: Picking = { highlight, pinned, onPoint: onPointPart, onPin: onPinPart }
  const profile = useMemo(() => (route ? smoothElevation(routeProfile(route.coords)) : []), [route])

  if (state.status === 'error') return <p className="route-message error">{t('routeError')}</p>
  if (!route) return <p className="route-message">{state.status === 'loading' ? t('routeLoading') : t('routeHint')}</p>

  const stress = stressScore(route.segments)

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
        {travel === 'bike' && (
          <div className="route-stat" title={t('stressAbout')}>
            <dd>
              <span
                className={`stress-score level-${stressLevel(stress)}`}
                style={{ background: LTS_COLORS[stressLevel(stress) - 1] }}
              >
                {stress}
                <span className="out-of">/10</span>
              </span>
            </dd>
            <dt>{t('stress')}</dt>
          </div>
        )}
      </dl>
      {travel === 'bike' && <ComfortBar route={route} picking={picking} />}
      {travel === 'bike' && <StopCounts route={route} picking={picking} />}
      <ElevationChart profile={profile} label={t('elevation')} hover={hover} onHover={onHover} />
      <div className="route-actions">
        <button
          type="button"
          className="primary"
          onClick={() =>
            downloadText(
              `${travel === 'bike' ? 'bike' : 'walk'}-route.gpx`,
              toGpx(route, t('gpxName')),
              'application/gpx+xml',
            )
          }
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
