-- =============================================
-- ProfessorIA Classroom — Database Migration
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. Escolas
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Guarulhos',
    state TEXT NOT NULL DEFAULT 'SP',
    network TEXT DEFAULT 'municipal' CHECK (network IN ('municipal','estadual','federal','particular')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Professores (estende auth.users)
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    school_id UUID REFERENCES public.schools(id),
    role TEXT DEFAULT 'teacher' CHECK (role IN ('teacher','coordinator','admin')),
    subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free','premium','school')),
    subscription_expires_at TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Turmas
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    year INT NOT NULL DEFAULT 2026,
    grade TEXT NOT NULL,
    period TEXT DEFAULT 'manha' CHECK (period IN ('manha','tarde','integral')),
    school_id UUID REFERENCES public.schools(id),
    student_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Alunos
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    nickname TEXT,
    birth_date DATE,
    photo_url TEXT,
    gender TEXT CHECK (gender IN ('M','F','O')),
    ra TEXT,
    notes TEXT,
    special_needs JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Matrículas
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','transferred','inactive')),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

-- 6. Responsáveis
CREATE TABLE IF NOT EXISTS public.guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Sessões de Chamada
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, date)
);

-- 8. Registros de Presença
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id),
    status TEXT NOT NULL CHECK (status IN ('present','absent','late','justified')),
    arrival_time TIME,
    notes TEXT,
    UNIQUE(session_id, student_id)
);

-- 9. Diário Pedagógico
CREATE TABLE IF NOT EXISTS public.diary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('general','activity','incident','achievement')),
    title TEXT,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Observações do Aluno
CREATE TABLE IF NOT EXISTS public.student_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL CHECK (category IN ('behavior','difficulty','evolution','intervention','general')),
    content TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info','attention','critical')),
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Habilidades Curriculares (QSN/BNCC)
CREATE TABLE IF NOT EXISTS public.curriculum_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    component TEXT NOT NULL,
    grade TEXT NOT NULL,
    axis TEXT,
    source TEXT DEFAULT 'bncc' CHECK (source IN ('bncc','qsn')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Avaliação de Habilidades
CREATE TABLE IF NOT EXISTS public.skill_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id),
    class_id UUID NOT NULL REFERENCES public.classes(id),
    skill_id UUID NOT NULL REFERENCES public.curriculum_skills(id),
    level TEXT NOT NULL CHECK (level IN ('not_started','in_progress','developing','consolidated')),
    assessed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    UNIQUE(student_id, skill_id, assessed_at)
);

-- 13. Relatórios IA
CREATE TABLE IF NOT EXISTS public.ai_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    class_id UUID REFERENCES public.classes(id),
    student_id UUID REFERENCES public.students(id),
    type TEXT NOT NULL CHECK (type IN ('descriptive_report','class_council','parent_meeting','pedagogical_suggestion','progress_summary')),
    prompt_context JSONB NOT NULL DEFAULT '{}',
    content TEXT NOT NULL,
    model_used TEXT,
    tokens_used INT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','reviewed','final')),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Submissões GIER
CREATE TABLE IF NOT EXISTS public.gier_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    class_id UUID REFERENCES public.classes(id),
    original_file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image','pdf','docx')),
    ocr_extracted_text TEXT,
    ai_interpretation JSONB,
    gier_description TEXT,
    curriculum_skill_id UUID REFERENCES public.curriculum_skills(id),
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing','completed','error','reviewed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Planos de Aula
CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    class_id UUID NOT NULL REFERENCES public.classes(id),
    type TEXT NOT NULL CHECK (type IN ('daily','weekly','sequence','assessment')),
    title TEXT NOT NULL,
    date_start DATE NOT NULL,
    date_end DATE,
    content JSONB NOT NULL DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    ai_generated BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Índices
-- =============================================
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON public.enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_date ON public.attendance_sessions(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_class_date ON public.diary_entries(class_id, date);
CREATE INDEX IF NOT EXISTS idx_student_obs_student ON public.student_observations(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_student ON public.ai_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_student ON public.skill_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_class ON public.lesson_plans(class_id, date_start);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Teachers
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_profile" ON public.teachers FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own_profile" ON public.teachers FOR UPDATE USING (id = auth.uid());

-- Classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_classes" ON public.classes FOR ALL USING (teacher_id = auth.uid());

-- Students (via enrollment)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_see_enrolled_students" ON public.students FOR ALL USING (
    EXISTS (SELECT 1 FROM public.enrollments e JOIN public.classes c ON c.id = e.class_id WHERE e.student_id = students.id AND c.teacher_id = auth.uid())
);

-- Enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_manage_enrollments" ON public.enrollments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = enrollments.class_id AND c.teacher_id = auth.uid())
);

-- Guardians
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_see_guardians" ON public.guardians FOR ALL USING (
    EXISTS (SELECT 1 FROM public.students s JOIN public.enrollments e ON e.student_id = s.id JOIN public.classes c ON c.id = e.class_id WHERE s.id = guardians.student_id AND c.teacher_id = auth.uid())
);

-- Attendance
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_sessions" ON public.attendance_sessions FOR ALL USING (teacher_id = auth.uid());

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_records" ON public.attendance_records FOR ALL USING (
    EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_records.session_id AND s.teacher_id = auth.uid())
);

-- Diary
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_diary" ON public.diary_entries FOR ALL USING (teacher_id = auth.uid());

ALTER TABLE public.student_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_observations" ON public.student_observations FOR ALL USING (teacher_id = auth.uid());

-- AI Reports
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_reports" ON public.ai_reports FOR ALL USING (teacher_id = auth.uid());

-- GIER
ALTER TABLE public.gier_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_gier" ON public.gier_submissions FOR ALL USING (teacher_id = auth.uid());

-- Lesson Plans
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_plans" ON public.lesson_plans FOR ALL USING (teacher_id = auth.uid());

-- Curriculum Skills (público para leitura)
ALTER TABLE public.curriculum_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_reads_skills" ON public.curriculum_skills FOR SELECT USING (true);

-- Skill Assessments
ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_assessments" ON public.skill_assessments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = skill_assessments.class_id AND c.teacher_id = auth.uid())
);

-- =============================================
-- Trigger: Auto-create teacher profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.teachers (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Professor'), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RPC: Class student count management
-- =============================================

CREATE OR REPLACE FUNCTION public.increment_class_student_count(class_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.classes SET student_count = student_count + 1 WHERE id = class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_class_student_count(class_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.classes SET student_count = GREATEST(student_count - 1, 0) WHERE id = class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
