'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, FileText, Users, MessageSquare, Lightbulb, ClipboardCopy, Check, FileDown, Upload, Copy, Plus, ChevronRight, User, X, FileText as FileTextIcon, ArrowLeft, Calendar } from 'lucide-react'
import { getClasses, getClassStudents, getStudentObservations, saveAIReport, getAIReports, getDiaryEntries, getTeacher } from '@/lib/db'
import { useToast } from '@/lib/toast'
import { getTodayISO, formatDateBR, formatDateTimeBR } from '@/lib/dates'
import type { Class, Student, AIReport, Teacher } from '@/types'

const reportTypes = [
  { key: 'descriptive_report', label: 'Parecer Descritivo', desc: 'Gere relatórios individuais detalhados sobre cada aluno', icon: FileText, color: '#6366F1' },
  { key: 'class_council', label: 'Conselho de Classe', desc: 'Análise completa da turma por bimestre', icon: Users, color: '#8B5CF6' },
  { key: 'parent_meeting', label: 'Reunião de Pais', desc: 'Roteiro individual para conversa com responsáveis', icon: MessageSquare, color: '#06B6D4' },
  { key: 'pedagogical_suggestion', label: 'Sugestão Pedagógica', desc: 'Recomendações de atividades e intervenções', icon: Lightbulb, color: '#10B981' },
]

const BIMESTRES = [
  { key: '1', label: '1º Bimestre' },
  { key: '2', label: '2º Bimestre' },
  { key: '3', label: '3º Bimestre' },
  { key: '4', label: '4º Bimestre' },
]

