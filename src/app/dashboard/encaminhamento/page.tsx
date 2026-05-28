'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Check, Copy, FileDown, FileText as FileTextIcon, User, X, ArrowLeft, ChevronRight, Brain, AlertTriangle, Zap, MessageCircle, Smile, Eye, Heart, Users, Mic, ClipboardCopy, Loader2, Upload, Clock, Plus, Trash2 } from 'lucide-react'
import { getClasses, getClassStudents, saveAIReport, updateAIReport, deleteAIReport, getAIReports, getTeacher, getStudentObservations } from '@/lib/db'
import { useToast } from '@/lib/toast'
import { getTodayISO, formatDateBR, formatDateTimeBR } from '@/lib/dates'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'
import { REFERRAL_TYPES } from '@/types/database'
import type { Class, Student, Teacher, AIReport } from '@/types'

const REFERRAL_ICONS: Record<string, typeof Brain> = {
  tea: Brain,
  tod: AlertTriangle,
  tdah: Zap,
  fono: MessageCircle,
  dentista: Smile,
  oftalmo: Eye,
  psicologo: Heart,
  multi: Users,
  outro: FileTextIcon,
}

const REFERRAL_COLORS: Record<string, string> = {
  tea: '#6366F1',
  tod: '#EF4444',
  tdah: '#F59E0B',
  fono: '#06B6D4',
  dentista: '#10B981',
  oftalmo: '#8B5CF6',
  psicologo: '#EC4899',
  multi: '#6366F1',
  outro: '#6B7280',
}

const CATEGORY_LABELS: Record<string, string> = {
  behavior: 'Comportamento', difficulty: 'Dificuldade',
  evolution: 'Evolução', intervention: 'Intervenção', general: 'Geral',
}
const SEVERITY_LABELS: Record<string, string> = {
  info: 'Info', attention: 'Atenção', critical: 'Crítico',
}

