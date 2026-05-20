-- =============================================
-- ProfessorIA Classroom — Add type and description to class_holidays
-- =============================================

-- Add type and description columns to class_holidays table
ALTER TABLE public.class_holidays 
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'holiday',
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing rows to have type 'holiday' (if they don't already)
UPDATE public.class_holidays 
SET type = 'holiday' 
WHERE type IS NULL;

-- Recreate the index to include the new columns if needed
DROP INDEX IF EXISTS idx_class_holidays_class_date;
CREATE INDEX IF NOT EXISTS idx_class_holidays_class_date ON public.class_holidays(class_id, date);

-- Update RLS policy to allow teachers to manage all types
DROP POLICY IF EXISTS "teachers_manage_holidays" ON public.class_holidays;
CREATE POLICY "teachers_manage_holidays" ON public.class_holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes c 
      WHERE c.id = class_holidays.class_id 
      AND c.teacher_id = auth.uid()
    )
  );