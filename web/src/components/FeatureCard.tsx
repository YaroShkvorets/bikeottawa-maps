import { REGION } from '../config'
import { describeStatus, hoursStatus, parseHours, weekTimeIn } from '../hours'
import { isMessageKey, type MessageKey, type Translate, useI18n } from '../i18n'
import { LTS_COLORS, WINTER_COLORS } from '../layers'
import type { Selected } from '../map/style'
import { isPlaceKind } from '../places'
import { wayType } from '../wayType'
import { PlaceIcon } from './PlaceIcon'
import { PlacePhoto } from './PlacePhoto'

const WAY_FACTS = ['surface', 'smoothness', 'width', 'lit', 'maxspeed', 'lanes'] as const
const PLACE_FACTS = [
  'description',
  'bicycle_parking',
  'capacity',
  'covered',
  'service:bicycle:repair',
  'service:bicycle:pump',
  'service:bicycle:chain_tool',
  'information',
  'indoor',
  'bottle',
  'backrest',
  'material',
  'fuel',
  'cuisine',
  'outdoor_seating',
  'takeaway',
  'fee',
  'seasonal',
  'opening_hours',
  'phone',
  'operator',
] as const

/** Shows an OSM tag value in plain words: yes/no translated, units added, underscores removed. */
function formatValue(key: string, value: unknown, t: Translate): string {
  const text = String(value)
  if (text === 'yes' || text === 'no') return t(text)
  if (key === 'width' && /^[\d.]+$/.test(text)) return `${text} m`
  if (key === 'maxspeed' && /^\d+$/.test(text)) return `${text} km/h`
  return text.replaceAll('_', ' ').replaceAll(';', ', ')
}

function osmPath(selected: Selected): string {
  return selected.kind === 'way' ? `way/${selected.id}` : selected.osm
}

interface Props {
  selected: Selected
  onClose: () => void
}

export function FeatureCard({ selected, onClose }: Props) {
  const { t, lang } = useI18n()
  const { props } = selected
  const kindKey = `${selected.kind === 'way' ? 'kind' : 'place'}.${props.kind}`
  const kindLabel = (selected.kind === 'way' && wayType(props, t)) || (isMessageKey(kindKey) ? t(kindKey) : '')
  const name = typeof props.name === 'string' ? props.name : null
  const [type, id] = osmPath(selected).split('/')

  const facts: { label: string; value: string; color?: string; tone?: 'open' | 'closed'; note?: string }[] = []
  if (selected.kind === 'way') {
    const lts = Number(props.lts)
    facts.push({
      label: t('fact.comfort'),
      value: t(`lts.${lts}` as MessageKey),
      color: lts > 0 ? LTS_COLORS[lts - 1] : undefined,
    })
    if (props.kind === 'path' && props.winter !== undefined) {
      const winter = String(props.winter) as keyof typeof WINTER_COLORS
      facts.push({ label: t('fact.winter'), value: t(`winter.${winter}`), color: WINTER_COLORS[winter] })
    }
  }
  for (const key of selected.kind === 'way' ? WAY_FACTS : PLACE_FACTS) {
    if (props[key] === undefined) continue
    const value = formatValue(key, props[key], t)
    // Hours lead with whether the place is open now, when they can be understood.
    const week = key === 'opening_hours' ? parseHours(String(props[key])) : null
    if (week) {
      const status = hoursStatus(week, weekTimeIn(REGION.timeZone))
      const words = describeStatus(status, lang === 'fr' ? 'fr-CA' : 'en-CA', {
        openUntil: t('hours.openUntil'),
        open24: t('hours.open24'),
        opensAt: t('hours.opensAt'),
        opensTomorrow: t('hours.opensTomorrow'),
        opensDay: t('hours.opensDay'),
        closed: t('hours.closed'),
      })
      facts.push({ label: t(`fact.${key}`), value: words, tone: status.open ? 'open' : 'closed', note: value })
    } else {
      facts.push({ label: t(`fact.${key}`), value })
    }
  }
  const website = typeof props.website === 'string' && /^https?:\/\//.test(props.website) ? props.website : null

  const hasFacts = facts.length > 0 || website !== null

  return (
    <section className="feature-card" aria-live="polite">
      <header>
        {selected.kind === 'place' && isPlaceKind(props.kind) && <PlaceIcon kind={props.kind} large />}
        <div className="feature-title">
          <h2>{name ?? kindLabel}</h2>
          {/* The kind is the title when there is no name, so it is not repeated. */}
          {name && kindLabel && <p>{kindLabel}</p>}
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
      {selected.kind === 'place' && <PlacePhoto props={props} />}
      {hasFacts && (
        <dl>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                {fact.color && <span className="swatch line" style={{ background: fact.color }} />}
                {fact.note ? (
                  <span className="fact-lines">
                    <strong className={fact.tone}>{fact.value}</strong>
                    <small>{fact.note}</small>
                  </span>
                ) : (
                  fact.value
                )}
              </dd>
            </div>
          ))}
          {website && (
            <div>
              <dt>{t('fact.website')}</dt>
              <dd>
                <a href={website} target="_blank" rel="noopener noreferrer">
                  {new URL(website).hostname.replace(/^www\./, '')}
                </a>
              </dd>
            </div>
          )}
        </dl>
      )}
      <p className="feature-links">
        <a href={`https://www.openstreetmap.org/${type}/${id}`} target="_blank" rel="noopener noreferrer">
          {t('viewOnOsm')}
        </a>
      </p>
    </section>
  )
}
