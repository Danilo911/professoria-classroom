'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Check, Calendar } from 'lucide-react'
import { getClasses, getClassStudents, getDiaryEntries, createDiaryEntry, updateDiaryEntry, getDiaryEntryByDate, getStudentObservations, createStudentObservation, getGrades, upsertGrade, getClassSummary } from '@/lib/db'
import { useToast } from '@/lib/toast'
import type { Class, Student, DiaryEntry, StudentObservation, Grade } from '@/types'

type Tab = 'grades' | 'observations' | 'records'

const BIMESTRES = [1, 2, 3, 4]
const SUBJECTS = ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Arte', 'Ed. Física']

const OBSERVATION_CATEGORIES = [
  { key: 'behavior', label: 'Comportamento', color: '#EF4444' },
  { key: 'difficulty', label: 'Dificuldade', color: '#F59E0B' },
  { key: 'evolution', label: 'Evolução', color: '#10B981' },
  { key: 'intervention', label: 'Intervenção', color: '#3B82F6' },
  { key: 'general', label: 'Geral', color: '#6366F1' },
]

const DIARY_TYPES = [
  { key: 'general', label: 'Geral', color: '#6366F1' },
  { key: 'activity', label: 'Atividade', color: '#10B981' },
  { key: 'incident', label: 'Incidente', color: '#EF4444' },
  { key: 'achievement', label: 'Conquista', color: '#F59E0B' },
]

function getTodayBR(): string {
  const now = new Date()
  const brasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  return brasilia.toISOString().split('T')[0]
}

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

