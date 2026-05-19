'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { getDiaryEntries, createDiaryEntry, getClasses } from '@/lib/db'
import { useToast } from '@/lib/toast'
import type { DiaryEntry, Class } from '@/types'

const categories = [
  { key: 'general', label: 'Geral', color: '#6366F1' },
  { key: 'activity', label: 'Atividade', color: '#10B981' },
  { key: 'incident', label: 'Incidente', color: '#EF4444' },
  { key: 'achievement', label: 'Conquista', color: '#F59E0B' },
]

export default function DiarioPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ class_id: '', type: 'general', title: '', content: '' })
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [entriesData, classesData] = await Promise.all([
      getDiaryEntries(),
      getClasses(),
    ])
    setEntries(entriesData)
    setClasses(classesData)
    if (classesData.length > 0 && !form.class_id) {
      setForm(prev => ({ ...prev, class_id: classesData[0].id }))
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const entry = await createDiaryEntry({
        class_id: form.class_id,
        type: form.type,
        title: form.title || undefined,
        content: form.content,
      })
      setEntries(prev => [entry, ...prev])
      setShowNew(false)
      setForm(prev => ({ ...prev, title: '', content: '' }))
      toast('Registro criado!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao criar registro', 'error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Diário Pedagógico</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Registros da turma e individuais</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-primary"><Plus size={18} /> Novo registro</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}>Todos</button>
        {categories.map(c => (
          <button key={c.key} onClick={() => setFilter(c.key)}
            className={`btn btn-sm ${filter === c.key ? 'btn-primary' : 'btn-secondary'}`}
            style={filter === c.key ? { background: c.color } : {}}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(entry => {
            const cat = categories.find(c => c.key === entry.type) || categories[0]
            return (
              <div key={entry.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 4, height: 32, borderRadius: 4, background: cat.color }} />
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>{entry.title || cat.label}</h3>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <span className="badge" style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginLeft: 12 }}>{entry.content}</p>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              Nenhum registro encontrado.
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={() => setShowNew(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: 32 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, marginBottom: 20 }}>Novo Registro</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Turma</label>
                <select className="input" value={form.class_id} onChange={e => setForm(prev => ({ ...prev, class_id: e.target.value }))} required>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Tipo</label>
                <select className="input" value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}>
                  {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Título (opcional)</label>
                <input className="input" placeholder="Ex: Aula de Português" value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Conteúdo</label>
                <textarea className="input" rows={4} placeholder="Descreva o registro..." value={form.content} required
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
