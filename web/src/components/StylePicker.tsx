import { useI18n } from '../i18n'
import { type ParamKey, type RouteParams, SPEED_RANGE, STYLE_IDS, type StyleId, WEIGHT_KEYS } from '../route/styles'

interface Props {
  style: StyleId
  params: RouteParams
  onStyleChange: (style: StyleId) => void
  onParamChange: (key: ParamKey, value: number) => void
}

/** Riding style buttons, and the weight sliders of the Custom style. */
export function StylePicker({ style, params, onStyleChange, onParamChange }: Props) {
  const { t } = useI18n()
  return (
    <>
      <fieldset className="style-picker">
        <legend className="eyebrow">{t('ridingStyle')}</legend>
        <div className="style-buttons">
          {STYLE_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={id === style} onClick={() => onStyleChange(id)}>
              {t(`style.${id}`)}
            </button>
          ))}
        </div>
        <p className="footnote style-desc">
          {t(`style.${style}.desc`)} {t('speedNote').replace('{speed}', String(params.cruiseSpeed))}
        </p>
      </fieldset>
      {style === 'custom' && (
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
      {style === 'custom' && (
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
