import { useI18n } from '../i18n'
import { type BasemapId, reachRamp } from '../layers'
import type { ReachState } from '../route/useReach'
import { visibleReach } from '../route/useReach'

interface Props {
  state: ReachState
  minutes: number
  basemap: BasemapId
  /** Square metres covered, for the reach shown. */
  area: number
}

/** Square kilometres: one decimal below ten. */
export function formatArea(area: number, lang: string): string {
  const km2 = area / 1e6
  return `${km2.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: km2 < 10 ? 1 : 0 })} km²`
}

/** Status of the reach map and the key to its colours. */
export function ReachResult({ state, minutes, basemap, area }: Props) {
  const { t, lang } = useI18n()
  if (state.status === 'error') return <p className="route-message error">{t('reachError')}</p>
  const reach = visibleReach(state)
  if (!reach) return <p className="route-message">{state.status === 'loading' ? t('reachLoading') : t('reachHint')}</p>
  const ramp = reachRamp(basemap)
  return (
    <section className={`route-result ${state.status === 'loading' ? 'stale' : ''}`} aria-live="polite">
      <dl className="route-stats">
        <div className="route-stat">
          <dd>{formatArea(area, lang)}</dd>
          <dt>{t('area')}</dt>
        </div>
      </dl>
      <div className="reach-key">
        <div
          className="reach-bar"
          aria-hidden="true"
          style={{ background: `linear-gradient(to right, ${ramp.join(', ')})` }}
        />
        <div className="reach-ticks">
          <span>0</span>
          <span>{minutes / 2}</span>
          <span>{minutes} min</span>
        </div>
      </div>
      <p className="footnote">{t('reachAbout')}</p>
    </section>
  )
}
