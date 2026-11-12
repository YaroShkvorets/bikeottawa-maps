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

/** Starts loading an image so it shows at once when its turn comes. */
function preload(photo: Photo | null) {
  if (photo) new Image().src = photo.largeUrl
}

/** Photos the larger view can step to after the card's own, and a line about each. */
interface More {
  items: readonly NearbyImage[]
  noteFor: (item: NearbyImage) => string
}

const NOTHING_MORE: More = { items: [], noteFor: () => '' }

/**
 * A photo in the card (a grey box while it loads), larger over the map on a
 * click. With more photos the larger view steps through them with ‹ › or the
 * arrow keys; the ones either side of the photo shown are loaded ahead.
 */
function PhotoFigure({
  photo,
  note,
  more = NOTHING_MORE,
  onBroken,
}: {
  photo: Photo | null
  note?: string
  more?: More
  onBroken: () => void
}) {
  const { t, lang } = useI18n()
  const count = 1 + more.items.length
  // Which photo the larger view shows (0 is the card's); null when it is closed.
  const [index, setIndex] = useState<number | null>(null)
  const [shown, setShown] = useState<Photo | null>(null)
  const loads = useRef(new Map<string, Promise<Photo | null>>())

  // A new card photo closes the larger view and forgets what was loaded for it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resets when the photo changes
  useEffect(() => {
    setIndex(null)
    loads.current = new Map()
  }, [photo])

  // The photo at a position, loaded once and kept.
  const load = (at: number): Promise<Photo | null> => {
    if (at === 0) return Promise.resolve(photo)
    const item = more.items[at - 1]
    if (!item || !MAPILLARY_TOKEN) return Promise.resolve(null)
    let pending = loads.current.get(item.id)
    if (!pending) {
      pending = fetchMapillaryPhoto(item.id, MAPILLARY_TOKEN).catch(() => null)
      loads.current.set(item.id, pending)
    }
    return pending
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load reads the current photos
  useEffect(() => {
    if (index === null) return
    let current = true
    setShown(index === 0 ? photo : null)
    load(index).then((found) => {
      if (current) setShown(found)
    })
    // Get the neighbours ready, so stepping either way is instant.
    if (count > 1) {
      for (const next of [(index + 1) % count, (index - 1 + count) % count]) load(next).then(preload)
    }
    return () => {
      current = false
    }
  }, [index, photo, more.items])

  const step = (by: number) => setIndex((i) => (i === null ? i : (i + by + count) % count))

  // Esc closes the larger view; the arrow keys step through the photos.
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

  // How far away, when it was taken, then the credit: short enough for one line in a card.
  const captionOf = (p: Photo | null, line?: string) =>
    [line, p && takenOn(p, lang), p?.credit].filter(Boolean).join(' · ')
  const viewerNote = index ? more.noteFor(more.items[index - 1]) : note

  return (
    <figure className="place-photo">
      {photo ? (
        <button type="button" className="place-photo-open" title={t('photoEnlarge')} onClick={() => setIndex(0)}>
          {/* A broken link hides the photo rather than showing a broken image. */}
          <img src={photo.url} alt={t('photoAlt')} onError={onBroken} />
          {count > 1 && (
            <span className="place-photo-more" title={t('photoMore').replace('{count}', String(count - 1))}>
              +{count - 1}
            </span>
          )}
        </button>
      ) : (
        <span className="place-photo-loading" />
      )}
      <figcaption>{captionOf(photo, note)}</figcaption>
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

interface Found {
  photo: Photo
  /** Set when the card's photo is not the place's own but one taken nearby. */
  distance?: number
  more: NearbyImage[]
}

/**
 * Photos for a card. A place's own photo (its mapillary or image tag) comes
 * first; then, or for a street or a place without one, the Mapillary photos
 * taken nearby: the closest of each capture run, leaving out near-copies of
 * the place's own. They are only looked up once the card is open, and nothing
 * shows when there are none.
 */
export function CardPhoto({ at, props }: { at: readonly [number, number]; props?: Record<string, unknown> }) {
  const { t } = useI18n()
  const [lon, lat] = at
  const tagged = props && MAPILLARY_TOKEN ? mapillaryId(props.mapillary) : null
  const direct = props ? directImage(props.image) : null
  const [found, setFound] = useState<Found | null>(null)
  const [state, setState] = useState<'loading' | 'shown' | 'none'>('loading')

  useEffect(() => {
    setFound(null)
    setState('loading')
    const token = MAPILLARY_TOKEN
    const controller = new AbortController()
    const { signal } = controller
    const own: Promise<Photo | null> =
      tagged && token ? fetchMapillaryPhoto(tagged, token, signal).catch(() => null) : Promise.resolve(null)
    const nearby: Promise<NearbyImage[]> = token
      ? findNearbyMapillary([lon, lat], token, signal).catch(() => [])
      : Promise.resolve([])
    Promise.all([own, nearby])
      .then(async ([ownPhoto, near]) => {
        const first = ownPhoto ?? (direct ? directPhoto(direct) : null)
        let result: Found | null = null
        if (first) {
          const others = near.filter((n) => n.id !== tagged && !(first.sequence && n.sequence === first.sequence))
          result = { photo: first, more: others }
        } else if (near[0] && token) {
          const closest = await fetchMapillaryPhoto(near[0].id, token, signal)
          if (closest) result = { photo: closest, distance: near[0].distance, more: near.slice(1) }
        }
        if (signal.aborted) return
        setFound(result)
        setState(result ? 'shown' : 'none')
      })
      .catch(() => {
        if (!signal.aborted) setState('none')
      })
    return () => controller.abort()
  }, [lon, lat, tagged, direct])

  if (state === 'none' || (!MAPILLARY_TOKEN && !direct)) return null
  const metres = (distance: number) => String(Math.max(1, Math.round(distance)))
  const note =
    found?.distance !== undefined ? t('photoDistance').replace('{distance}', metres(found.distance)) : undefined
  return (
    <PhotoFigure
      photo={found?.photo ?? null}
      note={note}
      more={{
        items: found?.more ?? NO_NEARBY,
        noteFor: (item) => t('photoDistance').replace('{distance}', metres(item.distance)),
      }}
      onBroken={() => setState('none')}
    />
  )
}

const NO_NEARBY: NearbyImage[] = []
