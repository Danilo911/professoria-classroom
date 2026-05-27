'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Clock, Save } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { getClasses, saveGierSubmission } from '@/lib/db'
import { getTodayISO } from '@/lib/dates'
import GierAnalyzer from '@/components/gier/GierAnalyzer'
import type { GierResult } from '@/components/gier/GierAnalyzer'

export default function GierPage() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [activityDate, setActivityDate] = useState(getTodayISO())
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    getClasses().then(list => {
      const mapped = list.map(c => ({ id: c.id, name: c.name }))
      setClasses(mapped)
      if (mapped.length === 1) setSelectedClassId(mapped[0].id)
    }).catch(() => toast('Erro ao carregar turmas', 'error'))
  }, [toast])

  async function handleSave(result: GierResult, description: string) {
    if (!selectedClassId) { toast('Selecione uma turma', 'error'); return }
    if (!activityDate) { toast('Selecione a data da atividade', 'error'); return }
    setSaving(true)
    try {
      await saveGierSubmission({
        class_id: selectedClassId,
        gier_description: description,
        ocr_extracted_text: result.text,
        ai_interpretation: {
          component: result.component,
          ute: result.ute,
          saber: result.saber,
          apr: result.apr,
          description,
        },
        activity_date: activityDate,
      })
      toast('GIER salvo com sucesso!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Gerador GIER</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Envie uma atividade e a IA gera a descrição para o GIER</p>
        </div>
        <a href="/dashboard/gier/historico">
          <button className="btn btn-secondary btn-sm"><Clock size={16} /> Histórico</button>
        </a>
      </div>

      <div style={{
        background: 'var(--primary-50)', border: '1px solid var(--primary-100)',
        borderRadius: 'var(--radius-lg)', padding: '10px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 13, flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ color: 'var(--text-primary)' }}>
          ⚡ Quer usar o GIER sem criar conta?
        </span>
        <a href="/gier" target="_blank" style={{ textDecoration: 'none' }}>
          <button className="btn btn-primary btn-sm">
            <ExternalLink size={14} /> Versão gratuita
          </button>
        </a>
      </div>

      <GierAnalyzer
        apiEndpoint="/api/gemini/gier"
        resultExtras={(result, descEditavel, editando) => (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />
            <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Turma</label>
                  {classes.length <= 1 && selectedClassId ? (
                    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', padding: '8px 0', display: 'block' }}>
                      {classes.find(c => c.id === selectedClassId)?.name}
                    </span>
                  ) : (
                    <select className="input" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} style={{ fontSize: 16, minHeight: 44 }}>
                      <option value="">Selecione...</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Data da atividade</label>
                  <input type="date" className="input" value={activityDate} onChange={e => setActivityDate(e.target.value)} style={{ fontSize: 16, minHeight: 44 }} />
                </div>
              </div>
              <button onClick={() => handleSave(result, editando ? descEditavel : result.description)} className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
                {saving ? <><span className="spinner" /> Salvando...</> : <><Save size={16} /> Salvar</>}
              </button>
            </div>
          </>
        )}
      />
    </div>
  )
}