export default function DiarioPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('grades')
  const [summary, setSummary] = useState<{ totalStudents: number; averageGrade: number | null; criticalObservations: number } | null>(null)
  const [gradesMap, setGradesMap] = useState<Record<string, Grade[]>>({})
  const [obsMap, setObsMap] = useState<Record<string, StudentObservation[]>>({})
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingObs, setSavingObs] = useState(false)
  const [editingCell, setEditingCell] = useState<{ studentId: string; subject: string; bimestre: number } | null>(null)
  const [obsMenu, setObsMenu] = useState<{ studentId: string; x: number; y: number } | null>(null)
  const [obsForm, setObsForm] = useState({ category: 'general', severity: 'info', content: '' })
  const [entryForm, setEntryForm] = useState({ type: 'general', title: '', content: '' })
  const [showNewEntry, setShowNewEntry] = useState(false)
  const { toast } = useToast()
  const today = getTodayBR()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getClasses().then(data => {
      setClasses(data)
      if (data.length > 0) setSelectedClass(data[0].id)
      else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (selectedClass) loadData(selectedClass)
  }, [selectedClass])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setObsMenu(null)
    }
    if (obsMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [obsMenu])

  async function loadData(classId: string) {
    setLoading(true)
    const [studentsData, summaryData, entriesData, todayEntryData] = await Promise.all([
      getClassStudents(classId),
      getClassSummary(classId),
      getDiaryEntries(classId),
      getDiaryEntryByDate(classId, today),
    ])
    setStudents(studentsData)
    setSummary(summaryData)
    setEntries(entriesData)
    setTodayEntry(todayEntryData)
    if (todayEntryData) {
      setEntryForm({ type: todayEntryData.type, title: todayEntryData.title || '', content: todayEntryData.content })
    }

    const gradesData = await getGrades({ class_id: classId })
    const map: Record<string, Grade[]> = {}
    for (const st of studentsData) {
      map[st.id] = gradesData.filter(g => g.student_id === st.id)
    }
    setGradesMap(map)

    const obsDataMap: Record<string, StudentObservation[]> = {}
    for (const st of studentsData) {
      const obs = await getStudentObservations(st.id, classId)
      obsDataMap[st.id] = obs
    }
    setObsMap(obsDataMap)

    setLoading(false)
  }

  function getStudentGrade(studentId: string, subject: string, bimestre: number): number | null {
    const grades = gradesMap[studentId] || []
    const g = grades.find(g => g.subject === subject && g.bimestre === bimestre)
    return g ? g.nota : null
  }

  function getStudentAverage(studentId: string): number | null {
    const grades = gradesMap[studentId] || []
    const notas = grades.map(g => g.nota).filter((n): n is number => n !== null)
    if (notas.length === 0) return null
    return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10
  }

  async function handleSaveGrade(studentId: string, subject: string, bimestre: number, nota: number | null) {
    setSaving(true)
    try {
      const grade = await upsertGrade({ student_id: studentId, class_id: selectedClass, subject, bimestre, nota })
      setGradesMap(prev => {
        const existing = prev[studentId] || []
        const idx = existing.findIndex(g => g.subject === subject && g.bimestre === bimestre)
        const updated = [...existing]
        if (idx >= 0) updated[idx] = grade
        else updated.push(grade)
        return { ...prev, [studentId]: updated }
      })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar nota', 'error')
    } finally {
      setSaving(false)
    }
  }

  function openObsMenu(studentId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setObsMenu({ studentId, x: rect.left, y: rect.bottom + 4 })
    setObsForm({ category: 'general', severity: 'info', content: '' })
  }

  async function handleCreateObservation(e: React.FormEvent) {
    e.preventDefault()
    if (!obsMenu) return
    setSavingObs(true)
    try {
      const obs = await createStudentObservation({
        student_id: obsMenu.studentId, class_id: selectedClass,
        category: obsForm.category, content: obsForm.content,
        severity: obsForm.severity,
      })
      setObsMap(prev => ({
        ...prev,
        [obsMenu.studentId]: [obs, ...(prev[obsMenu.studentId] || [])],
      }))
      setObsMenu(null)
      toast('Observação adicionada!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao adicionar observação', 'error')
    } finally {
      setSavingObs(false)
    }
  }

  async function handleSaveTodayEntry(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (todayEntry) {
        const updated = await updateDiaryEntry(todayEntry.id, entryForm)
        setTodayEntry(updated)
        setEntries(prev => prev.map(en => en.id === updated.id ? updated : en))
        toast('Registro atualizado!', 'success')
      } else {
        const created = await createDiaryEntry({
          class_id: selectedClass, type: entryForm.type, title: entryForm.title || undefined, content: entryForm.content,
        })
        setTodayEntry(created)
        setEntries(prev => [created, ...prev])
        toast('Registro criado!', 'success')
      }
      setShowNewEntry(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  function getObsCount(studentId: string, category: string): number {
    const obs = obsMap[studentId] || []
    return obs.filter(o => o.category === category).length
  }

  function getLastObsDate(studentId: string): string | null {
    const obs = obsMap[studentId] || []
    return obs.length > 0 ? obs[0].date : null
  }

  function hasCriticalObs(studentId: string): boolean {
    const obs = obsMap[studentId] || []
    return obs.some(o => o.severity === 'critical')
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>

  const lowAvgStudents = students
    .map(st => ({ student: st, avg: getStudentAverage(st.id) }))
    .filter(s => s.avg !== null && s.avg < 5)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Diário</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{selectedClass ? classes.find(c => c.id === selectedClass)?.name : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Salvando...</span>}
          {!saving && <span style={{ fontSize: 13, color: 'var(--success)' }}>✓ Salvo</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" style={{ maxWidth: 250 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['grades', 'observations', 'records'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}>
              {tab === 'grades' ? 'Notas' : tab === 'observations' ? 'Observações' : 'Registros'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {activeTab === 'grades' && (
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} /> ≥ 7</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} /> 5-6.9</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> &lt; 5</span>
          </div>
        )}
        {activeTab === 'observations' && (
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            {OBSERVATION_CATEGORIES.map(c => (
              <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} /> {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {students.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum aluno matriculado nesta turma.</div>
      ) : activeTab === 'records' ? (
        <RecordsTab
          entries={entries}
          today={today}
          todayEntry={todayEntry}
          entryForm={entryForm}
          saving={saving}
          showNewEntry={showNewEntry}
          onFormChange={setEntryForm}
          onSave={handleSaveTodayEntry}
          onToggleNew={() => setShowNewEntry(!showNewEntry)}
        />
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 2, borderBottom: '2px solid var(--border)', minWidth: 180 }}>Aluno</th>
                  {activeTab === 'grades' ? (
                    <>
                      {BIMESTRES.map(b => (
                        <th key={b} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 80 }}>{b}º Bim.</th>
                      ))}
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 70 }}>Média</th>
                    </>
                  ) : (
                    <>
                      {OBSERVATION_CATEGORIES.map(c => (
                        <th key={c.key} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 70, color: c.color }}>{c.label}</th>
                      ))}
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 100 }}>Última obs.</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((st, idx) => {
                  const avg = getStudentAverage(st.id)
                  const lastObs = getLastObsDate(st.id)
                  const isCritical = hasCriticalObs(st.id)
                  return (
                    <tr key={st.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500, position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span
                            onClick={(e) => activeTab === 'observations' && openObsMenu(st.id, e)}
                            style={{ cursor: activeTab === 'observations' ? 'pointer' : 'default', color: isCritical ? 'var(--danger)' : undefined }}
                            title={activeTab === 'observations' ? 'Clique para adicionar observação' : ''}
                          >
                            {st.full_name}
                          </span>
                          {isCritical && (
                            <span style={{
                              fontSize: 9, padding: '1px 6px', borderRadius: 8,
                              background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 700,
                            }} title="Observação crítica">
                              ⚠
                            </span>
                          )}
                        </div>
                      </td>

                      {activeTab === 'grades' ? (
                        <>
                          {BIMESTRES.map(bimestre => {
                            const nota = getStudentGrade(st.id, 'Geral', bimestre)
                            const isEditing = editingCell?.studentId === st.id && editingCell?.bimestre === bimestre
                            return (
                              <td key={bimestre} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    defaultValue={nota !== null ? nota : ''}
                                    style={{
                                      width: 56, height: 28, padding: '2px 4px', textAlign: 'center',
                                      fontSize: 13, borderRadius: 6, border: '1px solid var(--border)',
                                      background: 'var(--bg-surface)', color: 'var(--text-primary)',
                                    }}
                                    onBlur={async (e) => {
                                      const val = e.target.value.trim()
                                      const n = val === '' ? null : parseFloat(val)
                                      if (n !== null && (isNaN(n) || n < 0 || n > 10)) return
                                      setEditingCell(null)
                                      await handleSaveGrade(st.id, 'Geral', bimestre, n)
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') e.currentTarget.blur()
                                      if (e.key === 'Escape') { setEditingCell(null); e.currentTarget.blur() }
                                    }}
                                  />
                                ) : (
                                  <button
                                    onClick={() => setEditingCell({ studentId: st.id, subject: 'Geral', bimestre })}
                                    style={{
                                      width: 36, height: 28, borderRadius: 6, border: 'none',
                                      background: nota !== null ? (nota >= 7 ? '#22c55e15' : nota >= 5 ? '#f59e0b15' : '#ef444415') : 'transparent',
                                      color: nota !== null ? (nota >= 7 ? '#22c55e' : nota >= 5 ? '#f59e0b' : '#ef4444') : 'var(--text-muted)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                    }}
                                  >
                                    {nota !== null ? nota : '-'}
                                  </button>
                                )}
                              </td>
                            )
                          })}
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', color: avg !== null ? (avg >= 7 ? 'var(--success)' : avg >= 5 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-muted)' }}>
                            {avg !== null ? avg : '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          {OBSERVATION_CATEGORIES.map(cat => {
                            const count = getObsCount(st.id, cat.key)
                            return (
                              <td key={cat.key} style={{ padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)', color: count > 0 ? cat.color : 'var(--text-muted)' }}>
                                {count > 0 ? count : '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: 12, borderBottom: '1px solid var(--border)', color: lastObs ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {lastObs ? formatDateBR(lastObs) : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {lowAvgStudents.length > 0 && activeTab === 'grades' && (
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>Atenção — {lowAvgStudents.length} aluno(s) com média abaixo de 5</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {lowAvgStudents.map(s => (
                  <span key={s.student.id} style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', fontWeight: 500,
                  }}>
                    {s.student.full_name.split(' ')[0]} — {s.avg}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {obsMenu && (
        <div ref={menuRef} style={{
          position: 'fixed', left: obsMenu.x, top: obsMenu.y,
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 12, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: 280,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
            {students.find(s => s.id === obsMenu.studentId)?.full_name}
          </p>
          <form onSubmit={handleCreateObservation} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Categoria</label>
                <select className="input" value={obsForm.category}
                  onChange={e => setObsForm(prev => ({ ...prev, category: e.target.value }))}
                  style={{ fontSize: 12, padding: '4px 8px' }}>
                  {OBSERVATION_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Severidade</label>
                <select className="input" value={obsForm.severity}
                  onChange={e => setObsForm(prev => ({ ...prev, severity: e.target.value }))}
                  style={{ fontSize: 12, padding: '4px 8px' }}>
                  <option value="info">Info</option>
                  <option value="attention">Atenção</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>
            </div>
            <textarea className="input" rows={2} placeholder="Descreva a observação..." value={obsForm.content} required
              onChange={e => setObsForm(prev => ({ ...prev, content: e.target.value }))}
              style={{ fontSize: 12, padding: '4px 8px' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setObsMenu(null)} style={{ flex: 1 }}>Cancelar</button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={savingObs || !obsForm.content.trim()} style={{ flex: 1 }}>
                {savingObs ? '...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function RecordsTab({
  entries, today, todayEntry, entryForm, saving, showNewEntry,
  onFormChange, onSave, onToggleNew,
}: {
  entries: DiaryEntry[]; today: string; todayEntry: DiaryEntry | null
  entryForm: { type: string; title: string; content: string }; saving: boolean; showNewEntry: boolean
  onFormChange: (f: { type: string; title: string; content: string }) => void
  onSave: (e: React.FormEvent) => Promise<void>; onToggleNew: () => void
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-sm btn-primary" onClick={onToggleNew}>
          {showNewEntry ? <X size={16} /> : <Plus size={16} />}
          {showNewEntry ? 'Cancelar' : 'Novo registro'}
        </button>
      </div>

      {showNewEntry && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            {todayEntry ? 'Editando registro de hoje' : 'Registro de hoje'}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>{formatDateBR(today)}</span>
          </h3>
          <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>Tipo</label>
                <select className="input" value={entryForm.type}
                  onChange={e => onFormChange({ ...entryForm, type: e.target.value })}>
                  {DIARY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>Título (opcional)</label>
                <input className="input" placeholder="Ex: Aula de Matemática" value={entryForm.title}
                  onChange={e => onFormChange({ ...entryForm, title: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>O que trabalhamos hoje?</label>
              <textarea className="input" rows={3} placeholder="Descreva as atividades, conteúdo e observações da aula..." value={entryForm.content} required
                onChange={e => onFormChange({ ...entryForm, content: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving || !entryForm.content.trim()}>
                {saving ? 'Salvando...' : (todayEntry ? 'Atualizar' : 'Salvar')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border)', minWidth: 100 }}>Data</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border)', minWidth: 100 }}>Tipo</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border)', minWidth: 140 }}>Título</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border)' }}>Conteúdo</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro encontrado.</td></tr>
            ) : entries.map((entry, idx) => {
              const cat = DIARY_TYPES.find(t => t.key === entry.type) || DIARY_TYPES[0]
              return (
                <tr key={entry.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDateBR(entry.date)}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="badge" style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                    {entry.title || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.content}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
