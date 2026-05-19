export function PageHeader({ title, description, action }: {
  title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 24, marginBottom: description ? 4 : 0 }}>{title}</h1>
        {description && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{description}</p>}
      </div>
      {action}
    </div>
  )
}
