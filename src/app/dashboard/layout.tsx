'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, ClipboardCheck, BookOpen,
  Sparkles, FileText, Calendar, Settings, LogOut,
  Menu, X, ChevronLeft, MoreHorizontal, Stethoscope,
  ClipboardList, Wrench,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/dashboard/turmas', label: 'Turmas', icon: Users },
  { href: '/dashboard/chamada', label: 'Chamada', icon: ClipboardCheck },
  { href: '/dashboard/diario', label: 'Diário', icon: BookOpen },
  { href: '/dashboard/ia', label: 'IA Pedagógica', icon: Sparkles },
  { href: '/dashboard/encaminhamento', label: 'Encaminhamento', icon: Stethoscope },
  { href: '/dashboard/avaliacao', label: 'Avaliação', icon: ClipboardList },
  { href: '/dashboard/gier', label: 'Gerador GIER', icon: FileText },
  { href: '/dashboard/planejamento', label: 'Planejamento', icon: Calendar },
  { href: '/dashboard/ferramentas', label: 'Ferramentas', icon: Wrench },
]

// Bottom nav shows first 4 + "More" on mobile
const bottomNavItems = navItems.slice(0, 4)
const moreNavItems = navItems.slice(4)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('sessionOnly') === 'true') {
      const handleBeforeUnload = () => {
        sessionStorage.setItem('sessionExpired', 'true')
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('sessionExpired') === 'true') {
      sessionStorage.removeItem('sessionExpired')
      const supabase = createClient()
      supabase.auth.signOut().then(() => {
        router.push('/login')
        router.refresh()
      })
    }
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
    setShowMoreMenu(false)
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isMoreActive = moreNavItems.some(item =>
    pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="mobile-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 99, display: 'none',
          }}
        />
      )}

      {/* Sidebar (Desktop) */}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}
        style={{
          position: 'fixed', top: 0, left: 0, height: '100vh',
          display: 'flex', flexDirection: 'column', zIndex: 100,
          padding: '16px 12px',
        }}
      >
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
          padding: '4px 4px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16,
          position: 'relative',
        }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 16,
            }}>P</div>
            {!collapsed && (
              <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
                Professor<span style={{ color: 'var(--primary)' }}>IA</span>
              </span>
            )}
          </Link>
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="btn btn-icon btn-ghost btn-expand" style={{
              position: 'absolute', right: -10, top: -4, width: 22, height: 22,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
            }} title="Expandir menu">
              <ChevronLeft size={12} style={{ transform: 'rotate(180deg)' }} />
            </button>
          ) : (
            <>
              <button onClick={() => setCollapsed(true)} className="btn btn-icon btn-ghost desktop-collapse" title="Recolher menu">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setSidebarOpen(false)} className="btn btn-icon btn-ghost mobile-close" style={{ display: 'none' }}>
                <X size={18} />
              </button>
            </>
          )}
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
              >
                <Icon size={20} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link
            href="/dashboard/configuracoes"
            className={`sidebar-link ${pathname.startsWith('/dashboard/configuracoes') ? 'active' : ''}`}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <Settings size={20} />
            {!collapsed && 'Configurações'}
          </Link>
          <button
            onClick={handleLogout}
            className="sidebar-link"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start', color: 'var(--danger)',
            }}
          >
            <LogOut size={20} />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content" style={{
        flex: 1,
        marginLeft: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        transition: 'margin-left var(--transition-base)',
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
      }}>
        {/* Top Bar (Mobile) */}
        <header style={{
          display: 'none', /* shown via CSS on mobile */
          alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 50,
        }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-icon btn-ghost">
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 18 }}>
            Professor<span style={{ color: 'var(--primary)' }}>IA</span>
          </span>
          <div style={{ width: 36 }} />
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '24px' }}>
          {children}
        </main>
      </div>

      {/* Bottom Navigation (Mobile) */}
      <nav className="bottom-nav">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
        {/* More button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`bottom-nav-item ${isMoreActive ? 'active' : ''}`}
          >
            <MoreHorizontal size={20} />
            <span>Mais</span>
          </button>
          {showMoreMenu && (
            <div style={{
              position: 'absolute', bottom: '100%', right: 0,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 8, minWidth: 180,
              boxShadow: 'var(--shadow-xl)', marginBottom: 8,
            }}>
              {moreNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setShowMoreMenu(false)}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                )
              })}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <Link
                href="/dashboard/configuracoes"
                className={`sidebar-link ${pathname.startsWith('/dashboard/configuracoes') ? 'active' : ''}`}
                onClick={() => setShowMoreMenu(false)}
              >
                <Settings size={18} />
                Configurações
              </Link>
              <button
                onClick={() => { setShowMoreMenu(false); handleLogout() }}
                className="sidebar-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', color: 'var(--danger)' }}
              >
                <LogOut size={18} />
                Sair
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Responsive CSS */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            left: -100% !important;
            width: var(--sidebar-width) !important;
            transition: left var(--transition-base) !important;
          }
          .sidebar.open {
            left: 0 !important;
          }
          .mobile-overlay {
            display: block !important;
          }
          .mobile-header {
            display: flex !important;
          }
          .mobile-close {
            display: block !important;
          }
          .desktop-collapse {
            display: none !important;
          }
          .main-content {
            margin-left: 0 !important;
          }
        }

        @media (min-width: 769px) {
          .bottom-nav {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
