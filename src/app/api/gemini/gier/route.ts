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
    const body: GeminiGierRequest & { classId?: string } = await request.json()

    if (!body.imageBase64 && !body.textDescription) {
      return NextResponse.json({ error: 'Imagem ou texto é obrigatório' }, { status: 400 })
    }

    // Fetch QSN skills if classId is provided
    let qsnSkills: GeminiGierRequest['qsnSkills'] = undefined
    if (body.classId) {
      const { data: classData } = await supabase
        .from('classes')
        .select('grade')
        .eq('id', body.classId)
        .single()

      if (classData?.grade) {
        const { data: skills } = await supabase
          .from('curriculum_skills')
          .select('code, description, component, axis, grade')
          .ilike('grade', `%${classData.grade}%`)
          .eq('source', 'qsn')
          .limit(30)

        if (skills && skills.length > 0) {
          qsnSkills = skills.filter(s => {
            const text = `${s.description} ${s.axis || ''}`.toLowerCase()
            return !text.includes('libras') && !text.includes('língua de sinais')
          })
        }
      }
    }

    const result = await analyzeGier({ ...body, qsnSkills })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Gemini gier error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao analisar atividade' },
      { status: 500 }
    )
  }
}
