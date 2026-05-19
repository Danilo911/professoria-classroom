# Estado Atual — ProfessorIA Classroom

> Este documento descreve o estado real do código-fonte neste momento, sem idealizações.
> Use como fonte da verdade para entender o que existe antes de refatorar.

_Última atualização: 18/05/2026_

---

## Sumário

1. [Stack Real](#1-stack-real)
2. [O que Cada Arquivo Realmente Faz](#2-o-que-cada-arquivo-realmente-faz)
3. [Padrões Reais vs Oficiais](#3-padrões-reais-vs-oficiais)
4. [Inventário de Inconsistências](#4-inventário-de-inconsistências)
5. [Dívida Técnica](#5-dívida-técnica)
6. [Métrica de Linhas](#6-métrica-de-linhas)
7. [Fluxo de Dados Real](#7-fluxo-de-dados-real)

---

## 1. Stack Real

O que está de fato rodando:

| Camada | O que realmente acontece |
|--------|-------------------------|
| Next.js 16.2.6 | Build passa, App Router funcionando |
| Supabase | Client configurado, mas banco **nunca criado** (migration nunca executada) |
| Auth | Login/registro conectados ao Supabase Auth real, mas sem dados de seed |
| Gemini | API key configurada, chamadas funcionam (dentro da cota free) |
| Tailwind CSS v4 | Instalado, @import \"tailwindcss\" no globals.css, mas **zero classes Tailwind** nos componentes — só aumenta o bundle |

## 2. O que Cada Arquivo Realmente Faz

### Páginas

| Arquivo | O que faz de fato | Estado dos dados |
|---------|------------------|------------------|
| page.tsx (/) | Landing page estática com 6 feature cards | Sem dados |
| login/page.tsx | Formulário email/senha, chama supabase.auth.signInWithPassword | Real (Supabase Auth) |
| egistro/page.tsx | Formulário de cadastro, chama supabase.auth.signUp | Real (Supabase Auth) |
| dashboard/page.tsx | Exibe stats (turmas ativas, alunos, relatórios) via getDashboardStats() | Mock (Supabase vazio retorna 0) |
| dashboard/layout.tsx | Sidebar com 8 links de navegação + logout | — |
| dashboard/loading.tsx | Importa <Loading /> e renderiza | — |
| dashboard/error.tsx | Mensagem de erro + botão \"Tentar novamente\" | — |
| 	urmas/page.tsx | Lista turmas, modal de criação, busca | Mock (array vazio) |
| 	urmas/[id]/page.tsx | Lista alunos da turma, adicionar/remover | Mock (array vazio) |
| chamada/page.tsx | Grid de alunos com clique para alternar status, salva sessão | Mock (nenhuma sessão, cria nova) |
| diario/page.tsx | Lista entradas com filtro por tipo, modal de criação | Mock (array vazio) |
| ia/page.tsx | Seleciona tipo de relatório, preenche formulário, chama API Gemini | Real (Gemini responde) |
| gier/page.tsx | Upload de imagem, chama API Gemini para análise | Real (Gemini responde) |
| planejamento/page.tsx | Lista planos de aula com badges de status | Mock (array vazio) |
| configuracoes/page.tsx | Formulário de perfil, escola, tema, logout | Mock (teacher null) |

### Componentes UI

| Componente | Estado real |
|-----------|-------------|
| Loading.tsx | Existe, exportado, mas só usado em dashboard/loading.tsx |
| EmptyState.tsx | Existe, exportado, mas **nunca importado por ninguém** |
| PageHeader.tsx | Existe, exportado, mas **nunca importado por ninguém** |

### Lib

| Arquivo | Estado real |
|---------|-------------|
| db.ts | 21 funções, todas conectadas ao Supabase real, mas banco vazio → retornam null/[] |
| gemini.ts | 2 funções, lazy init com getAI(), prompts em português |
| 	oast.tsx | Context + Provider, useToast() hook, 3 tipos (success/error/info) |
| supabase/client.ts | createBrowserClient com env vars |
| supabase/server.ts | createServerClient com cookies |
| supabase/middleware.ts | Protege /dashboard/*, redireciona /login → /dashboard |

### API Routes

| Rota | Estado real |
|------|-------------|
| POST /api/gemini/report | Autentica, chama Gemini, retorna texto. **NÃO persiste no banco** |
| POST /api/gemini/gier | Autentica, chama Gemini, retorna JSON. **NÃO persiste no banco** |

---

## 3. Padrões Reais vs Oficiais

### Estilo: INLINE REIGNS

**Real:** 90% do CSS é style={} inline. Classes do globals.css são usadas apenas para:
- .card / .card-interactive (estrutura de card)
- .btn / .btn-primary / .btn-secondary / .btn-ghost / .btn-sm / .btn-lg / .btn-icon / .btn-danger
- .input
- .badge / .badge-present / .badge-absent / .badge-late / .badge-info
- .avatar / .avatar-sm / .avatar-md / .avatar-lg / .avatar-xl / .avatar-placeholder
- .sidebar / .sidebar-collapsed / .sidebar-link / .sidebar-link.active
- .attendance-grid / .attendance-card / .attendance-card[data-status]
- .spinner / .toast / .stat-card / .stat-value / .empty-state
- .gradient-text / .glass (só na landing page)

**Oficial (desejado):** className como padrão, style só para valores dinâmicos.

### Componentes: NINGUÉM USA

**Real:** Loading, EmptyState, PageHeader existem em componentes/ui/ mas não são consumidos.

Todas as páginas replicam o mesmo padrão inline:
`	sx
// Loading (replicado em 7 páginas):
<div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>

// Empty state (replicado em 5 páginas):
<div className="card" style={{ padding: 48, textAlign: 'center' }}>
  <p>Nenhum registro encontrado.</p>
</div>

// Page header (replicado em 8 páginas):
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
  <div>
    <h1 style={{ fontSize: 24, marginBottom: 4 }}>Título</h1>
    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Descrição</p>
  </div>
  <button className="btn btn-primary">Ação</button>
</div>
`

### Modal: TRÊS VERSÕES IGUAIS

**Real:** O mesmo padrão de modal existe em 3 lugares com código quase idêntico:

- 	urmas/page.tsx (Nova Turma) — 35 linhas
- 	urmas/[id]/page.tsx (Adicionar Aluno) — 34 linhas
- diario/page.tsx (Novo Registro) — 37 linhas

`	sx
<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
  onClick={() => setShowModal(false)}>
  <div className="card" style={{ width: '100%', maxWidth: 480, padding: 32 }} onClick={e => e.stopPropagation()}>
    <h2 style={{ fontSize: 20, marginBottom: 20 }}>Título</h2>
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      ...
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Salvar</button>
      </div>
    </form>
  </div>
</div>
`

### Form Field: 20+ REPETIÇÕES

**Real:** O padrão label + input é copiado em toda página:

`	sx
<div>
  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Nome</label>
  <input className="input" placeholder="..." value={...} onChange={...} />
</div>
`

### Submit: DOIS ESTILOS

**Real:** Metade dos formulários usa <form onSubmit>, metade usa onClick no botão:
- <form onSubmit>: login, registro, turmas modal, diário modal, alunos modal
- onClick no botão: chamada, configurações, IA, GIER

### Notificação: TOAST + CONFIRM

**Real:** Toast funciona e é usado em 6 páginas. Mas 	urmas/[id]/page.tsx usa confirm() nativo:

`	sx
if (!confirm(Remover  da turma?)) return
`

### API Routes: NÃO PERSISTEM

**Real:** As duas API routes retornam dados do Gemini mas nunca salvam no banco via saveAIReport() ou tabela gier_submissions.

---

## 4. Inventário de Inconsistências

| # | Inconsistência | Ocorrências | Impacto |
|---|---------------|-------------|---------|
| 1 | **ar(--text-muted) para loading** | 7 páginas | Baixo — funcional, mas repetitivo |
| 2 | **Cores hardcode em globals.css** | 4 badges | Médio — .badge-present usa #065F46 em vez de ar(--success) |
| 3 | **Cores hardcode inline** | chamada.tsx:130 | Baixo — #065F46 inline |
| 4 | **ontSize: 24 inline** | 8 páginas | Médio — deveria ser ar(--text-3xl) |
| 5 | **marginBottom: 24 inline** | 8 páginas | Médio — deveria ser ar(--space-6) |
| 6 | **Componentes UI não usados** | 3 (Loading, EmptyState, PageHeader) | Alto — código morto que deveria ser eliminado ou consumido |
| 7 | **Modal duplicado** | 3 | Alto — 106 linhas de código repetido |
| 8 | **FormField duplicado** | 20+ | Alto — centenas de linhas repetidas |
| 9 | **confirm() nativo** | 1 | Médio — quebra padrão Toast |
| 10 | **API routes sem persistência** | 2 | Alto — dados de IA perdidos |
| 11 | **Tailwind morto** | 1 import | Baixo — aumenta bundle em ~30kb |
| 12 | **styled-jsx no layout** | 1 | Baixo — alternativa a CSS puro |

---

## 5. Dívida Técnica

### Banco de Dados
- Migration  01_initial_schema.sql nunca foi executada
- Nenhum dado de seed
- RPC increment_class_student_count e decrement_class_student_count adicionados mas nunca testados
- Trigger handle_new_user() nunca testado

### Testes
- Zero testes unitários
- Zero testes de integração
- Zero testes E2E

### Scripts
- scripts/extract-qsn.ts parou por quota Gemini (429 após ~48 chunks)
- Usa equire('pdf-parse') dinâmico em vez de import

### Build
- Build passa, mas 
pm run dev só testado localmente
- Netlify deploy nunca testado

### Erro Conhecido (corrigido)
- upsertSchool() em db.ts linha 254 usava user.id em vez de userId — corrigido em 18/05/2026

---

## 6. Métrica de Linhas

### Total por diretório (src/)

| Diretório | Arquivos | Linhas |
|-----------|----------|--------|
| src/app/ | 18 | ~2.450 |
| src/components/ui/ | 3 | ~44 |
| src/lib/ | 6 | ~593 |
| src/types/ | 2 | ~239 |
| **Total** | **29** | **~3.326** |

### Top 10 maiores arquivos

| Arquivo | Linhas | % do total |
|---------|--------|-----------|
| globals.css | 469 | 14% |
| 	ypes/database.ts | 238 | 7% |
| lib/gemini.ts | 216 | 6% |
| lib/db.ts | 275 | 8% |
| dashboard/configuracoes/page.tsx | 202 | 6% |
| dashboard/ia/page.tsx | 205 | 6% |
| dashboard/layout.tsx | 197 | 6% |
| dashboard/gier/page.tsx | 182 | 5% |
| dashboard/chamada/page.tsx | 181 | 5% |
| dashboard/diario/page.tsx | 159 | 5% |

---

## 7. Fluxo de Dados Real

`
                    +-----------+
                    | Supabase  |
                    | (vazio)   |
                    +-----+-----+
                          |
            +-------------+-------------+
            |                           |
    +-------v------+          +---------v--------+
    | lib/db.ts    |          | lib/supabase/*   |
    | (21 funções) |          | (client/server)  |
    +-------+------+          +------------------+
            |
    +-------v--------+          +------------------+
    | Páginas        |          | API Routes       |
    | (useEffect)    |          | /api/gemini/*    |
    +-------+--------+          +--------+---------+
            |                            |
            |                   +--------v---------+
            |                   | lib/gemini.ts    |
            |                   | (getAI → Gemini) |
            |                   +------------------+
            |
    +-------v--------+
    | useState       |
    | → render JSX   |
    +----------------+

    Feedback: useToast() → ToastProvider → render toasts
`

**Legenda:**
- Setas sólidas = fluxo ativo e testado
- Setas tracejadas = fluxo existe mas sem dados reais (banco vazio)
- Círculo vermelho = API routes não persistem resultados
