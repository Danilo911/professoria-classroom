-- =============================================
-- ProfessorIA Classroom — Migration 004: Grades
-- =============================================

CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    subject TEXT NOT NULL DEFAULT 'Geral',
    bimestre INT NOT NULL CHECK (bimestre BETWEEN 1 AND 4),
    nota DECIMAL(4,1) CHECK (nota BETWEEN 0 AND 10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, class_id, subject, bimestre)
);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_grades" ON public.grades
    FOR ALL USING (teacher_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_grades_student ON public.grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_class ON public.grades(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_teacher ON public.grades(teacher_id);
