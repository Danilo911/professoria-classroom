import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateReport, type GeminiReportRequest } from '@/lib/gemini'

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
    const body: GeminiReportRequest = await request.json()

    if (!body.type) {
      return NextResponse.json({ error: 'Tipo de relatório é obrigatório' }, { status: 400 })
    }

    const result = await generateReport(body)

    return NextResponse.json({ content: result })
  } catch (error) {
    console.error('Gemini report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar relatório' },
      { status: 500 }
    )
  }
}
