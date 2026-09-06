import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  variant?: 'solid' | 'ghost'
}

const styles = {
  solid:
    'bg-text text-surface hover:bg-white disabled:bg-line disabled:text-muted',
  ghost: 'text-muted hover:bg-elevated hover:text-text disabled:text-line',
} as const

/** Circular icon control matching the reference header treatment. */
export function IconButton({
  label,
  children,
  variant = 'ghost',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
