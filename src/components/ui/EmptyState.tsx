export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>}
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: description ? 4 : 0 }}>{title}</p>
      {description && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
