import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateReport, buildReportPrompt, type GeminiReportRequest } from '@/lib/gemini'
import { GeminiReportRequestSchema } from '@/lib/validation'

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
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate input
    const parsed = GeminiReportRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados invalidos' }, { status: 400 })
    }

    const { provider: preferredProvider, classId, ...reportRequest } = body

    // Fetch QSN skills if classId is provided
    let qsnSkills: GeminiReportRequest['qsnSkills'] = undefined
    if (classId) {
      const { data: classData } = await supabase
        .from('classes')
        .select('grade')
        .eq('id', classId)
        .single()

      if (classData?.grade) {
        const { data: skills } = await supabase
          .from('curriculum_skills')
          .select('code, description, component, axis, grade')
          .ilike('grade', `%${classData.grade}%`)
          .eq('source', 'qsn')
          .limit(30)

        if (skills && skills.length > 0) {
          // Filtra habilidades de Libras/Lingua de Sinais (inclusao -- so cita se pedido nas observacoes)
          qsnSkills = skills.filter(s => {
            const text = `${s.description} ${s.axis || ''}`.toLowerCase()
            return !text.includes('libras') && !text.includes('lingua de sinais')
          })
        }
      }
    }

    const prompt = buildReportPrompt({ ...reportRequest, qsnSkills } as GeminiReportRequest)

    const { content, provider } = await generateReport({ ...reportRequest, qsnSkills, preferredProvider })

    return NextResponse.json({ content, prompt, provider, corrected: false })
  } catch (error) {
    console.error('AI report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar relatorio' },
      { status: 500 }
    )
  }
}
