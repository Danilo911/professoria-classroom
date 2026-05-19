-- Fix RLS for students table: INSERT must not require existing enrollment
-- The old policy "teachers_see_enrolled_students" used FOR ALL USING (enrollment check),
-- which blocks INSERT because the student doesn't exist in enrollments yet.

DROP POLICY IF EXISTS "teachers_see_enrolled_students" ON public.students;

-- Allow INSERT for any authenticated user (student record is created, then enrollment links it)
CREATE POLICY "teachers_insert_students" ON public.students
  FOR INSERT WITH CHECK (true);

-- Allow SELECT only for enrolled students (existing behavior)
CREATE POLICY "teachers_select_students" ON public.students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON c.id = e.class_id
      WHERE e.student_id = students.id AND c.teacher_id = auth.uid())
  );

-- Allow UPDATE only for enrolled students
CREATE POLICY "teachers_update_students" ON public.students
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON c.id = e.class_id
      WHERE e.student_id = students.id AND c.teacher_id = auth.uid())
  );

-- Allow DELETE only for enrolled students
CREATE POLICY "teachers_delete_students" ON public.students
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON c.id = e.class_id
      WHERE e.student_id = students.id AND c.teacher_id = auth.uid())
  );
