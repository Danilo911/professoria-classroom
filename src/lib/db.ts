import { createClient } from './supabase/client'
import type {
  Teacher, Class, Student, Enrollment, Guardian,
  AttendanceSession, AttendanceRecord, DiaryEntry,
  StudentObservation, AIReport, GierSubmission,
  CurriculumSkill, SkillAssessment, LessonPlan, School, Grade,
} from '@/types'

// Cache de sessão para evitar N chamadas auth.getUser()
let cachedUserId: string | null = null
let cachePromise: Promise<string | null> | null = null

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

  const { data } = await supabase
    .from('teachers')
    .select('*, school:schools(*)')
    .eq('id', userId)
    .single()
  return data
}

// ==================== CLASSES ====================

export async function getClasses(): Promise<Class[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('classes')
    .select('*')
    .eq('is_active', true)
    .order('name')
  return data || []
}

export async function createClass(input: {
  name: string; grade: string; period: string; year?: number
}): Promise<Class> {
  const supabase = createClient()
  const userId = await getUserId()

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
  const supabase = createClient()
  const { data } = await supabase
    .from('enrollments')
    .select('student:students(*)')
    .eq('class_id', classId)
    .eq('status', 'active')
    .order('enrolled_at')

  const result: Student[] = []
  data?.forEach((e: Record<string, unknown>) => {
    const student = Array.isArray(e.student) ? e.student[0] : e.student
    if (student) result.push(student as Student)
  })
  return result
}

export async function getTransfers(classId: string): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('enrollments')
    .select('student_id, transferred_at')
    .eq('class_id', classId)
    .eq('status', 'active')
    .not('transferred_at', 'is', null)

  const result: Record<string, string> = {}
  data?.forEach((e: Record<string, unknown>) => {
    if (e.transferred_at && e.student_id) result[e.student_id as string] = e.transferred_at as string
  })
  return result
}

export async function saveTransfer(classId: string, studentId: string, date: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('enrollments')
    .update({ transferred_at: date })
    .eq('class_id', classId)
    .eq('student_id', studentId)
  if (error) throw error
}

export async function removeTransfer(classId: string, studentId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('enrollments')
    .update({ transferred_at: null })
    .eq('class_id', classId)
    .eq('student_id', studentId)
  if (error) throw error
}

export async function addStudent(classId: string, fullName: string): Promise<Student> {
  const supabase = createClient()
  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({ full_name: fullName })
    .select()
    .single()
  if (studentError) throw studentError

  const { error: enrollError } = await supabase
    .from('enrollments')
    .insert({ class_id: classId, student_id: student.id })
  if (enrollError) throw enrollError

  // Increment student_count on class
  await supabase.rpc('increment_class_student_count', { class_id: classId })

  return student
}

export async function updateStudent(id: string, fullName: string) {
  const supabase = createClient()
  const { error } = await supabase.from('students').update({ full_name: fullName }).eq('id', id)
  if (error) throw error
}

export async function removeStudent(id: string, classId: string) {
  const supabase = createClient()
  const { error: enrollError } = await supabase
    .from('enrollments')
    .update({ status: 'inactive' })
    .eq('student_id', id)
    .eq('class_id', classId)
  if (enrollError) throw enrollError

  await supabase.rpc('decrement_class_student_count', { class_id: classId })
}

export async function getStudent(id: string): Promise<Student | null> {
  const supabase = createClient()
  const { data } = await supabase.from('students').select('*').eq('id', id).single()
  return data
}

// ==================== ATTENDANCE ====================

export async function getSessionsByRange(classId: string, startDate: string, endDate: string): Promise<AttendanceSession[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('attendance_sessions')
    .select('*, records:attendance_records(student_id, status)')
    .eq('class_id', classId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  return data || []
}

export async function getSessionByDate(classId: string, date: string): Promise<AttendanceSession | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('attendance_sessions')
    .select('*, records:attendance_records(*, student:students(*))')
    .eq('class_id', classId)
    .eq('date', date)
    .maybeSingle()
  return data
}

export async function getTodaySession(classId: string): Promise<AttendanceSession | null> {
  const today = new Date().toISOString().split('T')[0]
  return getSessionByDate(classId, today)
}

export async function createAttendanceSession(classId: string, date?: string): Promise<AttendanceSession> {
  const supabase = createClient()
  const userId = await getUserId()
  const sessionDate = date || new Date().toISOString().split('T')[0]

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
  const supabase = createClient()
  await supabase.from('attendance_sessions').update({ completed: true }).eq('id', sessionId)
}

