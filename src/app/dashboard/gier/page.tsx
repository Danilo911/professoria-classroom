'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Image, File, Sparkles } from 'lucide-react'

export default function GierPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ text: string; component: string; skill: string; description: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    setResult(null)
    setError(null)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  async function handleProcess() {
    if (!file) return
    setProcessing(true)
    setError(null)

    try {
      let payload: { imageBase64?: string; mimeType?: string; textDescription?: string } = {}

      if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file)
        const cleanBase64 = base64.split(',')[1]
        payload = { imageBase64: cleanBase64, mimeType: file.type }
      } else {
        payload = { textDescription: `Arquivo enviado: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(0)}KB). Analise e identifique o componente curricular, habilidade BNCC e descrição pedagógica.` }
      }

      const res = await fetch('/api/gemini/gier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao analisar atividade')
      }

      setResult({
        text: data.extractedText || 'Texto não extraído (arquivo não é imagem)',
        component: data.component,
        skill: data.skill,
        description: data.description,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setProcessing(false)
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

  const getIcon = (type?: string) => {
    if (type?.startsWith('image/')) return <Image size={20} color="#8B5CF6" />
    if (type?.includes('pdf')) return <FileText size={20} color="#EF4444" />
    return <File size={20} color="#6366F1" />
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Gerador GIER</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Envie uma atividade e a IA (Gemini Flash) gera a descrição para o GIER</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 24, maxWidth: 1000 }}>
        {/* Upload Area */}
        <div>
          <div onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-xl)', padding: 48, textAlign: 'center', cursor: 'pointer', transition: 'all var(--transition-fast)', background: file ? 'var(--primary-50)' : 'transparent' }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}>
            <input ref={fileRef} type="file" accept="image/*,.pdf,.docx" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            {!file ? (
              <>
                <Upload size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Arraste ou clique para enviar</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Imagens, PDFs ou DOCX · Máx 20MB</p>
              </>
            ) : (
              <>
                {preview ? <img src={preview} alt="Preview" style={{ maxHeight: 200, borderRadius: 'var(--radius-md)', marginBottom: 12, maxWidth: '100%' }} /> : getIcon(file.type)}
                <p style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </>
            )}
          </div>

          {file && (
            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <button onClick={() => { setFile(null); setPreview(null); setResult(null); setError(null) }} className="btn btn-secondary">Trocar arquivo</button>
              <button onClick={handleProcess} className="btn btn-primary" disabled={processing} style={{ flex: 1 }}>
                {processing ? <><span className="spinner" /> Processando...</> : <><Sparkles size={16} /> Analisar com IA</>}
              </button>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--danger-50)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--danger)' }}>
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
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Texto Extraído (OCR)</label>
                <p style={{ fontSize: 13, background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)', marginTop: 6, lineHeight: 1.5 }}>{result.text}</p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Componente Curricular</label>
                <p style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{result.component}</p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Habilidade BNCC</label>
                <p style={{ fontSize: 14, marginTop: 4 }}>{result.skill}</p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Descrição para GIER</label>
                <div style={{ background: 'var(--primary-50)', padding: 16, borderRadius: 'var(--radius-md)', marginTop: 6, border: '1px solid var(--primary-100)', fontSize: 14, lineHeight: 1.6 }}>{result.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }}>Editar</button>
                <button className="btn btn-primary" style={{ flex: 1 }}>Copiar descrição</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
