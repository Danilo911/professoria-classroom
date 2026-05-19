# Regras de UI — ProfessorIA Classroom

## Design Tokens

Todas as cores, espaçamentos e tipografia usam **CSS custom properties** do globals.css. Nunca hardcode valores.

### Cores

--primary (#6366F1) — Botões, links, elementos ativos
--primary-dark (#4F46E5) — Hover de botões primários
--primary-50 (#EEF2FF) — Sidebar active, backgrounds leves
--secondary (#8B5CF6) — Gradientes, accent
--success (#10B981) — Toast success, badges present
--danger (#EF4444) — Toast error, badges absent, remoção
--warning (#F59E0B) — Toast warning, badges late
--info (#3B82F6) — Badges info
--text-primary (#0F172A) — Títulos e body
--text-secondary (#475569) — Subtítulos, descrições
--text-muted (#94A3B8) — Placeholder, metadados
--bg-primary (#F8FAFC) — Fundo da página
--bg-secondary (#F1F5F9) — Fundo de cards hover, inputs
--bg-surface (#FFFFFF) — Fundo de cards, sidebar, modais
--border (#E2E8F0) — Bordas padrão

### Espaçamento (escala de 4px)

--space-1 = 4px
--space-2 = 8px
--space-3 = 12px
--space-4 = 16px
--space-5 = 20px
--space-6 = 24px
--space-8 = 32px
--space-10 = 40px
--space-12 = 48px

Regra: padding, margin, gap sempre usam --space-N. Exceção: border-radius usa --radius-*.

### Tipografia

--text-xs = 12px — Badges, metadados
--text-sm = 13px — Labels de formulário
--text-base = 14px — Body, botões, inputs
--text-lg = 15px — Subtítulos de card
--text-xl = 18px — Títulos de card
--text-2xl = 20px — Títulos de modal
--text-3xl = 24px — Título de página (h1)
--text-4xl = 32px — Stats no dashboard

Fontes: Inter (corpo) + Outfit (headings). Carregadas via Google Fonts no root layout.

### Sombras

--shadow-sm — Cards padrão
--shadow-md — Cards hover
--shadow-lg — Cards interactive hover
--shadow-xl — Toast, modais
--shadow-glow — Botões primários

### Bordas

--radius-sm = 6px
--radius-md = 8px — Botões, inputs
--radius-lg = 12px — Cards, toast
--radius-xl = 16px
--radius-2xl = 24px
--radius-full = 9999px — Badges, avatares

## Classes CSS Obrigatórias

### Card
.card — Container com borda, sombra, bg-surface
.card-interactive — Adiciona hover com translateY(-2px) + shadow-lg

### Botões
.btn — Base (inline-flex, gap 8px, padding 10px 20px, font 14px 500)
  + .btn-primary — Gradiente indigo, shadow, white text
  + .btn-secondary — bg-secondary, border, texto normal
  + .btn-ghost — Transparente, texto secondary
  + .btn-danger — Vermelho
  + .btn-sm — Padding 6px 12px, font 13px
  + .btn-lg — Padding 14px 28px, font 16px
  + .btn-icon — Padding 8px, quadrado

### Input
.input — Largura total, padding 10px 14px, focus ring primary

### Badge
.badge — Inline-flex, pill, font 12px 600
.badge-present — Fundo verde claro
.badge-absent — Fundo vermelho claro
.badge-late — Fundo âmbar claro
.badge-info — Fundo azul claro

### Avatar
.avatar — Círculo, object-fit cover
  + .avatar-sm = 32px
  + .avatar-md = 40px
  + .avatar-lg = 56px
  + .avatar-xl = 80px
.avatar-placeholder — Gradiente, iniciais, white text

### Sidebar
.sidebar — 260px, border-right
.sidebar-collapsed — 72px
.sidebar-link — Flex, gap 12px, padding 10px 16px, radius-md
.sidebar-link.active — Primary-50 bg, primary text

### Attendance
.attendance-grid — Grid auto-fill, minmax(100px, 1fr), gap 12px
.attendance-card — Flex column, center, border 2px, cursor pointer
.attendance-card[data-status="present"] — Borda verde
.attendance-card[data-status="absent"] — Borda vermelha
.attendance-card[data-status="late"] — Borda âmbar

## Regras de Uso

1. **Sempre prefira className a style={}** — use classes do globals.css para tudo que é estrutura/layout
2. **style={} apenas para valores dinâmicos** — ex: orderColor: cat.color, ackground: user.bgColor
3. **Nunca hardcode cores, espaçamentos ou fontes** — sempre use ar(--token)
4. **Nunca use valores ímpares** — espaçamento sempre múltiplo de 4
5. **Botões de ação principal sempre tn-primary** — ação destrutiva usa tn-danger
6. **Links de navegação usam sidebar-link** — não reinventar no layout
7. **Formulários seguem o padrão FormField** — label + input com gap consistente

## Dark Mode

O tema dark é ativado pela classe .dark no <html> (gerenciado por 
ext-themes).
As variáveis CSS já têm valores para dark mode. Não é necessário escrever CSS dark extra — só usar os tokens.

## Responsivo

Breakpoint: 768px
- Sidebar vira overlay (posição fixed, left -100%, toggle via .open)
- Attendance grid reduz para minmax(80px, 1fr)
- Conteúdo principal perde margin-left
- Mobile header aparece (sticky top)
