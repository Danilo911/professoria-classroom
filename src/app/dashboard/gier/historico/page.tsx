'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { FileText, ArrowLeft, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { getGierSubmissions, deleteGierSubmission } from '@/lib/db'
import { formatDateBR } from '@/lib/dates'

interface HistoryItem {
  id: string
  class_id?: string
  class?: { name: string }
  gier_description?: string
  activity_date?: string
  created_at: string
  status: string
  ai_interpretation?: {
    component: string
    skill_code: string
    skill_description: string
    activity_type?: string
  }
}

export default function GierHistoricoPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  useEffect(() => {
    getGierSubmissions()
      .then(data => setItems(data as HistoryItem[]))
      .catch(() => toast('Erro ao carregar histórico', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryItem[]>()
    for (const item of items) {
      const key = item.activity_date || 'sem-data'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    const sorted = Array.from(map.entries())
    sorted.sort((a, b) => {
      if (a[0] === 'sem-data') return 1
      if (b[0] === 'sem-data') return -1
      return b[0].localeCompare(a[0])
    })
    return sorted
  }, [items])

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return
    try {
      await deleteGierSubmission(id)
      setItems(prev => prev.filter(i => i.id !== id))
      toast('Registro excluído', 'success')
    } catch {
      toast('Erro ao excluir', 'error')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/dashboard/gier" style={{ display: 'flex' }}>
          <button className="btn btn-ghost btn-sm"><ArrowLeft size={18} /></button>
        </Link>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Histórico GIER</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {items.length} registro{items.length !== 1 ? 's' : ''} salvo{items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <span className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>Nenhum GIER salvo ainda.</p>
          <Link href="/dashboard/gier">
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Criar um GIER</button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map(([date, dayItems]) => {
            const isOpen = expandedDates.has(date)
            return (
              <div key={date} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  onClick={() => toggleDate(date)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
                    color: 'var(--text-primary)', fontSize: 15, fontWeight: 600,
                    fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span style={{ flex: 1 }}>
                    {date === 'sem-data' ? 'Sem data definida' : formatDateBR(date)}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 500, color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)', padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    {dayItems.length} {dayItems.length === 1 ? 'item' : 'itens'}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {dayItems.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '14px 20px 14px 52px',
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            {item.class?.name && (
                              <span style={{
                                fontSize: 12, fontWeight: 600, color: 'var(--primary)',
                                background: 'var(--primary-50)', padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                              }}>{item.class.name}</span>
                            )}
                            {item.ai_interpretation?.component && (
                              <span style={{
                                fontSize: 12, fontWeight: 600, color: 'var(--secondary)',
                                background: 'var(--bg-secondary)', padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                              }}>{item.ai_interpretation.component}</span>
                            )}
                          </div>
                          <p style={{
                            fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)',
                            display: '-webkit-box', WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                            {item.gier_description || 'Sem descrição'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
