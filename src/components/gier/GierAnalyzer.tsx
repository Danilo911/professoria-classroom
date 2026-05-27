'use client'

import { useState, useRef } from 'react'
import { Upload, Sparkles, Copy, Check, Pencil, Save, Camera } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'
import { MicButton } from '@/components/ui/MicButton'
import { fileToBase64 } from '@/lib/file'

export type GierResult = {
  text: string
  component: string
  ute: string
  saber: string
  apr: string
  description: string
}

interface GierAnalyzerProps {
  apiEndpoint: string
  disabled?: boolean
  /** Called before processing — return false to cancel */
  onBeforeProcess?: () => boolean | Promise<boolean>
  /** Called after processing succeeds */
  onAfterProcess?: () => void
  /** Extra UI abaixo dos botões de ação do resultado (editar/copiar) */
  resultExtras?: (result: GierResult, description: string, editando: boolean) => React.ReactNode
  /** Conteúdo extra no topo (ex: aviso da versão gratuita) */
  headerExtras?: React.ReactNode
}

export default function GierAnalyzer({
  apiEndpoint,
  disabled = false,
  onBeforeProcess,
  onAfterProcess,
  resultExtras,
  headerExtras,
}: GierAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [descricao, setDescricao] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GierResult | null>(null)
  const [editando, setEditando] = useState(false)
  const [descEditavel, setDescEditavel] = useState('')
  const [copiado, setCopiado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

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
      setDescricao(prev => (prev ? prev + ' ' + cleaned : cleaned))
    },
    (err) => toast(err, 'error'),
  )

  function handleFile(f: File) {
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

    if (onBeforeProcess) {
      const shouldProceed = await onBeforeProcess()
      if (!shouldProceed) return
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
      const res = await fetch(apiEndpoint, {
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
        ute: data.ute,
        saber: data.saber,
        apr: data.apr,
        description: data.description,
      })
      setDescEditavel(data.description)
      onAfterProcess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setProcessing(false)
    }
  }

  function handleEditar() { setEditando(true) }

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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: result ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: 20, maxWidth: 1000 }}>
      <style jsx>{`
        @media (max-width: 768px) {
          div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Upload Area */}
      <div>
        {headerExtras}

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
              disabled={disabled}
              style={{ fontSize: 14, padding: 12, paddingRight: 40, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <MicButton
              status={descricaoSpeech.status}
              onToggle={descricaoSpeech.toggleListening}
              disabled={disabled}
              size={30}
              titles={{ loading: 'Carregando...', listening: 'Parar', idle: 'Gravar por voz' }}
              style={{ position: 'absolute', right: 6, bottom: 6 }}
            />
          </div>
        </div>

        <div onClick={() => !disabled && fileRef.current?.click()}
          style={{
            border: '2px dashed var(--border)', borderRadius: 'var(--radius-xl)',
            padding: 'clamp(24px, 5vw, 48px)', textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all var(--transition-fast)',
            background: file ? 'var(--bg-secondary)' : disabled ? 'var(--bg-secondary)' : 'transparent',
            opacity: disabled ? 0.5 : 1,
          }}
          onDragOver={e => { if (!disabled) { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)' } }}
          onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' } }
          onDrop={e => { if (!disabled) { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) } }}>
          <div>
            <input ref={fileRef} type="file" accept="image/*" hidden disabled={disabled} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />

            {!file ? (
              <>
                <Upload size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Arraste ou clique para enviar</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Imagens (JPEG, PNG, WebP) · Máx 20MB</p>
                <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); fileRef.current?.click() }} className="btn btn-secondary btn-sm"><Upload size={14} /> Galeria</button>
                  <button onClick={e => { e.stopPropagation(); cameraRef.current?.click() }} className="btn btn-secondary btn-sm"><Camera size={14} /> Câmera</button>
                </div>
              </>
            ) : (
              <>
                {preview ? <img src={preview} alt="Preview" style={{ maxHeight: 200, borderRadius: 'var(--radius-md)', marginBottom: 12, maxWidth: '100%' }} /> : null}
                <p style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </>
            )}
          </div>
        </div>

        {(file || descricao.trim()) && !disabled && (
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
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: 'var(--primary)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Sparkles size={20} color="white" />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>Resultado da Análise</h3>
          </div>

          {/* Texto Extraído */}
          <div style={{ padding: '16px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Texto Extraído</label>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{result.text}</p>
          </div>

          {/* Card: Componente + Eixo + Habilidade + Objeto de Conhecimento */}
          <div style={{ margin: '16px 24px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--primary-50)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1 }}>Componente Curricular</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', margin: '4px 0 0 0' }}>{result.component}</p>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Eixo</span>
              <p style={{ fontSize: 14, fontWeight: 500, margin: '4px 0 0 0', lineHeight: 1.5 }}>{result.ute}</p>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Habilidade</span>
              <p style={{ fontSize: 14, margin: '4px 0 0 0', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{result.saber}</p>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: '12px 16px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Objeto de Conhecimento</span>
              <p style={{ fontSize: 14, margin: '4px 0 0 0', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{result.apr}</p>
            </div>
          </div>

          {/* Descrição para GIER */}
          <div style={{ padding: '0 24px 16px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Descrição para GIER</label>
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

          {/* Action buttons */}
          <div style={{ padding: '0 24px 24px', display: 'flex', gap: 12 }}>
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

          {/* Extras — ex: seletor de turma + salvar (dashboard) ou CTA login (público) */}
          {resultExtras?.(result, descEditavel, editando)}
        </div>
      )}
    </div>
  )
}
