'use client'

import { useState, useEffect } from 'react'
import { LogIn } from 'lucide-react'
import GierAnalyzer from '@/components/gier/GierAnalyzer'

const WEEKLY_LIMIT = 5

function getWeekKey(): string {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil((((now.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7)
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function getUsage(): { count: number; week: string } {
  if (typeof window === 'undefined') return { count: 0, week: '' }
  const weekKey = getWeekKey()
  const stored = localStorage.getItem('gier_week') || ''
  if (stored !== weekKey) {
    localStorage.setItem('gier_week', weekKey)
    localStorage.setItem('gier_count', '0')
    return { count: 0, week: weekKey }
  }
  return { count: Number(localStorage.getItem('gier_count') || 0), week: weekKey }
}

function incrementUsage() {
  const { count, week } = getUsage()
  localStorage.setItem('gier_count', String(count + 1))
}

export default function GierPublicPage() {
  const [usage, setUsage] = useState({ count: 0, week: '' })

  useEffect(() => {
    setUsage(getUsage())
  }, [])

  const limitReached = usage.count >= WEEKLY_LIMIT

  function handleBeforeProcess() {
    const current = getUsage()
    if (current.count >= WEEKLY_LIMIT) {
      return false
    }
    return true
  }

  function handleAfterProcess() {
    incrementUsage()
    setUsage(getUsage())
  }

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
            {Math.max(0, WEEKLY_LIMIT - usage.count)}/{WEEKLY_LIMIT} esta semana
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
            {!limitReached && <span> {WEEKLY_LIMIT} gerações gratuitas por semana.</span>}
          </p>
        </div>

        {limitReached && (
          <div style={{
            background: 'var(--warning-light)', border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 500, width: '100%',
            textAlign: 'center', marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 16, marginBottom: 8, color: '#92400E' }}>Limite semanal atingido</h3>
            <p style={{ fontSize: 14, color: '#92400E', marginBottom: 16 }}>
              Você usou todas as {WEEKLY_LIMIT} gerações gratuitas desta semana.
              Crie uma conta gratuita para continuar gerando.
            </p>
            <a href="/login">
              <button className="btn btn-primary">
                <LogIn size={16} /> Criar conta gratuita
              </button>
            </a>
          </div>
        )}

        <GierAnalyzer
          apiEndpoint="/api/gier/public"
          disabled={limitReached}
          onBeforeProcess={handleBeforeProcess}
          onAfterProcess={handleAfterProcess}
          resultExtras={() => (
            <div style={{ margin: '0 24px 24px', padding: 16, background: 'var(--primary-50)', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--primary-100)' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>
                Gostou? Salve seus GIERs com uma conta gratuita!
              </p>
              <a href="/login">
                <button className="btn btn-primary btn-sm">
                  <LogIn size={14} /> Criar conta grátis
                </button>
              </a>
            </div>
          )}
        />
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
