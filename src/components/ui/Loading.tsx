import { CardSkeleton } from './Skeleton'

export function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
      Carregando...
    </div>
  )
}
