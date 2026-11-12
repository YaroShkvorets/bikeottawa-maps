import { useI18n } from '../i18n'
import type { PlaceKind } from '../places'
import type { PlaceCount } from '../route/reachPlaces'
import type { ReachState } from '../route/useReach'
import { visibleReach } from '../route/useReach'
import { PlaceIcon } from './PlaceIcon'

interface Props {
  state: ReachState
  minutes: number
  /** Square metres covered, for the reach shown. */
  area: number
  /** The places picked on the Places layer within reach; null while counted, or none picked. */
  places: PlaceCount[] | null
  /** Whether any places are picked on the Places layer. */
  picked: boolean
  /** The kind kept picked out on the map. Pointing at a row picks it out; a click keeps it. */
  pinned: PlaceKind | null
  onPoint: (kind: PlaceKind | null) => void
  onPin: (kind: PlaceKind | null) => void
}

/** Square kilometres: one decimal below ten. */
export function formatArea(area: number, lang: string): string {
  const km2 = area / 1e6
  return `${km2.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: km2 < 10 ? 1 : 0 })} km²`
}

/** Status of the reach map, what it covers and the places within it. */
export function ReachResult({ state, minutes, area, places, picked, pinned, onPoint, onPin }: Props) {
  const { t, lang } = useI18n()
  if (state.status === 'error') return <p className="route-message error">{t('reachError')}</p>
  const reach = visibleReach(state)
  if (!reach) return <p className="route-message">{state.status === 'loading' ? t('reachLoading') : t('reachHint')}</p>
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  return (
    <section className={`route-result ${state.status === 'loading' ? 'stale' : ''}`} aria-live="polite">
      <dl className="route-stats">
        <div className="route-stat">
          <dd>{formatArea(area, lang)}</dd>
          <dt>{t('area')}</dt>
        </div>
        <div className="route-stat">
          <dd>{minutes} min</dd>
          <dt>{t('time')}</dt>
        </div>
        {places && (
          <div className="route-stat">
            <dd>{number(places.reduce((sum, { points }) => sum + points.length, 0))}</dd>
            <dt>{t('reach.places')}</dt>
          </div>
        )}
      </dl>
      {places ? (
        <div className="reach-places">
          <ul>
            {places.map(({ kind, points }) => (
              <li key={kind}>
                <button
                  type="button"
                  className="comfort-part"
                  title={t('showOnMap')}
                  disabled={points.length === 0}
                  aria-pressed={pinned === kind}
                  // A tap is not pointing: on a touch screen only the click counts.
                  onPointerEnter={(e) => e.pointerType === 'mouse' && onPoint(kind)}
                  onPointerLeave={() => onPoint(null)}
                  onFocus={(e) => e.target.matches(':focus-visible') && onPoint(kind)}
                  onBlur={() => onPoint(null)}
                  onClick={() => {
                    // A second click lets go, even with the pointer still on the row.
                    if (pinned === kind) onPoint(null)
                    onPin(pinned === kind ? null : kind)
                  }}
                >
                  <PlaceIcon kind={kind} />
                  <span>{t(`place.${kind}`)}</span>
                  <span className="share">{number(points.length)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !picked && <p className="footnote">{t('reach.placesHint')}</p>
      )}
      <p className="footnote">{t('reachAbout')}</p>
    </section>
  )
}
