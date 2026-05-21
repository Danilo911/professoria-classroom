'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Check, Calendar, FileText, Download, Edit2 } from 'lucide-react'
import { getClasses, getClassStudents, getDiaryEntries, createDiaryEntry, updateDiaryEntry, getDiaryEntryByDate, getStudentObservations, createStudentObservation, getGrades, upsertGrade, getClassSummary } from '@/lib/db'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'
import { useToast } from '@/lib/toast'
import { MicButton } from '@/components/ui/MicButton'
import { getTodayISO, formatDateBR } from '@/lib/dates'
import { scheduleCorrection } from '@/lib/correctText'
import type { Class, Student, DiaryEntry, StudentObservation, Grade } from '@/types'

type Tab = 'grades' | 'observations' | 'records'

const BIMESTRES = [1, 2, 3, 4]
const SUBJECTS = ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Arte', 'Ed. Física']

function cleanSpeech(raw: string): string {
  let text = raw.trim()
  if (!text) return text
  text = text.charAt(0).toUpperCase() + text.slice(1)
  if (!/[.!?]$/.test(text)) text += '.'
  return text
}

const OBSERVATION_CATEGORIES = [
  { key: 'behavior', label: 'Comportamento', color: '#EF4444' },
  { key: 'difficulty', label: 'Dificuldade', color: '#F59E0B' },
  { key: 'evolution', label: 'Evolução', color: '#10B981' },
  { key: 'intervention', label: 'Intervenção', color: '#3B82F6' },
  { key: 'general', label: 'Geral', color: '#6366F1' },
]

const SEVERITY_OPTIONS = [
  { key: 'info', label: 'Info', color: '#3B82F6' },
  { key: 'attention', label: 'Atenção', color: '#F59E0B' },
  { key: 'critical', label: 'Crítico', color: '#EF4444' },
]

