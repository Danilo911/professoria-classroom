export function Skeleton({ width, height = 20, style }: { width?: string | number; height?: string | number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: width || '100%',
        height,
        borderRadius: 6,
        background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.2s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width="40%" height={16} />
      <Skeleton width="100%" height={14} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="60%" height={14} />
    </div>
  )
}
