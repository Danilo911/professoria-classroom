'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, ClipboardCheck, Plus, X, Check, Save, Trash2, ChevronDown, Users, ArrowLeft } from 'lucide-react'
import { getRubrics, createRubric, updateRubric, deleteRubric, getRubric, getClasses, getClassStudents, getRubricEvaluations, saveRubricEvaluation } from '@/lib/db'
import { useToast } from '@/lib/toast'
import type { Rubric, RubricLevel, Class, Student } from '@/types'

const RUBRIC_COLORS: Record<string, string> = {
  rubric: '#6366F1',
  checklist: '#10B981',
}

const DEFAULT_COLORS = ['#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#6B7280']

export default function AvaliacaoPage() {
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRubric, setSelectedRubric] = useState<Rubric | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { toast } = useToast()

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState<'rubric' | 'checklist'>('checklist')
  const [formCriteria, setFormCriteria] = useState<string[]>([''])
  const [formLevels, setFormLevels] = useState<{ label: string; color: string }[]>([
    { label: 'Sim', color: '#22C55E' },
    { label: 'Não', color: '#EF4444' },
  ])

  // Evaluation state
  const [showEval, setShowEval] = useState(false)
  const [evalClassId, setEvalClassId] = useState('')
  const [evalDate, setEvalDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [evalStudents, setEvalStudents] = useState<Student[]>([])
  const [evalClasses, setEvalClasses] = useState<Class[]>([])
  const [evalScores, setEvalScores] = useState<Record<string, Record<string, number>>>({})
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalSaving, setEvalSaving] = useState(false)

  useEffect(() => {
    loadRubrics()
  }, [])

  async function loadRubrics() {
    setLoading(true)
    try {
      const data = await getRubrics()
      setRubrics(data)
    } finally {
      setLoading(false)
    }
  }

  function openNewRubric() {
    setEditingId(null)
    setFormTitle('')
    setFormType('checklist')
    setFormCriteria([''])
    setFormLevels([
      { label: 'Sim', color: '#22C55E' },
      { label: 'Não', color: '#EF4444' },
    ])
    setShowForm(true)
  }

  function openEditRubric(rubric: Rubric) {
    setEditingId(rubric.id)
    setFormTitle(rubric.title)
    setFormType(rubric.type)
    setFormCriteria(rubric.criteria?.map(c => c.description) || [''])
    setFormLevels(
      rubric.type === 'checklist'
        ? [
            { label: 'Sim', color: '#22C55E' },
            { label: 'Não', color: '#EF4444' },
          ]
        : rubric.levels?.map(l => ({ label: l.label, color: l.color })) || [
            { label: 'Iniciando', color: '#EF4444' },
            { label: 'Em desenvolvimento', color: '#F59E0B' },
            { label: 'Consolidado', color: '#22C55E' },
          ]
    )
    setShowForm(true)
  }

  function addCriterion() {
    setFormCriteria(prev => [...prev, ''])
  }

  function removeCriterion(idx: number) {
    if (formCriteria.length <= 1) return
    setFormCriteria(prev => prev.filter((_, i) => i !== idx))
  }

  function updateCriterion(idx: number, value: string) {
    setFormCriteria(prev => prev.map((c, i) => i === idx ? value : c))
  }

  function addLevel() {
    const usedColors = formLevels.map(l => l.color)
    const nextColor = DEFAULT_COLORS.find(c => !usedColors.includes(c)) || '#6B7280'
    setFormLevels(prev => [...prev, { label: '', color: nextColor }])
  }

  function removeLevel(idx: number) {
    if (formLevels.length <= 2) return
    setFormLevels(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLevel(idx: number, field: 'label' | 'color', value: string) {
    setFormLevels(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  async function handleSaveForm() {
    if (!formTitle.trim()) {
      toast('Informe um título para a avaliação.', 'error')
      return
    }
    const criteria = formCriteria.filter(c => c.trim()).map((c, i) => ({ description: c.trim(), sort_order: i }))
    if (criteria.length === 0) {
      toast('Adicione pelo menos um critério.', 'error')
      return
    }

    try {
      if (editingId) {
        await updateRubric(editingId, {
          title: formTitle.trim(),
          criteria,
          levels: formLevels.map((l, i) => ({ level: i, label: l.label || `Nível ${i}`, color: l.color })),
        })
        toast('Rubrica atualizada!', 'success')
      } else {
        await createRubric({
          title: formTitle.trim(),
          type: formType,
          criteria,
          levels: formLevels.map((l, i) => ({ level: i, label: l.label || `Nível ${i}`, color: l.color })),
        })
        toast('Rubrica criada!', 'success')
      }
      setShowForm(false)
      loadRubrics()
    } catch {
      toast('Erro ao salvar rubrica.', 'error')
    }
  }

  async function handleDeleteRubric(rubric: Rubric) {
    if (!confirm(`Excluir "${rubric.title}"? Todas as avaliações serão perdidas.`)) return
    try {
      await deleteRubric(rubric.id)
      setRubrics(prev => prev.filter(r => r.id !== rubric.id))
      toast('Rubrica excluída.', 'success')
    } catch {
      toast('Erro ao excluir rubrica.', 'error')
    }
  }

  async function openEvaluation(rubric: Rubric) {
    setSelectedRubric(rubric)
    setEvalClassId('')
    setEvalScores({})
    setEvalStudents([])
    setEvalDate(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })

    try {
      const classes = await getClasses()
      setEvalClasses(classes)
    } catch {}

    setShowEval(true)
  }

  async function handleEvalClassChange(classId: string) {
    setEvalClassId(classId)
    if (!classId || !selectedRubric) return

    setEvalLoading(true)
    try {
      const students = await getClassStudents(classId)
      setEvalStudents(students)

      const evals = await getRubricEvaluations(selectedRubric.id, classId, evalDate)
      const scores: Record<string, Record<string, number>> = {}
      for (const ev of evals) {
        scores[ev.student_id] = {}
        for (const s of ev.scores || []) {
          scores[ev.student_id][s.criterion_id] = s.level
        }
      }
      // Fill defaults
      for (const st of students) {
        if (!scores[st.id]) scores[st.id] = {}
        for (const c of selectedRubric.criteria || []) {
          if (scores[st.id][c.id] === undefined) scores[st.id][c.id] = 0
        }
      }
      setEvalScores(scores)
    } finally {
      setEvalLoading(false)
    }
  }

  function setScore(studentId: string, criterionId: string, level: number) {
    setEvalScores(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [criterionId]: level },
    }))
  }

  async function handleSaveEvaluation() {
    if (!selectedRubric || !evalClassId) return
    setEvalSaving(true)
    let saved = 0
    try {
      for (const student of evalStudents) {
        const scores = Object.entries(evalScores[student.id] || {}).map(([criterion_id, level]) => ({
          criterion_id,
          level,
        }))
        if (scores.length === 0) continue
        await saveRubricEvaluation({
          rubricId: selectedRubric.id,
          studentId: student.id,
          classId: evalClassId,
          evaluatedAt: evalDate,
          scores,
        })
        saved++
      }
      toast(`${saved} aluno(s) avaliado(s) com sucesso!`, 'success')
    } catch {
      toast('Erro ao salvar avaliações.', 'error')
    } finally {
      setEvalSaving(false)
    }
  }

  const sortedLevels = (rubric: Rubric) =>
    [...(rubric.levels || [])].sort((a, b) => a.level - b.level)

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
  }
  const modalStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  }
  const modalHeaderStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)',
  }
  const modalBodyStyle: React.CSSProperties = {
    padding: 24,
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          <ClipboardList size={24} style={{ display: 'inline', marginRight: 8, color: 'var(--primary)' }} />
          Avaliação
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Avalie seus alunos com rubricas e checklists personalizados</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={openNewRubric} className="btn btn-primary">
          <Plus size={18} /> Nova avaliação
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : rubrics.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <ClipboardList size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ marginBottom: 16 }}>Nenhuma rubrica criada ainda.</p>
          <button onClick={openNewRubric} className="btn btn-primary">
            <Plus size={18} /> Criar primeira avaliação
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {rubrics.map(rubric => {
            const color = RUBRIC_COLORS[rubric.type] || '#6366F1'
            const Icon = rubric.type === 'checklist' ? ClipboardCheck : ClipboardList
            const levels = sortedLevels(rubric)
            return (
              <div key={rubric.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button onClick={() => openEvaluation(rubric)}
                  style={{ width: '100%', padding: 24, textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--bg-surface)', display: 'block' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Icon size={24} color={color} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{rubric.title}</h3>
                  <span className="badge" style={{ background: `${color}15`, color, fontSize: 11 }}>
                    {rubric.type === 'checklist' ? 'Checklist' : 'Rubrica'} · {rubric.criteria?.length || 0} critérios
                  </span>
                  {levels.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                      {levels.map(l => (
                        <span key={l.level} style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 4,
                          background: `${l.color}20`, color: l.color, fontWeight: 500,
                        }}>{l.label}</span>
                      ))}
                    </div>
                  )}
                </button>
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => openEditRubric(rubric)} className="btn btn-sm btn-ghost" style={{ fontSize: 12 }}>Editar</button>
                  <button onClick={() => handleDeleteRubric(rubric)} className="btn btn-sm btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }}>Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== FORMULÁRIO CRIAR/EDITAR RUBRICA ===== */}
      {showForm && (
        <div style={overlayStyle} onClick={() => setShowForm(false)}>
          <div style={{ ...modalStyle, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editingId ? 'Editar' : 'Nova'} Avaliação</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}>
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div style={{ ...modalBodyStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Título</label>
                <input className="input" placeholder="Ex: Participação em aula" value={formTitle}
                  onChange={e => setFormTitle(e.target.value)} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([{ key: 'checklist', label: 'Checklist', desc: 'Sim/Não', icon: ClipboardCheck },
                    { key: 'rubric', label: 'Rubrica', desc: 'Múltiplos níveis', icon: ClipboardList }] as const).map(t => {
                    const Icon = t.icon
                    const active = formType === t.key
                    return (
                      <button key={t.key} onClick={() => {
                        setFormType(t.key as 'rubric' | 'checklist')
                        if (t.key === 'checklist') {
                          setFormLevels([
                            { label: 'Sim', color: '#22C55E' },
                            { label: 'Não', color: '#EF4444' },
                          ])
                        } else {
                          setFormLevels([
                            { label: 'Iniciando', color: '#EF4444' },
                            { label: 'Em desenvolvimento', color: '#F59E0B' },
                            { label: 'Consolidado', color: '#22C55E' },
                          ])
                        }
                      }} style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                        background: active ? 'var(--primary-50)' : 'var(--bg-surface)',
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        transition: 'all 0.15s',
                      }}>
                        <Icon size={20} color={active ? 'var(--primary)' : 'var(--text-muted)'} />
                        <div style={{ textAlign: 'left' }}>
                          <div>{t.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Critérios</label>
                  <button type="button" onClick={addCriterion} className="btn btn-sm btn-ghost" style={{ fontSize: 12 }}>
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {formCriteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input className="input" placeholder={`Critério ${i + 1}`} value={c}
                        onChange={e => updateCriterion(i, e.target.value)} style={{ flex: 1 }} />
                      <button onClick={() => removeCriterion(i)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 6, borderRadius: 6, color: 'var(--text-muted)',
                        opacity: formCriteria.length <= 1 ? 0.3 : 1,
                      }} disabled={formCriteria.length <= 1}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {formType === 'rubric' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Níveis</label>
                    <button type="button" onClick={addLevel} className="btn btn-sm btn-ghost" style={{ fontSize: 12 }}>
                      <Plus size={14} /> Adicionar nível
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {formLevels.map((l, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 20 }}>N{i}</span>
                        <input className="input" placeholder={`Nível ${i}`} value={l.label}
                          onChange={e => updateLevel(i, 'label', e.target.value)} style={{ flex: 1 }} />
                        <input type="color" value={l.color}
                          onChange={e => updateLevel(i, 'color', e.target.value)}
                          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', padding: 0, cursor: 'pointer' }} />
                        <button onClick={() => removeLevel(i)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 6, borderRadius: 6, color: 'var(--text-muted)',
                          opacity: formLevels.length <= 2 ? 0.3 : 1,
                        }} disabled={formLevels.length <= 2}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancelar</button>
                <button onClick={handleSaveForm} className="btn btn-primary">
                  <Save size={16} /> {editingId ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== AVALIAÇÃO GRID ===== */}
      {showEval && selectedRubric && (
        <div style={overlayStyle} onClick={() => { if (!evalSaving) setShowEval(false) }}>
          <div style={{ ...modalStyle, maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>{selectedRubric.title}</h2>
                <span className="badge" style={{
                  background: `${RUBRIC_COLORS[selectedRubric.type]}15`,
                  color: RUBRIC_COLORS[selectedRubric.type], fontSize: 11,
                }}>{selectedRubric.type === 'checklist' ? 'Checklist' : 'Rubrica'}</span>
              </div>
              <button onClick={() => setShowEval(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}>
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div style={{ ...modalBodyStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>Turma</label>
                  <select className="input" value={evalClassId} onChange={e => handleEvalClassChange(e.target.value)}>
                    <option value="">Selecione...</option>
                    {evalClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 160 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>Data</label>
                  <input className="input" type="date" value={evalDate} onChange={e => {
                    setEvalDate(e.target.value)
                    if (evalClassId) handleEvalClassChange(evalClassId)
                  }} />
                </div>
              </div>

              {!evalClassId ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Selecione uma turma para começar a avaliar.
                </div>
              ) : evalLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Carregando...</div>
              ) : evalStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhum aluno nesta turma.</div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 2, borderBottom: '2px solid var(--border)', minWidth: 160 }}>Aluno</th>
                          {(selectedRubric.criteria || []).map(c => (
                            <th key={c.id} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 120 }}>{c.description}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evalStudents.map((st, idx) => (
                          <tr key={st.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                            <td style={{ padding: '6px 12px', fontWeight: 500, position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                              {st.full_name}
                            </td>
                            {(selectedRubric.criteria || []).map(c => {
                              const level = evalScores[st.id]?.[c.id] ?? 0
                              const lvl = sortedLevels(selectedRubric).find(l => l.level === level)
                              return (
                                <td key={c.id} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                                  <select
                                    value={level}
                                    onChange={e => setScore(st.id, c.id, Number(e.target.value))}
                                    style={{
                                      padding: '6px 8px', borderRadius: 6, border: `1px solid ${lvl?.color || 'var(--border)'}`,
                                      background: lvl ? `${lvl.color}15` : 'var(--bg-surface)',
                                      color: lvl?.color || 'var(--text-primary)',
                                      fontWeight: 500, fontSize: 12, cursor: 'pointer', minWidth: 100,
                                    }}
                                  >
                                    {sortedLevels(selectedRubric).map(l => (
                                      <option key={l.level} value={l.level} style={{ color: l.color }}>
                                        {l.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => setShowEval(false)} className="btn btn-secondary">Cancelar</button>
                    <button onClick={handleSaveEvaluation} className="btn btn-primary" disabled={evalSaving}>
                      <Save size={16} /> {evalSaving ? 'Salvando...' : 'Salvar avaliação'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
