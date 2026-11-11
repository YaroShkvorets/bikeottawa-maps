import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAPILLARY_TOKEN } from '../config'
import { type Lang, useI18n } from '../i18n'
import {
  directImage,
  directPhoto,
  fetchMapillaryPhoto,
  findNearbyMapillary,
  mapillaryId,
  type NearbyImage,
  type Photo,
} from '../photos'

/** Whether the card shows a picture for these tags (otherwise it links to the photo, if any). */
export function hasPhoto(props: Record<string, unknown>): boolean {
  return Boolean((mapillaryId(props.mapillary) && MAPILLARY_TOKEN) || directImage(props.image))
}

/** "Jun 2019": when a photo was taken. */
function takenOn(photo: Photo, lang: Lang): string | null {
  return photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
        month: 'short',
        year: 'numeric',
      })
    : null
}

const NO_ITEMS: readonly NearbyImage[] = []

/** Mapillary photos the larger view can step through; the first is the one in the card. */
interface Gallery {
  items: readonly NearbyImage[]
  /** A line about each, e.g. how far away it was taken. */
  noteFor: (item: NearbyImage) => string
}

/**
 * A photo in the card (a grey box while it loads), larger over the map on a
 * click. With a gallery the larger view steps through it with ‹ › or the arrow
 * keys, loading each photo when it is reached.
 */
function PhotoFigure({
  photo,
  note,
  gallery,
  onBroken,
}: {
  photo: Photo | null
  note?: string
  gallery?: Gallery
  onBroken: () => void
}) {
  const { t, lang } = useI18n()
  const items = gallery?.items ?? NO_ITEMS
  const count = Math.max(1, items.length)
  // Which photo the larger view shows; null when it is closed.
  const [index, setIndex] = useState<number | null>(null)
  const [shown, setShown] = useState<Photo | null>(null)
  const loaded = useRef(new Map<string, Photo>())

  // A new card photo closes the larger view and forgets the old gallery.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resets when the photo changes
  useEffect(() => {
    setIndex(null)
    loaded.current = new Map()
  }, [photo])

  useEffect(() => {
    if (index === null) return
    const item = items[index]
    if (index === 0 || !item || !MAPILLARY_TOKEN) return setShown(photo)
    const cached = loaded.current.get(item.id)
    if (cached) return setShown(cached)
    setShown(null)
    const controller = new AbortController()
    fetchMapillaryPhoto(item.id, MAPILLARY_TOKEN, controller.signal)
      .then((found) => {
        if (!found) return
        loaded.current.set(item.id, found)
        setShown(found)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [index, items, photo])

  const step = (by: number) => setIndex((i) => (i === null ? i : (i + by + count) % count))

  // Esc closes the larger view; the arrow keys step through the gallery.
  // biome-ignore lint/correctness/useExhaustiveDependencies: step reads only the count
  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null)
      if (e.key === 'ArrowRight' && count > 1) step(1)
      if (e.key === 'ArrowLeft' && count > 1) step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index === null, count])

  const captionOf = (p: Photo | null, line?: string) =>
    [line, p?.credit, p && takenOn(p, lang)].filter(Boolean).join(' · ')
  const viewerNote = index !== null && gallery && items[index] ? gallery.noteFor(items[index]) : note

  return (
    <figure className="place-photo">
      {photo ? (
        <button type="button" className="place-photo-open" title={t('photoEnlarge')} onClick={() => setIndex(0)}>
          {/* A broken link hides the photo rather than showing a broken image. */}
          <img src={photo.url} alt={t('photoAlt')} onError={onBroken} />
        </button>
      ) : (
        <span className="place-photo-loading" />
      )}
      <figcaption>
        {captionOf(photo, note)}
        {count > 1 && ` · ${t('photoMore').replace('{count}', String(count - 1))}`}
      </figcaption>
      {photo &&
        index !== null &&
        createPortal(
          // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes it, handled above
          <div className="photo-viewer" role="dialog" aria-label={t('photoAlt')} onClick={() => setIndex(null)}>
            {shown ? <img src={shown.largeUrl} alt={t('photoAlt')} /> : <span className="photo-viewer-loading" />}
            <p>
              {count > 1 && `${index + 1} / ${count} · `}
              {captionOf(shown, viewerNote)}
              {shown && (
                <>
                  {' · '}
                  <a href={shown.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {t('photoSource')}
                  </a>
                </>
              )}
            </p>
            {count > 1 && (
              <>
                <button
                  type="button"
                  className="photo-viewer-step prev"
                  aria-label={t('photoPrev')}
                  onClick={(e) => {
                    e.stopPropagation()
                    step(-1)
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="photo-viewer-step next"
                  aria-label={t('photoNext')}
                  onClick={(e) => {
                    e.stopPropagation()
                    step(1)
                  }}
                >
                  ›
                </button>
              </>
            )}
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
 * clicked, and in the larger view the closest from other capture runs nearby.
 * Nothing shows if there is none nearby.
 */
export function NearbyPhoto({ at }: { at: readonly [number, number] }) {
  const { t } = useI18n()
  const [lon, lat] = at
  const [items, setItems] = useState<NearbyImage[]>([])
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [state, setState] = useState<'loading' | 'shown' | 'none'>('loading')

  useEffect(() => {
    setItems([])
    setPhoto(null)
    setState('loading')
    if (!MAPILLARY_TOKEN) return setState('none')
    const token = MAPILLARY_TOKEN
    const controller = new AbortController()
    findNearbyMapillary([lon, lat], token, controller.signal)
      .then(async (found) => {
        const first = found[0] ? await fetchMapillaryPhoto(found[0].id, token, controller.signal) : null
        setItems(found)
        setPhoto(first)
        setState(first ? 'shown' : 'none')
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('none')
      })
    return () => controller.abort()
  }, [lon, lat])

  if (state === 'none') return null
  const noteFor = (item: NearbyImage) =>
    t(item === items[0] ? 'photoNearby' : 'photoDistance').replace(
      '{distance}',
      String(Math.max(1, Math.round(item.distance))),
    )
  return (
    <PhotoFigure
      photo={photo}
      note={items[0] ? noteFor(items[0]) : undefined}
      gallery={{ items, noteFor }}
      onBroken={() => setState('none')}
    />
  )
}