export async function getClassHolidays(classId: string, startDate: string, endDate: string): Promise<{ date: string; type: string; description: string | null }[]> {
  const supabase = createClient()
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
  return data || []
}

export async function upsertHoliday(classId: string, date: string, type: string = 'holiday', description: string | null = null) {
  const supabase = createClient()
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
  const supabase = createClient()
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
  let query = supabase.from('diary_entries').select('*').order('date', { ascending: false })
  if (classId) query = query.eq('class_id', classId)
  const { data } = await query
  return data || []
}

export async function createDiaryEntry(input: {
  class_id: string; type: string; title?: string; content: string; tags?: string[]; date?: string
}): Promise<DiaryEntry> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('diary_entries')
    .insert({ ...input, teacher_id: userId!, date: input.date || new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDiaryEntryByDate(classId: string, date: string): Promise<DiaryEntry | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('class_id', classId)
    .eq('date', date)
    .maybeSingle()
  return data
}

export async function updateDiaryEntry(id: string, input: { title?: string; content: string; type?: string }): Promise<DiaryEntry> {
  const supabase = createClient()
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
  let query = supabase
    .from('student_observations')
    .select('*')
    .eq('student_id', studentId)
    .order('date', { ascending: false })
  if (classId) query = query.eq('class_id', classId)
  const { data } = await query
  return data || []
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
      date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== GRADES ====================

export async function getGrades(filters: { student_id?: string; class_id?: string; bimestre?: number }): Promise<Grade[]> {
  const supabase = createClient()
  let query = supabase.from('grades').select('*, student:students(*)')
  if (filters.student_id) query = query.eq('student_id', filters.student_id)
  if (filters.class_id) query = query.eq('class_id', filters.class_id)
  if (filters.bimestre) query = query.eq('bimestre', filters.bimestre)
  query = query.order('bimestre')
  const { data } = await query
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

  const [enrollments, gradesData, obsData] = await Promise.all([
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('status', 'active'),
    supabase.from('grades').select('nota').eq('class_id', classId),
    supabase.from('student_observations').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('severity', 'critical'),
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
  let query = supabase.from('lesson_plans').select('*').order('date_start', { ascending: false })
  if (classId) query = query.eq('class_id', classId)
  const { data } = await query
  return data || []
}

// ==================== CURRICULUM SKILLS ====================

export async function getSkills(grade?: string, source?: string): Promise<CurriculumSkill[]> {
  const supabase = createClient()
  let query = supabase.from('curriculum_skills').select('*').order('code')
  if (grade) query = query.eq('grade', grade)
  if (source) query = query.eq('source', source)
  const { data } = await query
  return data || []
}

export async function getCurriculumSkills(grade?: string, source?: string): Promise<CurriculumSkill[]> {
  const supabase = createClient()
  let query = supabase.from('curriculum_skills').select('*').order('code')
  if (grade) {
    // Match grade containing the class grade (e.g. "1º Ano" matches "1º Ano/2º Ano/3º Ano/4º Ano")
    query = query.ilike('grade', `%${grade}%`)
  }
  if (source) query = query.eq('source', source)
  const { data } = await query
  return data || []
}

export async function getClass(id: string): Promise<Class | null> {
  const supabase = createClient()
  const { data } = await supabase.from('classes').select('*').eq('id', id).single()
  return data
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
  let query = supabase.from('ai_reports').select('*').order('created_at', { ascending: false })
  if (filters.class_id) query = query.eq('class_id', filters.class_id)
  if (filters.student_id) query = query.eq('student_id', filters.student_id)
  if (filters.type) query = query.eq('type', filters.type)
  const { data } = await query
  return data || []
}

export async function saveAIReport(input: {
  class_id?: string; student_id?: string; type: string; content: string; prompt_context?: Record<string, unknown>
}): Promise<AIReport> {
  const supabase = createClient()
  const userId = await getUserId()
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
  const { data } = await query
  return (data || []) as GierSubmission[]
}

export async function saveGierSubmission(input: {
  class_id?: string
  original_file_url?: string
  file_type?: 'image' | 'pdf' | 'docx'
  ocr_extracted_text?: string
  ai_interpretation?: {
    component: string
    skill_code: string
    skill_description: string
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
  const supabase = createClient()
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
  const supabase = createClient()
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
      // Fallback: insert without select, then find by name
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
