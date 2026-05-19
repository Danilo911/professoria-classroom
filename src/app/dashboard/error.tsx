'use client'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Algo deu errado</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>{error.message}</p>
      <button onClick={reset} className="btn btn-primary">Tentar novamente</button>
    </div>
  )
}
