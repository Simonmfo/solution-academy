-- ============================================================================
-- CapacitaPro LMS — Fix RLS en public.courses para INSERT ... RETURNING de Instructores
-- Archivo: supabase/migrations/20261120000002_fix_instructor_courses_rls.sql
-- Causa: courses_instructor_manage_own llamaba a is_instructor_of_course(id) (STABLE)
--        durante el RETURNING de un INSERT recién creado, antes de que la fila fuera
--        visible para la subconsulta STABLE.
-- ============================================================================

DROP POLICY IF EXISTS "courses_instructor_manage_own" ON public.courses;
DROP POLICY IF EXISTS "courses_instructor_insert" ON public.courses;
DROP POLICY IF EXISTS "courses_instructor_select_own" ON public.courses;
DROP POLICY IF EXISTS "courses_instructor_update_own" ON public.courses;
DROP POLICY IF EXISTS "courses_instructor_delete_own" ON public.courses;

CREATE POLICY "courses_instructor_select_own" ON public.courses
  FOR SELECT USING (
    public.get_my_role() = 'instructor'
    AND (instructor_id = auth.uid() OR public.is_instructor_of_course(id))
  );

CREATE POLICY "courses_instructor_insert" ON public.courses
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'instructor'
    AND instructor_id = auth.uid()
  );

CREATE POLICY "courses_instructor_update_own" ON public.courses
  FOR UPDATE USING (
    public.get_my_role() = 'instructor'
    AND (instructor_id = auth.uid() OR public.is_instructor_of_course(id))
  )
  WITH CHECK (
    public.get_my_role() = 'instructor'
    AND (instructor_id = auth.uid() OR public.is_instructor_of_course(id))
  );

CREATE POLICY "courses_instructor_delete_own" ON public.courses
  FOR DELETE USING (
    public.get_my_role() = 'instructor'
    AND (instructor_id = auth.uid() OR public.is_instructor_of_course(id))
  );

NOTIFY pgrst, 'reload schema';

