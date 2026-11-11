import { ICON_SIZE, type PlaceKind, placeColor, placeIconPaths } from '../places'

/** The marker shown on the map for a kind of place, for legends and headings. */
export function PlaceIcon({ kind, large = false }: { kind: PlaceKind; large?: boolean }) {
  return (
    <span
      className={large ? 'place-icon large' : 'place-icon'}
      style={{ background: placeColor(kind) }}
      aria-hidden="true"
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
        width={large ? 17 : 14}
        height={large ? 17 : 14}
        fill="currentColor"
      >
        {placeIconPaths(kind).map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  )
}
