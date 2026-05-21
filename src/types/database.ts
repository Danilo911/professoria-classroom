// ==========================================
// ProfessorIA Classroom — Database Types
// ==========================================

export type UserRole = 'teacher' | 'coordinator' | 'admin'
export type SubscriptionPlan = 'free' | 'premium' | 'school'
export type SchoolNetwork = 'municipal' | 'estadual' | 'federal' | 'particular'
export type ClassPeriod = 'manha' | 'tarde' | 'integral'
export type EnrollmentStatus = 'active' | 'transferred' | 'inactive'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'justified'
export type DiaryEntryType = 'general' | 'activity' | 'incident' | 'achievement'
export type ObservationCategory = 'behavior' | 'difficulty' | 'evolution' | 'intervention' | 'general'
export type ObservationSeverity = 'info' | 'attention' | 'critical'
export type AIReportType = 'descriptive_report' | 'class_council' | 'parent_meeting' | 'pedagogical_suggestion' | 'progress_summary' | 'referral'

export const REFERRAL_TYPES = [
  { key: 'tea', label: 'Suspeita de TEA (Transtorno do Espectro Autista)', icon: '🧩' },
  { key: 'tod', label: 'Suspeita de TOD (Transtorno Opositivo-Desafiador)', icon: '⚡' },
  { key: 'tdah', label: 'Suspeita de TDAH (Déficit de Atenção / Hiperatividade)', icon: '🎯' },
  { key: 'fono', label: 'Avaliação Fonoaudiológica', icon: '🗣️' },
  { key: 'dentista', label: 'Avaliação Odontológica', icon: '🦷' },
  { key: 'oftalmo', label: 'Avaliação Oftalmológica', icon: '👁️' },
  { key: 'psicologo', label: 'Avaliação Psicológica', icon: '🧠' },
  { key: 'multi', label: 'Equipe Multidisciplinar', icon: '👥' },
  { key: 'outro', label: 'Outro encaminhamento', icon: '📋' },
] as const
export type ReportStatus = 'draft' | 'reviewed' | 'final'
export type GierFileType = 'image' | 'pdf' | 'docx'
export type GierStatus = 'processing' | 'completed' | 'error' | 'reviewed'
export type SkillLevel = 'not_started' | 'in_progress' | 'developing' | 'consolidated'
export type SkillSource = 'bncc' | 'qsn'
export type LessonPlanType = 'daily' | 'weekly' | 'sequence' | 'assessment'
export type LessonPlanStatus = 'draft' | 'active' | 'completed'

// ==========================================
// Models
// ==========================================

export interface Teacher {
  id: string
  full_name: string
  email: string
  phone?: string
  avatar_url?: string
  school_id?: string
  role: UserRole
  subscription_plan: SubscriptionPlan
  subscription_expires_at?: string
  preferences: Record<string, unknown>
  onboarding_completed: boolean
  created_at: string
  updated_at: string
  // Joined
  school?: School
}

export interface School {
  id: string
  name: string
  city: string
  state: string
  network: SchoolNetwork
  created_at: string
}

export interface Class {
  id: string
  teacher_id: string
  name: string
  year: number
  grade: string
  period: ClassPeriod
  school_id?: string
  student_count: number
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined
  students?: Student[]
  enrollments?: Enrollment[]
}

export interface Student {
  id: string
  full_name: string
  nickname?: string
  birth_date?: string
  photo_url?: string
  gender?: 'M' | 'F' | 'O'
  ra?: string
  notes?: string
  special_needs: string[]
  created_at: string
  updated_at: string
  // Joined
  guardians?: Guardian[]
  enrollments?: Enrollment[]
}

export interface Enrollment {
  id: string
  class_id: string
  student_id: string
  status: EnrollmentStatus
  enrolled_at: string
  // Joined
  student?: Student
  class?: Class
}

export interface Guardian {
  id: string
  student_id: string
  full_name: string
  relationship: string
  phone?: string
  email?: string
  is_primary: boolean
  created_at: string
}

export interface AttendanceSession {
  id: string
  class_id: string
  teacher_id: string
  date: string
  completed: boolean
  notes?: string
  created_at: string
  // Joined
  records?: AttendanceRecord[]
}

export interface AttendanceRecord {
  id: string
  session_id: string
  student_id: string
  status: AttendanceStatus
  arrival_time?: string
  notes?: string
  // Joined
  student?: Student
}

export interface DiaryEntry {
  id: string
  class_id: string
  teacher_id: string
  date: string
  type: DiaryEntryType
  title?: string
  content: string
  tags: string[]
  attachments: Array<{ url: string; name: string; type: string }>
  created_at: string
  updated_at: string
}

export interface StudentObservation {
  id: string
  student_id: string
  class_id: string
  teacher_id: string
  date: string
  category: ObservationCategory
  content: string
  severity?: ObservationSeverity
  is_private: boolean
  created_at: string
  // Joined
  student?: Student
}

export interface AIReport {
  id: string
  teacher_id: string
  class_id?: string
  student_id?: string
  type: AIReportType
  prompt_context: Record<string, unknown>
  content: string
  model_used?: string
  tokens_used?: number
  status: ReportStatus
  reviewed_at?: string
  created_at: string
  // Joined
  student?: Student
  class?: Class
}

export interface GierSubmission {
  id: string
  teacher_id: string
  class_id?: string
  original_file_url: string
  file_type: GierFileType
  ocr_extracted_text?: string
  ai_interpretation?: {
    component: string
    ute: string
    saber: string
    apr: string
    description: string
    activity_type: string
  }
  gier_description?: string
  curriculum_skill_id?: string
  status: GierStatus
  activity_date?: string
  created_at: string
}

export interface CurriculumSkill {
  id: string
  code: string
  description: string
  component: string
  grade: string
  axis?: string
  source: SkillSource
  created_at: string
}

export interface SkillAssessment {
  id: string
  student_id: string
  class_id: string
  skill_id: string
  level: SkillLevel
  assessed_at: string
  notes?: string
  // Joined
  skill?: CurriculumSkill
  student?: Student
}

export interface LessonPlan {
  id: string
  teacher_id: string
  class_id: string
  type: LessonPlanType
  title: string
  date_start: string
  date_end?: string
  content: Record<string, unknown>
  skills: string[]
  ai_generated: boolean
  status: LessonPlanStatus
  created_at: string
  updated_at: string
}

export interface Grade {
  id: string
  student_id: string
  class_id: string
  teacher_id: string
  subject: string
  bimestre: number
  nota: number | null
  created_at: string
  updated_at: string
  // Joined
  student?: Student
}

export interface Rubric {
  id: string
  teacher_id: string
  title: string
  type: 'rubric' | 'checklist'
  created_at: string
  updated_at: string
  criteria?: RubricCriterion[]
  levels?: RubricLevel[]
}

export interface RubricCriterion {
  id: string
  rubric_id: string
  description: string
  sort_order: number
}

export interface RubricLevel {
  id: string
  rubric_id: string
  level: number
  label: string
  color: string
}

export interface RubricEvaluation {
  id: string
  rubric_id: string
  student_id: string
  class_id: string
  teacher_id: string
  evaluated_at: string
  notes: string | null
  created_at: string
  student?: Student
  scores?: RubricScore[]
}

export interface RubricScore {
  id: string
  evaluation_id: string
  criterion_id: string
  level: number
}
