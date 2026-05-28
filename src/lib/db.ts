import { createClient } from './supabase/client'
import type {
  Teacher, Class, Student, Enrollment, Guardian,
  AttendanceSession, AttendanceRecord, DiaryEntry,
  StudentObservation, AIReport, GierSubmission,
  CurriculumSkill, SkillAssessment, LessonPlan, School, Grade,
  Rubric, RubricEvaluation, ClassHoliday,
} from '@/types'
import { getTodayISO } from '@/lib/dates'

let cachedUserId: string | null = null
let cachePromise: Promise<string | null> | null = null

export function clearUserCache() {
  cachedUserId = null
  cachePromise = null
}

async function getUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId
  if (cachePromise) return cachePromise

  cachePromise = (async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    cachedUserId = user?.id || null
    return cachedUserId
  })()

  return cachePromise
}

// ==================== TEACHER ====================

export async function getTeacher(): Promise<Teacher | null> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from('teachers')
    .select('*, school:schools(*)')
    .eq('id', userId)
    .single()
  if (error) console.error('getTeacher:', error.message)
  return data || null
}

// ==================== CLASSES ====================

export async function getClasses(): Promise<Class[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', userId!)
    .is('is_active', true)
    .order('name')
  if (error) console.error('getClasses:', error.message)
  return data || []
}

export async function createClass(input: {
  name: string; grade: string; period: string; year?: number
}): Promise<Class> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('classes')
    .insert({ ...input, teacher_id: userId!, year: input.year || new Date().getFullYear() })
    .select()
    .single()

  if (error) throw error
  return data
}

// ==================== STUDENTS ====================

export async function getClassStudents(classId: string): Promise<Student[]> {
  const userId = await getUserId()
  if (!userId) return []
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) return []

  const { data, error } = await supabase
    .from('enrollments')
    .select('student:students(*)')
    .eq('class_id', classId)
    .eq('status', 'active')
    .order('enrolled_at')

  if (error) console.error('getClassStudents:', error.message)
  const result: Student[] = []
  data?.forEach((e: Record<string, unknown>) => {
    const student = Array.isArray(e.student) ? e.student[0] : e.student
    if (student) result.push(student as Student)
  })
  return result
}

export async function getTransfers(classId: string): Promise<Record<string, string>> {
  const userId = await getUserId()
  if (!userId) return {}
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) return {}

  const { data, error } = await supabase
    .from('enrollments')
    .select('student_id, transferred_at')
    .eq('class_id', classId)
    .eq('status', 'active')
    .not('transferred_at', 'is', null)

  if (error) console.error('getTransfers:', error.message)
  const result: Record<string, string> = {}
  data?.forEach((e: Record<string, unknown>) => {
    if (e.transferred_at && e.student_id) result[e.student_id as string] = e.transferred_at as string
  })
  return result
}

export async function saveTransfer(classId: string, studentId: string, date: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { error } = await supabase
    .from('enrollments')
    .update({ transferred_at: date })
    .eq('class_id', classId)
    .eq('student_id', studentId)
  if (error) throw error
}

export async function removeTransfer(classId: string, studentId: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { error } = await supabase
    .from('enrollments')
    .update({ transferred_at: null })
    .eq('class_id', classId)
    .eq('student_id', studentId)
  if (error) throw error
}

export async function addStudent(classId: string, fullName: string): Promise<Student> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({ full_name: fullName })
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
  return student
}

export async function updateStudent(id: string, fullName: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: enrollment } = await supabase.from('enrollments').select('class_id').eq('student_id', id).limit(1).single()
  if (enrollment) {
    const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', enrollment.class_id).single()
    if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')
  }

  const { error } = await supabase.from('students').update({ full_name: fullName }).eq('id', id)
  if (error) throw error
}

export async function removeStudent(id: string, classId: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { error: enrollError } = await supabase
    .from('enrollments')
    .update({ status: 'inactive' })
    .eq('student_id', id)
    .eq('class_id', classId)
  if (enrollError) throw enrollError

  await supabase.rpc('decrement_class_student_count', { class_id: classId })
}

