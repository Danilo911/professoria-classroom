'use client'

import { useState, useEffect } from 'react'
import { Users, ClipboardCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { getDashboardStats } from '@/lib/db'

export default function DashboardPage() {
  const [stats, setStats] = useState({ activeClasses: 0, totalStudents: 0, aiReports: 0 })
  const [loading, setLoading] = useState(true)
  const [greeting] = useState(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  })

  useEffect(() => {
    getDashboardStats().then(data => {
      if (data) setStats(data)
      setLoading(false)
    })
  }, [])

  const statCards = [
    { label: 'Turmas ativas', value: String(stats.activeClasses), icon: Users, color: 'var(--primary)' },
    { label: 'Alunos', value: String(stats.totalStudents), icon: Users, color: 'var(--secondary)' },
    { label: 'Frequência hoje', value: '—', icon: ClipboardCheck, color: 'var(--success)' },
    { label: 'Relatórios IA', value: String(stats.aiReports), icon: Sparkles, color: 'var(--accent)' },
  ]

  const quickActions = [
    { label: 'Fazer chamada', href: '/dashboard/chamada', icon: ClipboardCheck, color: '#10B981' },
    { label: 'Novo registro', href: '/dashboard/diario', icon: Sparkles, color: '#8B5CF6' },
    { label: 'Gerar parecer', href: '/dashboard/ia', icon: Sparkles, color: '#6366F1' },
    { label: 'Upload GIER', href: '/dashboard/gier', icon: Sparkles, color: '#06B6D4' },
    { label: 'Planejamento', href: '/dashboard/planejamento', icon: Sparkles, color: '#F59E0B' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>{greeting}, Professor! 👋</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            {statCards.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={i} className="stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} color={s.color} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                </div>
              )
            })}
          </div>

          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Ações rápidas</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
            {quickActions.map((a, i) => {
              const Icon = a.icon
              return (
                <Link key={i} href={a.href} className="card card-interactive" style={{ padding: 20, textDecoration: 'none', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: `${a.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Icon size={24} color={a.color} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</span>
                </Link>
              )
            })}
          </div>

          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Atividade recente</h2>
          <div className="card" style={{ padding: 24 }}>
            {stats.activeClasses === 0 ? (
              <div className="empty-state" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Nenhuma atividade ainda</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Comece criando sua primeira turma!</p>
                <Link href="/dashboard/turmas" className="btn btn-primary" style={{ marginTop: 16 }}>Criar turma</Link>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Registros serão exibidos aqui em breve.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
