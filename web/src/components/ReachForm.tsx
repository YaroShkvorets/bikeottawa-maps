import { useI18n } from '../i18n'
import { REACH_MINUTES, type ReachMinutes } from '../route/reach'
import type { RoutePoint } from '../route/state'
import { PlaceInput } from './PlaceInput'
import { StylePicker, type StylePickerProps } from './StylePicker'

interface Props {
  start: RoutePoint | null
  minutes: ReachMinutes
  /** Bike or on foot, and the style to go by. */
  picker: StylePickerProps
  onStartChange: (point: RoutePoint | null) => void
  onMinutesChange: (minutes: ReachMinutes) => void
}

export function ReachForm({ start, minutes, picker, onStartChange, onMinutesChange }: Props) {
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
      <StylePicker {...picker} />
    </div>
  )
}
