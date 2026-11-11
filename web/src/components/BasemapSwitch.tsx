import { useState } from 'react'
import { useI18n } from '../i18n'
import { BASEMAP_IDS, type BasemapId } from '../layers'

interface Props {
  basemap: BasemapId
  onChange: (basemap: BasemapId) => void
}

/** Map control: a button that opens the list of map styles. */
export function BasemapSwitch({ basemap, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={t('basemap')}
        title={t('basemap')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg
          aria-hidden="true"
          width="19"
          height="19"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        >
          <path d="M10 2.5 2.5 6.5 10 10.5l7.5-4L10 2.5ZM2.5 10 10 14l7.5-4M2.5 13.5 10 17.5l7.5-4" />
        </svg>
      </button>
      {open && (
        <fieldset className="basemap-menu">
          <legend className="visually-hidden">{t('basemap')}</legend>
          {BASEMAP_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === basemap}
              onClick={() => {
                onChange(id)
                setOpen(false)
              }}
            >
              {t(`basemap.${id}`)}
            </button>
          ))}
        </fieldset>
      )}
    </>
  )
}
