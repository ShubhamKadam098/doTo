interface IconProps {
  className?: string
}

const base = 'h-4 w-4'

export function SearchIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.2 13.2 3.3 3.3" />
    </svg>
  )
}

export function ChevronLeftIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 4.5 6.5 10l5.5 5.5" />
    </svg>
  )
}

export function ChevronRightIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m8 4.5 5.5 5.5L8 15.5" />
    </svg>
  )
}

export function CheckCircleIcon({
  className = base,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="8"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m6.4 10.2 2.4 2.4 4.8-4.8"
        fill="none"
        stroke={filled ? 'var(--color-surface)' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrashIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 5.5h13M8 5.5V4h4v1.5M5.5 5.5 6 16h8l.5-10.5" />
    </svg>
  )
}

export function CloseIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  )
}
