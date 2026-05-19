-- Corrige policies duplicadas (pode rodar sem erro mesmo se já existirem)

DROP POLICY IF EXISTS "users_read_own_profile" ON public.teachers;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.teachers;
CREATE POLICY "users_read_own_profile" ON public.teachers FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own_profile" ON public.teachers FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "teachers_own_classes" ON public.classes;
CREATE POLICY "teachers_own_classes" ON public.classes FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teachers_see_enrolled_students" ON public.students;
CREATE POLICY "teachers_see_enrolled_students" ON public.students FOR ALL USING (
    EXISTS (SELECT 1 FROM public.enrollments e JOIN public.classes c ON c.id = e.class_id WHERE e.student_id = students.id AND c.teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers_manage_enrollments" ON public.enrollments;
CREATE POLICY "teachers_manage_enrollments" ON public.enrollments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = enrollments.class_id AND c.teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers_see_guardians" ON public.guardians;
CREATE POLICY "teachers_see_guardians" ON public.guardians FOR ALL USING (
    EXISTS (SELECT 1 FROM public.students s JOIN public.enrollments e ON e.student_id = s.id JOIN public.classes c ON c.id = e.class_id WHERE s.id = guardians.student_id AND c.teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers_own_sessions" ON public.attendance_sessions;
CREATE POLICY "teachers_own_sessions" ON public.attendance_sessions FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teachers_own_records" ON public.attendance_records;
CREATE POLICY "teachers_own_records" ON public.attendance_records FOR ALL USING (
    EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_records.session_id AND s.teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers_own_diary" ON public.diary_entries;
CREATE POLICY "teachers_own_diary" ON public.diary_entries FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teachers_own_observations" ON public.student_observations;
CREATE POLICY "teachers_own_observations" ON public.student_observations FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teachers_own_reports" ON public.ai_reports;
CREATE POLICY "teachers_own_reports" ON public.ai_reports FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teachers_own_gier" ON public.gier_submissions;
CREATE POLICY "teachers_own_gier" ON public.gier_submissions FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teachers_own_plans" ON public.lesson_plans;
CREATE POLICY "teachers_own_plans" ON public.lesson_plans FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "anyone_reads_skills" ON public.curriculum_skills;
CREATE POLICY "anyone_reads_skills" ON public.curriculum_skills FOR SELECT USING (true);

DROP POLICY IF EXISTS "teachers_own_assessments" ON public.skill_assessments;
CREATE POLICY "teachers_own_assessments" ON public.skill_assessments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = skill_assessments.class_id AND c.teacher_id = auth.uid())
);

-- Trigger (idempotente)
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

-- RPCs (idempotentes via OR REPLACE)
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
