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
