import { useI18n } from '../i18n'
import { LAYER_IDS, type LayerId } from '../layers'

interface Props {
  active: LayerId
  onChange: (layer: LayerId) => void
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
          <span className="layer-label">{t(`layer.${id}`)}</span>
          <span className="layer-desc">{t(`layer.${id}.desc`)}</span>
        </button>
      ))}
    </fieldset>
  )
}
