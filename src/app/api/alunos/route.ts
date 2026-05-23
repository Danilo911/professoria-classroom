import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const { classId, fullName } = await request.json()
    if (!classId || !fullName) {
      return NextResponse.json({ error: 'classId e fullName obrigatórios' }, { status: 400 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verify teacher owns the class (RLS also enforces this)
    const { data: classData } = await supabase
      .from('classes')
      .select('teacher_id')
      .eq('id', classId)
      .single()
    if (!classData || classData.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão para esta turma' }, { status: 403 })
    }

    // Use the authenticated client (RLS policy teachers_insert_students
    // allows INSERT with CHECK true, and teachers_manage_enrollments
    // checks teacher_id via classes table)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert({ full_name: fullName.trim() })
      .select()
      .single()
    if (studentError) throw studentError

    const { error: enrollError } = await supabase
      .from('enrollments')
      .insert({ class_id: classId, student_id: student.id })
    if (enrollError) {
      await supabase.from('students').delete().eq('id', student.id)
      throw enrollError
    }

    await supabase.rpc('increment_class_student_count', { class_id: classId })

    return NextResponse.json(student)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'erro' }, { status: 500 })
  }
}
