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
export type AIReportType = 'descriptive_report' | 'class_council' | 'parent_meeting' | 'pedagogical_suggestion' | 'progress_summary'
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
    skill_code: string
    skill_description: string
    activity_type: string
  }
  gier_description?: string
  curriculum_skill_id?: string
  status: GierStatus
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
