import { useMemo } from 'react'
import {
  COLLISION_PARTIES,
  COLLISION_YEARS,
  type CollisionFilters,
  type CollisionSpot,
  SEVERITIES,
  type Severity,
} from '../collisions'
import { useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'

interface Props {
  /** The spots shown, for the counts; null while they load. */
  spots: readonly CollisionSpot[] | null
  /** The most collisions at any one spot, for the slider's top. */
  busiestSpot: number
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  basemap: BasemapId
}

/** A spot's circle as the map draws it in the middle of its zoom range: area grows with the count. */
function SpotDot({ count, color }: { count: number; color: string }) {
  const r = 4 + 2.2 * Math.sqrt(Math.max(0, count - 1))
  const size = Math.ceil(2 * r + 2)
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="spot-dot">
      <circle cx={size / 2} cy={size / 2} r={r} fill={color} stroke="#fff" />
    </svg>
  )
}

const YEARS = Array.from(
  { length: COLLISION_YEARS.last - COLLISION_YEARS.first + 1 },
  (_, i) => COLLISION_YEARS.first + i,
).filter((y) => !(COLLISION_YEARS.missing as readonly number[]).includes(y))

/** Who, which years and which injuries the collisions layer shows, with how many of each. */
export function CollisionLegend({ spots, busiestSpot, filters, onChange, basemap }: Props) {
  const { t, lang } = useI18n()
  // Collisions shown, by worst injury: those in the spots left on the map.
  const counts = useMemo(() => {
    if (!spots) return null
    const byInjury = { none: 0, minimal: 0, minor: 0, major: 0, fatal: 0 }
    for (const spot of spots) for (const p of spot.items) byInjury[p.severity]++
    return byInjury
  }, [spots])
  const colors = collisionColors(basemap)
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const shown = counts ? filters.severities.reduce((sum, s) => sum + counts[s], 0) : null

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  return (
    <div className="collision-legend">
      <div className="collision-parties">
        {COLLISION_PARTIES.map((party) => (
          <label key={party} className="check">
            <input
              type="checkbox"
              checked={filters.parties.includes(party)}
              onChange={() => onChange({ ...filters, parties: toggle(filters.parties, party) })}
            />
            {t(`crash.${party}`)}
          </label>
        ))}
      </div>
      <div className="collision-years">
        <span>{t('crash.years')}</span>
        <select
          aria-label={t('crash.years')}
          value={filters.from}
          onChange={(e) => {
            const from = Number(e.target.value)
            onChange({ ...filters, from, to: Math.max(from, filters.to) })
          }}
        >
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <span>{t('crash.yearTo')}</span>
        <select
          aria-label={`${t('crash.years')} ${t('crash.yearTo')}`}
          value={filters.to}
          onChange={(e) => {
            const to = Number(e.target.value)
            onChange({ ...filters, to, from: Math.min(to, filters.from) })
          }}
        >
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      <ul className="collision-severities">
        {[...SEVERITIES].reverse().map((severity: Severity) => (
          <li key={severity}>
            <label className="check">
              <input
                type="checkbox"
                checked={filters.severities.includes(severity)}
                onChange={() => onChange({ ...filters, severities: toggle(filters.severities, severity) })}
              />
              <span className={`swatch dot severity-${severity}`} style={{ background: colors[severity] }} />
              <span>{t(`severity.${severity}`)}</span>
              {counts && filters.severities.includes(severity) && (
                <span className="share">{number(counts[severity])}</span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <label className="collision-min">
        <span>
          {filters.minCount <= 1
            ? t('crash.everySpot')
            : t('crash.minCount').replace('{count}', number(filters.minCount))}
        </span>
        {/* Dragged right, only the places where collisions keep happening stay on the map. */}
        <span className="collision-min-row">
          <SpotDot count={1} color={colors.minor} />
          <input
            className="collision-min-range"
            type="range"
            min={1}
            max={Math.max(2, busiestSpot)}
            step={1}
            value={Math.min(filters.minCount, Math.max(2, busiestSpot))}
            onChange={(e) => onChange({ ...filters, minCount: Number(e.target.value) })}
          />
          <SpotDot count={busiestSpot} color={colors.minor} />
        </span>
      </label>
      {shown !== null && spots && (
        <p className="collision-total">
          {t('crash.shown').replace('{count}', number(shown)).replace('{spots}', number(spots.length))}
        </p>
      )}
      <p className="footnote">
        {t('crash.source')
          .replace('{first}', String(COLLISION_YEARS.first))
          .replace('{last}', String(COLLISION_YEARS.last))}
      </p>
    </div>
  )
}
