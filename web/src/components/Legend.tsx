import { useI18n } from '../i18n'
import { type LayerId, LTS_COLORS, PLACE_COLORS, PLACE_KINDS, type PlaceKind, WINTER_COLORS } from '../layers'

interface Props {
  layer: LayerId
  placeKinds: readonly PlaceKind[]
  onTogglePlaceKind: (kind: PlaceKind) => void
}

export function Legend({ layer, placeKinds, onTogglePlaceKind }: Props) {
  const { t } = useI18n()
  return (
    <section className="legend" aria-label={t('legend')}>
      <h2 className="eyebrow">{t('legend')}</h2>
      {layer === 'comfort' && (
        <ul>
          {LTS_COLORS.map((color, i) => (
            <li key={color}>
              <span className="swatch line" style={{ background: color }} />
              {t(`lts.${(i + 1) as 1 | 2 | 3 | 4}`)}
            </li>
          ))}
        </ul>
      )}
      {layer === 'winter' && (
        <ul>
          {(['yes', 'no', 'unknown'] as const).map((value) => (
            <li key={value}>
              <span
                className={`swatch line ${value === 'unknown' ? 'dashed' : ''}`}
                style={{
                  color: WINTER_COLORS[value],
                  background: value === 'unknown' ? undefined : WINTER_COLORS[value],
                }}
              />
              {t(`winter.${value}`)}
            </li>
          ))}
        </ul>
      )}
      {layer === 'places' && (
        <ul>
          {PLACE_KINDS.map((kind) => (
            <li key={kind}>
              <label className="check">
                <input type="checkbox" checked={placeKinds.includes(kind)} onChange={() => onTogglePlaceKind(kind)} />
                <span className="swatch dot" style={{ background: PLACE_COLORS[kind] }} />
                {t(`place.${kind}`)}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
