import Link from 'next/link'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 18,
          }}>P</div>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>
            Professor<span style={{ color: 'var(--primary)' }}>IA</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/login" className="btn btn-ghost">Entrar</Link>
          <Link href="/registro" className="btn btn-primary">Começar grátis</Link>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720 }}>
          <div className="badge badge-info" style={{ marginBottom: 16, fontSize: 13 }}>
            ✨ Novidade — IA que entende seu dia a dia
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.03em' }}>
            Sua sala de aula,{' '}
            <span className="gradient-text">mais inteligente</span>
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Chamada em segundos, diário pedagógico automatizado, pareceres descritivos com IA e muito mais. Tudo feito para quem vive a sala de aula.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/registro" className="btn btn-primary btn-lg">
              Começar gratuitamente
            </Link>
            <Link href="#funcionalidades" className="btn btn-secondary btn-lg">
              Ver funcionalidades
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <section id="funcionalidades" style={{ marginTop: 80, width: '100%', maxWidth: 1000, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            { icon: '📋', title: 'Chamada Inteligente', desc: 'Marque presença com fotos dos alunos. Menos de 1 minuto para toda a turma.' },
            { icon: '📝', title: 'Diário Pedagógico', desc: 'Registros da turma e individuais. Comportamento, evolução e intervenções.' },
            { icon: '🤖', title: 'IA Pedagógica', desc: 'Pareceres descritivos, conselho de classe e reunião de pais gerados automaticamente.' },
            { icon: '📄', title: 'Gerador GIER', desc: 'Envie foto ou PDF da atividade. A IA identifica habilidades e gera a descrição.' },
            { icon: '📚', title: 'Currículo QSN', desc: 'Habilidades da BNCC e QSN de Guarulhos integradas automaticamente.' },
            { icon: '📅', title: 'Planejamento', desc: 'Sequências didáticas e planos semanais com sugestões inteligentes.' },
          ].map((f, i) => (
            <div key={i} className="card card-interactive" style={{ padding: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, marginBottom: 8, fontWeight: 600 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
        © 2026 ProfessorIA Classroom · Feito com 💜 para professores
      </footer>
    </div>
  )
}
