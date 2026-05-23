'use client'

import { Mic, Loader2, Upload } from 'lucide-react'
import type { CSSProperties } from 'react'

type Status = 'idle' | 'loading' | 'listening' | 'uploading' | 'error'

interface MicButtonProps {
  status: Status
  onToggle: () => void
  disabled?: boolean
  size?: number
  titles?: {
    loading: string
    listening: string
    idle: string
    uploading?: string
  }
  style?: CSSProperties
}

export function MicButton({
  status,
  onToggle,
  disabled = false,
  size = 28,
  titles,
  style,
}: MicButtonProps) {
  const isDisabled = disabled || status === 'loading' || status === 'uploading'
  const t = titles ?? {
    loading: 'Carregando modelo...',
    listening: 'Parar gravação',
    idle: 'Gravar por voz',
    uploading: 'Enviando para transcrição...',
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        border: 'none',
        cursor: isDisabled ? 'wait' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: status === 'listening'
          ? 'var(--danger)'
          : status === 'loading'
            ? 'var(--warning)'
            : 'transparent',
        color: status === 'listening' || status === 'loading' ? 'white' : 'var(--text-muted)',
        transition: 'all 0.15s',
        ...style,
      }}
      title={
        status === 'loading'
          ? t.loading
          : status === 'listening'
            ? t.listening
            : status === 'uploading'
              ? (t.uploading || 'Enviando...')
              : t.idle
      }
    >
      {status === 'loading' ? (
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
      ) : status === 'uploading' ? (
        <Upload size={14} />
      ) : (
        <Mic size={14} />
      )}
    </button>
  )
}
