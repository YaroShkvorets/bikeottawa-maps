import { useMemo } from 'react'
import {
  COLLISION_PARTIES,
  COLLISION_YEARS,
  type Collision,
  type CollisionFilters,
  countBySeverity,
  SEVERITIES,
  type Severity,
} from '../collisions'
import { useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'

interface Props {
  /** All collisions, for the counts; null while they load. */
  data: readonly Collision[] | null
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  basemap: BasemapId
}

/** Circles for 1, 5 and 15 collisions, about as big as on the map in the middle of its zoom range. */
const SIZE_SAMPLES = [
  { count: 1, r: 5, x: 8 },
  { count: 5, r: 9, x: 32 },
  { count: 15, r: 13.5, x: 70 },
]

const YEARS = Array.from(
  { length: COLLISION_YEARS.last - COLLISION_YEARS.first + 1 },
  (_, i) => COLLISION_YEARS.first + i,
).filter((y) => !(COLLISION_YEARS.missing as readonly number[]).includes(y))

/** Who, which years and which injuries the collisions layer shows, with how many of each. */
export function CollisionLegend({ data, filters, onChange, basemap }: Props) {
  const { t, lang } = useI18n()
  const counts = useMemo(
    () =>
      data
        ? countBySeverity(
            data.map((c) => c.props),
            filters,
          )
        : null,
    [data, filters],
  )
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
              {counts && <span className="share">{number(counts[severity])}</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="collision-sizes">
        <svg aria-hidden="true" width="96" height="30" viewBox="0 0 96 30">
          {SIZE_SAMPLES.map(({ count, r, x }) => (
            <g key={count}>
              <circle cx={x} cy={15} r={r} fill="none" stroke="currentColor" strokeWidth="1.4" />
              <text x={x} y={15} dy="0.35em" textAnchor="middle" fontSize="9" fill="currentColor">
                {count}
              </text>
            </g>
          ))}
        </svg>
        <span>{t('crash.sizes')}</span>
      </div>
      {shown !== null && <p className="collision-total">{t('crash.shown').replace('{count}', number(shown))}</p>}
      <p className="footnote">
        {t('crash.source')
          .replace('{first}', String(COLLISION_YEARS.first))
          .replace('{last}', String(COLLISION_YEARS.last))}
      </p>
    </div>
  )
}
