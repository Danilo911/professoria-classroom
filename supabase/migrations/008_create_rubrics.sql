-- Criação das tabelas de rubricas/checklists para avaliação rápida

-- 1. Rubricas (templates de avaliação)
CREATE TABLE IF NOT EXISTS public.rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('rubric', 'checklist')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Critérios de cada rubrica
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

-- 3. Níveis de cada rubrica (para checklist: 2 níveis, para rubrica: N níveis)
CREATE TABLE IF NOT EXISTS public.rubric_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
    level INT NOT NULL CHECK (level >= 0),
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6B7280'
);

-- 4. Avaliações aplicadas (uma por aluno por rubrica por data)
CREATE TABLE IF NOT EXISTS public.rubric_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    evaluated_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (rubric_id, student_id, class_id, evaluated_at)
);

-- 5. Scores individuais por critério dentro de cada avaliação
CREATE TABLE IF NOT EXISTS public.rubric_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES public.rubric_evaluations(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 0,
    UNIQUE (evaluation_id, criterion_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rubrics_teacher ON public.rubrics(teacher_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON public.rubric_criteria(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_order ON public.rubric_criteria(rubric_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rubric_levels_rubric ON public.rubric_levels(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_levels_order ON public.rubric_levels(rubric_id, level);
CREATE INDEX IF NOT EXISTS idx_rubric_evaluations_rubric ON public.rubric_evaluations(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_evaluations_student ON public.rubric_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_rubric_evaluations_class ON public.rubric_evaluations(class_id);
CREATE INDEX IF NOT EXISTS idx_rubric_evaluations_date ON public.rubric_evaluations(evaluated_at);
CREATE INDEX IF NOT EXISTS idx_rubric_scores_evaluation ON public.rubric_scores(evaluation_id);

-- RLS
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_scores ENABLE ROW LEVEL SECURITY;

-- Políticas: professor só vê/altera os próprios dados
CREATE POLICY "teachers_own_rubrics" ON public.rubrics
    FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "teachers_own_criteria" ON public.rubric_criteria
    FOR ALL USING (rubric_id IN (SELECT id FROM public.rubrics WHERE teacher_id = auth.uid()));

CREATE POLICY "teachers_own_levels" ON public.rubric_levels
    FOR ALL USING (rubric_id IN (SELECT id FROM public.rubrics WHERE teacher_id = auth.uid()));

CREATE POLICY "teachers_own_evaluations" ON public.rubric_evaluations
    FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "teachers_own_scores" ON public.rubric_scores
    FOR ALL USING (evaluation_id IN (SELECT id FROM public.rubric_evaluations WHERE teacher_id = auth.uid()));
