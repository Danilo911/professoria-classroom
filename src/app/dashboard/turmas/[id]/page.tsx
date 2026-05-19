'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Upload, FileUp, User } from 'lucide-react'
import { getClassStudents, removeStudent, getClasses } from '@/lib/db'
import { useToast } from '@/lib/toast'
import type { Student, Class } from '@/types'

export default function ClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { toast } = useToast()

  const [turma, setTurma] = useState<Class | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [importText, setImportText] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      getClasses().then(all => all.find(c => c.id === id)),
      getClassStudents(id),
    ]).then(([t, s]) => {
      setTurma(t || null)
      setStudents(s)
      setLoading(false)
    })
  }, [id])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/alunos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: id, fullName: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar')
      const student: Student = data
      setStudents(prev => [...prev, student])
      setNewName('')
      setShowAdd(false)
      toast(`Aluno(a) adicionado(a)!`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao adicionar aluno', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(studentId: string, studentName: string) {
    if (!confirm(`Remover ${studentName} da turma?`)) return
    try {
      await removeStudent(studentId, id)
      setStudents(prev => prev.filter(s => s.id !== studentId))
      toast('Aluno removido', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao remover aluno', 'error')
    }
  }

  async function handleImport() {
    const names = importText.split('\n').map(n => n.trim()).filter(Boolean)
    if (names.length === 0) return
    setSaving(true)
    let added = 0
    for (const name of names) {
      try {
        const res = await fetch('/api/alunos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId: id, fullName: name }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao adicionar')
        const student: Student = data
        setStudents(prev => [...prev, student])
        added++
      } catch (err) {
        toast(`Erro ao adicionar "${name}": ${err instanceof Error ? err.message : 'erro'}`, 'error')
      }
    }
    setSaving(false)
    setImportText('')
    setShowImport(false)
    toast(`${added} aluno(s) importado(s) com sucesso!`, 'success')
  }

  const importNames = importText.split('\n').map(n => n.trim()).filter(Boolean)

  async function handleFile(file: File) {
    setImportFile(file)
    try {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      await new Promise((resolve, reject) => {
        reader.onload = resolve
        reader.onerror = reject
      })
      const dataUrl = reader.result as string
      const fileBase64 = dataUrl.split(',')[1]

      const res = await fetch('/api/planilha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, fileName: file.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar')
      const names: string[] = data.names
      setImportText(names.join('\n'))
      toast(`${names.length} aluno(s) encontrados!`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao ler planilha', 'error')
    }
  }

  function extractNamesFromPaste(text: string): string {
    const lines = text.split('\n')
    const names = lines.filter(line => {
      const t = line.trim()
      if (!t) return false
      if (/^\d+$/.test(t)) return false
      if (/^(A\.D\.|AD|P|F|C|Entr\.|Saída|Data)$/i.test(t)) return false
      if (t.length < 6) return false
      if (!/\s/.test(t)) return false
      if (!/^[A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]/.test(t)) return false
      return true
    })
    return names.join('\n')
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
  }

  if (!turma) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Turma não encontrada</h2>
        <button onClick={() => router.push('/dashboard/turmas')} className="btn btn-primary">Voltar</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/dashboard/turmas')} className="btn btn-icon btn-ghost">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 2 }}>{turma.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {turma.grade} — {turma.period === 'manha' ? 'Manhã' : turma.period === 'tarde' ? 'Tarde' : 'Integral'} — {turma.year}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{students.length} alunos</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImport(true)} className="btn btn-secondary">
            <Upload size={18} /> Importar lista
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            <Plus size={18} /> Adicionar aluno
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <User size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Nenhum aluno cadastrado nesta turma.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setShowImport(true)} className="btn btn-secondary">
              <Upload size={18} /> Importar lista
            </button>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary">
              <Plus size={18} /> Adicionar primeiro aluno
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map((student, index) => (
            <div key={student.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14,
                }}>
                  {index + 1}
                </div>
                <span style={{ fontWeight: 500 }}>{student.full_name}</span>
              </div>
              <button onClick={() => handleRemove(student.id, student.full_name)} className="btn btn-icon btn-ghost" style={{ color: 'var(--danger)' }} title="Remover">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={() => setShowAdd(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, marginBottom: 20 }}>Adicionar Aluno</h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Nome completo</label>
                <input className="input" placeholder="Nome do aluno" value={newName} required autoFocus
                  onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !newName.trim()}>
                  {saving ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={() => { if (!saving) { setShowImport(false); setImportText(''); setImportFile(null) } }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 32 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Importar Alunos</h2>

            {/* Upload planilha */}
            <div style={{ marginBottom: 16, marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Faça upload da planilha de frequência (.xls ou .xlsx):
              </p>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              <button onClick={() => fileRef.current?.click()} className="btn btn-secondary" style={{ width: '100%' }} disabled={saving}>
                <FileUp size={18} /> {importFile ? importFile.name : 'Selecionar planilha'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ou cole os dados copiados do GIER</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <textarea
              className="input" rows={6}
              placeholder={`Copie os dados da página do GIER e cole aqui,\ndepois clique em "Extrair nomes"`}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
              disabled={saving}
            />
            {importText.trim() && (
              <button onClick={() => setImportText(extractNamesFromPaste(importText))}
                className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>
                Extrair nomes
              </button>
            )}
            {importNames.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                {importNames.length} aluno(s) serão importados
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowImport(false); setImportText(''); setImportFile(null) }} disabled={saving}>
                Cancelar
              </button>
              <button onClick={handleImport} className="btn btn-primary" disabled={saving || importNames.length === 0}>
                {saving ? `Importando...` : `Importar ${importNames.length > 0 ? importNames.length : ''}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
