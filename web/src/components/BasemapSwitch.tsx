import { useState } from 'react'
import dark from '../assets/basemaps/dark.webp'
import grey from '../assets/basemaps/grey.webp'
import light from '../assets/basemaps/light.webp'
import satellite from '../assets/basemaps/satellite.webp'
import { useI18n } from '../i18n'
import { BASEMAP_IDS, type BasemapId, BIKEWAY_IDS, bikewayColors } from '../layers'

/** A small picture of each map style, taken from the map itself. */
const PREVIEWS: Record<BasemapId, string> = { light, grey, dark, satellite }

interface Props {
  basemap: BasemapId
  onChange: (basemap: BasemapId) => void
  /** The bike lanes overlay, drawn over any map style. */
  bikeLanes: boolean
  onBikeLanesChange: (on: boolean) => void
}

/** Map control: a button that opens the list of map styles. */
export function BasemapSwitch({ basemap, onChange, bikeLanes, onBikeLanesChange }: Props) {
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
              <img src={PREVIEWS[id]} alt="" width="40" height="40" />
              {t(`basemap.${id}`)}
            </button>
          ))}
          <label className="check bike-lanes-toggle">
            <input type="checkbox" checked={bikeLanes} onChange={(e) => onBikeLanesChange(e.target.checked)} />
            {t('bikeLanes')}
          </label>
          {bikeLanes && (
            <ul className="bike-lanes-key">
              {BIKEWAY_IDS.map((id) => (
                <li key={id}>
                  <span
                    className={`swatch line ${id === 'shared' ? 'dotted' : id === 'lane' ? 'dashed' : ''}`}
                    style={{ color: bikewayColors('light')[id] }}
                  />
                  {t(`bikeway.${id}`)}
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}
    </>
  )
}
