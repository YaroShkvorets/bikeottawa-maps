import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAPILLARY_TOKEN } from '../config'
import { useI18n } from '../i18n'
import {
  directImage,
  directPhoto,
  fetchMapillaryPhoto,
  mapillaryId,
  nearestMapillaryPhoto,
  type Photo,
} from '../photos'

/** Whether the card shows a picture for these tags (otherwise it links to the photo, if any). */
export function hasPhoto(props: Record<string, unknown>): boolean {
  return Boolean((mapillaryId(props.mapillary) && MAPILLARY_TOKEN) || directImage(props.image))
}

/** A photo in the card, larger over the map on a click; a grey box while it loads. */
function PhotoFigure({ photo, note, onBroken }: { photo: Photo | null; note?: string; onBroken: () => void }) {
  const { t } = useI18n()
  const [enlarged, setEnlarged] = useState(false)

  // A new photo starts small; Esc closes the larger view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resets when the photo changes
  useEffect(() => setEnlarged(false), [photo])
  useEffect(() => {
    if (!enlarged) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlarged(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enlarged])

  const caption = [note, photo?.credit].filter(Boolean).join(' · ')
  return (
    <figure className="place-photo">
      {photo ? (
        <button type="button" className="place-photo-open" title={t('photoEnlarge')} onClick={() => setEnlarged(true)}>
          {/* A broken link hides the photo rather than showing a broken image. */}
          <img src={photo.url} alt={t('photoAlt')} onError={onBroken} />
        </button>
      ) : (
        <span className="place-photo-loading" />
      )}
      <figcaption>{caption}</figcaption>
      {photo &&
        enlarged &&
        createPortal(
          // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes it, handled above
          <div className="photo-viewer" role="dialog" aria-label={t('photoAlt')} onClick={() => setEnlarged(false)}>
            <img src={photo.largeUrl} alt={t('photoAlt')} />
            <p>
              {caption} ·{' '}
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

/**
 * The photo a mapper linked to the place. A Mapillary photo needs a token and
 * is only requested once the card is open; a picture linked directly is shown
 * as it is.
 */
export function PlacePhoto({ props }: { props: Record<string, unknown> }) {
  const id = MAPILLARY_TOKEN ? mapillaryId(props.mapillary) : null
  const direct = directImage(props.image)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPhoto(null)
    setFailed(false)
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

  if (failed || (!id && !direct)) return null
  return <PhotoFigure photo={photo} onBroken={() => setFailed(true)} />
}

/**
 * For a street or path: the Mapillary photo taken closest to where it was
 * clicked, with how far away it was taken. Nothing shows if there is none nearby.
 */
export function NearbyPhoto({ at }: { at: readonly [number, number] }) {
  const { t } = useI18n()
  const [lon, lat] = at
  const [photo, setPhoto] = useState<(Photo & { distance: number }) | null>(null)
  const [state, setState] = useState<'loading' | 'shown' | 'none'>('loading')

  useEffect(() => {
    setPhoto(null)
    setState('loading')
    if (!MAPILLARY_TOKEN) return setState('none')
    const controller = new AbortController()
    nearestMapillaryPhoto([lon, lat], MAPILLARY_TOKEN, controller.signal)
      .then((found) => {
        setPhoto(found)
        setState(found ? 'shown' : 'none')
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('none')
      })
    return () => controller.abort()
  }, [lon, lat])

  if (state === 'none') return null
  const note = photo ? t('photoNearby').replace('{distance}', String(Math.max(1, Math.round(photo.distance)))) : ''
  return <PhotoFigure photo={photo} note={note} onBroken={() => setState('none')} />
}
