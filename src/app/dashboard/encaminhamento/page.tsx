'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Check, Pencil, Save, ClipboardCopy, Copy, User, Users, FileText } from 'lucide-react'
import { getClasses, getClassStudents, saveAIReport } from '@/lib/db'
import { useToast } from '@/lib/toast'
import { REFERRAL_TYPES } from '@/types/database'
import type { Class, Student } from '@/types'

export default function EncaminhamentoPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [referralType, setReferralType] = useState('')
  const [observations, setObservations] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [editavel, setEditavel] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    getClasses().then(list => {
      setClasses(list)
      if (list.length === 1) setSelectedClassId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedClassId) {
      getClassStudents(selectedClassId).then(list => setStudents(list))
    } else {
      setStudents([])
    }
    setSelectedStudent(null)
  }, [selectedClassId])

  async function handleGenerate() {
    if (!selectedStudent || !referralType) {
      toast('Selecione um aluno e o tipo de encaminhamento', 'error')
      return
    }

    setGenerating(true)
    setResult(null)
    setEditando(false)

    try {
      const res = await fetch('/api/gemini/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.full_name,
          className: classes.find(c => c.id === selectedClassId)?.name,
          observations,
          referralType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar')

      setResult(data.content)
      setEditavel(data.content)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro inesperado', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!result || !selectedStudent || !selectedClassId) return
    setSaving(true)
    try {
      await saveAIReport({
        class_id: selectedClassId,
        student_id: selectedStudent.id,
        type: 'referral',
        content: editando ? editavel : result,
        prompt_context: { referralType },
      })
      toast('Encaminhamento salvo!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopiar() {
    const text = editando ? editavel : (result || '')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiado(true)
      toast('Copiado!', 'success')
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast('Erro ao copiar', 'error')
    }
  }

  const typeLabel = REFERRAL_TYPES.find(t => t.key === referralType)

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Encaminhamento</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Gere documentos de encaminhamento para avaliação profissional
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 24, maxWidth: 1000 }} className={result ? 'ref-grid' : ''}>
        <style jsx>{`
          @media (max-width: 768px) {
            .ref-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* Form */}
        <div className="card">
          {/* Turma */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Turma
            </label>
            <select className="input" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} style={{ fontSize: 16, minHeight: 44 }}>
              <option value="">Selecione...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Aluno */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              <User size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Aluno
            </label>
            <select
              className="input"
              value={selectedStudent?.id || ''}
              onChange={e => setSelectedStudent(students.find(s => s.id === e.target.value) || null)}
              disabled={!selectedClassId}
              style={{ fontSize: 16, minHeight: 44 }}
            >
              <option value="">Selecione...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>

          {/* Tipo de encaminhamento */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tipo de Encaminhamento
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REFERRAL_TYPES.map(t => (
                <label
                  key={t.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    background: referralType === t.key ? 'var(--primary-50)' : 'var(--bg-secondary)',
                    border: `1px solid ${referralType === t.key ? 'var(--primary)' : 'var(--border)'}`,
                    fontSize: 13, fontWeight: referralType === t.key ? 500 : 400,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <input
                    type="radio"
                    name="refType"
                    value={t.key}
                    checked={referralType === t.key}
                    onChange={e => setReferralType(e.target.value)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Observações (opcional)
            </label>
            <textarea
              className="input"
              rows={4}
              placeholder="Descreva comportamentos observados, dificuldades, estratégias já utilizadas..."
              value={observations}
              onChange={e => setObservations(e.target.value)}
              style={{ fontSize: 14, padding: 12, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <button
            onClick={handleGenerate}
            className="btn btn-primary"
            disabled={generating || !selectedStudent || !referralType}
            style={{ width: '100%' }}
          >
            {generating ? <><span className="spinner" /> Gerando...</> : <><Sparkles size={16} /> Gerar Encaminhamento</>}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--primary)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={20} color="white" />
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>Encaminhamento</h3>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  {selectedStudent?.full_name} — {typeLabel?.label}
                </span>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              {editando ? (
                <textarea
                  className="input"
                  value={editavel}
                  onChange={e => setEditavel(e.target.value)}
                  style={{ minHeight: 300, fontSize: 14, lineHeight: 1.6, padding: 12, resize: 'vertical', fontFamily: 'inherit' }}
                />
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{result}</div>
              )}
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 12 }}>
              {editando ? (
                <>
                  <button onClick={() => { setEditando(false); setEditavel(result) }} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                  <button onClick={() => { setResult(editavel); setEditando(false) }} className="btn btn-primary" style={{ flex: 1 }}><Save size={16} /> Salvar edição</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditando(true)} className="btn btn-secondary" style={{ flex: 1 }}><Pencil size={16} /> Editar</button>
                  <button onClick={handleCopiar} className="btn btn-primary" style={{ flex: 1 }}>
                    {copiado ? <><Check size={16} /> Copiado</> : <><ClipboardCopy size={16} /> Copiar</>}
                  </button>
                </>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />
            <div style={{ padding: 16, display: 'flex', gap: 12 }}>
              <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                {saving ? <><span className="spinner" /> Salvando...</> : <><Save size={16} /> Salvar no histórico</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
