# Arquitetura — ProfessorIA Classroom

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js | 16.2.6 |
| Linguagem | TypeScript | 5.x |
| Runtime | React | 19.2.4 |
| Banco | Supabase (PostgreSQL) | — |
| Auth | Supabase SSR (@supabase/ssr) | 0.10 |
| IA | Google Gemini (@google/genai) | 2.4 |
| Ícones | lucide-react | 1.16 |
| Tema | next-themes | 0.4 |
| CSS | Custom (globals.css) | — |

## Estrutura de Diretórios

```
src/
├── app/                    # Next.js App Router
│   ├── api/gemini/         # API routes (server-only)
│   ├── dashboard/          # Protected pages (layout + pages)
│   ├── login/              # Login page
│   ├── registro/           # Registration page
│   ├── globals.css         # Design tokens + component styles
│   ├── layout.tsx          # Root layout (fonts, providers)
│   ├── page.tsx            # Landing page
│   └── providers.tsx       # ThemeProvider + ToastProvider
├── components/
│   └── ui/                 # Reusable UI components (stateless)
├── lib/
│   ├── supabase/           # Supabase clients (client/server/middleware)
│   ├── db.ts               # Data access layer (all database functions)
│   ├── gemini.ts           # Gemini AI service
│   └── toast.tsx           # Toast notification system (context)
└── types/
    ├── index.ts            # Re-exports
    └── database.ts         # All TypeScript interfaces
```

## Fluxo de Dados

```
Página (client component)
  └── useEffect / evento
        └── lib/db.ts (getUserId cache → createClient)
              └── Supabase REST (RLS policies)
                    └── Retorno tipado → setState

Página IA / GIER (client component)
  └── fetch() POST
        └── /api/gemini/* (server, auth check)
              └── lib/gemini.ts (getAI lazy → @google/genai)
                    └── Gemini API
                          └── Retorno → setState
```

### Regras de Fluxo

1. **Páginas NUNCA acessam Supabase diretamente** — sempre via `lib/db.ts`
2. **Componentes UI NUNCA chamam `lib/db.ts`** — só recebem dados por props
3. **API routes são o único lugar que chama Gemini** — segurança da chave
4. **Toast** via `useToast()` hook — nunca `alert()` ou `confirm()`

## Roteamento

| Rota | Tipo | Arquivo | Auth |
|------|------|---------|------|
| `/` | Static | `page.tsx` | — |
| `/login` | Static | `login/page.tsx` | Redireciona se logado |
| `/registro` | Static | `registro/page.tsx` | Redireciona se logado |
| `/dashboard` | Dinâmica | `dashboard/page.tsx` | Requer |
| `/dashboard/turmas` | Dinâmica | `turmas/page.tsx` | Requer |
| `/dashboard/turmas/[id]` | Dinâmica | `turmas/[id]/page.tsx` | Requer |
| `/dashboard/chamada` | Dinâmica | `chamada/page.tsx` | Requer |
| `/dashboard/diario` | Dinâmica | `diario/page.tsx` | Requer |
| `/dashboard/ia` | Dinâmica | `ia/page.tsx` | Requer |
| `/dashboard/gier` | Dinâmica | `gier/page.tsx` | Requer |
| `/dashboard/planejamento` | Dinâmica | `planejamento/page.tsx` | Requer |
| `/dashboard/configuracoes` | Dinâmica | `configuracoes/page.tsx` | Requer |
| `/api/gemini/report` | API Route | `api/gemini/report/route.ts` | Requer (401 se não) |
| `/api/gemini/gier` | API Route | `api/gemini/gier/route.ts` | Requer (401 se não) |

## Autenticação

- **Middleware**: `lib/supabase/middleware.ts` — protege `/dashboard/*`, redireciona `/login` → `/dashboard`
- **Server**: `lib/supabase/server.ts` — usado em API routes (via `cookies()`)
- **Client**: `lib/supabase/client.ts` — usado em páginas client-side
- **Cache**: `lib/db.ts` — `getUserId()` cacheia o userId para evitar N chamadas `auth.getUser()`

## Banco de Dados (Supabase)

- Migration em `supabase/migrations/001_initial_schema.sql` (15 tabelas)
- RLS habilitado em todas as tabelas
- Trigger `handle_new_user()` cria perfil `teachers` automaticamente no signup
- Nunca executado em produção — precisa rodar `supabase db push`

## IA (Gemini)

- Lazy init: `getAI()` em `lib/gemini.ts` — não quebra se `GEMINI_API_KEY` não estiver configurada
- Prompt em português brasileiro
- Modelo: `gemini-2.0-flash`
- 2 funcionalidades: relatórios pedagógicos (4 tipos) + análise GIER (OCR + BNCC)

## Próximos Passos Arquiteturais

1. Persistir resultados de IA via `saveAIReport()` nas API routes
2. Extrair modal, form field e confirm dialog para componentes reutilizáveis
3. Adicionar error boundaries por página (não só no dashboard)
4. Remover Tailwind se não for utilizado