export async function getStudent(id: string): Promise<Student | null> {
  const userId = await getUserId()
  if (!userId) return null
  const supabase = createClient()
  const { data: enrollment } = await supabase.from('enrollments').select('class_id').eq('student_id', id).limit(1).single()
  if (enrollment) {
    const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', enrollment.class_id).single()
    if (!cls || cls.teacher_id !== userId) return null
  }

  const { data, error } = await supabase.from('students').select('*').eq('id', id).single()
  if (error) console.error('getStudent:', error.message)
  return data || null
}

// ==================== ATTENDANCE ====================

export async function getSessionsByRange(classId: string, startDate: string, endDate: string): Promise<AttendanceSession[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*, records:attendance_records(student_id, status)')
    .eq('class_id', classId)
    .eq('teacher_id', userId!)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  if (error) console.error('getSessionsByRange:', error.message)
  return data || []
}

export async function getSessionByDate(classId: string, date: string): Promise<AttendanceSession | null> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*, records:attendance_records(*, student:students(*))')
    .eq('class_id', classId)
    .eq('teacher_id', userId!)
    .eq('date', date)
    .maybeSingle()
  if (error) console.error('getSessionByDate:', error.message)
  return data || null
}

export async function getTodaySession(classId: string): Promise<AttendanceSession | null> {
  const today = getTodayISO()
  return getSessionByDate(classId, today)
}

export async function createAttendanceSession(classId: string, date?: string): Promise<AttendanceSession> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const sessionDate = date || getTodayISO()

  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({ class_id: classId, teacher_id: userId!, date: sessionDate })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function saveAttendanceRecords(
  sessionId: string,
  records: { student_id: string; status: string }[]
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('attendance_records')
    .upsert(
      records.map(r => ({ session_id: sessionId, ...r })),
      { onConflict: 'session_id,student_id' }
    )
  if (error) throw error
}

export async function completeSession(sessionId: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: session } = await supabase.from('attendance_sessions').select('teacher_id').eq('id', sessionId).single()
  if (!session || session.teacher_id !== userId) throw new Error('Sem permissão')

  await supabase.from('attendance_sessions').update({ completed: true }).eq('id', sessionId)
}

