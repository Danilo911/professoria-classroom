-- Tabela para feriados por turma
CREATE TABLE IF NOT EXISTS public.class_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, date)
);

CREATE INDEX IF NOT EXISTS idx_class_holidays_class_date ON public.class_holidays(class_id, date);

ALTER TABLE public.class_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_manage_holidays" ON public.class_holidays
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_holidays.class_id AND c.teacher_id = auth.uid())
  );
