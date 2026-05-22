-- Partial unique index: allows re-enrollment of inactive students
-- Only enforces uniqueness among active enrollments
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_active_unique
  ON public.enrollments (class_id, student_id)
  WHERE status = 'active';

-- Drop the old unique constraint that blocks re-enrollment
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_class_id_student_id_key;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_enrollments_class_status
  ON public.enrollments (class_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_class_student
  ON public.enrollments (class_id, student_id);

CREATE INDEX IF NOT EXISTS idx_student_observations_teacher
  ON public.student_observations (teacher_id);

CREATE INDEX IF NOT EXISTS idx_student_observations_class
  ON public.student_observations (class_id);

CREATE INDEX IF NOT EXISTS idx_diary_entries_teacher
  ON public.diary_entries (teacher_id);

CREATE INDEX IF NOT EXISTS idx_ai_reports_teacher
  ON public.ai_reports (teacher_id);

CREATE INDEX IF NOT EXISTS idx_gier_submissions_teacher
  ON public.gier_submissions (teacher_id);

CREATE INDEX IF NOT EXISTS idx_gier_submissions_class
  ON public.gier_submissions (class_id);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher
  ON public.lesson_plans (teacher_id);

CREATE INDEX IF NOT EXISTS idx_grades_class_bimestre
  ON public.grades (class_id, bimestre);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher
  ON public.attendance_sessions (teacher_id);