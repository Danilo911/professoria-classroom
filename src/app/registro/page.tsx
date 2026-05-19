'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este e-mail já está cadastrado. Tente fazer login.')
        } else {
          setError('Erro no cadastro. Tente novamente.')
        }
        return
      }

      setSuccess(true)
    } catch {
      setError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--bg-primary) 50%, #F5F3FF 100%)',
      }}>
        <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>Conta criada!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            Enviamos um e-mail de confirmação para <strong>{email}</strong>.
            Verifique sua caixa de entrada e clique no link para ativar sua conta.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
            Não recebeu? Verifique a pasta de spam.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-block' }}>
            Ir para login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--bg-primary) 50%, #F5F3FF 100%)',
      padding: 24,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 16,
          }}>P</div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Crie sua conta</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Comece a usar o ProfessorIA gratuitamente</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Nome completo
            </label>
            <input id="register-name" type="text" className="input" placeholder="Seu nome completo"
              value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
              E-mail
            </label>
            <input id="register-email" type="email" className="input" placeholder="professor@escola.edu.br"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Senha
            </label>
            <input id="register-password" type="password" className="input" placeholder="Mínimo 6 caracteres"
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', color: '#991B1B', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button id="register-submit" type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? <span className="spinner" /> : 'Criar conta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
          Já tem conta?{' '}
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Faça login
          </Link>
        </p>
      </div>
    </div>
  )
}
