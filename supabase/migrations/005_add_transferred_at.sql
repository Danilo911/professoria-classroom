-- =============================================
-- ProfessorIA Classroom — Add transferred_at to enrollments
-- =============================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS transferred_at DATE;

CREATE INDEX IF NOT EXISTS idx_enrollments_transferred
  ON public.enrollments(class_id, transferred_at);
