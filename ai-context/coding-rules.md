# Regras de Código — ProfessorIA Classroom

## Nomenclatura

| Contexto | Idioma | Padrão | Exemplos |
|----------|--------|--------|----------|
| Arquivos de página | Português | kebab-case | configuracoes/page.tsx, [id]/page.tsx |
| Componentes | Inglês | PascalCase | PageHeader.tsx, EmptyState.tsx |
| Funções exportadas | Inglês | camelCase | getClasses(), createClass() |
| Props de componente | Inglês | camelCase | 	itle, description, onClose |
| Variáveis locais | Português | camelCase | 	urma, luno, chamada |
| Constantes | Inglês | UPPER_CASE | GEMINI_MODEL |
| Tipos/Interfaces | Inglês | PascalCase | Student, AttendanceSession |
| CSS classes | Inglês | kebab-case | .btn-primary, .sidebar-link |
| Comentários | Português | — | Explicar o *porquê*, não o *o quê* |

## Estrutura de Arquivos

`
pasta/
├── page.tsx          # Componente da página (default export)
├── layout.tsx        # Layout wrapper (se houver)
├── loading.tsx       # Loading boundary (se houver)
├── error.tsx         # Error boundary (se houver)
└── [param]/          # Rotas dinâmicas
    └── page.tsx
`

## Regras por Tipo de Arquivo

### Páginas (app/**/page.tsx)

Sempre 'use client'. Default export. Nome da função = nome da rota em PascalCase + "Page".

`	sx
'use client'

import { useState, useEffect } from 'react'
// lib/db.ts para dados
// lib/toast para notificações
// componentes de components/ui/

export default function TurmasPage() {
  // 1. useState para estado local
  // 2. useEffect para carregar dados
  // 3. Funções handler (handleSubmit, handleDelete)
  // 4. Render (JSX)

  // useEffect SEMPRE com getClasses, getTeacher etc
  // NUNCA chama supabase direto
}
`

### Componentes (components/ui/*.tsx)

Nunca 'use client' a menos que necessário (eventos, hooks). Sempre named export. Props tipadas com interface.

`	sx
interface Props {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function PageHeader({ title, description, action, className, style }: Props) {
  return (
    <div className={className} style={style}>
      ...
    </div>
  )
}
`

### API Routes (app/api/**/route.ts)

Sempre server-side. Sempre verificar auth. Tratar erros com try/catch.

`	s
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // 1. Verificar auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // 2. Parsear body
  const body = await request.json()

  // 3. Validar input
  if (!body.type) return NextResponse.json({ error: 'Campo obrigatório' }, { status: 400 })

  // 4. Processar
  try {
    const result = await processSomething(body)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
`

### Lib (lib/*.ts)

Nunca 'use client'. Funções puras ou serviços. Sempre tipadas.

`	s
// lib/db.ts
import { createClient } from './supabase/client'

// Cache de sessão para evitar N chamadas auth.getUser()
let cachedUserId: string | null = null

async function getUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  cachedUserId = user?.id || null
  return cachedUserId
}
`

## Padrões de Código

### Hooks: Ordem Consistente

1. useState (agrupados no topo)
2. useEffect (logo após os states)
3. Hooks de contexto (useToast, useTheme, useRouter)
4. Funções handler

### Async/Await com try/catch

Sempre usar try/catch em operações assíncronas. Toast para feedback ao usuário.

`	sx
async function handleSave() {
  setSaving(true)
  try {
    await saveData(form)
    toast('Salvo!', 'success')
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
  } finally {
    setSaving(false)
  }
}
`

### Imports: Ordem

1. React (useState, useEffect)
2. Next (useRouter, useParams, Link)
3. Ícones (lucide-react)
4. lib local (db, toast, gemini)
5. Types (type import)
6. Componentes (components/ui/)

## Proibições

- lert() → use useToast()
- confirm() → não usar (substituir por modal de confirmação)
- ar → usar const / let
- ny → evitar; preferir tipos específicos ou unknown
- CSS inline para layout → usar classes do globals.css
- Comentários descrevendo *o que* o código faz → o código deve ser auto-explicativo
- Import dinâmico com equire() → usar import
- Valores hardcoded de cor/espaçamento → usar CSS custom properties
- setTimeout para delays de UX → usar transições CSS

## Preferências

- const sobre let sempre que possível
- Objetos de lookup em vez de switch/if longos
- Promise.all() para chamadas paralelas
- Early return para loading/empty/error states
- Fragmentos <>...</> em vez de <div> desnecessários
- TypeScript: interface sobre 	ype para objetos
- Nomes descritivos: isLoading em vez de loading (booleans começam com is/has/should)
