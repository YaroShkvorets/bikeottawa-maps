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
      {/* A slider over the times on offer, which are not evenly spaced: it moves stop by stop. */}
      <label className="reach-minutes">
        <span className="visually-hidden">{t('reachTime')}</span>
        <input
          className="reach-minutes-input"
          type="range"
          min={0}
          max={REACH_MINUTES.length - 1}
          step={1}
          value={REACH_MINUTES.indexOf(minutes)}
          aria-valuetext={`${minutes} min`}
          onChange={(e) => onMinutesChange(REACH_MINUTES[Number(e.target.value)])}
        />
        <b className="reach-minutes-value" aria-hidden="true">
          {minutes} min
        </b>
        <span className="reach-minutes-ticks" aria-hidden="true">
          {REACH_MINUTES.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </span>
      </label>
      <StylePicker {...picker} />
    </div>
  )
}