export async function getClassHolidays(classId: string, startDate: string, endDate: string): Promise<ClassHoliday[]> {
  const userId = await getUserId()
  if (!userId) return []
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) return []

  const { data, error } = await supabase
    .from('class_holidays')
    .select('date, type, description')
    .eq('class_id', classId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
  if (error) {
    console.warn('getClassHolidays: columns type/description not found, falling back. Run migration 004.')
    const { data: fallback } = await supabase
      .from('class_holidays')
      .select('date')
      .eq('class_id', classId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
    return (fallback || []).map(d => ({ date: d.date, type: 'holiday', description: null }))
  }
  return (data || []) as ClassHoliday[]
}

export async function upsertHoliday(classId: string, date: string, type: string = 'holiday', description: string | null = null) {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { error } = await supabase
    .from('class_holidays')
    .upsert({ class_id: classId, date, type, description }, { onConflict: 'class_id,date' })
  if (error) {
    if (error.message?.includes('type') || error.message?.includes('column')) {
      const { error: fallbackError } = await supabase
        .from('class_holidays')
        .upsert({ class_id: classId, date }, { onConflict: 'class_id,date' })
      if (fallbackError) throw fallbackError
    } else {
      throw error
    }
  }
}

export async function deleteHoliday(classId: string, date: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()
  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { error } = await supabase
    .from('class_holidays')
    .delete()
    .eq('class_id', classId)
    .eq('date', date)
  if (error) throw error
}

// ==================== DIARY ====================

export async function getDiaryEntries(classId?: string): Promise<DiaryEntry[]> {
  const supabase = createClient()
  const userId = await getUserId()
  let query = supabase.from('diary_entries').select('*').eq('teacher_id', userId!).order('date', { ascending: false })
  if (classId) query = query.eq('class_id', classId)
  const { data, error } = await query
  if (error) console.error('getDiaryEntries:', error.message)
  return data || []
}

export async function createDiaryEntry(input: {
  class_id: string; type: string; title?: string; content: string; tags?: string[]; date?: string
}): Promise<DiaryEntry> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('diary_entries')
    .insert({ ...input, teacher_id: userId!, date: input.date || getTodayISO() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDiaryEntryByDate(classId: string, date: string): Promise<DiaryEntry | null> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('class_id', classId)
    .eq('teacher_id', userId!)
    .eq('date', date)
    .maybeSingle()
  if (error) console.error('getDiaryEntryByDate:', error.message)
  return data || null
}

export async function updateDiaryEntry(id: string, input: { title?: string; content: string; type?: string }): Promise<DiaryEntry> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()

  const { data: existing } = await supabase.from('diary_entries').select('teacher_id').eq('id', id).single()
  if (!existing || existing.teacher_id !== userId) throw new Error('Sem permissão')

  const { data, error } = await supabase
    .from('diary_entries')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== STUDENT OBSERVATIONS ====================

export async function getStudentObservations(studentId: string, classId?: string): Promise<StudentObservation[]> {
  const supabase = createClient()
  const userId = await getUserId()
  let query = supabase
    .from('student_observations')
    .select('*')
    .eq('student_id', studentId)
    .eq('teacher_id', userId!)
    .order('date', { ascending: false })
  if (classId) query = query.eq('class_id', classId)
  const { data, error } = await query
  if (error) console.error('getStudentObservations:', error.message)
  return data || []
}

export async function getBatchStudentObservations(classId: string): Promise<Record<string, StudentObservation[]>> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return {}
  const { data, error } = await supabase
    .from('student_observations')
    .select('*')
    .eq('class_id', classId)
    .eq('teacher_id', userId)
    .order('date', { ascending: false })
  if (error) console.error('getBatchStudentObservations:', error.message)
  const result: Record<string, StudentObservation[]> = {}
  for (const obs of (data || [])) {
    if (!result[obs.student_id]) result[obs.student_id] = []
    result[obs.student_id].push(obs)
  }
  return result
}

export async function createStudentObservation(input: {
  student_id: string; class_id: string; category: string; content: string; severity?: string; is_private?: boolean
}): Promise<StudentObservation> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('student_observations')
    .insert({
      ...input,
      teacher_id: userId!,
      date: getTodayISO(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStudentObservation(id: string, input: {
  category?: string; content?: string; severity?: string; is_private?: boolean
}): Promise<StudentObservation> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('student_observations')
    .update(input)
    .eq('id', id)
    .eq('teacher_id', userId!)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStudentObservation(id: string): Promise<void> {
  const supabase = createClient()
  const userId = await getUserId()
  const { error } = await supabase
    .from('student_observations')
    .delete()
    .eq('id', id)
    .eq('teacher_id', userId!)
  if (error) throw error
}

// ==================== GRADES ====================

export async function getGrades(filters: { student_id?: string; class_id?: string; bimestre?: number }): Promise<Grade[]> {
  const supabase = createClient()
  const userId = await getUserId()
  let query = supabase.from('grades').select('*, student:students(*)').eq('teacher_id', userId!)
  if (filters.student_id) query = query.eq('student_id', filters.student_id)
  if (filters.class_id) query = query.eq('class_id', filters.class_id)
  if (filters.bimestre) query = query.eq('bimestre', filters.bimestre)
  query = query.order('bimestre')
  const { data, error } = await query
  if (error) console.error('getGrades:', error.message)
  return data || []
}

export async function upsertGrade(input: {
  student_id: string; class_id: string; subject: string; bimestre: number; nota: number | null
}): Promise<Grade> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('grades')
    .upsert({
      ...input,
      teacher_id: userId!,
    }, { onConflict: 'student_id,class_id,subject,bimestre' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== CLASS SUMMARY ====================

export async function getClassSummary(classId: string): Promise<{
  totalStudents: number
  averageGrade: number | null
  criticalObservations: number
}> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return { totalStudents: 0, averageGrade: null, criticalObservations: 0 }

  const [enrollments, gradesData, obsData] = await Promise.all([
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('status', 'active'),
    supabase.from('grades').select('nota').eq('class_id', classId).eq('teacher_id', userId),
    supabase.from('student_observations').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('teacher_id', userId).eq('severity', 'critical'),
  ])

  const notas = gradesData.data?.map(g => g.nota).filter((n): n is number => n !== null) || []
  const avg = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null

  return {
    totalStudents: enrollments.count || 0,
    averageGrade: avg ? Math.round(avg * 10) / 10 : null,
    criticalObservations: obsData.count || 0,
  }
}

// ==================== LESSON PLANS ====================

export async function getLessonPlans(classId?: string): Promise<LessonPlan[]> {
  const supabase = createClient()
  const userId = await getUserId()
  let query = supabase.from('lesson_plans').select('*').eq('teacher_id', userId!).order('date_start', { ascending: false })
  if (classId) query = query.eq('class_id', classId)
  const { data, error } = await query
  if (error) console.error('getLessonPlans:', error.message)
  return data || []
}

// ==================== CURRICULUM SKILLS ====================

export async function getCurriculumSkills(grade?: string, source?: string): Promise<CurriculumSkill[]> {
  const supabase = createClient()
  let query = supabase.from('curriculum_skills').select('*').order('code')
  if (grade) {
    query = query.ilike('grade', `%${grade}%`)
  }
  if (source) query = query.eq('source', source)
  const { data, error } = await query
  if (error) console.error('getCurriculumSkills:', error.message)
  return data || []
}

export async function getClass(id: string): Promise<Class | null> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return null
  const { data, error } = await supabase.from('classes').select('*').eq('id', id).eq('teacher_id', userId).single()
  if (error) console.error('getClass:', error.message)
  return data || null
}

export async function insertSkills(skills: Omit<CurriculumSkill, 'id' | 'created_at'>[]) {
  const supabase = createClient()
  const { error } = await supabase.from('curriculum_skills').upsert(
    skills,
    { onConflict: 'code', ignoreDuplicates: false }
  )
  if (error) throw error
}

// ==================== AI REPORTS ====================

export async function getAIReports(filters: { class_id?: string; student_id?: string; type?: string }): Promise<AIReport[]> {
  const supabase = createClient()
  const userId = await getUserId()
  let query = supabase.from('ai_reports').select('*').eq('teacher_id', userId!).order('created_at', { ascending: false })
  if (filters.class_id) query = query.eq('class_id', filters.class_id)
  if (filters.student_id) query = query.eq('student_id', filters.student_id)
  if (filters.type) query = query.eq('type', filters.type)
  const { data, error } = await query
  if (error) console.error('getAIReports:', error.message)
  return data || []
}

export async function saveAIReport(input: {
  class_id?: string; student_id?: string; type: string; content: string; prompt_context?: Record<string, unknown>
}): Promise<AIReport> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('ai_reports')
    .insert({
      ...input,
      teacher_id: userId!,
      prompt_context: input.prompt_context || {},
      model_used: 'gemini-2.0-flash',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAIReport(id: string, input: {
  content: string; status?: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('ai_reports')
    .update({ content: input.content, status: input.status || 'draft' })
    .eq('id', id)
  if (error) throw error
}

export async function deleteAIReport(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('ai_reports')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ==================== GIER SUBMISSIONS ====================

export async function getGierSubmissions(filters?: { class_id?: string }): Promise<GierSubmission[]> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return []

  let query = supabase
    .from('gier_submissions')
    .select('*, class:classes(name)')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false })

  if (filters?.class_id) query = query.eq('class_id', filters.class_id)
  const { data, error } = await query
  if (error) console.error('getGierSubmissions:', error.message)
  return (data || []) as GierSubmission[]
}

export async function saveGierSubmission(input: {
  class_id?: string
  original_file_url?: string
  file_type?: 'image' | 'pdf' | 'docx'
  ocr_extracted_text?: string
  ai_interpretation?: {
    component: string
    ute: string
    saber: string
    apr: string
    description: string
    activity_type?: string
  }
  gier_description: string
  status?: 'processing' | 'completed' | 'error' | 'reviewed'
  activity_date?: string
}): Promise<GierSubmission> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('gier_submissions')
    .insert({
      ...input,
      original_file_url: input.original_file_url || '',
      file_type: input.file_type || 'image',
      teacher_id: userId,
      status: input.status || 'completed'
    })
    .select('*, class:classes(name)')
    .single()

  if (error) throw error
  return data as GierSubmission
}

export async function updateGierSubmission(id: string, data: Partial<GierSubmission>): Promise<GierSubmission> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()

  const { data: existing } = await supabase.from('gier_submissions').select('teacher_id').eq('id', id).single()
  if (!existing || existing.teacher_id !== userId) throw new Error('Sem permissão')

  const { data: updated, error } = await supabase
    .from('gier_submissions')
    .update(data)
    .eq('id', id)
    .select('*, class:classes(name)')
    .single()

  if (error) throw error
  return updated as GierSubmission
}

export async function deleteGierSubmission(id: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()

  const { data: existing } = await supabase.from('gier_submissions').select('teacher_id').eq('id', id).single()
  if (!existing || existing.teacher_id !== userId) throw new Error('Sem permissão')

  const { error } = await supabase
    .from('gier_submissions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ==================== DASHBOARD STATS ====================

export async function getDashboardStats() {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return null

  const [classes, reports] = await Promise.all([
    supabase.from('classes').select('id, student_count').eq('teacher_id', userId).eq('is_active', true),
    supabase.from('ai_reports').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
  ])

  const totalStudents = classes.data?.reduce((acc, c) => acc + (c.student_count || 0), 0) || 0

  return {
    activeClasses: classes.data?.length || 0,
    totalStudents,
    aiReports: reports.count || 0,
  }
}

// ==================== UPDATE PROFILE ====================

export async function updateTeacher(data: { full_name?: string; phone?: string }) {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')

  const { error } = await supabase.from('teachers').update(data).eq('id', userId)
  if (error) throw error
}

export async function upsertSchool(data: { name: string; city?: string; state?: string; network?: string }) {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')

  const { data: teacher } = await supabase.from('teachers').select('school_id').eq('id', userId).single()

  if (teacher?.school_id) {
    const { error } = await supabase.from('schools').update(data).eq('id', teacher.school_id)
    if (error) throw error
  } else {
    const { data: school, error } = await supabase.from('schools').insert(data).select().single()
    if (error) {
      const { error: insertErr } = await supabase.from('schools').insert(data)
      if (insertErr) throw insertErr
      const { data: foundSchool } = await supabase.from('schools').select('id').eq('name', data.name).limit(1).single()
      if (foundSchool) {
        await supabase.from('teachers').update({ school_id: foundSchool.id }).eq('id', userId)
      }
      return
    }
    await supabase.from('teachers').update({ school_id: school.id }).eq('id', userId)
  }
}

// ==================== CLASS UPDATE/DELETE ====================

export async function updateClass(id: string, data: { name?: string; grade?: string; period?: string }): Promise<Class> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()

  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', id).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { data: updated, error } = await supabase
    .from('classes')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return updated
}

export async function deleteClass(id: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()

  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', id).single()
  if (!cls || cls.teacher_id !== userId) throw new Error('Sem permissão')

  const { error } = await supabase
    .from('classes')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ==================== RUBRICS ====================

export async function getRubrics(): Promise<Rubric[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('rubrics')
    .select('*, criteria:rubric_criteria(*), levels:rubric_levels(*)')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false })
  if (error) console.error('getRubrics:', error.message)
  return data || []
}

export async function getRubric(id: string): Promise<Rubric | null> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return null
  const { data, error } = await supabase
    .from('rubrics')
    .select('*, criteria:rubric_criteria(*), levels:rubric_levels(*)')
    .eq('id', id)
    .eq('teacher_id', userId!)
    .single()
  if (error) console.error('getRubric:', error.message)
  return data || null
}

export async function createRubric(input: {
  title: string
  type: 'rubric' | 'checklist'
  criteria: { description: string; sort_order: number }[]
  levels: { level: number; label: string; color: string }[]
}): Promise<Rubric> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data, error } = await supabase
    .from('rubrics')
    .insert({ teacher_id: userId, title: input.title, type: input.type })
    .select()
    .single()
  if (error) throw error

  if (input.criteria.length > 0) {
    const { error: errC } = await supabase.from('rubric_criteria').insert(
      input.criteria.map(c => ({ rubric_id: data.id, ...c }))
    )
    if (errC) throw errC
  }

  if (input.levels.length > 0) {
    const { error: errL } = await supabase.from('rubric_levels').insert(
      input.levels.map(l => ({ rubric_id: data.id, ...l }))
    )
    if (errL) throw errL
  }

  const rubric = await getRubric(data.id)
  return rubric!
}

