'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Sparkles, Copy, Check, Pencil, Save, LogIn } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'
import { MicButton } from '@/components/ui/MicButton'
import { fileToBase64 } from '@/lib/file'
import { scheduleCorrection } from '@/lib/correctText'

const DAILY_LIMIT = 5

function getUsage(): { count: number; date: string } {
  if (typeof window === 'undefined') return { count: 0, date: '' }
  const date = localStorage.getItem('gier_date') || ''
  const today = new Date().toISOString().split('T')[0]
  if (date !== today) {
    localStorage.setItem('gier_date', today)
    localStorage.setItem('gier_count', '0')
    return { count: 0, date: today }
  }
  return { count: Number(localStorage.getItem('gier_count') || 0), date }
}

function incrementUsage() {
  const { count, date } = getUsage()
  localStorage.setItem('gier_count', String(count + 1))
}

export default function GierPublicPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [descricao, setDescricao] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ text: string; component: string; skill: string; description: string } | null>(null)
  const [editando, setEditando] = useState(false)
  const [descEditavel, setDescEditavel] = useState('')
  const [copiado, setCopiado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [usage, setUsage] = useState({ count: 0, date: '' })

  useEffect(() => {
    setUsage(getUsage())
  }, [])

  function cleanSpeech(raw: string): string {
    let text = raw.trim()
    if (!text) return text
    text = text.charAt(0).toUpperCase() + text.slice(1)
    if (!/[.!?]$/.test(text)) text += '.'
    return text
  }

  const descricaoSpeech = useSpeechRecognition(
    (text) => {
      const cleaned = cleanSpeech(text)
      setDescricao(prev => {
        const updated = prev ? prev + ' ' + cleaned : cleaned
        scheduleCorrection(updated, (corrected) => {
          setDescricao(p => p === updated ? corrected : p)
        })
        return updated
      })
    },
    (err) => toast(err, 'error'),
  )

  async function handleFile(f: File) {
    setFile(f)
    setResult(null)
    setError(null)
    setEditando(false)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  async function handleProcess() {
    if (!file && !descricao.trim()) { toast('Adicione uma imagem ou descreva a atividade', 'error'); return }
    if (file && !file.type.startsWith('image/')) { toast('Envie apenas imagens', 'error'); return }

    const current = getUsage()
    if (current.count >= DAILY_LIMIT) {
      toast('Limite diário atingido! Crie uma conta gratuita para continuar.', 'error')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const body: any = {}
      if (descricao.trim()) body.textDescription = descricao.trim()
      if (file) {
        const base64 = await fileToBase64(file)
        body.imageBase64 = base64.split(',')[1]
        body.mimeType = file.type
      }
      const res = await fetch('/api/gier/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao analisar atividade')
      }

      setResult({
        text: data.extractedText || 'Texto extraído com sucesso',
        component: data.component,
        skill: data.skill,
        description: data.description,
      })
      setDescEditavel(data.description)
      incrementUsage()
      setUsage(getUsage())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setProcessing(false)
    }
  }

  function handleEditar() {
    setEditando(true)
  }

  function handleCancelarEdicao() {
    setEditando(false)
    if (result) setDescEditavel(result.description)
  }

  function handleSalvarEdicao() {
    setResult(prev => prev ? { ...prev, description: descEditavel } : null)
    setEditando(false)
    toast('Descrição atualizada!', 'success')
  }

  async function handleCopiar() {
    const text = editando ? descEditavel : (result?.description || '')
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

  const limitReached = usage.count >= DAILY_LIMIT

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <a href="/gier" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 14,
          }}>P</div>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Professor<span style={{ color: 'var(--primary)' }}>IA</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13, marginLeft: 8 }}>GIER</span>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {DAILY_LIMIT - usage.count}/{DAILY_LIMIT} hoje
          </span>
          <a href="/login" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-sm">
              <LogIn size={14} /> Entrar
            </button>
          </a>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 600 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Gerador GIER</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>
            Transforme suas atividades em descrições pedagógicas prontas para o GIER.
            {!limitReached && <span> {DAILY_LIMIT} gerações gratuitas por dia.</span>}
          </p>
        </div>

        {limitReached && !result && (
          <div style={{
            background: 'var(--warning-light)', border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 500, width: '100%',
            textAlign: 'center', marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 16, marginBottom: 8, color: '#92400E' }}>Limite diário atingido</h3>
            <p style={{ fontSize: 14, color: '#92400E', marginBottom: 16 }}>
              Você usou todas as {DAILY_LIMIT} gerações gratuitas de hoje.
              Crie uma conta gratuita para continuar gerando.
            </p>
            <a href="/login">
              <button className="btn btn-primary">
                <LogIn size={16} /> Criar conta gratuita
              </button>
            </a>
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr',
          gap: 24, maxWidth: 1000, width: '100%',
        }}>
          {/* Upload Area */}
          <div>
            {/* Descrição da atividade */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Descrição da atividade (opcional)
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Descreva a atividade aplicada para ajudar a IA..."
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  disabled={limitReached}
                  style={{ fontSize: 14, padding: 12, paddingRight: 40, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <MicButton
                  status={descricaoSpeech.status}
                  onToggle={descricaoSpeech.toggleListening}
                  disabled={limitReached}
                  size={30}
                  titles={{ loading: 'Carregando...', listening: 'Parar', idle: 'Gravar por voz' }}
                  style={{ position: 'absolute', right: 6, bottom: 6 }}
                />
              </div>
            </div>

            <div onClick={() => !limitReached && fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 'var(--radius-xl)', padding: 48,
                textAlign: 'center', cursor: limitReached ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
                background: file ? 'var(--bg-secondary)' : limitReached ? 'var(--bg-secondary)' : 'transparent',
                opacity: limitReached ? 0.5 : 1,
              }}
              onDragOver={e => { if (!limitReached) { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)' } }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              onDrop={e => { if (!limitReached) { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) } }}>
              <input ref={fileRef} type="file" accept="image/*" hidden disabled={limitReached} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              {!file ? (
                <>
                  <Upload size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                  <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Arraste ou clique para enviar</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Imagens (JPEG, PNG, WebP) · Máx 20MB</p>
                </>
              ) : (
                <>
                  {preview ? <img src={preview} alt="Preview" style={{ maxHeight: 200, borderRadius: 'var(--radius-md)', marginBottom: 12, maxWidth: '100%' }} /> : null}
                  <p style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{file.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </>
              )}
            </div>

            {(file || descricao.trim()) && !limitReached && (
              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                {file && <button onClick={() => { setFile(null); setPreview(null); setResult(null); setError(null); setEditando(false) }} className="btn btn-secondary">Trocar arquivo</button>}
                {!file && <button onClick={() => { setDescricao(''); setResult(null); setError(null) }} className="btn btn-secondary">Limpar</button>}
                <button onClick={handleProcess} className="btn btn-primary" disabled={processing} style={{ flex: 1 }}>
                  {processing ? <><span className="spinner" /> Processando...</> : <><Sparkles size={16} /> Analisar com IA</>}
                </button>
              </div>
            )}

            {error && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--danger)' }}>
                {error}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16, fontWeight: 600 }}>Resultado da Análise</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Texto Extraído</label>
                  <p style={{ fontSize: 13, background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)', marginTop: 6, lineHeight: 1.5 }}>{result.text}</p>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Componente Curricular</label>
                  <p style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{result.component}</p>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Habilidade QSN</label>
                  <p style={{ fontSize: 14, marginTop: 4 }}>{result.skill}</p>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Descrição para GIER</label>
                  {editando ? (
                    <textarea
                      className="input"
                      value={descEditavel}
                      onChange={e => setDescEditavel(e.target.value)}
                      style={{ minHeight: 150, fontSize: 14, lineHeight: 1.6, padding: 12, marginTop: 6, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  ) : (
                    <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-md)', marginTop: 6, border: '1px solid var(--border)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{result.description}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {editando ? (
                    <>
                      <button onClick={handleCancelarEdicao} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                      <button onClick={handleSalvarEdicao} className="btn btn-primary" style={{ flex: 1 }}><Save size={16} /> Salvar</button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleEditar} className="btn btn-secondary" style={{ flex: 1 }}><Pencil size={16} /> Editar</button>
                      <button onClick={handleCopiar} className="btn btn-primary" style={{ flex: 1 }}>
                        {copiado ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar descrição</>}
                      </button>
                    </>
                  )}
                </div>

                {/* CTA for account */}
                <div style={{
                  marginTop: 8, padding: 16, background: 'var(--primary-50)',
                  borderRadius: 'var(--radius-lg)', textAlign: 'center',
                  border: '1px solid var(--primary-100)',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>
                    Gostou? Salve seus GIERs com uma conta gratuita!
                  </p>
                  <a href="/login">
                    <button className="btn btn-primary btn-sm">
                      <LogIn size={14} /> Criar conta grátis
                    </button>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '16px 24px',
        borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13,
      }}>
        ProfessorIA Classroom &copy; 2026 &middot;{' '}
        <a href="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Acessar plataforma completa</a>
      </footer>
    </div>
  )
}
