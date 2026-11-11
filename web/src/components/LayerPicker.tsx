import { useI18n } from '../i18n'
import { LAYER_IDS, type LayerId, LTS_COLORS, WINTER_COLORS } from '../layers'
import { GROUP_COLORS } from '../places'

interface Props {
  active: LayerId
  onChange: (layer: LayerId) => void
}

/** A small picture of what each layer shows, in the colours it uses on the map. */
function LayerIcon({ layer }: { layer: LayerId }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none' } as const
  if (layer === 'comfort') {
    // Streets in the four stress colours.
    return (
      <svg aria-hidden="true" {...common} strokeWidth="3.2" strokeLinecap="round">
        <path d="M3 5h18" stroke={LTS_COLORS[0]} />
        <path d="M3 10h14" stroke={LTS_COLORS[1]} />
        <path d="M3 15h18" stroke={LTS_COLORS[2]} />
        <path d="M3 20h10" stroke={LTS_COLORS[3]} />
      </svg>
    )
  }
  if (layer === 'winter') {
    return (
      <svg
        aria-hidden="true"
        {...common}
        stroke={WINTER_COLORS.yes}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
        <path d="m9 4 3 3 3-3M9 20l3-3 3 3M3.5 11l3.5-1-1-3.5M20.5 13 17 14l1 3.5M3.5 13l3.5 1-1 3.5M20.5 11 17 10l1-3.5" />
      </svg>
    )
  }
  if (layer === 'collisions') {
    // A warning sign in the colours of the injuries.
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M12 3 2.5 20h19Z" fill="#E2603A" stroke="#BC2F1F" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 9.5v5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="17.3" r="1.2" fill="#fff" />
      </svg>
    )
  }
  if (layer === 'night') {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="#E3A72F" />
        <path d="m17 3 .7 1.8 1.8.7-1.8.7L17 8l-.7-1.8-1.8-.7 1.8-.7Z" fill="#E3A72F" />
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      {...common}
      stroke={GROUP_COLORS.food}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21.5s7-6.4 7-11.5a7 7 0 1 0-14 0c0 5.1 7 11.5 7 11.5Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}

export function LayerPicker({ active, onChange }: Props) {
  const { t } = useI18n()
  return (
    <fieldset className="layer-picker">
      <legend className="eyebrow">{t('layers')}</legend>
      {LAYER_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className="layer-button"
          aria-pressed={id === active}
          onClick={() => onChange(id)}
        >
          <span className="layer-icon">
            <LayerIcon layer={id} />
          </span>
          <span className="layer-text">
            <span className="layer-label">{t(`layer.${id}`)}</span>
            <span className="layer-desc">{t(`layer.${id}.desc`)}</span>
          </span>
        </button>
      ))}
    </fieldset>
  )
}
