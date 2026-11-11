import { useI18n } from '../i18n'
import { REACH_MINUTES, type ReachMinutes } from '../route/reach'
import type { RoutePoint } from '../route/state'
import type { ParamKey, RouteParams, StyleId } from '../route/styles'
import { PlaceInput } from './PlaceInput'
import { StylePicker } from './StylePicker'

interface Props {
  start: RoutePoint | null
  minutes: ReachMinutes
  style: StyleId
  params: RouteParams
  onStartChange: (point: RoutePoint | null) => void
  onMinutesChange: (minutes: ReachMinutes) => void
  onStyleChange: (style: StyleId) => void
  onParamChange: (key: ParamKey, value: number) => void
}

export function ReachForm({
  start,
  minutes,
  style,
  params,
  onStartChange,
  onMinutesChange,
  onStyleChange,
  onParamChange,
}: Props) {
  const { t } = useI18n()
  return (
    <div className="route-form">
      <PlaceInput id="reach-from" label={t('from')} marker="A" point={start} onChange={onStartChange} />
      <fieldset className="style-picker">
        <legend className="eyebrow">{t('reachTime')}</legend>
        <div className="style-buttons">
          {REACH_MINUTES.map((m) => (
            <button key={m} type="button" aria-pressed={m === minutes} onClick={() => onMinutesChange(m)}>
              {m} min
            </button>
          ))}
        </div>
      </fieldset>
      <StylePicker style={style} params={params} onStyleChange={onStyleChange} onParamChange={onParamChange} />
    </div>
  )
}
