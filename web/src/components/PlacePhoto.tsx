import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAPILLARY_TOKEN } from '../config'
import { useI18n } from '../i18n'
import { directImage, directPhoto, fetchMapillaryPhoto, mapillaryId, type Photo } from '../photos'

interface Props {
  /** The place's tags, which may name a Mapillary image or link to a picture. */
  props: Record<string, unknown>
}

/** Whether the card shows a picture for these tags (otherwise it links to the photo, if any). */
export function hasPhoto(props: Record<string, unknown>): boolean {
  return Boolean((mapillaryId(props.mapillary) && MAPILLARY_TOKEN) || directImage(props.image))
}

/**
 * The photo a mapper linked to the place, shown in the card and larger on a
 * click. A Mapillary photo needs a token and is only requested once the card
 * is open; a picture linked directly is shown as it is.
 */
export function PlacePhoto({ props }: Props) {
  const { t } = useI18n()
  const id = MAPILLARY_TOKEN ? mapillaryId(props.mapillary) : null
  const direct = directImage(props.image)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [failed, setFailed] = useState(false)
  const [enlarged, setEnlarged] = useState(false)

  useEffect(() => {
    setPhoto(null)
    setFailed(false)
    setEnlarged(false)
    if (!id || !MAPILLARY_TOKEN) {
      if (direct) setPhoto(directPhoto(direct))
      return
    }
    const controller = new AbortController()
    fetchMapillaryPhoto(id, MAPILLARY_TOKEN, controller.signal)
      .then((found) => {
        if (found) setPhoto(found)
        else if (direct) setPhoto(directPhoto(direct))
        else setFailed(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [id, direct])

  // Esc closes the larger view.
  useEffect(() => {
    if (!enlarged) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlarged(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enlarged])

  if (failed || (!id && !direct)) return null
  return (
    <figure className="place-photo">
      {photo ? (
        <button type="button" className="place-photo-open" title={t('photoEnlarge')} onClick={() => setEnlarged(true)}>
          {/* A broken link hides the photo rather than showing a broken image. */}
          <img src={photo.url} alt={t('photoAlt')} onError={() => setFailed(true)} />
        </button>
      ) : (
        <span className="place-photo-loading" />
      )}
      <figcaption>{photo?.credit ?? ''}</figcaption>
      {photo &&
        enlarged &&
        createPortal(
          // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes it, handled above
          <div className="photo-viewer" role="dialog" aria-label={t('photoAlt')} onClick={() => setEnlarged(false)}>
            <img src={photo.largeUrl} alt={t('photoAlt')} />
            <p>
              {photo.credit} ·{' '}
              <a href={photo.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                {t('photoSource')}
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
