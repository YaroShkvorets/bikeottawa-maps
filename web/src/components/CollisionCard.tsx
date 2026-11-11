import { type CollisionProps, collisionLocation } from '../collisions'
import { isMessageKey, type MessageKey, type Translate, useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'
import { streetViewUrl } from '../photos'
import { CardPhoto } from './PlacePhoto'

interface Props {
  props: Record<string, unknown>
  at: [number, number]
  basemap: BasemapId
  onClose: () => void
}

/** "Angle" → "Angle (crossing paths)": the city's coded values in plain words, as given when unknown. */
function coded(field: string, value: unknown, t: Translate): string | null {
  if (typeof value !== 'string' || !value) return null
  const key = `crash.${field}.${value}`
  return isMessageKey(key) ? t(key) : value
}

/** "2 cyclists, 1 vehicle". */
function involved(p: CollisionProps, t: Translate): string {
  const count = (n: number, one: MessageKey, many: MessageKey) => (n > 0 ? `${n} ${t(n === 1 ? one : many)}` : null)
  return [
    count(p.bicycles, 'crash.cyclist', 'crash.cyclists'),
    count(p.pedestrians, 'crash.pedestrian', 'crash.pedestrians'),
    count(p.vehicles, 'crash.vehicle', 'crash.vehicles'),
  ]
    .filter(Boolean)
    .join(', ')
}

/** Details of one collision, from the city's record of it. */
export function CollisionCard({ props, at, basemap, onClose }: Props) {
  const { t, lang } = useI18n()
  const p = props as unknown as CollisionProps
  const bicycles = Number(p.bicycles) > 0
  const pedestrians = Number(p.pedestrians) > 0
  const title = t(bicycles && pedestrians ? 'crash.title.both' : bicycles ? 'crash.title.bike' : 'crash.title.foot')
  // Dates are local days; read them as such, not as UTC midnight.
  const date = p.date
    ? new Date(`${p.date}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'long' })
    : String(p.year)
  const facts: { label: string; value: string | null; color?: string }[] = [
    { label: t('crash.injury'), value: t(`severity.${p.severity}`), color: collisionColors(basemap)[p.severity] },
    { label: t('crash.where'), value: p.location ? collisionLocation(p.location, t('crash.between')) : null },
    {
      label: t('crash.involved'),
      value: involved(
        { ...p, bicycles: Number(p.bicycles), pedestrians: Number(p.pedestrians), vehicles: Number(p.vehicles) },
        t,
      ),
    },
    { label: t('crash.impact'), value: coded('impact', p.impact, t) },
    { label: t('crash.light'), value: coded('light', p.light, t) },
    { label: t('crash.surface'), value: coded('surface', p.surface, t) },
    { label: t('crash.weather'), value: coded('weather', p.weather, t) },
    { label: t('crash.control'), value: coded('control', p.control, t) },
  ]

  return (
    <section className="feature-card" aria-live="polite">
      <header>
        <div className="feature-title">
          <h2>{title}</h2>
          <p>{date}</p>
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
      <CardPhoto at={at} />
      <dl>
        {facts
          .filter((fact) => fact.value)
          .map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                {fact.color && <span className="swatch dot" style={{ background: fact.color }} />}
                {fact.value}
              </dd>
            </div>
          ))}
      </dl>
      <p className="feature-links">
        <span>
          {t('viewIn')}{' '}
          <a href={streetViewUrl(at)} target="_blank" rel="noopener noreferrer">
            Street View
          </a>
        </span>
      </p>
    </section>
  )
}
