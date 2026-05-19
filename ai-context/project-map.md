# Mapa do Projeto — ProfessorIA Classroom

## Inventário de Arquivos

`
professoria-classroom/
├── ai-context/                          # Documentação oficial
│   ├── architecture.md
│   ├── ui-rules.md
│   ├── coding-rules.md
│   ├── component-guide.md
│   └── project-map.md                   ← este arquivo
├── public/
│   └── favicon.ico
├── scripts/
│   └── extract-qsn.ts                   # Extração de habilidades de PDFs (Gemini)
├── src/
│   ├── app/
│   │   ├── api/gemini/
│   │   │   ├── gier/route.ts            # POST — análise GIER (auth)
│   │   │   └── report/route.ts          # POST — relatórios pedagógicos (auth)
│   │   ├── dashboard/
│   │   │   ├── chamada/page.tsx         # Chamada diária (181 linhas)
│   │   │   ├── configuracoes/page.tsx   # Perfil, escola, tema (202 linhas)
│   │   │   ├── diario/page.tsx          # Diário pedagógico (159 linhas)
│   │   │   ├── gier/page.tsx            # Gerador GIER (182 linhas)
│   │   │   ├── ia/page.tsx              # Relatórios IA (205 linhas)
│   │   │   ├── planejamento/page.tsx    # Planos de aula (104 linhas)
│   │   │   ├── turmas/
│   │   │   │   ├── [id]/page.tsx        # Alunos da turma (157 linhas)
│   │   │   │   └── page.tsx             # Lista de turmas (146 linhas)
│   │   │   ├── error.tsx                # Error boundary (12 linhas)
│   │   │   ├── layout.tsx               # Sidebar + navegação (197 linhas)
│   │   │   ├── loading.tsx              # Loading boundary (4 linhas)
│   │   │   └── page.tsx                 # Home com stats (119 linhas)
│   │   ├── login/page.tsx               # Login (139 linhas)
│   │   ├── registro/page.tsx            # Cadastro (109 linhas)
│   │   ├── globals.css                  # Design tokens + 30+ classes (469 linhas)
│   │   ├── layout.tsx                   # Root layout (27 linhas)
│   │   ├── page.tsx                     # Landing page (72 linhas)
│   │   └── providers.tsx                # Providers wrapper (13 linhas)
│   ├── components/ui/
│   │   ├── EmptyState.tsx               # [NÃO USADO] Estado vazio
│   │   ├── Loading.tsx                  # [SUBUTILIZADO] Loading spinner
│   │   └── PageHeader.tsx               # [NÃO USADO] Cabeçalho de página
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                # createClient() browser
│   │   │   ├── middleware.ts            # updateSession() middleware
│   │   │   └── server.ts                # createClient() server
│   │   ├── db.ts                        # 21 funções de dados (275 linhas)
│   │   ├── gemini.ts                    # Service Gemini + prompts (216 linhas)
│   │   └── toast.tsx                    # Toast system (context) (43 linhas)
│   └── types/
│       ├── index.ts                     # Re-export
│       └── database.ts                  # 25 interfaces/tipos (238 linhas)
├── supabase/migrations/
│   └── 001_initial_schema.sql           # Schema completo (326 linhas)
├── .env.example
├── .env.local
├── next.config.ts
├── package.json
├── tsconfig.json
├── postcss.config.mjs
└── eslint.config.mjs
`

## Mapa de Dependências Entre Arquivos

### Páginas → lib/db.ts (21 funções)

| Página | Funções de db.ts usadas |
|--------|------------------------|
| dashboard/page.tsx | getDashboardStats |
| turmas/page.tsx | getClasses, createClass |
| turmas/[id]/page.tsx | getClasses, getClassStudents, addStudent, removeStudent |
| chamada/page.tsx | getClasses, getClassStudents, getTodaySession, createAttendanceSession, saveAttendanceRecords, completeSession |
| diario/page.tsx | getClasses, getDiaryEntries, createDiaryEntry |
| planejamento/page.tsx | getLessonPlans |
| configuracoes/page.tsx | getTeacher, updateTeacher, upsertSchool |

