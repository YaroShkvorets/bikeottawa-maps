import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { type Place, searchPlaces } from '../route/geocode'
import { locate } from '../route/locate'
import type { RoutePoint } from '../route/state'

interface Props {
  id: string
  label: string
  /** A and B are the ends; via is a point in between. */
  marker: 'A' | 'B' | 'via'
  point: RoutePoint | null
  onChange: (point: RoutePoint | null) => void
}

const SEARCH_DELAY_MS = 300
const MIN_QUERY_LENGTH = 3

/** A start or destination field: type to search, or it shows the point picked on the map. */
export function PlaceInput({ id, label, marker, point, onChange }: Props) {
  const { t, lang } = useI18n()
  // Text being typed; null while the field just mirrors the chosen point.
  const [query, setQuery] = useState<string | null>(null)
  const [results, setResults] = useState<Place[]>([])
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Finding where the device is, and whether that last failed.
  const [locating, setLocating] = useState(false)
  const [noLocation, setNoLocation] = useState(false)

  useEffect(() => {
    if (query === null || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(query.trim(), lang, controller.signal)
        .then(setResults)
        .catch(() => setResults([]))
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, lang])

  const locateHere = () => {
    setLocating(true)
    setNoLocation(false)
    locate()
      .then((lngLat) => onChange({ lngLat, label: t('myLocation') }))
      .catch(() => setNoLocation(true))
      .finally(() => setLocating(false))
  }

  const pick = (place: Place) => {
    onChange({ lngLat: place.lngLat, label: place.label })
    setQuery(null)
  }
  const shown =
    query ??
    (point ? (point.label ?? `${t('pin')} (${point.lngLat[1].toFixed(4)}, ${point.lngLat[0].toFixed(4)})`) : '')

  return (
    <div className="place-input">
      <label htmlFor={id}>
        <span
          className={`route-marker inline ${marker === 'A' ? 'start' : marker === 'B' ? 'end' : 'via'}`}
          aria-hidden="true"
        >
          {marker === 'via' ? '' : marker}
        </span>
        <span className="visually-hidden">{label}</span>
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={noLocation ? t('noLocation') : `${label}${t('colon')}${t('searchPlaceholder')}`}
        value={shown}
        onChange={(e) => {
          setQuery(e.target.value)
          setNoLocation(false)
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          // Leave time for a click on a result before closing the list.
          blurTimer.current = setTimeout(() => setQuery(null), 200)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) pick(results[0])
          if (e.key === 'Escape') setQuery(null)
        }}
      />
      {point && query === null && (
        <button
          type="button"
          className="icon-button small"
          aria-label={`${t('clear')}${t('colon')}${label}`}
          onClick={() => onChange(null)}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
      )}
      {/* An empty field offers where the device is, in the place of the clear button. */}
      {!point && !query && marker !== 'via' && (
        <button
          type="button"
          className={`icon-button small ${locating ? 'locating' : ''}`}
          aria-label={`${t('myLocation')}${t('colon')}${label}`}
          title={t('myLocation')}
          disabled={locating}
          onClick={locateHere}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
      {results.length > 0 && (
        <ul className="place-results">
          {results.map((place) => (
            <li key={`${place.label}${place.lngLat.join()}`}>
              <button
                type="button"
                onClick={() => {
                  clearTimeout(blurTimer.current)
                  pick(place)
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
