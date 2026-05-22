'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, BookOpen } from 'lucide-react'
import { getLessonPlans, getClasses } from '@/lib/db'
import { formatDateBR } from '@/lib/dates'
import type { LessonPlan, Class } from '@/types'

const typeLabels: Record<string, { label: string; color: string }> = {
  weekly: { label: 'Semanal', color: '#6366F1' },
  sequence: { label: 'Sequência', color: '#8B5CF6' },
  assessment: { label: 'Avaliação', color: '#F59E0B' },
  daily: { label: 'Diário', color: '#10B981' },
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'var(--text-muted)' },
  active: { label: 'Em uso', color: 'var(--success)' },
  completed: { label: 'Concluído', color: 'var(--primary)' },
}

export default function PlanejamentoPage() {
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLessonPlans().then(data => {
      setPlans(data)
      setLoading(false)
    })
  }, [])

  function formatDateRange(start: string, end?: string) {
    const s = formatDateBR(start)
    if (!end || start === end) return s
    const e = formatDateBR(end)
    return `${s} a ${e}`
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Planejamento</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Planos semanais, sequências didáticas e avaliações</p>
        </div>
        <button className="btn btn-primary"><Plus size={18} /> Novo plano</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Nenhum plano de aula criado ainda.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }}><Plus size={18} /> Criar primeiro plano</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plans.map(plan => {
            const t = typeLabels[plan.type] || { label: plan.type, color: 'var(--primary)' }
            const s = statusLabels[plan.status] || { label: plan.status, color: 'var(--text-muted)' }
            return (
              <div key={plan.id} className="card card-interactive" style={{ padding: 20, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `${t.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {plan.type === 'weekly' ? <Calendar size={20} color={t.color} /> : <BookOpen size={20} color={t.color} />}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{plan.title}</h3>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDateRange(plan.date_start, plan.date_end)}</span>
                        <span className="badge" style={{ background: `${t.color}15`, color: t.color }}>{t.label}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: 13, color: s.color, fontWeight: 500 }}>{s.label}</span>
                  </div>
                </div>
                {plan.skills.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {plan.skills.map(sk => (
                      <span key={sk} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{sk}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
