# ProfessorIA Classroom

Plataforma inteligente para professores da educação básica. Automatize chamadas, diários, relatórios e planejamentos com auxílio de IA.

## Features

- Chamada inteligente com fotos
- Diário pedagógico automatizado
- Pareceres descritivos com IA
- Gerador GIER (análise de atividades)
- Planejamento de aulas com sugestões inteligentes
- Currículo BNCC/QSN integrado

## Stack

- **Framework:** Next.js 16 + React 19
- **Database/Auth:** Supabase
- **AI:** Google Gemini Flash (free tier)
- **Styling:** Tailwind CSS v4
- **State:** Zustand

## Getting Started

### 1. Clone e instale as dependências

```bash
npm install
```

### 2. Configure as variáveis de ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha as variáveis:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: crie um projeto gratuito em [supabase.com](https://supabase.com)
- `GEMINI_API_KEY`: obtenha gratuitamente em [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### 3. Execute o servidor de desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Google Gemini - Free Tier

O projeto usa **Gemini 2.0 Flash** via API gratuita:

- **15 requests/minuto**
- **1M tokens/dia**
- **Sem custo** para uso pessoal

Para obter sua API key:
1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Faça login com sua conta Google
3. Clique em "Create API Key"
4. Cole a key no `.env.local` como `GEMINI_API_KEY`

## Deploy

### Netlify (frontend)

1. Conecte seu repositório ao Netlify
2. Adicione as variáveis de ambiente no painel do Netlify
3. Deploy automático a cada push

### Supabase (backend)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com)
2. Configure as tabelas conforme `src/types/database.ts`
3. Adicione as credenciais no `.env.local` e no Netlify

## License

MIT
