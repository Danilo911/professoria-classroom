'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Copy, ArrowRight } from 'lucide-react'

const tools = [
  {
    id: 'duplicar-pdf',
    title: 'Duplicar PDF',
    desc: 'Duas cópias por folha A4. Perfeito para imprimir atividades, provas e materiais pedagógicos.',
    icon: Copy,
    color: '#6366F1',
  },
]

const colorMap: Record<string, string> = {
  'duplicar-pdf': '#6366F1',
}

export default function FerramentasPage() {
  const router = useRouter()

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          <Wrench size={24} style={{ display: 'inline', marginRight: 8, color: 'var(--primary)' }} />
          Ferramentas
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Utilitários para o dia a dia do professor</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {tools.map(t => {
          const Icon = t.icon
          const c = colorMap[t.id]
          return (
            <button key={t.id} onClick={() => router.push(`/dashboard/ferramentas/${t.id}`)}
              className="card card-interactive"
              style={{ padding: 24, textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--bg-surface)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={24} color={c} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{t.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>{t.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                Abrir <ArrowRight size={14} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
