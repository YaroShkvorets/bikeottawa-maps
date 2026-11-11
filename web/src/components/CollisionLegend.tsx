import { useEffect, useMemo, useState } from 'react'
import {
  COLLISION_PARTIES,
  COLLISION_YEARS,
  type CollisionFilters,
  type CollisionProps,
  countBySeverity,
  SEVERITIES,
  type Severity,
} from '../collisions'
import { DATA_BASE } from '../config'
import { useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'

interface Props {
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  basemap: BasemapId
}

/** The collisions, for counting what the filters show; the map loads the same file. */
function useCollisionData(): readonly CollisionProps[] | null {
  const [data, setData] = useState<readonly CollisionProps[] | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${DATA_BASE}/data/collisions.geojson`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { features: { properties: CollisionProps }[] }) => setData(json.features.map((f) => f.properties)))
      .catch(() => {})
    return () => controller.abort()
  }, [])
  return data
}

const YEARS = Array.from(
  { length: COLLISION_YEARS.last - COLLISION_YEARS.first + 1 },
  (_, i) => COLLISION_YEARS.first + i,
).filter((y) => !(COLLISION_YEARS.missing as readonly number[]).includes(y))

/** Who, which years and which injuries the collisions layer shows, with how many of each. */
export function CollisionLegend({ filters, onChange, basemap }: Props) {
  const { t, lang } = useI18n()
  const data = useCollisionData()
  const counts = useMemo(() => (data ? countBySeverity(data, filters) : null), [data, filters])
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
      {shown !== null && <p className="collision-total">{t('crash.shown').replace('{count}', number(shown))}</p>}
      <p className="footnote">
        {t('crash.source')
          .replace('{first}', String(COLLISION_YEARS.first))
          .replace('{last}', String(COLLISION_YEARS.last))}
      </p>
    </div>
  )
}
