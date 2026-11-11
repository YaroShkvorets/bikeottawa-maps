import type { CollisionFilters } from '../collisions'
import { useI18n } from '../i18n'
import { type BasemapId, type LayerId, LTS_COLORS, lampColor, WINTER_COLORS } from '../layers'
import { kindsInGroup, PLACE_GROUP_IDS, type PlaceKind } from '../places'
import { CollisionLegend } from './CollisionLegend'
import { PlaceIcon } from './PlaceIcon'

interface Props {
  layer: LayerId
  collisionFilters: CollisionFilters
  onCollisionFiltersChange: (filters: CollisionFilters) => void
  /** The night layer's colours depend on the ground they are drawn on. */
  basemap: BasemapId
  placeKinds: readonly PlaceKind[]
  onTogglePlaceKind: (kind: PlaceKind) => void
}

export function Legend({
  layer,
  basemap,
  placeKinds,
  onTogglePlaceKind,
  collisionFilters,
  onCollisionFiltersChange,
}: Props) {
  const { t } = useI18n()
  const lamp = lampColor(basemap)
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
      {layer === 'night' && (
        <ul>
          <li>
            <span className="swatch line glow" style={{ background: lamp, color: lamp }} />
            {t('night.street')}
          </li>
          <li>
            <span className="swatch lamp" style={{ background: lamp, color: lamp }} />
            {t('night.lamp')}
          </li>
        </ul>
      )}
      {layer === 'collisions' && (
        <CollisionLegend filters={collisionFilters} onChange={onCollisionFiltersChange} basemap={basemap} />
      )}
      {layer === 'places' &&
        PLACE_GROUP_IDS.map((group) => (
          <fieldset key={group} className="place-group">
            <legend>{t(`group.${group}`)}</legend>
            {kindsInGroup(group).map((kind) => (
              <label key={kind} className="check">
                <input type="checkbox" checked={placeKinds.includes(kind)} onChange={() => onTogglePlaceKind(kind)} />
                <PlaceIcon kind={kind} />
                {t(`place.${kind}`)}
              </label>
            ))}
          </fieldset>
        ))}
    </section>
  )
}
