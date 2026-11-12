import type { ReactNode } from 'react'

/** A small line icon in the text colour, drawn on a 24-unit grid. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export const ExploreIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Icon>
)

export const RouteIcon = () => (
  <Icon>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16" />
  </Icon>
)

export const ReachIcon = () => (
  <Icon>
    <circle cx="12" cy="14" r="7.5" />
    <path d="M12 14v-3.5M10 2.5h4M12 2.5v4M18 7l1.5-1.5" />
  </Icon>
)

export const BikeIcon = () => (
  <Icon>
    <circle cx="5.5" cy="16" r="4" />
    <circle cx="18.5" cy="16" r="4" />
    <path d="M5.5 16 9 8h6l3.5 8M9 8l3.5 8h-7M8 5h3" />
  </Icon>
)

export const WalkIcon = () => (
  <Icon>
    <circle cx="13.5" cy="4" r="2" />
    <path d="m12 8-1.5 6.5M10.5 14.5l3 2.5v4.5M10.5 14.5 8.5 21.5M12 8 9 10.5V13M12 8l2 3.5 3 1" />
  </Icon>
)
