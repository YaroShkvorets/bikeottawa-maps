import { useI18n } from '../i18n'
import type { RoutePoint, RoutePoints } from '../route/state'
import { PlaceInput } from './PlaceInput'
import { StylePicker, type StylePickerProps } from './StylePicker'

interface Props {
  points: RoutePoints
  /** Places the route passes through, in riding order, with their address once known. */
  vias: readonly RoutePoint[]
  onViaChange: (index: number, point: RoutePoint | null) => void
  /** Bike or on foot, and the style to go by. */
  picker: StylePickerProps
  onPointChange: (index: 0 | 1, point: RoutePoint | null) => void
  onReverse: () => void
}

export function RouteForm({ points, vias, picker, onPointChange, onReverse, onViaChange }: Props) {
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
          {vias.map((via, index) => (
            <PlaceInput
              // biome-ignore lint/suspicious/noArrayIndexKey: vias are identified by their place in the route
              key={index}
              id={`route-via-${index}`}
              label={t('via')}
              marker="via"
              point={via}
              onChange={(p) => onViaChange(index, p)}
            />
          ))}
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
      <StylePicker {...picker} />
    </div>
  )
}
