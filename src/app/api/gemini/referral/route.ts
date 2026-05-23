import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateReport } from '@/lib/gemini'
import { ReferralRequestSchema } from '@/lib/validation'

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
    const body = await request.json()

    // Validate input
    const parsed = ReferralRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const { content, provider } = await generateReport({
      type: 'referral',
      studentName: body.studentName,
      className: body.className,
      observations: body.observations,
      referralType: body.referralType,
    })

    return NextResponse.json({ content, provider })
  } catch (error) {
    console.error('Referral error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar encaminhamento' },
      { status: 500 }
    )
  }
}