### Páginas → API Routes

| Página | API Route | Método |
|--------|-----------|--------|
| ia/page.tsx | /api/gemini/report | POST |
| gier/page.tsx | /api/gemini/gier | POST |

### API Routes → lib

| API Route | Dependência |
|-----------|-------------|
| api/gemini/report/route.ts | lib/supabase/server (auth), lib/gemini (generateReport) |
| api/gemini/gier/route.ts | lib/supabase/server (auth), lib/gemini (analyzeGier) |

### Páginas → Components

| Página | Componentes usados |
|--------|-------------------|
| dashboard/loading.tsx | Loading |
| (nenhuma outra página usa componentes de ui/) |

### Páginas → Providers/Context

| Página | Contexto |
|--------|----------|
| providers.tsx → layout.tsx | ThemeProvider (next-themes) + ToastProvider (toast.tsx) |
| Todas as dashboard pages | useToast() |
| configuracoes/page.tsx | useTheme() |

## Database: Tabelas (Supabase)

| Tabela | Chave Primária | RLS | Funções CRUD |
|--------|---------------|-----|--------------|
| teachers | id (UUID, = auth.users) | SELECT/UPDATE own | getTeacher, updateTeacher |
| schools | id (UUID) | — | upsertSchool |
| classes | id (UUID) | teacher_id = auth.uid() | getClasses, createClass |
| students | id (UUID) | via enrollment join | getClassStudents, addStudent, updateStudent, removeStudent, getStudent |
| enrollments | id (UUID) | via class join | (via addStudent/removeStudent) |
| guardians | id (UUID) | via student→class join | — |
| attendance_sessions | id (UUID) | teacher_id = auth.uid() | getTodaySession, createAttendanceSession, completeSession |
| attendance_records | id (UUID) | via session join | saveAttendanceRecords |
| diary_entries | id (UUID) | teacher_id = auth.uid() | getDiaryEntries, createDiaryEntry |
| lesson_plans | id (UUID) | teacher_id = auth.uid() | getLessonPlans |
| student_observations | id (UUID) | teacher_id = auth.uid() | — |
| ai_reports | id (UUID) | teacher_id = auth.uid() | saveAIReport |
| gier_submissions | id (UUID) | teacher_id = auth.uid() | — |
| curriculum_skills | id (UUID) | public read | getSkills, insertSkills |
| skill_assessments | id (UUID) | via class join | — |

## Dependências (npm)

### Produção

ext eact eact-dom @supabase/supabase-js @supabase/ssr @google/genai lucide-react 
ext-themes pdf-parse

### Desenvolvimento
	ypescript eslint eslint-config-next 	ailwindcss @tailwindcss/postcss @types/node @types/react @types/react-dom

**Nota:** Tailwind CSS v4 está instalado e importado no globals.css, mas nenhuma classe Tailwind é usada nos componentes.

## Pontos de Atenção

### Inconsistências Conhecidas

1. **Componentes não consumidos**: EmptyState, PageHeader existem mas zero páginas os importam
2. **Loading subutilizado**: Só o dashboard/loading.tsx importa Loading; todas as outras páginas replicam inline
3. **Modal duplicado**: Cria turma, adiciona aluno, novo diário — 3x código idêntico
4. **API routes não persistem**: /api/gemini/report nunca chama saveAIReport(); /api/gemini/gier nunca salva
5. **confirm() browser**: turmas/[id] usa confirm() — quebra padrão Toast
6. **Cores hardcoded**: .badge-present, .badge-absent etc em globals.css usam hex fixo (#065F46 etc)
7. **submit misto**: Alguns formulários usam onSubmit, outros onClick

### Dívida Técnica

- Tailwind no package.json mas não usado (peso extra no build)
- styled-jsx no dashboard/layout.tsx (preferir CSS puro)
- extract-qsn.ts usa require() dinâmico (migrar para import)
- Nenhum teste escrito
- Nenhum error boundary por página (só no dashboard raiz)