export async function updateRubric(id: string, input: {
  title?: string
  criteria?: { description: string; sort_order: number }[]
  levels?: { level: number; label: string; color: string }[]
}): Promise<Rubric> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()

  const { data: existing } = await supabase.from('rubrics').select('teacher_id').eq('id', id).single()
  if (!existing || existing.teacher_id !== userId) throw new Error('Sem permissão')

  if (input.title) {
    const { error: titleErr } = await supabase.from('rubrics').update({ title: input.title }).eq('id', id)
    if (titleErr) throw titleErr
  }

  if (input.criteria) {
    const { error: delErr } = await supabase.from('rubric_criteria').delete().eq('rubric_id', id)
    if (delErr) throw delErr
    if (input.criteria.length > 0) {
      const { error: insErr } = await supabase.from('rubric_criteria').insert(
        input.criteria.map(c => ({ rubric_id: id, ...c }))
      )
      if (insErr) throw insErr
    }
  }

  if (input.levels) {
    const { error: delErr } = await supabase.from('rubric_levels').delete().eq('rubric_id', id)
    if (delErr) throw delErr
    if (input.levels.length > 0) {
      const { error: insErr } = await supabase.from('rubric_levels').insert(
        input.levels.map(l => ({ rubric_id: id, ...l }))
      )
      if (insErr) throw insErr
    }
  }

  const rubric = await getRubric(id)
  return rubric!
}

