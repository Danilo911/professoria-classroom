'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Check, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getTeacher, updateTeacher, upsertSchool } from '@/lib/db'
import { useToast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { Teacher } from '@/types'

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { toast } = useToast()
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    school_name: '',
    school_city: '',
    school_state: '',
    school_network: 'municipal',
  })

  useEffect(() => {
    getTeacher().then(data => {
      if (data) {
        setTeacher(data)
        setForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
          school_name: data.school?.name || '',
          school_city: data.school?.city || 'Guarulhos',
          school_state: data.school?.state || 'SP',
          school_network: data.school?.network || 'municipal',
        })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await updateTeacher({ full_name: form.full_name, phone: form.phone })
      if (form.school_name) {
        await upsertSchool({
          name: form.school_name,
          city: form.school_city,
          state: form.school_state,
          network: form.school_network,
        })
      }
      setSaved(true)
      toast('Configurações salvas!', 'success')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Configurações</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        {/* Perfil */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Perfil</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Nome completo</label>
              <input className="input" value={form.full_name}
                onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>E-mail</label>
              <input className="input" value={teacher?.email || ''} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Telefone</label>
              <input className="input" placeholder="(11) 99999-9999" value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Escola */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Escola</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Nome da escola</label>
              <input className="input" placeholder="EMEF Professor" value={form.school_name}
                onChange={e => setForm(prev => ({ ...prev, school_name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Cidade</label>
                <input className="input" value={form.school_city}
                  onChange={e => setForm(prev => ({ ...prev, school_city: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Estado</label>
                <input className="input" value={form.school_state} maxLength={2} style={{ textTransform: 'uppercase' }}
                  onChange={e => setForm(prev => ({ ...prev, school_state: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Rede</label>
              <select className="input" value={form.school_network}
                onChange={e => setForm(prev => ({ ...prev, school_network: e.target.value }))}>
                <option value="municipal">Municipal</option>
                <option value="estadual">Estadual</option>
                <option value="federal">Federal</option>
                <option value="particular">Particular</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tema */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Aparência</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            {themeOptions.map(opt => {
              const Icon = opt.icon
              const isActive = theme === opt.value
              return (
                <button key={opt.value} onClick={() => setTheme(opt.value)}
                  className="card card-interactive"
                  style={{
                    flex: 1, padding: 16, cursor: 'pointer', border: isActive ? '2px solid var(--primary)' : '2px solid var(--border)',
                    background: isActive ? 'var(--primary-50)' : 'transparent', textAlign: 'center',
                  }}>
                  <Icon size={24} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 8px' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Plano */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Plano</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, textTransform: 'capitalize' }}>
                {teacher?.subscription_plan === 'free' ? 'Plano Gratuito' : teacher?.subscription_plan === 'premium' ? 'Premium' : 'Escola'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Funcionalidades básicas · Sem custo</p>
            </div>
            <button className="btn btn-primary btn-sm">Upgrade</button>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 14, fontWeight: 500 }}>
              <Check size={16} /> Salvo!
            </span>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
          <button onClick={handleLogout} className="btn btn-danger btn-sm">
            <LogOut size={16} /> Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
