import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateReport, buildReportPrompt, type GeminiReportRequest } from '@/lib/gemini'

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
    const { provider: preferredProvider, classId, ...reportRequest } = body

    if (!reportRequest.type) {
      return NextResponse.json({ error: 'Tipo de relatório é obrigatório' }, { status: 400 })
    }

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
          // Filtra habilidades de Libras/Língua de Sinais (inclusão — só cita se pedido nas observações)
          qsnSkills = skills.filter(s => {
            const text = `${s.description} ${s.axis || ''}`.toLowerCase()
            return !text.includes('libras') && !text.includes('língua de sinais')
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
      { error: error instanceof Error ? error.message : 'Erro ao gerar relatório' },
      { status: 500 }
    )
  }
}
