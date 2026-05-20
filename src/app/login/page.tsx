'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Shield } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Email ou senha incorretos. Tente novamente.')
        return
      }

      if (!keepLoggedIn) {
        sessionStorage.setItem('sessionOnly', 'true')
      } else {
        sessionStorage.removeItem('sessionOnly')
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--bg-primary) 50%, #F5F3FF 100%)',
      padding: 24,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 16,
          }}>P</div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Bem-vindo de volta</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Entre na sua conta ProfessorIA</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              className="input"
              placeholder="professor@escola.edu.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} style={{ color: 'var(--text-muted)' }} /> : <Eye size={18} style={{ color: 'var(--text-muted)' }} />}
              </button>
            </div>
          </div>

          {/* Manter login */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--primary)', width: 16, height: 16, flexShrink: 0 }}
            />
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>Manter login</span>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 2, fontSize: 12 }}>
                <Shield size={12} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                Use apenas no seu computador pessoal. Se não marcar, será deslogado ao fechar o navegador.
              </span>
            </div>
          </label>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--danger-light)', color: '#991B1B', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button id="login-submit" type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
          Não tem conta?{' '}
          <Link href="/registro" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </div>
  )
}
