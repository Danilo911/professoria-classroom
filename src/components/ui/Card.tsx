import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  padding?: number | string
  style?: React.CSSProperties
  className?: string
}

export function Card({ children, padding = 24, style, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`.trim()} style={{ padding, ...style }}>
      {children}
    </div>
  )
}
