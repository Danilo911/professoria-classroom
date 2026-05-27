'use client'

import { useState, useEffect } from 'react'
import { Copy, Calendar, FileText, Check } from 'lucide-react'
import { getClasses, getDiaryEntries, createDiaryEntry } from '@/lib/db'
import { formatDateBR, getTodayISO } from '@/lib/dates'
import { useToast } from '@/lib/toast'
import type { Class, DiaryEntry } from '@/types'

const DIARY_TYPES = [
  { key: 'general', label: 'Geral', color: '#6366F1' },
  { key: 'activity', label: 'Atividade', color: '#10B981' },
  { key: 'incident', label: 'Incidente', color: '#EF4444' },
  { key: 'achievement', label: 'Conquista', color: '#F59E0B' },
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  general: <FileText size={16} />,
  activity: <FileText size={16} />,
  incident: <FileText size={16} />,
  achievement: <Check size={16} />,
}

export default function DuplicarAtividadePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    getClasses().then(data => {
      setClasses(data)
      if (data.length > 0) setSelectedClass(data[0].id)
      else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (selectedClass) loadEntries(selectedClass)
    else setEntries([])
  }, [selectedClass])

  async function loadEntries(classId: string) {
    setLoading(true)
    try {
      const data = await getDiaryEntries(classId)
      setEntries(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao carregar registros', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDuplicate(entry: DiaryEntry) {
    setDuplicatingId(entry.id)
    try {
      const today = getTodayISO()
      const created = await createDiaryEntry({
        class_id: entry.class_id,
        type: entry.type,
        title: entry.title ? `${entry.title} (cópia)` : undefined,
        content: entry.content,
        tags: entry.tags || [],
        date: today,
      })
      setEntries(prev => [created, ...prev])
      toast('Atividade duplicada com sucesso!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao duplicar atividade', 'error')
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Duplicar Atividade</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Selecione uma turma e duplique registros do diário</p>
        </div>
      </div>

      <div style={{ marginBottom: 20, maxWidth: 320 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Turma</label>
        {classes.length === 0 && !loading ? (
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Nenhuma turma encontrada.</span>
        ) : (
          <select
            className="input"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{ width: '100%' }}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : !selectedClass ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          Selecione uma turma para ver os registros do diário.
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          Nenhum registro encontrado para esta turma.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {entries.length} registro(s) encontrado(s) em {classes.find(c => c.id === selectedClass)?.name}
          </p>
          {entries.map((entry) => {
            const cat = DIARY_TYPES.find(t => t.key === entry.type) || DIARY_TYPES[0]
            const isDuplicating = duplicatingId === entry.id

            return (
              <div key={entry.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 'var(--radius-md)',
                      background: `${cat.color}15`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0,
                    }}>
                      <div style={{ color: cat.color }}>{TYPE_ICONS[entry.type] || <FileText size={16} />}</div>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span className="badge" style={{ background: `${cat.color}15`, color: cat.color, fontSize: 11 }}>
                          {cat.label}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} />
                          {formatDateBR(entry.date)}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, wordBreak: 'break-word' }}>
                        {entry.title || '(sem título)'}
                      </h3>
                      <p style={{
                        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {entry.content}
                      </p>
                    </div>
                  </div>
                  <button
                    className={`btn btn-sm ${isDuplicating ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => handleDuplicate(entry)}
                    disabled={isDuplicating}
                    style={{ flexShrink: 0 }}
                    title="Duplicar esta atividade"
                  >
                    <Copy size={14} />
                    {isDuplicating ? 'Duplicando...' : 'Duplicar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
