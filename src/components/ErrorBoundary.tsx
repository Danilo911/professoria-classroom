'use client'

import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Algo deu errado</p>
          <p style={{ fontSize: 13, color: 'var(--danger)' }}>{this.state.error?.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            className="btn btn-sm btn-primary"
            style={{ marginTop: 16 }}
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
