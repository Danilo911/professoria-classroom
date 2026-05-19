'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, MoreVertical, Users } from 'lucide-react'
import { getClasses, createClass } from '@/lib/db'
import { useToast } from '@/lib/toast'
import type { Class } from '@/types'

const gradeColors: Record<string, string> = {
  '1º Ano': '#6366F1',
  '2º Ano': '#8B5CF6',
  '3º Ano': '#06B6D4',
  '4º Ano': '#10B981',
  '5º Ano': '#F59E0B',
}

export default function TurmasPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewClass, setShowNewClass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', grade: '1º Ano', period: 'manha' })
  const { toast } = useToast()

  useEffect(() => {
    getClasses().then(data => { setClasses(data); setLoading(false) })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const newClass = await createClass(form)
      setClasses(prev => [...prev, newClass])
      setShowNewClass(false)
      setForm({ name: '', grade: '1º Ano', period: 'manha' })
      toast('Turma criada com sucesso!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao criar turma', 'error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Minhas Turmas</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{classes.length} turmas ativas em {new Date().getFullYear()}</p>
        </div>
        <button onClick={() => setShowNewClass(true)} className="btn btn-primary">
          <Plus size={18} /> Nova turma
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="input" placeholder="Buscar turma..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((turma) => {
            const color = gradeColors[turma.grade] || 'var(--primary)'
            return (
              <div key={turma.id} className="card card-interactive" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => router.push(`/dashboard/turmas/${turma.id}`)}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{turma.name}</h3>
                      <span className="badge" style={{ background: `${color}15`, color }}>{turma.period === 'manha' ? 'Manhã' : turma.period === 'tarde' ? 'Tarde' : 'Integral'}</span>
                    </div>
                    <button className="btn btn-icon btn-ghost" style={{ marginTop: -4 }}>
                      <MoreVertical size={18} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                    <Users size={16} />
                    <span>{turma.student_count} alunos</span>
                  </div>
                </div>
              </div>
            )
          })}

          <button onClick={() => setShowNewClass(true)} className="card" style={{
            padding: 40, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', border: '2px dashed var(--border)',
            color: 'var(--text-muted)', background: 'transparent', minHeight: 150,
          }}>
            <Plus size={28} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Adicionar turma</span>
          </button>
        </div>
      )}

      {showNewClass && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={() => setShowNewClass(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 32 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, marginBottom: 20 }}>Nova Turma</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Nome da turma</label>
                <input className="input" placeholder="Ex: 1º Ano C" value={form.name} required
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Série</label>
                  <select className="input" value={form.grade} onChange={e => setForm(prev => ({ ...prev, grade: e.target.value }))}>
                    {['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Período</label>
                  <select className="input" value={form.period} onChange={e => setForm(prev => ({ ...prev, period: e.target.value }))}>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="integral">Integral</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewClass(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Criar turma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
