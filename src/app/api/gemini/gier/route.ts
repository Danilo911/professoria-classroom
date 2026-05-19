import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { analyzeGier, type GeminiGierRequest } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body: GeminiGierRequest = await request.json()

    if (!body.imageBase64 && !body.textDescription) {
      return NextResponse.json({ error: 'Imagem ou texto é obrigatório' }, { status: 400 })
    }

    const result = await analyzeGier(body)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Gemini gier error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao analisar atividade' },
      { status: 500 }
    )
  }
}