export default function IAPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [editableResult, setEditableResult] = useState('')
  const [resultProvider, setResultProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [copiandoRegistros, setCopiandoRegistros] = useState(false)
  const [salvandoFinal, setSalvandoFinal] = useState(false)
  const [savedReports, setSavedReports] = useState<AIReport[]>([])
  const [copiado, setCopiado] = useState(false)
  const [importando, setImportando] = useState(false)
  const [importandoDiario, setImportandoDiario] = useState(false)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Parecer Descritivo states
  const [showStudentList, setShowStudentList] = useState(false)
  const [classStudents, setClassStudents] = useState<{ class: Class; students: Student[] }[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<{ student: Student; class: Class } | null>(null)
  const [studentReports, setStudentReports] = useState<AIReport[]>([])

  // Conselho de Classe states
  const [showBimesterList, setShowBimesterList] = useState(false)
  const [selectedBimester, setSelectedBimester] = useState<{ bimester: string; class: Class } | null>(null)
  const [bimesterReports, setBimesterReports] = useState<AIReport[]>([])

  // Generation form popup
  const [showGenForm, setShowGenForm] = useState(false)
  const [editingReport, setEditingReport] = useState<AIReport | null>(null)
  const [formData, setFormData] = useState({
    classId: '',
    className: '',
    studentId: '',
    studentName: '',
    bimester: '',
    periodStart: '',
    periodEnd: '',
    observations: '',
  })

  const isDescriptive = selected === 'descriptive_report'
  const isCouncil = selected === 'class_council'

  useEffect(() => {
    getClasses().then(data => {
      setClasses(data)
      if (data.length === 1) setFormData(prev => ({ ...prev, classId: data[0].id, className: data[0].name }))
    })
    getTeacher().then(data => setTeacher(data))
  }, [])



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

  function handleSelectDescriptive() {
    setSelected('descriptive_report')
    setShowStudentList(true)
    loadClassStudents()
  }

  function handleSelectCouncil() {
    setSelected('class_council')
    setShowBimesterList(true)
  }

  function handleSelectStudent(student: Student, cls: Class) {
    setSelectedStudent({ student, class: cls })
    setStudentReports([])
    getAIReports({ class_id: cls.id, student_id: student.id, type: 'descriptive_report' }).then(reports => {
      setStudentReports(reports)
    })
  }

  function handleSelectBimester(bimester: string, cls: Class) {
    setSelectedBimester({ bimester, class: cls })
    setBimesterReports([])
    getAIReports({ class_id: cls.id, type: 'class_council' }).then(reports => {
      setBimesterReports(reports.filter(r => {
        const ctx = r.prompt_context as any
        return ctx?.bimester === bimester
      }))
    })
  }

  function handleNovoParecer() {
    if (!selectedStudent) return
    setEditingReport(null)
    setFormData({
      classId: selectedStudent.class.id,
      className: selectedStudent.class.name,
      studentId: selectedStudent.student.id,
      studentName: selectedStudent.student.full_name,
      bimester: '',
      periodStart: '',
      periodEnd: '',
      observations: '',
    })
    setShowGenForm(true)
  }

  function handleNovoConselho() {
    if (!selectedBimester) return
    setEditingReport(null)
    const bim = BIMESTRES.find(b => b.key === selectedBimester.bimester)
    setFormData({
      classId: selectedBimester.class.id,
      className: selectedBimester.class.name,
      studentId: '',
      studentName: '',
      bimester: selectedBimester.bimester,
      periodStart: '',
      periodEnd: '',
      observations: '',
    })
    setShowGenForm(true)
  }

  function handleLoadReport(report: AIReport) {
    const ctx = report.prompt_context as any
    if (selectedStudent) {
      setEditingReport(report)
      const header = gerarCabecalho()
      const content = report.content.startsWith('PREFEITURA') ? report.content : `${header}\n\n${report.content}`
      setFormData({
        classId: selectedStudent.class.id,
        className: selectedStudent.class.name,
        studentId: selectedStudent.student.id,
        studentName: selectedStudent.student.full_name,
        bimester: '',
        periodStart: '',
        periodEnd: '',
        observations: content,
      })
    } else if (selectedBimester) {
      setEditingReport(report)
      const header = gerarCabecalho()
      const content = report.content.startsWith('PREFEITURA') ? report.content : `${header}\n\n${report.content}`
      setFormData({
        classId: selectedBimester.class.id,
        className: selectedBimester.class.name,
        studentId: '',
        studentName: '',
        bimester: ctx?.bimester || selectedBimester.bimester,
        periodStart: '',
        periodEnd: '',
        observations: content,
      })
    }
    setShowGenForm(true)
  }

  function closeStudentReports() {
    setSelectedStudent(null)
    setStudentReports([])
  }

  function closeBimesterReports() {
    setSelectedBimester(null)
    setBimesterReports([])
  }

  function closeGenForm() {
    setShowGenForm(false)
    setEditingReport(null)
    setImportandoDiario(false)
  }

  function closeStudentList() {
    setShowStudentList(false)
    setSelected(null)
    setClassStudents([])
  }

  function closeBimesterList() {
    setShowBimesterList(false)
    setSelected(null)
  }

  function formatDateInput(dateStr: string): string {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  function getPeriodLabel(): string {
    const { periodStart, periodEnd } = formData
    if (periodStart && periodEnd) return `${formatDateInput(periodStart)} a ${formatDateInput(periodEnd)}`
    if (periodStart) return `a partir de ${formatDateInput(periodStart)}`
    if (periodEnd) return `até ${formatDateInput(periodEnd)}`
    if (formData.bimester) {
      const bim = BIMESTRES.find(b => b.key === formData.bimester)
      return bim?.label || ''
    }
    return ''
  }

  function gerarCabecalho(): string {
    const schoolName = teacher?.school?.name || ''
    const schoolCity = teacher?.school?.city || 'Guarulhos'
    const schoolState = teacher?.school?.state || 'SP'
    const teacherName = teacher?.full_name || ''
    const studentName = formData.studentName || ''
    const className = formData.className || ''
    const period = getPeriodLabel()
    const formattedDate = formatDateBR(getTodayISO())

    let lines = ''
    lines += `PREFEITURA MUNICIPAL DE ${schoolCity.toUpperCase()}\n`
    lines += `SECRETARIA MUNICIPAL DE EDUCAÇÃO\n`
    if (schoolName) {
      lines += `EPG ${schoolName.toUpperCase()}\n`
    }
    lines += `\n`
    lines += `PARECER DESCRITIVO INDIVIDUAL\n`
    lines += `\n`
    if (studentName) lines += `Aluno(a): ${studentName}\n`
    if (className) lines += `Turma: ${className}\n`
    if (teacherName) lines += `Professor(a): ${teacherName}\n`
    lines += `Data: ${formattedDate}\n`
    if (period) lines += `Período: ${period}\n`
    lines += `Ano letivo: ${getTodayISO().split('-')[0]}\n`

    return lines
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/gemini/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selected,
          classId: formData.classId || undefined,
          className: formData.className,
          studentName: formData.studentName,
          period: getPeriodLabel(),
          observations: formData.observations,
        }),
      })

      if (res.status === 429) {
        const fallback = formData.observations || 'Nenhum conteúdo para exibir.'
        const contentWithHeader = fallback.startsWith('PREFEITURA') ? fallback : `${gerarCabecalho()}\n\n${fallback}`
        setResult(contentWithHeader)
        setEditableResult(contentWithHeader)
        setResultProvider(null)
        setShowGenForm(false)
        return
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar relatório')
      }

      const header = gerarCabecalho()
      const contentWithHeader = `${header}\n\n${data.content}`
      setResult(contentWithHeader)
      setEditableResult(contentWithHeader)
      setResultProvider(data.provider || null)
      setShowGenForm(false)
      if (isDescriptive) closeStudentReports()
      if (isCouncil) closeBimesterReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setGenerating(false)
    }
  }

  function resetForm() {
    setSelected(null)
    setResult(null)
    setEditableResult('')
    setResultProvider(null)
    setError(null)
    setShowStudentList(false)
    setClassStudents([])
    setSelectedStudent(null)
    setStudentReports([])
    setShowBimesterList(false)
    setSelectedBimester(null)
    setBimesterReports([])
    setShowGenForm(false)
    setEditingReport(null)
    setImportandoDiario(false)
    setFormData({ classId: '', className: '', studentId: '', studentName: '', bimester: '', periodStart: '', periodEnd: '', observations: '' })
  }

  const CATEGORY_LABELS: Record<string, string> = {
    behavior: 'Comportamento', difficulty: 'Dificuldade',
    evolution: 'Evolução', intervention: 'Intervenção', general: 'Geral',
  }
  const SEVERITY_LABELS: Record<string, string> = {
    info: 'Info', attention: 'Atenção', critical: 'Crítico',
  }

  async function copiarRegistros() {
    if (!formData.classId || !formData.studentId) return
    setCopiandoRegistros(true)
    try {
      const obs = await getStudentObservations(formData.studentId, formData.classId)
      const periodo = getPeriodLabel()
      const cabecalho = `Parecer Descritivo — ${formData.studentName}`
      const info = `Turma: ${formData.className}${periodo ? ' | Período: ' + periodo : ''}`

      if (obs.length === 0) {
        const template = `${cabecalho}\n${info}\n\nNenhum registro encontrado para este aluno no diário.\n\nSugestões:\n• Manter acompanhamento próximo.\n• Registrar observações no diário para gerar um parecer mais completo.`
        setFormData(prev => ({ ...prev, observations: template }))
        return
      }

      const linhas = obs.map(o => {
        const cat = CATEGORY_LABELS[o.category] || o.category
        const sev = o.severity ? SEVERITY_LABELS[o.severity] || o.severity : ''
        return `• [${formatDateBR(o.date)} - ${cat}]${sev ? ' (' + sev + ')' : ''} ${o.content}`
      }).join('\n')

      const template = `${cabecalho}\n${info}\n\nRegistros do aluno:\n${linhas}\n\nPróximos passos sugeridos:\n• Reforçar os conteúdos onde apresenta mais dificuldade.\n• Manter comunicação próxima com a família.\n• Acompanhar a evolução nas próximas semanas.`
      setFormData(prev => ({ ...prev, observations: template }))
    } catch {
      // silent
    } finally {
      setCopiandoRegistros(false)
    }
  }

  async function importarDiarioGeral() {
    if (!formData.classId) return
    setImportandoDiario(true)
    try {
      const entries = await getDiaryEntries(formData.classId)
      if (entries.length === 0) {
        toast('Nenhum registro encontrado no diário.', 'info')
        return
      }
      const linhas = entries.map(e => {
        const typeLabels: Record<string, string> = { general: 'Geral', activity: 'Atividade', incident: 'Ocorrência', achievement: 'Conquista' }
        const type = typeLabels[e.type] || e.type
        return `• [${formatDateBR(e.date)} - ${type}]${e.title ? ' ' + e.title + ': ' : ' '}${e.content}`
      }).join('\n')

      const cabecalho = `Conselho de Classe — ${formData.className}`
      const info = formData.bimester ? `Bimestre: ${BIMESTRES.find(b => b.key === formData.bimester)?.label}` : ''
      const template = `${cabecalho}\n${info}\n\nRegistros do diário:\n${linhas}`
      setFormData(prev => ({ ...prev, observations: (prev.observations ? prev.observations + '\n\n' : '') + template }))
      toast('Registros do diário importados!', 'success')
    } catch {
      toast('Erro ao importar registros do diário.', 'error')
    } finally {
      setImportandoDiario(false)
    }
  }

  function handleCopy() {
    let text = editableResult || formData.observations
    if (!text) return
    if (!text.startsWith('PREFEITURA')) {
      text = `${gerarCabecalho()}\n\n${text}`
    }
    navigator.clipboard.writeText(text)
    setCopiado(true)
    toast('Copiado!', 'success')
    setTimeout(() => setCopiado(false), 2000)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    try {
      const text = await file.text()
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'txt' || (text && text.length > 50 && text.includes(' '))) {
        setFormData(prev => ({ ...prev, observations: (prev.observations ? prev.observations + '\n\n' : '') + text }))
        toast('Arquivo importado!', 'success')
      } else {
        toast('Não foi possível extrair texto deste arquivo. Cole o conteúdo manualmente.', 'info')
      }
    } catch {
      toast('Erro ao ler arquivo. Tente copiar e colar o texto manualmente.', 'error')
    } finally {
      setImportando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function getExportCabecalho(): string {
    let extra = ''
    if (formData.studentName) extra += `Aluno: ${formData.studentName}\n`
    if (formData.bimester) {
      const bim = BIMESTRES.find(b => b.key === formData.bimester)
      extra += `Bimestre: ${bim?.label}\n`
    }
    return `${formData.className ? 'Turma: ' + formData.className + '\n' : ''}${extra}${getPeriodLabel() ? 'Período: ' + getPeriodLabel() + '\n' : ''}`
  }

  function getExportNome(): string {
    return (formData.studentName || formData.className || 'relatorio').replace(/\s+/g, '-').toLowerCase()
  }

  function getExportData(): string {
    return getTodayISO()
  }

  function handleExportTxt() {
    const text = editableResult || formData.observations
    if (!text) return
    const conteudo = text.startsWith('PREFEITURA') ? text : `${gerarCabecalho()}\n\n${text}`
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parecer-${getExportNome()}-${getExportData()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exportado como TXT!', 'success')
  }

  function handleExportDoc() {
    const text = editableResult || formData.observations
    if (!text) return
    const displayText = text.startsWith('PREFEITURA') ? text : `${gerarCabecalho()}\n\n${text}`
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Parecer Descritivo</title>
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
    a.download = `parecer-${getExportNome()}-${getExportData()}.doc`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exportado como DOC!', 'success')
  }

  async function handleSaveFinal() {
    let content = result || formData.observations
    if (!content) return
    if (!result && formData.observations) {
      content = `${gerarCabecalho()}\n\n${content}`
    }
    setSalvandoFinal(true)
    try {
      const saved = await saveAIReport({
        class_id: formData.classId || undefined,
        student_id: formData.studentId || undefined,
        type: selected || 'descriptive_report',
        content,
        prompt_context: {
          className: formData.className,
          studentName: formData.studentName,
          bimester: formData.bimester,
          period: getPeriodLabel(),
        },
      })
      setResultProvider('saved')
      if (result) {
        setSavedReports(prev => [saved, ...prev])
      } else {
        if (isDescriptive) setStudentReports(prev => [saved, ...prev])
        if (isCouncil) setBimesterReports(prev => [saved, ...prev])
      }
      toast('Relatório salvo com sucesso!', 'success')
      if (!result) {
        closeGenForm()
      }
    } catch {
      toast('Erro ao salvar relatório', 'error')
    } finally {
      setSalvandoFinal(false)
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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          <Sparkles size={24} style={{ display: 'inline', marginRight: 8, color: 'var(--primary)' }} />
          IA Pedagógica
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Gere relatórios e pareceres com inteligência artificial</p>
      </div>

      {/* ===== TIPOS DE RELATÓRIO ===== */}
      {!selected && !showStudentList && !showBimesterList && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {reportTypes.map(rt => {
            const Icon = rt.icon
            return (
              <button key={rt.key} onClick={() => rt.key === 'descriptive_report' ? handleSelectDescriptive() : rt.key === 'class_council' ? handleSelectCouncil() : setSelected(rt.key)} className="card card-interactive"
                style={{ padding: 24, textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--bg-surface)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: `${rt.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={24} color={rt.color} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{rt.label}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{rt.desc}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* ===== LISTA DE ALUNOS (Parecer Descritivo) ===== */}
      {showStudentList && !selectedStudent && !result && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={closeStudentList} className="btn btn-sm btn-ghost" style={{ padding: 8 }}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ fontSize: 18 }}>Parecer Descritivo — Alunos</h2>
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

      {/* ===== LISTA DE BIMESTRES (Conselho de Classe) ===== */}
      {showBimesterList && !selectedBimester && !result && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={closeBimesterList} className="btn btn-sm btn-ghost" style={{ padding: 8 }}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ fontSize: 18 }}>Conselho de Classe — Bimestres</h2>
          </div>
          {classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Nenhuma turma encontrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {classes.map(cls => (
                <div key={cls.id}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cls.name}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    {BIMESTRES.map(bim => (
                      <button key={bim.key} onClick={() => handleSelectBimester(bim.key, cls)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Calendar size={16} color="#fff" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{bim.label}</div>
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

      {/* ===== POPUP RELATÓRIOS DO ALUNO ===== */}
      {selectedStudent && !showGenForm && !result && (
        <div style={overlayStyle} onClick={closeStudentReports}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>{selectedStudent.student.full_name}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedStudent.class.name}</p>
              </div>
              <button onClick={closeStudentReports} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}>
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div style={modalBodyStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Relatórios gerados</h3>
                <button onClick={handleNovoParecer} className="btn btn-primary" style={{ fontSize: 13 }}>
                  <Plus size={16} /> Novo
                </button>
              </div>
              {studentReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>
                  <FileTextIcon size={32} style={{ marginBottom: 8, opacity: 0.3, color: 'var(--text-muted)' }} />
                  <p>Nenhum relatório gerado ainda.</p>
                  <button onClick={handleNovoParecer} className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>
                    <Plus size={16} /> Gerar primeiro parecer
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {studentReports.map(r => (
                    <button key={r.id} onClick={() => handleLoadReport(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileTextIcon size={18} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Parecer Descritivo</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateTimeBR(r.created_at)}</div>
                      </div>
                      <span className="badge" style={{
                        background: r.status === 'final' ? 'var(--success-light)' : 'var(--warning-light)',
                        color: r.status === 'final' ? 'var(--success)' : 'var(--warning)',
                        fontSize: 11,
                      }}>
                        {r.status === 'final' ? 'Final' : 'Rascunho'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== POPUP RELATÓRIOS DO BIMESTRE ===== */}
      {selectedBimester && !showGenForm && !result && (
        <div style={overlayStyle} onClick={closeBimesterReports}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>{BIMESTRES.find(b => b.key === selectedBimester.bimester)?.label}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedBimester.class.name}</p>
              </div>
              <button onClick={closeBimesterReports} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}>
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div style={modalBodyStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Relatórios gerados</h3>
                <button onClick={handleNovoConselho} className="btn btn-primary" style={{ fontSize: 13 }}>
                  <Plus size={16} /> Novo
                </button>
              </div>
              {bimesterReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>
                  <FileTextIcon size={32} style={{ marginBottom: 8, opacity: 0.3, color: 'var(--text-muted)' }} />
                  <p>Nenhum relatório gerado ainda.</p>
                  <button onClick={handleNovoConselho} className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>
                    <Plus size={16} /> Gerar primeiro conselho
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bimesterReports.map(r => (
                    <button key={r.id} onClick={() => handleLoadReport(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileTextIcon size={18} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Conselho de Classe</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateTimeBR(r.created_at)}</div>
                      </div>
                      <span className="badge" style={{
                        background: r.status === 'final' ? 'var(--success-light)' : 'var(--warning-light)',
                        color: r.status === 'final' ? 'var(--success)' : 'var(--warning)',
                        fontSize: 11,
                      }}>
                        {r.status === 'final' ? 'Final' : 'Rascunho'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== POPUP FORMULÁRIO DE GERAÇÃO ===== */}
      {showGenForm && !result && (
        <div style={overlayStyle} onClick={closeGenForm}>
          <div style={{ ...modalStyle, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editingReport ? (isDescriptive ? 'Editar Parecer' : 'Editar Conselho') : (isDescriptive ? 'Novo Parecer Descritivo' : 'Novo Conselho de Classe')}</h2>
              <button onClick={closeGenForm} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}>
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div style={{ ...modalBodyStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Turma</label>
                <input className="input" value={formData.className} readOnly style={{ background: 'var(--bg-secondary)' }} />
              </div>
              {isDescriptive && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Aluno</label>
                  <input className="input" value={formData.studentName} readOnly style={{ background: 'var(--bg-secondary)' }} />
                </div>
              )}
              {isCouncil && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Bimestre</label>
                  <input className="input" value={BIMESTRES.find(b => b.key === formData.bimester)?.label || ''} readOnly style={{ background: 'var(--bg-secondary)' }} />
                </div>
              )}
              {isDescriptive && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Período</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input" type="date" value={formData.periodStart} onChange={e => setFormData(prev => ({ ...prev, periodStart: e.target.value }))} style={{ flex: 1 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>a</span>
                    <input className="input" type="date" value={formData.periodEnd} onChange={e => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Observações adicionais (opcional)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importando} style={{ fontSize: 12 }}>
                    <Upload size={14} /> {importando ? '...' : 'Importar'}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleImportFile} style={{ display: 'none' }} />
                  {isDescriptive && formData.studentId && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={copiarRegistros} disabled={copiandoRegistros} style={{ fontSize: 12 }}>
                      <ClipboardCopy size={14} /> {copiandoRegistros ? '...' : 'Registros'}
                    </button>
                  )}
                  {isCouncil && formData.classId && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={importarDiarioGeral} disabled={importandoDiario} style={{ fontSize: 12 }}>
                      <ClipboardCopy size={14} /> {importandoDiario ? '...' : 'Diário Geral'}
                    </button>
                  )}
                </div>
                <textarea className="input" rows={4} placeholder={isDescriptive ? 'Informações relevantes sobre o aluno...' : 'Informações relevantes sobre a turma...'} value={formData.observations} onChange={e => setFormData(prev => ({ ...prev, observations: e.target.value }))} />
              </div>
              {error && (
                <div style={{ padding: 12, background: 'var(--danger-50)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--danger)' }}>{error}</div>
              )}
              {editingReport ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button onClick={closeGenForm} className="btn btn-secondary">Cancelar</button>
                  <button onClick={handleCopy} className="btn btn-secondary">{copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar'}</button>
                  <button onClick={handleExportTxt} className="btn btn-secondary"><FileDown size={16} /> TXT</button>
                  <button onClick={handleExportDoc} className="btn btn-secondary"><FileDown size={16} /> DOC</button>
                  <button onClick={handleSaveFinal} className="btn btn-primary" disabled={salvandoFinal} style={{ marginLeft: 'auto' }}>
                    {salvandoFinal ? <><span className="spinner" /> Salvando...</> : <><Check size={16} /> Salvar como final</>}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button onClick={closeGenForm} className="btn btn-secondary">Cancelar</button>
                  <button onClick={handleGenerate} className="btn btn-primary" disabled={generating}>
                    {generating ? <><span className="spinner" /> Gerando...</> : <><Sparkles size={16} /> Gerar com IA</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== FORMULÁRIO PARA OUTROS RELATÓRIOS ===== */}
      {selected && !isDescriptive && !isCouncil && !result && (
        <div className="card" style={{ padding: 32, maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={resetForm} className="btn btn-sm btn-ghost" style={{ padding: 8 }}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ fontSize: 18 }}>{reportTypes.find(r => r.key === selected)?.label}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Turma</label>
              <select className="input" value={formData.classId} onChange={e => {
                const c = classes.find(cl => cl.id === e.target.value)
                setFormData(prev => ({ ...prev, classId: e.target.value, className: c?.name || '' }))
              }}>
                <option value="">Selecione uma turma</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Observações adicionais (opcional)</label>
              <textarea className="input" rows={4} placeholder="Informações relevantes..." value={formData.observations} onChange={e => setFormData(prev => ({ ...prev, observations: e.target.value }))} />
            </div>
            {error && (
              <div style={{ padding: 12, background: 'var(--danger-50)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--danger)' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={resetForm} className="btn btn-secondary">Voltar</button>
              <button onClick={handleGenerate} className="btn btn-primary" disabled={generating}>
                {generating ? <><span className="spinner" /> Gerando...</> : <><Sparkles size={16} /> Gerar com IA</>}
              </button>
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
              {resultProvider === 'saved' && <span className="badge" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>✓ Salvo</span>}
              {!resultProvider && <span className="badge badge-info">Rascunho</span>}
            </div>
          </div>
          <textarea className="input" value={editableResult} onChange={e => setEditableResult(e.target.value)}
            style={{ minHeight: 300, fontSize: 14, lineHeight: 1.7, padding: 16, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <button onClick={resetForm} className="btn btn-secondary">Novo</button>
            <button onClick={handleCopy} className="btn btn-secondary">{copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar'}</button>
            <button onClick={handleExportTxt} className="btn btn-secondary"><FileDown size={16} /> TXT</button>
            <button onClick={handleExportDoc} className="btn btn-secondary"><FileDown size={16} /> DOC</button>
            <button onClick={handleSaveFinal} className="btn btn-primary" disabled={salvandoFinal} style={{ marginLeft: 'auto' }}>
              {salvandoFinal ? <><span className="spinner" /> Salvando...</> : <><Check size={16} /> Salvar como final</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
