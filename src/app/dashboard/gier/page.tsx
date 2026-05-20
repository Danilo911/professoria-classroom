'use client'

import { useState, useRef } from 'react'
import { Upload, Sparkles, Copy, Check, Pencil, Save, Mic, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'

export default function GierPage() {
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

  const descricaoSpeech = useSpeechRecognition(
    (text) => setDescricao(prev => prev ? prev + ' ' + text : text),
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
      const res = await fetch('/api/gemini/gier', {
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

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const getIcon = () => null

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Gerador GIER</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Envie uma atividade e a IA gera a descrição para o GIER</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 24, maxWidth: 1000 }}>
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
                style={{ fontSize: 14, padding: 12, paddingRight: 40, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button type="button" onClick={descricaoSpeech.toggleListening} disabled={descricaoSpeech.status === 'loading'}
                style={{
                  position: 'absolute', right: 6, bottom: 6, width: 30, height: 30,
                  borderRadius: 6, border: 'none', cursor: descricaoSpeech.status === 'loading' ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: descricaoSpeech.status === 'listening' ? 'var(--danger)' : descricaoSpeech.status === 'loading' ? 'var(--warning)' : 'transparent',
                  color: descricaoSpeech.status === 'listening' ? 'white' : descricaoSpeech.status === 'loading' ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
                title={descricaoSpeech.status === 'loading' ? 'Carregando...' : descricaoSpeech.status === 'listening' ? 'Parar' : 'Gravar por voz'}>
                {descricaoSpeech.status === 'loading' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Mic size={14} />}
              </button>
            </div>
          </div>

          <div onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-xl)', padding: 48, textAlign: 'center', cursor: 'pointer', transition: 'all var(--transition-fast)', background: file ? 'var(--bg-secondary)' : 'transparent' }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            {!file ? (
              <>
                <Upload size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Arraste ou clique para enviar</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Imagens (JPEG, PNG, WebP) · Máx 20MB</p>
              </>
            ) : (
              <>
                {preview ? <img src={preview} alt="Preview" style={{ maxHeight: 200, borderRadius: 'var(--radius-md)', marginBottom: 12, maxWidth: '100%' }} /> : getIcon()}
                <p style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </>
            )}
          </div>

          {(file || descricao.trim()) && (
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
