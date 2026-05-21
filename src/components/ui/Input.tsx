import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = '', style, ...props }, ref) => {
    if (label) {
      return (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
            {label}
          </label>
          <input ref={ref} className={`input ${className}`.trim()} style={{ fontSize: 14, padding: 12, fontFamily: 'inherit', ...style }} {...props} />
        </div>
      )
    }
    return <input ref={ref} className={`input ${className}`.trim()} style={{ fontSize: 14, padding: 12, fontFamily: 'inherit', ...style }} {...props} />
  }
)
Input.displayName = 'Input'
