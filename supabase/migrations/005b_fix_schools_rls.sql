-- =============================================
-- Fix: Schools RLS policies
-- =============================================

ALTER TABLE IF EXISTS public.schools ENABLE ROW LEVEL SECURITY;

-- Allow teachers to read their own school (via the school_id reference)
CREATE POLICY "teachers_read_own_school" ON public.schools FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teachers WHERE teachers.school_id = schools.id AND teachers.id = auth.uid())
);

-- Allow teachers to insert schools (when creating their first school)
CREATE POLICY "teachers_insert_school" ON public.schools FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.teachers WHERE teachers.id = auth.uid())
);

-- Allow teachers to update their own school
CREATE POLICY "teachers_update_own_school" ON public.schools FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.teachers WHERE teachers.school_id = schools.id AND teachers.id = auth.uid())
);
