import { REGION } from '../config'
import { describeStatus, hoursStatus, parseHours, weekTimeIn } from '../hours'
import { isMessageKey, type MessageKey, type Translate, useI18n } from '../i18n'
import { bikewayColors, isBikewayId, LTS_COLORS, WINTER_COLORS } from '../layers'
import type { Selected } from '../map/style'
import { commonsLink, directImage, imageLink, mapillaryId, mapillaryViewerUrl, streetViewUrl } from '../photos'
import { isPlaceKind } from '../places'
import { wayType } from '../wayType'
import { RouteIcon } from './icons'
import { PlaceIcon } from './PlaceIcon'
import { CardPhoto, hasPhoto } from './PlacePhoto'

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
  'wheelchair',
  'operator',
] as const

/** Shows an OSM tag value in plain words: yes/no translated, units added, underscores removed. */
function formatValue(key: string, value: unknown, t: Translate): string {
  const text = String(value)
  if (text === 'yes' || text === 'no' || text === 'limited') return t(text)
  if (key === 'width' && /^[\d.]+$/.test(text)) return `${text} m`
  if (key === 'maxspeed' && /^\d+$/.test(text)) return `${text} km/h`
  return text.replaceAll('_', ' ').replaceAll(';', ', ')
}

/** An OSM date ("2026", "2026-09") in words: "2026", "September 2026". */
function formatMonth(date: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(date)
  if (!match) return date
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
}

function osmPath(selected: Props['selected']): string {
  return selected.kind === 'way' ? `way/${selected.id}` : selected.osm
}

interface Props {
  /** A street, path or place; collisions have a card of their own. */
  selected: Exclude<Selected, { kind: 'collision' }>
  onClose: () => void
  /** Plans a route to a place, named as given; left out where there is no router. */
  onRouteHere?: (label: string) => void
}

export function FeatureCard({ selected, onClose, onRouteHere }: Props) {
  const { t, lang } = useI18n()
  const { props } = selected
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  // Stations say what runs through them; the legend keeps the one word for all.
  const stationKey = `station.${props.station}`
  const kindKey =
    selected.kind === 'place' && isMessageKey(stationKey)
      ? stationKey
      : `${selected.kind === 'way' ? 'kind' : 'place'}.${props.kind}`
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
    if (isBikewayId(props.bikeway)) {
      // Sides that differ are both named, the better first.
      const other = [props.bikeway_left, props.bikeway_right].find((side) => side !== props.bikeway)
      facts.push({
        label: t('fact.bikeway'),
        value: [props.bikeway, other]
          .filter(isBikewayId)
          .map((kind) => t(`bikeway.${kind}`))
          .join(' · '),
        // The card is pale, so the colours drawn on pale ground.
        color: bikewayColors('light')[props.bikeway],
      })
    }
    if (props.kind === 'path' && props.winter !== undefined) {
      const winter = String(props.winter) as keyof typeof WINTER_COLORS
      facts.push({ label: t('fact.winter'), value: t(`winter.${winter}`), color: WINTER_COLORS[winter] })
    }
  } else if (props.kind === 'station') {
    if (props.construction === 'yes') {
      // A date already past only means the map is behind; it is left out.
      const date = typeof props.opening_date === 'string' ? props.opening_date.slice(0, 7) : ''
      const opens = /^\d{4}/.test(date) && date >= new Date().toISOString().slice(0, date.length) ? date : null
      facts.push({
        label: t('fact.status'),
        value: t('station.construction'),
        note: opens ? t('station.opens').replace('{date}', formatMonth(opens, locale)) : undefined,
      })
    }
    // VIA's trains are numbered, not lined: their "line" is just the operator again.
    const lines = typeof props.lines === 'string' && props.lines !== props.operator ? props.lines : null
    if (lines) facts.push({ label: t(/[,/]/.test(lines) ? 'fact.lines' : 'fact.line'), value: lines })
  }
  for (const key of selected.kind === 'way' ? WAY_FACTS : PLACE_FACTS) {
    if (props[key] === undefined) continue
    const value = formatValue(key, props[key], t)
    // Hours lead with whether the place is open now, when they can be understood.
    const week = key === 'opening_hours' ? parseHours(String(props[key])) : null
    if (week) {
      const status = hoursStatus(week, weekTimeIn(REGION.timeZone))
      const words = describeStatus(status, locale, {
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

  // Photos the card does not show itself are linked instead.
  const photoLinks: { href: string; label: string }[] = []
  if (selected.kind === 'place') {
    const shown = hasPhoto(props)
    const mapillary = mapillaryId(props.mapillary)
    const image = imageLink(props.image)
    const commons = commonsLink(props.wikimedia_commons)
    if (mapillary && !shown) photoLinks.push({ href: mapillaryViewerUrl(mapillary), label: t('photoOnMapillary') })
    if (image && !directImage(props.image)) photoLinks.push({ href: image, label: t('photo') })
    if (commons) photoLinks.push({ href: commons, label: 'Wikimedia Commons' })
  }

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
      {selected.kind === 'place' && onRouteHere && (
        <div className="feature-actions">
          <button type="button" className="primary" onClick={() => onRouteHere(name ?? kindLabel)}>
            <RouteIcon />
            {t('routeHere')}
          </button>
        </div>
      )}
      <CardPhoto at={selected.at} props={selected.kind === 'place' ? props : undefined} />
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
        <span>
          {t('viewIn')}{' '}
          <a href={`https://www.openstreetmap.org/${type}/${id}`} target="_blank" rel="noopener noreferrer">
            OSM
          </a>
          {' · '}
          <a href={streetViewUrl(selected.at)} target="_blank" rel="noopener noreferrer">
            Street View
          </a>
        </span>
        {photoLinks.map(({ href, label }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ))}
      </p>
    </section>
  )
}
