# Guia de Componentes — ProfessorIA Classroom

## Localização

Todos os componentes reutilizáveis ficam em src/components/ui/.

`
components/
└── ui/
    ├── PageHeader.tsx    # Cabeçalho de página + action slot
    ├── EmptyState.tsx    # Estado vazio com ação opcional
    ├── Loading.tsx       # Spinner de carregamento
    ├── Modal.tsx         # [A CRIAR] Overlay + card centralizado
    ├── FormField.tsx     # [A CRIAR] Label + input + error
    ├── ConfirmDialog.tsx # [A CRIAR] Modal de confirmação
    ├── Spinner.tsx       # [A CRIAR] Loading spinner animado
    └── index.ts          # [A CRIAR] Re-exports
`

## Contrato de Componente

### Estrutura Padrão

`	sx
interface Props {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string       // Sempre aceitar className para customização externa
  style?: React.CSSProperties  // Sempre aceitar style para overrides pontuais
}

export function PageHeader({ title, description, action, className, style }: Props) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
        ...style,
      }}
    >
      <div>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: description ? 'var(--space-1)' : 0 }}>
          {title}
        </h1>
        {description && <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>
          {description}
        </p>}
      </div>
      {action}
    </div>
  )
}
`

### Regras de Contrato

1. **Named export** — nunca export default em componentes UI
2. **Props tipadas com interface** — exportada para ser usada por consumidores
3. **className e style opcionais** — injetáveis para customização externa
4. **Sem useState ou useEffect** — componentes são funções puras
5. **Sem 'use client'** — a menos que use eventos, context ou hooks
6. **Sem acesso a lib/db.ts** — dados entram por props
7. **children?: React.ReactNode** — para componentes de contenção (card, modal)

## Catálogo de Componentes

### Existentes (precisam ser consumidos)

#### <Loading message? = "Carregando...">

Props: message?: string

Uso:
`	sx
import { Loading } from '@/components/ui/Loading'

if (loading) return <Loading />
`

#### <EmptyState icon? title description? action?>

Props:
`	sx
{
  icon?: string          // Emoji ou Lucide icon name
  title: string
  description?: string
  action?: React.ReactNode  // Botão ou link de ação
}
`

Uso:
`	sx
import { EmptyState } from '@/components/ui/EmptyState'

if (students.length === 0) {
  return (
    <EmptyState
      icon="👤"
      title="Nenhum aluno cadastrado"
      description="Adicione alunos para começar"
      action={<button className="btn btn-primary">Adicionar</button>}
    />
  )
}
`

#### <PageHeader title description? action?>

Props:
`	sx
{
  title: string
  description?: string
  action?: React.ReactNode
}
`

Uso:
`	sx
import { PageHeader } from '@/components/ui/PageHeader'

<PageHeader
  title="Minhas Turmas"
  description="5 turmas ativas"
  action={<button className="btn btn-primary"><Plus size={18} /> Nova turma</button>}
/>
`

### A Criar

#### <Modal open onClose title children>

Props:
`	sx
{
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: number  // default 500
}
`

Extraído de 3 ocorrências (turmas create, student add, diary entry).

#### <FormField label error? children>

Props:
`	sx
{
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode  // input, select, textarea
}
`

Extraído de 20+ ocorrências de label + input padronizados.

#### <ConfirmDialog open onClose onConfirm title message>

Props:
`	sx
{
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string  // default "Confirmar"
  variant?: 'danger' | 'primary'  // default 'danger'
}
`

Substitui o confirm() nativo.

## Padrões de Renderização

### Loading State

`	sx
// ❌ Errado — inline duplicado
{loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>}

// ✅ Correto — componente Loading
if (loading) return <Loading />
`

### Empty State

`	sx
// ❌ Errado — inline
<div className="card" style={{ padding: 48, textAlign: 'center' }}>
  <p>Nenhum registro encontrado.</p>
</div>

// ✅ Correto
<EmptyState title="Nenhum registro encontrado" />
`

### Error State

`	sx
// Com try/catch
try { ... } catch (err) {
  toast(err instanceof Error ? err.message : 'Erro desconhecido', 'error')
}
`

## Evolução do Sistema de Componentes

1. Consumir componentes existentes (Loading, EmptyState, PageHeader) em todas as páginas
2. Extrair Modal (3 ocorrências) e FormField (20+ ocorrências)
3. Extrair ConfirmDialog (substituir confirm())
4. Adicionar barrel export via index.ts para import limpo:
   import { PageHeader, EmptyState, Loading } from '@/components/ui'
5. Adicionar testes visuais (Storybook ou similar) apenas quando houver mais de 15 componentes
