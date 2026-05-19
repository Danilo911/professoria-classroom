'use client'

import { useState } from 'react'
import { Sparkles, FileText, Users, MessageSquare, Lightbulb } from 'lucide-react'

const reportTypes = [
  { key: 'descriptive_report', label: 'Parecer Descritivo', desc: 'Gere relatórios individuais detalhados sobre cada aluno', icon: FileText, color: '#6366F1' },
  { key: 'class_council', label: 'Conselho de Classe', desc: 'Análise completa da turma para apresentação', icon: Users, color: '#8B5CF6' },
  { key: 'parent_meeting', label: 'Reunião de Pais', desc: 'Roteiro individual para conversa com responsáveis', icon: MessageSquare, color: '#06B6D4' },
  { key: 'pedagogical_suggestion', label: 'Sugestão Pedagógica', desc: 'Recomendações de atividades e intervenções', icon: Lightbulb, color: '#10B981' },
]

export default function IAPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    className: '',
    studentName: '',
    period: '',
    observations: '',
  })

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/gemini/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selected,
          ...formData,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar relatório')
      }

      setResult(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setGenerating(false)
    }
  }

  function resetForm() {
    setSelected(null)
    setResult(null)
    setError(null)
    setFormData({ className: '', studentName: '', period: '', observations: '' })
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          <Sparkles size={24} style={{ display: 'inline', marginRight: 8, color: 'var(--primary)' }} />
          IA Pedagógica
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Gere relatórios e pareceres com inteligência artificial (Gemini Flash)</p>
      </div>

      {!selected ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {reportTypes.map(rt => {
            const Icon = rt.icon
            return (
              <button key={rt.key} onClick={() => setSelected(rt.key)} className="card card-interactive"
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
      ) : !result ? (
        <div className="card" style={{ padding: 32, maxWidth: 600 }}>
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>{reportTypes.find(r => r.key === selected)?.label}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Turma</label>
              <input
                className="input"
                placeholder="Ex: 1º Ano C"
                value={formData.className}
                onChange={e => setFormData(prev => ({ ...prev, className: e.target.value }))}
              />
            </div>
            {selected === 'descriptive_report' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Aluno</label>
                <input
                  className="input"
                  placeholder="Nome completo do aluno"
                  value={formData.studentName}
                  onChange={e => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Período</label>
              <input
                className="input"
                placeholder="Ex: 1º Bimestre"
                value={formData.period}
                onChange={e => setFormData(prev => ({ ...prev, period: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Observações adicionais (opcional)</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Informações relevantes sobre o aluno ou turma..."
                value={formData.observations}
                onChange={e => setFormData(prev => ({ ...prev, observations: e.target.value }))}
              />
            </div>
            {error && (
              <div style={{ padding: 12, background: 'var(--danger-50)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--danger)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={resetForm} className="btn btn-secondary">Voltar</button>
              <button onClick={handleGenerate} className="btn btn-primary" disabled={generating}>
                {generating ? <><span className="spinner" /> Gerando...</> : <><Sparkles size={16} /> Gerar com IA</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 32, maxWidth: 700 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18 }}>Resultado</h2>
            <span className="badge badge-info">Rascunho</span>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {result}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={resetForm} className="btn btn-secondary">Nova geração</button>
            <button className="btn btn-secondary">Editar</button>
            <button className="btn btn-primary">Salvar como final</button>
          </div>
        </div>
      )}
    </div>
  )
}
