'use client'

import { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', style, ...props }: ButtonProps) {
  const cls = `btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''} ${className}`.trim()
  return (
    <button className={cls} disabled={loading || props.disabled} style={style} {...props}>
      {loading ? <><span className="spinner" /> {children}</> : children}
    </button>
  )
}