export default function EncaminhamentoPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // Student selection
  const [showStudentList, setShowStudentList] = useState(false)
  const [classStudents, setClassStudents] = useState<{ class: Class; students: Student[] }[]>([])
  const [selectedStudent, setSelectedStudent] = useState<{ student: Student; class: Class } | null>(null)

  // Form
  const [showForm, setShowForm] = useState(false)
  const [observations, setObservations] = useState('')
  const [copiandoRegistros, setCopiandoRegistros] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Result
  const [result, setResult] = useState<string | null>(null)
  const [editableResult, setEditableResult] = useState('')
  const [resultProvider, setResultProvider] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [salvandoFinal, setSalvandoFinal] = useState(false)

  // Saved history
  const [savedReferrals, setSavedReferrals] = useState<AIReport[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [showSavedList, setShowSavedList] = useState(false)
  const [editingReportId, setEditingReportId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const obsSpeech = useSpeechRecognition(
    (text) => {
      setObservations(prev => (prev ? prev + ' ' + text : text))
    },
    (err) => toast(err, 'error')
  )

  useEffect(() => {
    getClasses().then(data => setClasses(data))
    getTeacher().then(data => setTeacher(data))
    fetchSavedReferrals()
  }, [])

  async function fetchSavedReferrals() {
    setLoadingSaved(true)
    try {
      const reports = await getAIReports({ type: 'referral' })
      setSavedReferrals(reports)
    } catch {
      // silent
    } finally {
      setLoadingSaved(false)
    }
  }

  function handleSelectReferral(report: AIReport) {
    const ctx = report.prompt_context as any
    setSelectedType(ctx?.referralType || null)
    setSelectedStudent({
      student: { id: report.student_id || '', full_name: ctx?.studentName || '' } as Student,
      class: { id: report.class_id || '', name: ctx?.className || '' } as Class,
    })
    setResult(report.content)
    setEditableResult(report.content)
    setEditingReportId(report.id)
    setResultProvider('saved')
    setShowSavedList(false)
  }

  async function loadClassStudents() {
    setLoadingStudents(true)
    try {
      const allClasses = await getClasses()
      const result: { class: Class; students: Student[] }[] = []
      for (const c of allClasses) {
        const s = await getClassStudents(c.id)
        result.push({ class: c, students: s })
      }
      setClassStudents(result)
    } finally {
      setLoadingStudents(false)
    }
  }

  function handleSelectType(key: string) {
    setSelectedType(key)
    loadClassStudents()
    setShowStudentList(true)
  }

  function handleSelectStudent(student: Student, cls: Class) {
    setSelectedStudent({ student, class: cls })
    setShowStudentList(false)
    setShowForm(true)
    setObservations('')
  }

  function closeStudentList() {
    setShowStudentList(false)
    if (!selectedStudent) setSelectedType(null)
  }

  function closeForm() {
    setShowForm(false)
    if (!result) {
      setSelectedStudent(null)
      setSelectedType(null)
    }
  }

  function resetAll() {
    setSelectedType(null)
    setSelectedStudent(null)
    setShowStudentList(false)
    setShowForm(false)
    setResult(null)
    setEditableResult('')
    setResultProvider(null)
    setError(null)
    setObservations('')
    setEditingReportId(null)
  }

  function gerarCabecalho(): string {
    const schoolName = teacher?.school?.name || ''
    const schoolCity = teacher?.school?.city || 'Guarulhos'
    const schoolState = teacher?.school?.state || 'SP'
    const teacherName = teacher?.full_name || ''
    const studentName = selectedStudent?.student.full_name || ''
    const className = selectedStudent?.class.name || ''
    const typeLabel = REFERRAL_TYPES.find(t => t.key === selectedType)
    const formattedDate = formatDateBR(getTodayISO())
    const year = getTodayISO().split('-')[0]

    let lines = ''
    lines += `PREFEITURA MUNICIPAL DE ${schoolCity.toUpperCase()}\n`
    lines += `SECRETARIA MUNICIPAL DE EDUCAÇÃO\n`
    if (schoolName) {
      lines += `EPG ${schoolName.toUpperCase()}\n`
    }
    lines += `\n`
    lines += `ENCAMINHAMENTO\n`
    if (typeLabel) lines += `${typeLabel.label}\n`
    lines += `\n`
    if (studentName) lines += `Aluno(a): ${studentName}\n`
    if (className) lines += `Turma: ${className}\n`
    if (teacherName) lines += `Professor(a): ${teacherName}\n`
    lines += `Data: ${formattedDate}\n`
    lines += `Ano letivo: ${year}\n`

    return lines
  }

  async function copiarRegistros() {
    if (!selectedStudent) return
    setCopiandoRegistros(true)
    try {
      const obs = await getStudentObservations(selectedStudent.student.id, selectedStudent.class.id)
      const cabecalho = `Encaminhamento — ${selectedStudent.student.full_name}`
      const info = `Turma: ${selectedStudent.class.name}`

      if (obs.length === 0) {
        const template = `${cabecalho}\n${info}\n\nNenhum registro encontrado para este aluno no diário.\n\nSugestões:\n• Manter acompanhamento próximo.\n• Registrar observações no diário para fundamentar o encaminhamento.`
        setObservations(template)
        return
      }

      const linhas = obs.map(o => {
        const cat = CATEGORY_LABELS[o.category] || o.category
        const sev = o.severity ? SEVERITY_LABELS[o.severity] || o.severity : ''
        return `• [${o.date} - ${cat}]${sev ? ' (' + sev + ')' : ''} ${o.content}`
      }).join('\n')

      const template = `${cabecalho}\n${info}\n\nRegistros do aluno:\n${linhas}\n\nPróximos passos sugeridos:\n• Reforçar os conteúdos onde apresenta mais dificuldade.\n• Manter comunicação próxima com a família.\n• Acompanhar a evolução nas próximas semanas.`
      setObservations(prev => (prev ? prev + '\n\n' : '') + template)
      toast('Registros importados!', 'success')
    } catch {
      toast('Erro ao importar registros.', 'error')
    } finally {
      setCopiandoRegistros(false)
    }
  }

  async function handleGenerate() {
    if (!selectedStudent || !selectedType) return
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/gemini/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.student.full_name,
          className: selectedStudent.class.name,
          observations,
          referralType: selectedType,
        }),
      })

      if (res.status === 429) {
        const fallback = observations || 'Nenhum conteúdo para exibir.'
        const contentWithHeader = fallback.startsWith('PREFEITURA') ? fallback : `${gerarCabecalho()}\n\n${fallback}`
        setResult(contentWithHeader)
        setEditableResult(contentWithHeader)
        setResultProvider(null)
        setShowForm(false)
        return
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar encaminhamento')
      }

      const header = gerarCabecalho()
      const contentWithHeader = `${header}\n\n${data.content}`
      setResult(contentWithHeader)
      setEditableResult(contentWithHeader)
      setResultProvider(data.provider || null)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy() {
    let text = editableResult
    if (!text) return
    if (!text.startsWith('PREFEITURA')) {
      text = `${gerarCabecalho()}\n\n${text}`
    }
    navigator.clipboard.writeText(text)
    setCopiado(true)
    toast('Copiado!', 'success')
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleExportTxt() {
    const text = editableResult
    if (!text) return
    const conteudo = text.startsWith('PREFEITURA') ? text : `${gerarCabecalho()}\n\n${text}`
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `encaminhamento-${(selectedStudent?.student.full_name || 'aluno').replace(/\s+/g, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exportado como TXT!', 'success')
  }

  function handleExportDoc() {
    const text = editableResult
    if (!text) return
    const displayText = text.startsWith('PREFEITURA') ? text : `${gerarCabecalho()}\n\n${text}`
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Encaminhamento</title>
<style>
body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 12pt; line-height: 1.6; padding: 40px; max-width: 800px; margin: auto; }
h1 { font-size: 16pt; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
.info { font-size: 11pt; color: #666; margin-bottom: 20px; }
.content { white-space: pre-wrap; }
</style></head>
<body>
<div class="content">${displayText.replace(/\n/g, '<br>')}</div>
</body></html>`
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `encaminhamento-${(selectedStudent?.student.full_name || 'aluno').replace(/\s+/g, '-').toLowerCase()}.doc`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exportado como DOC!', 'success')
  }

  async function handleSaveFinal() {
    if (!result || !selectedStudent || !selectedType) return
    setSalvandoFinal(true)
    try {
      if (editingReportId) {
        await updateAIReport(editingReportId, { content: editableResult, status: 'final' })
        setEditingReportId(null)
        setSavedReferrals(prev => prev.map(r => r.id === editingReportId ? { ...r, content: editableResult, status: 'final' as const } : r))
      } else {
        const saved = await saveAIReport({
          class_id: selectedStudent.class.id,
          student_id: selectedStudent.student.id,
          type: 'referral',
          content: editableResult,
          prompt_context: {
            className: selectedStudent.class.name,
            studentName: selectedStudent.student.full_name,
            referralType: selectedType,
          },
        })
        setSavedReferrals(prev => [saved, ...prev])
      }
      setResultProvider('saved')
      toast('Encaminhamento salvo!', 'success')
    } catch {
      toast('Erro ao salvar encaminhamento', 'error')
    } finally {
      setSalvandoFinal(false)
    }
  }

  async function handleDelete() {
    if (!editingReportId) return
    if (!confirm('Tem certeza que deseja excluir este encaminhamento?')) return
    try {
      await deleteAIReport(editingReportId)
      setSavedReferrals(prev => prev.filter(r => r.id !== editingReportId))
      resetAll()
      toast('Encaminhamento excluído!', 'success')
    } catch {
      toast('Erro ao excluir encaminhamento', 'error')
    }
  }

  // ===== MODAL STYLES =====
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

  const typeInfo = REFERRAL_TYPES.find(t => t.key === selectedType)
  const Icon = selectedType ? REFERRAL_ICONS[selectedType] : null
  const color = selectedType ? REFERRAL_COLORS[selectedType] : '#6366F1'

  function MicButton({ status, onToggle }: { status: string; onToggle: () => void }) {
    const isLoading = status === 'loading'
    const isUploading = status === 'uploading'
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={isLoading || isUploading}
        title={isLoading ? 'Carregando modelo...' : isUploading ? 'Enviando para transcrição...' : status === 'listening' ? 'Parar' : 'Gravar por voz'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6, border: 'none',
          cursor: isLoading || isUploading ? 'wait' : 'pointer',
          background: status === 'listening' ? 'var(--danger)' : isLoading ? 'var(--warning)' : 'transparent',
          color: status === 'listening' || isLoading ? 'white' : 'var(--text-muted)',
          transition: 'all 0.15s',
        }}
      >
        {isLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : isUploading ? <Upload size={14} /> : <Mic size={14} />}
      </button>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          <Sparkles size={24} style={{ display: 'inline', marginRight: 8, color: 'var(--primary)' }} />
          Encaminhamento
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Gere documentos de encaminhamento para avaliação profissional</p>
      </div>

      {/* ===== TIPOS DE ENCAMINHAMENTO ===== */}
      {!selectedType && (
        <div>
          {savedReferrals.length > 0 && (
            <button onClick={() => setShowSavedList(true)} className="btn btn-secondary" style={{ marginBottom: 16, fontSize: 13 }}>
              <Clock size={16} /> Histórico ({savedReferrals.length})
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {REFERRAL_TYPES.map(t => {
            const ICmp = REFERRAL_ICONS[t.key] || FileTextIcon
            const c = REFERRAL_COLORS[t.key] || '#6B7280'
            return (
              <button key={t.key} onClick={() => handleSelectType(t.key)}
                className="card card-interactive"
                style={{ padding: 24, textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--bg-surface)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <ICmp size={24} color={c} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{t.label}</h3>
              </button>
            )
          })}
        </div>
        </div>
      )}

      {/* ===== HISTÓRICO ===== */}
      {showSavedList && (
        <div style={overlayStyle} onClick={() => setShowSavedList(false)}>
          <div style={{ ...modalStyle, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Histórico de Encaminhamentos</h2>
              <button onClick={() => setShowSavedList(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}>
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div style={modalBodyStyle}>
              {savedReferrals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>
                  <FileTextIcon size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <p>Nenhum encaminhamento salvo.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {savedReferrals.map(r => {
                    const ctx = r.prompt_context as any
                    const typeLabel = REFERRAL_TYPES.find(t => t.key === ctx?.referralType)
                    return (
                      <button key={r.id} onClick={() => handleSelectReferral(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileTextIcon size={18} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{ctx?.studentName || 'Aluno'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {typeLabel?.label || ctx?.referralType} — {ctx?.className}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatDateTimeBR(r.created_at)}</div>
                        </div>
                        <span className="badge" style={{
                          background: r.status === 'final' ? 'var(--success-light)' : 'var(--warning-light)',
                          color: r.status === 'final' ? 'var(--success)' : 'var(--warning)',
                          fontSize: 11,
                        }}>
                          {r.status === 'final' ? 'Final' : 'Rascunho'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== LISTA DE ALUNOS ===== */}
      {showStudentList && !selectedStudent && !result && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={closeStudentList} className="btn btn-sm btn-ghost" style={{ padding: 8 }}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ fontSize: 18 }}>{typeInfo?.label} — Alunos</h2>
          </div>
          {loadingStudents ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando alunos...</div>
          ) : classStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Nenhuma turma encontrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {classStudents.map(({ class: cls, students: sts }) => (
                <div key={cls.id}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cls.name} <span style={{ fontWeight: 400, opacity: 0.6 }}>({sts.length} alunos)</span></h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                    {sts.map(s => (
                      <button key={s.id} onClick={() => handleSelectStudent(s, cls)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={16} color="#fff" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</div>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== FORMULÁRIO DE GERAÇÃO ===== */}
      {showForm && !result && (
        <div style={overlayStyle} onClick={closeForm}>
          <div style={{ ...modalStyle, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Novo Encaminhamento</h2>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}>
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div style={{ ...modalBodyStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Turma</label>
                <input className="input" value={selectedStudent?.class.name || ''} readOnly style={{ background: 'var(--bg-secondary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Aluno</label>
                <input className="input" value={selectedStudent?.student.full_name || ''} readOnly style={{ background: 'var(--bg-secondary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Tipo</label>
                <input className="input" value={typeInfo?.label || ''} readOnly style={{ background: 'var(--bg-secondary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Observações (opcional)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12 }}>
                    Importar
                  </button>
                  <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const text = await file.text()
                      setObservations(prev => (prev ? prev + '\n\n' : '') + text)
                      toast('Arquivo importado!', 'success')
                    } catch {
                      toast('Erro ao ler arquivo.', 'error')
                    }
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }} />
                  {selectedStudent && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={copiarRegistros} disabled={copiandoRegistros} style={{ fontSize: 12 }}>
                      <ClipboardCopy size={14} /> {copiandoRegistros ? '...' : 'Registros'}
                    </button>
                  )}
                  <MicButton status={obsSpeech.status} onToggle={obsSpeech.toggleListening} />
                </div>
                <textarea className="input" rows={4}
                  placeholder="Descreva comportamentos observados, dificuldades, estratégias já utilizadas..."
                  value={observations}
                  onChange={e => setObservations(e.target.value)} />
              </div>
              {error && (
                <div style={{ padding: 12, background: 'var(--danger-50)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--danger)' }}>{error}</div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button onClick={closeForm} className="btn btn-secondary">Cancelar</button>
                <button onClick={handleGenerate} className="btn btn-primary" disabled={generating}>
                  {generating ? <><span className="spinner" /> Gerando...</> : <><Sparkles size={16} /> Gerar com IA</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== RESULTADO ===== */}
      {result && (
        <div className="card" style={{ padding: 32, maxWidth: 700 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18 }}>Resultado</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {resultProvider === 'gemini' && <span className="badge" style={{ background: 'rgba(66,133,244,0.15)', color: '#4285F4' }}>Gemini</span>}
              {resultProvider === 'groq' && <span className="badge" style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>Groq (Llama 3)</span>}
              {resultProvider === 'groq-qwen' && <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>Qwen 3-32b</span>}
              {resultProvider === 'opencode' && <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>Qwen 3.5 Plus</span>}
              {resultProvider === 'saved' && <span className="badge" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>✓ Salvo</span>}
              {!resultProvider && <span className="badge badge-info">Rascunho</span>}
            </div>
          </div>
          <textarea className="input" value={editableResult} onChange={e => setEditableResult(e.target.value)}
            style={{ minHeight: 300, fontSize: 14, lineHeight: 1.7, padding: 16, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            {editingReportId && (
              <button onClick={handleDelete} className="btn btn-danger" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}>
                <Trash2 size={16} /> Excluir
              </button>
            )}
            <button onClick={resetAll} className="btn btn-secondary">Novo</button>
            <button onClick={handleCopy} className="btn btn-secondary">{copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar'}</button>
            <button onClick={handleExportTxt} className="btn btn-secondary"><FileDown size={16} /> TXT</button>
            <button onClick={handleExportDoc} className="btn btn-secondary"><FileDown size={16} /> DOC</button>
            <button onClick={handleSaveFinal} className="btn btn-primary" disabled={salvandoFinal} style={{ marginLeft: editingReportId ? 0 : 'auto' }}>
              {salvandoFinal ? <><span className="spinner" /> Salvando...</> : <><Check size={16} /> {editingReportId ? 'Atualizar' : 'Salvar como final'}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
