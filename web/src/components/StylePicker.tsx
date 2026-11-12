import { useI18n } from '../i18n'
import {
  type ParamKey,
  type RouteParams,
  SPEED_RANGE,
  STYLE_IDS,
  type StyleId,
  TRAVEL_MODES,
  type Travel,
  WALK_STYLE_IDS,
  type WalkStyleId,
  WEIGHT_KEYS,
} from '../route/styles'
import { BikeIcon, WalkIcon } from './icons'

export interface StylePickerProps {
  travel: Travel
  style: StyleId
  walkStyle: WalkStyleId
  params: RouteParams
  onTravelChange: (travel: Travel) => void
  onStyleChange: (style: StyleId) => void
  onWalkStyleChange: (style: WalkStyleId) => void
  onParamChange: (key: ParamKey, value: number) => void
}

/** Bike or on foot, that mode's styles, and the sliders of the Custom riding style. */
export function StylePicker({
  travel,
  style,
  walkStyle,
  params,
  onTravelChange,
  onStyleChange,
  onWalkStyleChange,
  onParamChange,
}: StylePickerProps) {
  const { t } = useI18n()
  const bike = travel === 'bike'
  return (
    <>
      <fieldset className="style-picker">
        <legend className="visually-hidden">{t('travelBy')}</legend>
        <div className="mode-switch travel-switch">
          {TRAVEL_MODES.map((id) => (
            <button key={id} type="button" aria-pressed={id === travel} onClick={() => onTravelChange(id)}>
              {id === 'bike' ? <BikeIcon /> : <WalkIcon />}
              {t(`travel.${id}`)}
            </button>
          ))}
        </div>
        <div className="style-buttons">
          {bike
            ? STYLE_IDS.map((id) => (
                <button key={id} type="button" aria-pressed={id === style} onClick={() => onStyleChange(id)}>
                  {t(`style.${id}`)}
                </button>
              ))
            : WALK_STYLE_IDS.map((id) => (
                <button key={id} type="button" aria-pressed={id === walkStyle} onClick={() => onWalkStyleChange(id)}>
                  {t(`walk.${id}`)}
                </button>
              ))}
        </div>
        <p className="footnote style-desc">
          {bike
            ? `${t(`style.${style}.desc`)} ${t('speedNote').replace('{speed}', String(params.cruiseSpeed))}`
            : t(`walk.${walkStyle}.desc`)}
        </p>
      </fieldset>
      {bike && style === 'custom' && (
        <fieldset className="param-sliders">
          <legend className="eyebrow">{t('param.cruiseSpeed')}</legend>
          <label>
            <span>{t('speedOnFlat').replace('{speed}', String(params.cruiseSpeed))}</span>
            <input
              type="range"
              min={SPEED_RANGE.min}
              max={SPEED_RANGE.max}
              step={1}
              value={params.cruiseSpeed}
              onChange={(e) => onParamChange('cruiseSpeed', Number(e.target.value))}
            />
          </label>
        </fieldset>
      )}
      {bike && style === 'custom' && (
        <fieldset className="param-sliders">
          <legend className="eyebrow">{t('avoid')}</legend>
          {WEIGHT_KEYS.map((key) => (
            <label key={key}>
              <span>{t(`param.${key}`)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={params[key]}
                onChange={(e) => onParamChange(key, Number(e.target.value))}
              />
            </label>
          ))}
          <label className="check">
            <input
              type="checkbox"
              checked={params.noWalk === 1}
              onChange={(e) => onParamChange('noWalk', e.target.checked ? 1 : 0)}
            />
            {t('param.noWalk')}
          </label>
        </fieldset>
      )}
    </>
  )
}