export async function deleteRubric(id: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Não autenticado')
  const supabase = createClient()

  const { data: existing } = await supabase.from('rubrics').select('teacher_id').eq('id', id).single()
  if (!existing || existing.teacher_id !== userId) throw new Error('Sem permissão')

  const { error } = await supabase.from('rubrics').delete().eq('id', id)
  if (error) throw error
}

export async function getRubricEvaluations(rubricId: string, classId: string, date?: string): Promise<RubricEvaluation[]> {
  const supabase = createClient()
  const userId = await getUserId()
  if (!userId) return []

  const { data: rubric } = await supabase.from('rubrics').select('teacher_id').eq('id', rubricId).single()
  if (!rubric || rubric.teacher_id !== userId) return []

  let query = supabase
    .from('rubric_evaluations')
    .select('*, student:students(*), scores:rubric_scores(*)')
    .eq('rubric_id', rubricId)
    .eq('class_id', classId)
  if (date) query = query.eq('evaluated_at', date)
  const { data, error } = await query.order('evaluated_at', { ascending: false })
  if (error) console.error('getRubricEvaluations:', error.message)
  return data || []
}

export async function saveRubricEvaluation(input: {
  rubricId: string
  studentId: string
  classId: string
  evaluatedAt: string
  notes?: string
  scores: { criterion_id: string; level: number }[]
}): Promise<RubricEvaluation> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data, error } = await supabase
    .from('rubric_evaluations')
    .upsert({
      rubric_id: input.rubricId,
      student_id: input.studentId,
      class_id: input.classId,
      teacher_id: userId,
      evaluated_at: input.evaluatedAt,
      notes: input.notes || null,
    }, { onConflict: 'rubric_id,student_id,class_id,evaluated_at' })
    .select()
    .single()

  if (error) throw error

  if (input.scores.length > 0) {
    await supabase.from('rubric_scores').delete().eq('evaluation_id', data.id)
    const { error: errS } = await supabase.from('rubric_scores').insert(
      input.scores.map(s => ({ evaluation_id: data.id, ...s }))
    )
    if (errS) throw errS
  }

  return data
}