const DIARY_TYPES = [
  { key: 'general', label: 'Geral', color: '#6366F1' },
  { key: 'activity', label: 'Atividade', color: '#10B981' },
  { key: 'incident', label: 'Incidente', color: '#EF4444' },
  { key: 'achievement', label: 'Conquista', color: '#F59E0B' },
]

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
  const [obsMenu, setObsMenu] = useState<{ studentId: string; x: number; y: number; view: 'menu' | 'form' | 'history' } | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [obsForm, setObsForm] = useState({ category: 'general', severity: 'info', content: '' })
  const { toast } = useToast()
  const today = getTodayISO()
  const menuRef = useRef<HTMLDivElement>(null)
  const [entryForm, setEntryForm] = useState({ type: 'general', title: '', content: '', date: today })
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [showTodayForm, setShowTodayForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  const obsSpeech = useSpeechRecognition(
    (text) => {
      const cleaned = cleanSpeech(text)
      setObsForm(prev => {
        const updated = prev.content ? prev.content + ' ' + cleaned : cleaned
        scheduleCorrection(updated, (corrected) => {
          setObsForm(p => p.content === updated ? { ...p, content: corrected } : p)
        })
        return { ...prev, content: updated }
      })
    },
    (err) => toast(err, 'error')
  )

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
    if (!obsMenu) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setObsMenu(null)
    }
    document.addEventListener('mousedown', handleClickOutside)

    // Keep popup inside viewport
    if (menuRef.current) {
      const h = menuRef.current.offsetHeight
      const maxTop = window.innerHeight - h - 8
      if (menuStyle.top > maxTop) {
        setMenuStyle(prev => ({ ...prev, top: Math.max(8, maxTop) }))
      }
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [obsMenu])

  async function loadData(classId: string) {
    setLoading(true)
    try {
      const [studentsData, summaryData, entriesData, todayEntryData] = await Promise.all([
        getClassStudents(classId),
        getClassSummary(classId).catch(() => ({ totalStudents: 0, averageGrade: null, criticalObservations: 0 })),
        getDiaryEntries(classId),
        getDiaryEntryByDate(classId, today),
      ])
      setStudents(studentsData)
      setSummary(summaryData)
      setEntries(entriesData)
      setTodayEntry(todayEntryData)
      if (todayEntryData) {
        setEntryForm({ type: todayEntryData.type, title: todayEntryData.title || '', content: todayEntryData.content, date: today })
      }

      const [gradesData, obsResults] = await Promise.all([
        getGrades({ class_id: classId }).catch(() => []),
        Promise.all(studentsData.map(st =>
          getStudentObservations(st.id, classId).catch(() => [])
        )),
      ])

      const map: Record<string, Grade[]> = {}
      for (const st of studentsData) {
        map[st.id] = gradesData.filter(g => g.student_id === st.id)
      }
      setGradesMap(map)

      const obsDataMap: Record<string, StudentObservation[]> = {}
      studentsData.forEach((st, i) => { obsDataMap[st.id] = obsResults[i] })
      setObsMap(obsDataMap)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
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
    setObsMenu({ studentId, x: rect.left, y: rect.bottom + 4, view: 'menu' })
    setMenuStyle({ left: rect.left, top: rect.bottom + 4 })
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
      toast('Registro salvo!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao adicionar observação', 'error')
    } finally {
      setSavingObs(false)
    }
  }

  async function handleSaveEntry(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingEntryId) {
        const updated = await updateDiaryEntry(editingEntryId, {
          type: entryForm.type, title: entryForm.title || undefined, content: entryForm.content,
        })
        setEntries(prev => prev.map(en => en.id === updated.id ? updated : en))
        if (updated.date === today) setTodayEntry(updated)
        toast('Registro atualizado!', 'success')
      } else if (showTodayForm) {
        if (todayEntry) {
          const updated = await updateDiaryEntry(todayEntry.id, {
            type: entryForm.type, title: entryForm.title || undefined, content: entryForm.content,
          })
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
      } else {
        const created = await createDiaryEntry({
          class_id: selectedClass, type: entryForm.type, title: entryForm.title || undefined,
          content: entryForm.content, tags: [], date: entryForm.date,
        })
        setEntries(prev => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
        toast('Registro criado!', 'success')
      }
      setShowNewEntry(false)
      setShowTodayForm(false)
      setEditingEntryId(null)
      setEntryForm({ type: 'general', title: '', content: '', date: today })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleEditEntry(entry: DiaryEntry) {
    setEditingEntryId(entry.id)
    setEntryForm({ type: entry.type, title: entry.title || '', content: entry.content, date: entry.date })
    setShowNewEntry(true)
    setShowTodayForm(false)
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Excluir este registro?')) return
    setSaving(true)
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { error } = await supabase.from('diary_entries').delete().eq('id', id)
      if (error) throw error
      setEntries(prev => prev.filter(e => e.id !== id))
      if (id === todayEntry?.id) setTodayEntry(null)
      toast('Registro excluído', 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao excluir', 'error')
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(18px, 4vw, 24px)', marginBottom: 4 }}>Diário</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{selectedClass ? classes.find(c => c.id === selectedClass)?.name : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Salvando...</span>}
          {!saving && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Salvo</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {classes.length <= 1 && selectedClass ? (
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', padding: '6px 0', flex: '1 1 160px' }}>
            {classes.find(c => c.id === selectedClass)?.name}
          </span>
        ) : (
          <select className="input" style={{ maxWidth: 220, flex: '1 1 160px', minWidth: 140 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['grades', 'observations', 'records'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}>
              {tab === 'grades' ? 'Notas' : tab === 'observations' ? 'Observ.' : 'Registros'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }} />
        {activeTab === 'grades' && (
          <div className="legend-bar mobile-hidden" style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} /> ≥ 7</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} /> 5-6.9</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> &lt; 5</span>
          </div>
        )}
        {activeTab === 'observations' && (
          <div className="legend-bar mobile-hidden" style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
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
          showTodayForm={showTodayForm}
          onFormChange={setEntryForm}
          onSave={handleSaveEntry}
          onToggleNew={() => { setShowNewEntry(!showNewEntry); setShowTodayForm(false); setEditingEntryId(null); setEntryForm({ type: 'general', title: '', content: '', date: today }) }}
          onToggleToday={() => {
            setShowTodayForm(!showTodayForm)
            setShowNewEntry(false)
            setEditingEntryId(null)
            if (todayEntry) {
              setEntryForm({ type: todayEntry.type, title: todayEntry.title || '', content: todayEntry.content, date: today })
            } else {
              setEntryForm({ type: 'general', title: '', content: '', date: today })
            }
          }}
          onEdit={handleEditEntry}
          onDelete={handleDeleteEntry}
        />
      ) : (
        <>
          {/* Mobile Card View (≤768px) */}
          <div className="mobile-only" style={{ display: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {students.map((st, idx) => {
                const avg = getStudentAverage(st.id)
                const lastObs = getLastObsDate(st.id)
                const isCritical = hasCriticalObs(st.id)
                return (
                  <div key={st.id} className="card" style={{ padding: 12 }}>
                    {/* Student header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 700, fontSize: 12,
                        }}>{idx + 1}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            color: isCritical ? 'var(--danger)' : undefined,
                          }}>{st.full_name}</div>
                          {isCritical && <span style={{ fontSize: 9, color: 'var(--danger)', fontWeight: 700 }}> Crítico</span>}
                        </div>
                      </div>
                    </div>

                    {activeTab === 'grades' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {BIMESTRES.map(b => {
                          const nota = getStudentGrade(st.id, 'Geral', b)
                          return (
                            <button key={b} onClick={() => setEditingCell({ studentId: st.id, subject: 'Geral', bimestre: b })} style={{
                              flex: 1, height: 48, borderRadius: 8, border: 'none',
                              background: nota !== null ? (nota >= 7 ? '#22c55e15' : nota >= 5 ? '#f59e0b15' : '#ef444415') : 'var(--bg-secondary)',
                              color: nota !== null ? (nota >= 7 ? '#22c55e' : nota >= 5 ? '#f59e0b' : '#ef4444') : 'var(--text-muted)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                            }}>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{b}º</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>{nota !== null ? nota : '-'}</div>
                            </button>
                          )
                        })}
                        <div style={{
                          flex: 1, height: 48, borderRadius: 8, background: 'var(--bg-secondary)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Méd</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: avg !== null ? (avg >= 7 ? 'var(--success)' : avg >= 5 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-muted)' }}>
                            {avg !== null ? avg : '-'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {OBSERVATION_CATEGORIES.map(cat => {
                          const count = getObsCount(st.id, cat.key)
                          return (
                            <button key={cat.key} onClick={() => activeTab === 'observations' && openObsMenu(st.id, new MouseEvent('click') as any)} style={{
                              flex: 1, height: 48, borderRadius: 8, border: 'none',
                              background: count > 0 ? `${cat.color}15` : 'var(--bg-secondary)',
                              color: count > 0 ? cat.color : 'var(--text-muted)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                            }}>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>{count > 0 ? count : '-'}</div>
                              <div style={{ fontSize: 8, color: cat.color }}>{cat.label.slice(0, 3)}</div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Desktop Table View (>768px) */}
          <div className="desktop-only" style={{ display: 'block' }}>
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
                            title={activeTab === 'observations' ? 'Clique para adicionar registro' : ''}
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
          position: 'fixed', left: menuStyle.left, top: menuStyle.top,
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 12, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: 300, maxWidth: 400,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {students.find(s => s.id === obsMenu.studentId)?.full_name}
            </p>
            {obsMenu.view !== 'menu' && (
              <button className="btn btn-icon btn-ghost" onClick={() => setObsMenu(prev => prev ? { ...prev, view: 'menu' } : null)}
                style={{ width: 24, height: 24, padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>

          {obsMenu.view === 'menu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-sm btn-primary" onClick={() => setObsMenu(prev => prev ? { ...prev, view: 'form' } : null)}
                style={{ justifyContent: 'flex-start' }}>
                <Plus size={16} /> Novo registro
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => setObsMenu(prev => prev ? { ...prev, view: 'history' } : null)}
                style={{ justifyContent: 'flex-start' }}>
                <FileText size={16} /> Ver registros ({(obsMap[obsMenu.studentId] || []).length})
              </button>
            </div>
          )}

          {obsMenu.view === 'form' && (
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
              <div style={{ position: 'relative' }}>
                <textarea className="input" rows={3} placeholder="Descreva o registro ou use o microfone..." value={obsForm.content} required
                  onChange={e => setObsForm(prev => ({ ...prev, content: e.target.value }))}
                  style={{ fontSize: 12, padding: '4px 8px', paddingRight: 36 }} />
                <MicButton
                  status={obsSpeech.status}
                  onToggle={obsSpeech.toggleListening}
                  style={{ position: 'absolute', right: 4, bottom: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setObsMenu(null)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={savingObs || !obsForm.content.trim()} style={{ flex: 1 }}>
                  {savingObs ? '...' : 'Salvar'}
                </button>
              </div>
            </form>
          )}

          {obsMenu.view === 'history' && (
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(obsMap[obsMenu.studentId] || []).length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  Nenhum registro para este aluno.
                </div>
              ) : (obsMap[obsMenu.studentId] || []).map(obs => {
                const cat = OBSERVATION_CATEGORIES.find(c => c.key === obs.category) || OBSERVATION_CATEGORIES[4]
                const sev = SEVERITY_OPTIONS.find(s => s.key === obs.severity) || SEVERITY_OPTIONS[0]
                return (
                  <div key={obs.id} style={{ padding: 8, borderLeft: `3px solid ${sev.color}`, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: `${cat.color}15`, color: cat.color, fontSize: 10 }}>{cat.label}</span>
                      <span className="badge" style={{ background: `${sev.color}15`, color: sev.color, fontSize: 10 }}>{sev.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDateBR(obs.date)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>{obs.content}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecordsTab({
  entries, today, todayEntry, entryForm, saving, showNewEntry, showTodayForm,
  onFormChange, onSave, onToggleNew, onToggleToday, onEdit, onDelete,
}: {
  entries: DiaryEntry[]; today: string; todayEntry: DiaryEntry | null
  entryForm: { type: string; title: string; content: string; date: string }; saving: boolean; showNewEntry: boolean; showTodayForm: boolean
  onFormChange: (f: { type: string; title: string; content: string; date: string }) => void
  onSave: (e: React.FormEvent) => Promise<void>; onToggleNew: () => void; onToggleToday: () => void
  onEdit: (entry: DiaryEntry) => void; onDelete: (id: string) => void
}) {
  const { toast } = useToast()
  const speech = useSpeechRecognition(
    (text) => {
      const cleaned = cleanSpeech(text)
      const updated = entryForm.content ? entryForm.content + ' ' + cleaned : cleaned
      onFormChange({ ...entryForm, content: updated })
      scheduleCorrection(updated, (corrected) => {
        onFormChange({ ...entryForm, content: corrected })
      })
    },
    (err) => toast(err, 'error')
  )

  function exportEntries() {
    const header = 'Data,Tipo,Título,Conteúdo\n'
    const rows = entries.map(e => {
      const type = DIARY_TYPES.find(t => t.key === e.type)?.label || e.type
      const title = (e.title || '').replace(/"/g, '""')
      const content = e.content.replace(/"/g, '""')
      return `${formatDateBR(e.date)},"${type}","${title}","${content}"`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registros-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('Registros exportados!', 'success')
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-sm btn-primary" onClick={onToggleToday}>
          {showTodayForm ? <X size={16} /> : <Calendar size={16} />}
          {showTodayForm ? 'Cancelar' : (todayEntry ? 'Editar registro de hoje' : 'Registro de hoje')}
        </button>
        <button className="btn btn-sm btn-secondary" onClick={onToggleNew}>
          {showNewEntry ? <X size={16} /> : <Plus size={16} />}
          {showNewEntry ? 'Cancelar' : 'Novo registro'}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={exportEntries} style={{ marginLeft: 'auto' }}>
          <Download size={16} /> Exportar
        </button>
      </div>

      {showTodayForm && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: '3px solid var(--primary)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Registro de hoje
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
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>O que trabalhamos hoje?</label>
              <textarea className="input" rows={3} placeholder="Descreva as atividades ou use o microfone..." value={entryForm.content} required
                onChange={e => onFormChange({ ...entryForm, content: e.target.value })}
                style={{ paddingRight: 36 }} />
              <MicButton
                status={speech.status}
                onToggle={speech.toggleListening}
                style={{ position: 'absolute', right: 12, bottom: 12 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving || !entryForm.content.trim()}>
                {saving ? 'Salvando...' : (todayEntry ? 'Atualizar' : 'Salvar')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showNewEntry && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Novo registro</h3>
          <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>Data</label>
                <input className="input" type="date" value={entryForm.date} max={today} required
                  onChange={e => onFormChange({ ...entryForm, date: e.target.value })} />
              </div>
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
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>Conteúdo</label>
              <textarea className="input" rows={3} placeholder="Descreva o registro ou use o microfone..." value={entryForm.content} required
                onChange={e => onFormChange({ ...entryForm, content: e.target.value })}
                style={{ paddingRight: 36 }} />
              <MicButton
                status={speech.status}
                onToggle={speech.toggleListening}
                style={{ position: 'absolute', right: 12, bottom: 12 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving || !entryForm.content.trim()}>
                {saving ? 'Salvando...' : 'Salvar registro'}
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
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', width: 80 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro encontrado.</td></tr>
            ) : entries.map((entry, idx) => {
              const cat = DIARY_TYPES.find(t => t.key === entry.type) || DIARY_TYPES[0]
              const isToday = entry.date === today
              return (
                <tr key={entry.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)', ...(isToday ? { background: 'rgba(99, 102, 241, 0.05)' } : {}) }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDateBR(entry.date)}
                    {isToday && <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, marginLeft: 4 }}>Hoje</span>}
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
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-icon btn-ghost" onClick={() => onEdit(entry)} style={{ width: 28, height: 28, padding: 0 }} title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-icon btn-ghost" onClick={() => onDelete(entry.id)} style={{ width: 28, height: 28, padding: 0, color: 'var(--danger)' }} title="Excluir">
                        <X size={14} />
                      </button>
                    </div>
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
