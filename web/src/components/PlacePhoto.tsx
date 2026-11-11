import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAPILLARY_TOKEN } from '../config'
import { useI18n } from '../i18n'
import { fetchMapillaryPhoto, imageLink, mapillaryId, mapillaryViewerUrl, type Photo } from '../photos'

interface Props {
  /** The place's tags, which may name a Mapillary image or link to a photo. */
  props: Record<string, unknown>
}

/**
 * The photo a mapper linked to the place. With a Mapillary token the image is
 * shown in the card; it is only requested once the card is open. Without one,
 * or for other photos, a link opens it.
 */
export function PlacePhoto({ props }: Props) {
  const { t } = useI18n()
  const id = mapillaryId(props.mapillary)
  const link = imageLink(props.image)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [failed, setFailed] = useState(false)
  const [enlarged, setEnlarged] = useState(false)

  useEffect(() => {
    setPhoto(null)
    setFailed(false)
    setEnlarged(false)
    if (!id || !MAPILLARY_TOKEN) return
    const controller = new AbortController()
    fetchMapillaryPhoto(id, MAPILLARY_TOKEN, controller.signal)
      .then((found) => (found ? setPhoto(found) : setFailed(true)))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [id])

  // Esc closes the larger view.
  useEffect(() => {
    if (!enlarged) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlarged(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enlarged])

  if (id && MAPILLARY_TOKEN && !failed) {
    const credit = photo?.by ? `© ${photo.by} · Mapillary` : '© Mapillary'
    return (
      <figure className="place-photo">
        {photo ? (
          <button
            type="button"
            className="place-photo-open"
            title={t('photoEnlarge')}
            onClick={() => setEnlarged(true)}
          >
            <img src={photo.url} alt={t('photoAlt')} />
          </button>
        ) : (
          <span className="place-photo-loading" />
        )}
        <figcaption>{credit}</figcaption>
        {photo &&
          enlarged &&
          createPortal(
            // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes it, handled above
            <div className="photo-viewer" role="dialog" aria-label={t('photoAlt')} onClick={() => setEnlarged(false)}>
              <img src={photo.largeUrl} alt={t('photoAlt')} />
              <p>
                {credit} ·{' '}
                <a href={photo.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {t('photoOpen')}
                </a>
              </p>
              <button type="button" className="photo-viewer-close" aria-label={t('close')}>
                ×
              </button>
            </div>,
            document.body,
          )}
      </figure>
    )
  }
  if (id) {
    return (
      <p className="feature-links">
        <a href={mapillaryViewerUrl(id)} target="_blank" rel="noopener noreferrer">
          {t('photoOnMapillary')}
        </a>
      </p>
    )
  }
  if (link) {
    return (
      <p className="feature-links">
        <a href={link} target="_blank" rel="noopener noreferrer">
          {t('photo')}
        </a>
      </p>
    )
  }
  return null
}
