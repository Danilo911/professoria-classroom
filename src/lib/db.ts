import { createClient } from './supabase/client'
import type {
  Teacher, Class, Student, Enrollment, Guardian,
  AttendanceSession, AttendanceRecord, DiaryEntry,
  StudentObservation, AIReport, GierSubmission,
  CurriculumSkill, SkillAssessment, LessonPlan, School,
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

  const result: Student[] = []
  data?.forEach((e: any) => { if (e.student) result.push(e.student) })
  return result
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

export async function getClassHolidays(classId: string, startDate: string, endDate: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('class_holidays')
    .select('date')
    .eq('class_id', classId)
    .gte('date', startDate)
    .lte('date', endDate)
  return data?.map(d => d.date) || []
}

export async function upsertHoliday(classId: string, date: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('class_holidays')
    .upsert({ class_id: classId, date }, { onConflict: 'class_id,date' })
  if (error) throw error
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
  class_id: string; type: string; title?: string; content: string; tags?: string[]
}): Promise<DiaryEntry> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('diary_entries')
    .insert({ ...input, teacher_id: userId!, date: new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) throw error
  return data
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

export async function insertSkills(skills: Omit<CurriculumSkill, 'id' | 'created_at'>[]) {
  const supabase = createClient()
  const { error } = await supabase.from('curriculum_skills').upsert(
    skills,
    { onConflict: 'code', ignoreDuplicates: false }
  )
  if (error) throw error
}

// ==================== AI REPORTS ====================

export async function saveAIReport(input: {
  class_id?: string; student_id?: string; type: string; content: string; prompt_context?: any
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

  // Get current teacher to see if they already have a school
  const { data: teacher } = await supabase.from('teachers').select('school_id').eq('id', userId).single()

  if (teacher?.school_id) {
    const { error } = await supabase.from('schools').update(data).eq('id', teacher.school_id)
    if (error) throw error
  } else {
    const { data: school, error } = await supabase.from('schools').insert(data).select().single()
    if (error) throw error
    await supabase.from('teachers').update({ school_id: school.id }).eq('id', userId)
  }
}
