<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Fuso horário padronizado

- **Timezone padrão:** `America/Sao_Paulo` (Brasília)
- **Utility:** `src/lib/dates.ts` — use `getTodayISO()` para obter a data atual no fuso BR, `formatDateBR()` para exibir datas no formato brasileiro, `formatDateTimeBR()` para exibir data+hora.
- **Nunca** use `new Date().toISOString().slice(0, 10)` — sempre `getTodayISO()`.
- **Nunca** use `new Date(dateStr + 'T12:00:00')` para exibir — sempre `formatDateBR()`.
- Novas funções que trabalhem com data/hora devem usar essas funções de `src/lib/dates.ts`.

# Dados Curriculares (QSN / GIER)

## Estrutura dos dados
- **Fonte primária:** `qsn_curriculo_completo.xlsx` (raiz do projeto) — 2.584 registros, 11 disciplinas, 1 planilha única com abas por componente
- **Dados brutos do PDF:** `tmp-fundamental.txt` (texto extraído do `Ensino Fundamental_digital.pdf`)
- **Pasta de planilhas individuais:** `planilhas_componentes/` (11 arquivos .xlsx, um por disciplina)
- **CSV estruturado:** `supabase/qsn_fundamental_estruturado.csv`

## Hierarquia dos dados
```
ComponenteCurricular → Eixo → UTE → SABER → APR
                                              └── Ciclo (1º-5º Ano, atribuído heurística modulo-4)
```

## Componentes extraídos do QSN Fundamental
| Componente | Registros (c/ anos) |
|---|---|
| Libras | 770 |
| Matemática | 278 |
| Língua Portuguesa | 268 |
| Cultura de Paz | 250 |
| Arte | 244 |
| Inglês | 202 |
| Educação Física | 152 |
| Ciências | 146 |
| Educação Digital | 122 |
| História | 86 |
| Geografia | 66 |

## Scripts relevantes
- `scripts/parse-qsn-structured.ts` — parser heurístico: extrai Componente→UTE→SABER→APR do `tmp-fundamental.txt`
- `scripts/gerar-excel-componentes.ts` — gera 1 Excel por componente (igual ao GIER Português)
- `scripts/gerar-planilha-unificada.ts` — gera `qsn_curriculo_completo.xlsx` com todas disciplinas + anos (opção C)
- `scripts/parse-qsn.ts` — parser original (SABER+APR combinados, NÃO usar mais)
- `scripts/extract-qsn.ts` — parser via Gemini (qualidade baixa, NÃO usar)

## Extração GIER (Língua Portuguesa 1º Ano)
- Fonte: `C:\Users\Administrator\Desktop\dropdowns do gier portugues.docx`
- Planilha final: `C:\Users\Administrator\Desktop\gier_portugues_dropdowns.xlsx` (248 APRs, 6 UTEs)
- Processo de extração: abrir GIER no navegador, F12 → Console, executar script para capturar dropdowns, colar resultados no docx

## Mapeamento QSN → GIER
As heurísticas de ano são aproximadas. Para dados exatos ano a ano, extrair do GIER diretamente (processo manual via F12).

## GIER API Response (Gerador de GIER)
- **Interface:** `GeminiGierResponse` em `src/lib/gemini.ts`
- **Campos:** `{ extractedText, component, ute, saber, apr, description }`
- **Prompt da IA:** Pede para identificar: texto extraído, componente curricular, UTE (Unidade Temática), SABER, APR (Aprendizagem específica), e descrição pedagógica para GIER
- **Grammar check:** Todos os campos de texto passam por LanguageTool
- **Frontend:** Layout em cartão com: header colorido, texto extraído, card com Componente/UTE/SABER/APR, descrição GIER editável
- **Arquivos:** `src/app/dashboard/gier/page.tsx` (autenticado), `src/app/gier/page.tsx` (público)
- **Database:** `ai_interpretation` armazena `{ component, ute, saber, apr, description, activity_type }`

# Ferramentas do Professor

A página `/dashboard/ferramentas` agrega utilitários para o dia a dia do professor. Cada ferramenta é uma sub-rota com seu próprio `page.tsx`.

## Como adicionar uma nova ferramenta

1. **Criar a página** em `src/app/dashboard/ferramentas/<slug>/page.tsx`
2. **Registrar o card** — adicionar item ao array `tools` em `src/app/dashboard/ferramentas/page.tsx`:
   ```ts
   { id: '<slug>', title: 'Nome Visível', desc: 'Descrição curta', icon: NomeIcone, color: '#HEX' }
   ```
3. **Mapear a cor** — adicionar entrada no objeto `colorMap` no mesmo arquivo:
   ```ts
   '<slug>': '#HEX',
   ```
4. **Importar o ícone** de `lucide-react` no topo do arquivo.

## Padrão da página de cada ferramenta

```tsx
'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function MinhaFerramentaPage() {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push('/dashboard/ferramentas')} className="btn btn-sm btn-ghost" style={{ padding: 8 }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: 20 }}>Nome da Ferramenta</h1>
      </div>
      {/* Conteúdo: iframe para apps externos, ou HTML/JS nativo */}
    </div>
  )
}
```

Para ferramentas externas que rodam 100% no navegador, usar `<iframe>` com `height: 'calc(100vh - 120px)'` para ocupar toda a altura disponível.
