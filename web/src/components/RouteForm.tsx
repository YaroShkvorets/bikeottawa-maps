import { useI18n } from '../i18n'
import type { RoutePoint, RoutePoints } from '../route/state'
import { PARAM_KEYS, type ParamKey, type RouteParams, STYLE_IDS, type StyleId } from '../route/styles'
import { PlaceInput } from './PlaceInput'

interface Props {
  points: RoutePoints
  viaCount: number
  onClearVias: () => void
  style: StyleId
  params: RouteParams
  onPointChange: (index: 0 | 1, point: RoutePoint | null) => void
  onReverse: () => void
  onStyleChange: (style: StyleId) => void
  onParamChange: (key: ParamKey, value: number) => void
}

export function RouteForm({
  points,
  viaCount,
  style,
  params,
  onPointChange,
  onReverse,
  onClearVias,
  onStyleChange,
  onParamChange,
}: Props) {
  const { t } = useI18n()
  return (
    <div className="route-form">
      <div className="route-points">
        <div className="route-fields">
          <PlaceInput
            id="route-from"
            label={t('from')}
            marker="A"
            point={points[0]}
            onChange={(p) => onPointChange(0, p)}
          />
          <PlaceInput
            id="route-to"
            label={t('to')}
            marker="B"
            point={points[1]}
            onChange={(p) => onPointChange(1, p)}
          />
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t('reverse')}
          title={t('reverse')}
          onClick={onReverse}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 3v12M5 15l-3-3M5 15l3-3M13 15V3M13 3l-3 3M13 3l3 3" />
          </svg>
        </button>
      </div>
      {viaCount > 0 && (
        <p className="via-summary">
          <span className="route-marker via inline" aria-hidden="true" />
          {t('viaPoints')}: {viaCount}
          <button type="button" onClick={onClearVias}>
            {t('clearVias')}
          </button>
        </p>
      )}
      <fieldset className="style-picker">
        <legend className="eyebrow">{t('ridingStyle')}</legend>
        <div className="style-buttons">
          {STYLE_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={id === style} onClick={() => onStyleChange(id)}>
              {t(`style.${id}`)}
            </button>
          ))}
        </div>
        <p className="footnote style-desc">{t(`style.${style}.desc`)}</p>
      </fieldset>
      {style === 'custom' && (
        <fieldset className="param-sliders">
          <legend className="eyebrow">{t('avoid')}</legend>
          {PARAM_KEYS.map((key) => (
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
        </fieldset>
      )}
    </div>
  )
}
