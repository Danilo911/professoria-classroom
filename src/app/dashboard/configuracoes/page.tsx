'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Check, LogOut, Eye, EyeOff } from 'lucide-react'
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
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [changingAuth, setChangingAuth] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showEmailPwd, setShowEmailPwd] = useState(false)

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
      const updated = await getTeacher()
      if (updated) {
        setTeacher(updated)
        setForm({
          full_name: updated.full_name || '',
          phone: updated.phone || '',
          school_name: updated.school?.name || '',
          school_city: updated.school?.city || 'Guarulhos',
          school_state: updated.school?.state || 'SP',
          school_network: updated.school?.network || 'municipal',
        })
      }
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

  async function handleChangePassword() {
    if (!currentPassword) {
      toast('Informe a senha atual', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      toast('As senhas não coincidem', 'error')
      return
    }
    if (newPassword.length < 6) {
      toast('A senha deve ter pelo menos 6 caracteres', 'error')
      return
    }
    setChangingAuth(true)
    try {
      const supabase = createClient()
      // Verifica a senha atual tentando fazer login
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: teacher?.email || '',
        password: currentPassword,
      })
      if (verifyError) {
        toast('Senha atual incorreta', 'error')
        return
      }
      // Senha correta, atualiza para a nova
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast('Senha alterada com sucesso!', 'success')
      setShowChangePassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao alterar senha', 'error')
    } finally {
      setChangingAuth(false)
    }
  }

  async function handleChangeEmail() {
    if (!emailPassword) {
      toast('Informe sua senha atual para confirmar', 'error')
      return
    }
    if (!newEmail || !newEmail.includes('@')) {
      toast('Informe um email válido', 'error')
      return
    }
    setChangingAuth(true)
    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: teacher?.email || '',
        password: emailPassword,
      })
      if (verifyError) {
        toast('Senha incorreta', 'error')
        return
      }
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error
      toast('Email de confirmação enviado! Verifique sua nova caixa de entrada.', 'success')
      setShowChangeEmail(false)
      setNewEmail('')
      setEmailPassword('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao alterar email', 'error')
    } finally {
      setChangingAuth(false)
    }
  }

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length === 0) return ''
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
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
              <input className="input" placeholder="(11) 99999-9999" value={form.phone} maxLength={15}
                onChange={e => setForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))} />
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

        {/* Segurança */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Segurança</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!showChangePassword ? (
              <button onClick={() => setShowChangePassword(true)} className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                Alterar senha
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <input type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="username" />
                <input type="password" style={{ display: 'none' }} tabIndex={-1} autoComplete="new-password" />
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Senha atual</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showCurrent ? 'text' : 'password'} placeholder="Digite sua senha atual" value={currentPassword}
                      autoComplete="new-password" name="current-pwd-field"
                      onChange={e => setCurrentPassword(e.target.value)}
                      style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showCurrent ? <EyeOff size={18} style={{ color: 'var(--text-muted)' }} /> : <Eye size={18} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showNew ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={newPassword}
                      autoComplete="new-password" name="new-pwd-field"
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showNew ? <EyeOff size={18} style={{ color: 'var(--text-muted)' }} /> : <Eye size={18} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Confirmar nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showConfirm ? 'text' : 'password'} placeholder="Repita a nova senha" value={confirmPassword}
                      autoComplete="new-password" name="confirm-pwd-field"
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showConfirm ? <EyeOff size={18} style={{ color: 'var(--text-muted)' }} /> : <Eye size={18} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleChangePassword} className="btn btn-primary btn-sm" disabled={changingAuth}>
                    {changingAuth ? 'Verificando...' : 'Salvar'}
                  </button>
                  <button onClick={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }} className="btn btn-ghost btn-sm">Cancelar</button>
                </div>
              </div>
            )}

            {!showChangeEmail ? (
              <button onClick={() => setShowChangeEmail(true)} className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                Alterar email
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <input type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="username" />
                <input type="password" style={{ display: 'none' }} tabIndex={-1} autoComplete="new-password" />
                <div style={{ fontSize: 12, color: 'var(--warning)', padding: '6px 10px', background: 'var(--warning-light)', borderRadius: 6 }}>
                  ⚠️ Um email de confirmação será enviado para o novo endereço. O email atual só será alterado após a confirmação.
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Senha atual (para confirmar)</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showEmailPwd ? 'text' : 'password'} placeholder="Digite sua senha" value={emailPassword}
                      autoComplete="new-password" name="email-pwd-field"
                      onChange={e => setEmailPassword(e.target.value)}
                      style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowEmailPwd(!showEmailPwd)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showEmailPwd ? <EyeOff size={18} style={{ color: 'var(--text-muted)' }} /> : <Eye size={18} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Novo email</label>
                  <input className="input" type="email" placeholder="novo@email.com" value={newEmail}
                    autoComplete="off" name="new-email-field"
                    onChange={e => setNewEmail(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleChangeEmail} className="btn btn-primary btn-sm" disabled={changingAuth}>
                    {changingAuth ? 'Enviando...' : 'Enviar confirmação'}
                  </button>
                  <button onClick={() => { setShowChangeEmail(false); setNewEmail(''); setEmailPassword('') }} className="btn btn-ghost btn-sm">Cancelar</button>
                </div>
              </div>
            )}
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
