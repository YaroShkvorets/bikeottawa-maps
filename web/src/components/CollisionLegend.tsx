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

/**
 * Years as one slider with two handles: two range inputs on one track, only
 * their handles taking the pointer, the span between them highlighted.
 */
function YearRange({ from, to, onChange }: { from: number; to: number; onChange: (from: number, to: number) => void }) {
  const { t } = useI18n()
  const { first, last } = COLLISION_YEARS
  const at = (year: number) => `${((year - first) / (last - first)) * 100}%`
  return (
    <div className="year-range">
      <span>
        {t('crash.years')}: {from === to ? from : `${from} – ${to}`}
      </span>
      <div className="year-range-track">
        <span className="year-range-span" style={{ left: at(from), right: `calc(100% - ${at(to)})` }} />
        <input
          className="year-range-input"
          type="range"
          min={first}
          max={last}
          step={1}
          value={from}
          aria-label={t('crash.yearFrom')}
          // Both handles at the far right: the left one must stay reachable.
          style={{ zIndex: from === last ? 2 : 1 }}
          onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
        />
        <input
          className="year-range-input"
          type="range"
          min={first}
          max={last}
          step={1}
          value={to}
          aria-label={t('crash.yearUntil')}
          onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
        />
      </div>
    </div>
  )
}

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
      <YearRange from={filters.from} to={filters.to} onChange={(from, to) => onChange({ ...filters, from, to })} />
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
