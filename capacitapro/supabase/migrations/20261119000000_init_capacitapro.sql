-- ============================================================================
-- CapacitaPro LMS - Migración Inicial de Producción
-- Archivo: supabase/migrations/20261119000000_init_capacitapro.sql
-- Descripción: Esquema multi-tenant B2B, estructura académica estilo Moodle,
--              motor de evaluaciones con banco de preguntas, gamificación,
--              certificados verificables con QR, analítica RRHH, triggers,
--              políticas RLS estrictas y buckets de Supabase Storage.
-- ============================================================================

-- 0. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TIPOS ENUM
-- ============================================================================
CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'company_admin',
  'instructor',
  'student'
);

CREATE TYPE public.course_level AS ENUM (
  'beginner',
  'intermediate',
  'advanced'
);

CREATE TYPE public.course_status AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TYPE public.lesson_type AS ENUM (
  'video',
  'reading',
  'document',
  'quiz',
  'assignment'
);

CREATE TYPE public.video_provider AS ENUM (
  'storage',
  'youtube',
  'vimeo',
  'bunny',
  'embed'
);

CREATE TYPE public.enrollment_status AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'overdue',
  'expired'
);

CREATE TYPE public.lesson_progress_status AS ENUM (
  'not_started',
  'in_progress',
  'completed'
);

CREATE TYPE public.submission_status AS ENUM (
  'submitted',
  'under_review',
  'graded',
  'resubmit_requested'
);

CREATE TYPE public.question_type AS ENUM (
  'single_choice',
  'multiple_choice',
  'true_false',
  'fill_blank',
  'open_ended'
);

CREATE TYPE public.question_difficulty AS ENUM (
  'easy',
  'medium',
  'hard'
);

CREATE TYPE public.quiz_feedback_mode AS ENUM (
  'immediate',
  'after_submit',
  'after_due_date',
  'never'
);

CREATE TYPE public.attempt_status AS ENUM (
  'in_progress',
  'submitted',
  'pending_manual_grading',
  'graded',
  'expired'
);

CREATE TYPE public.xp_source_type AS ENUM (
  'lesson_completed',
  'quiz_passed',
  'assignment_graded',
  'course_completed',
  'streak_bonus',
  'discussion_helpful'
);

CREATE TYPE public.import_job_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ============================================================================
-- 2. MULTI-TENANT B2B E IDENTIDAD
-- ============================================================================

-- 2.1 Empresas clientes
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tax_id TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#2563EB',
  max_seats INTEGER NOT NULL DEFAULT 50 CHECK (max_seats > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  settings JSONB NOT NULL DEFAULT '{
    "leaderboard_enabled": true,
    "allow_self_enrollment": false,
    "inactive_alert_days": 14
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Perfiles vinculados 1:1 a auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role public.user_role NOT NULL DEFAULT 'student',
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  job_title TEXT,
  department TEXT,
  employee_code TEXT,
  xp_points INTEGER NOT NULL DEFAULT 0 CHECK (xp_points >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_activity_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_company_required_for_b2b CHECK (
    (role IN ('super_admin', 'instructor')) OR (company_id IS NOT NULL) OR (is_active = FALSE)
  )
);

-- 2.3 Cohortes / Grupos internos de cada empresa
CREATE TABLE public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, name)
);

-- 2.4 Miembros de una cohorte
CREATE TABLE public.cohort_members (
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_id, user_id)
);

-- ============================================================================
-- 3. ESTRUCTURA ACADÉMICA (ESTILO MOODLE)
-- ============================================================================

-- 3.1 Cursos
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  level public.course_level NOT NULL DEFAULT 'beginner',
  status public.course_status NOT NULL DEFAULT 'draft',
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_sequential BOOLEAN NOT NULL DEFAULT TRUE,
  passing_score NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (passing_score >= 0 AND passing_score <= 100),
  xp_reward INTEGER NOT NULL DEFAULT 500 CHECK (xp_reward >= 0),
  estimated_hours NUMERIC(6,2) NOT NULL DEFAULT 1.00 CHECK (estimated_hours > 0),
  certificate_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Co-instructores por curso
CREATE TABLE public.course_instructors (
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, instructor_id)
);

-- 3.3 Licencias de cursos asignadas por Super Admin a Empresas
CREATE TABLE public.company_course_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  max_enrollments INTEGER CHECK (max_enrollments IS NULL OR max_enrollments > 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, course_id)
);

-- 3.4 Módulos / Unidades con correlatividad opcional
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  prerequisite_module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
  requires_quiz_pass BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT modules_no_self_prerequisite CHECK (prerequisite_module_id IS DISTINCT FROM id)
);

-- 3.5 Lecciones
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  lesson_type public.lesson_type NOT NULL DEFAULT 'reading',
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 10 CHECK (duration_minutes >= 0),
  xp_reward INTEGER NOT NULL DEFAULT 50 CHECK (xp_reward >= 0),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  is_preview BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  prerequisite_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  -- Contenido multimedia / lectura / tarea
  video_provider public.video_provider,
  video_url TEXT,
  video_storage_path TEXT,
  content_markdown TEXT,
  assignment_instructions TEXT,
  assignment_max_score NUMERIC(5,2) DEFAULT 100.00,
  assignment_allowed_extensions TEXT[] DEFAULT ARRAY['pdf', 'docx', 'xlsx', 'zip', 'png', 'jpg'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, slug),
  CONSTRAINT lessons_no_self_prerequisite CHECK (prerequisite_lesson_id IS DISTINCT FROM id)
);

-- 3.6 Recursos descargables por lección (bucket privado de Supabase Storage)
CREATE TABLE public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. MATRICULACIONES, PROGRESO Y ENTREGAS DE TAREAS
-- ============================================================================

-- 4.1 Inscripciones / Asignaciones de cursos (con fecha límite y cohorte)
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  status public.enrollment_status NOT NULL DEFAULT 'not_started',
  progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  final_grade NUMERIC(5,2) CHECK (final_grade IS NULL OR (final_grade >= 0 AND final_grade <= 100)),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

-- 4.2 Progreso por lección
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status public.lesson_progress_status NOT NULL DEFAULT 'not_started',
  video_last_position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (video_last_position_seconds >= 0),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

-- 4.3 Entregas de tareas prácticas (corrección por instructor)
CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  submission_text TEXT,
  file_storage_path TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  status public.submission_status NOT NULL DEFAULT 'submitted',
  score NUMERIC(5,2) CHECK (score IS NULL OR score >= 0),
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  feedback TEXT,
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. MOTOR DE EVALUACIONES AVANZADO (ESTILO MOODLE)
-- ============================================================================

-- 5.1 Bancos de preguntas por curso
CREATE TABLE public.question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.2 Preguntas (solo enunciado y opciones públicas sin clave de respuesta)
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_type public.question_type NOT NULL,
  prompt TEXT NOT NULL,
  -- Ejemplo para choice: [{"id": "opt_1", "label": "Opción A"}, {"id": "opt_2", "label": "Opción B"}]
  -- Ejemplo para fill_blank: {"blanks_count": 2, "case_sensitive": false}
  options_public JSONB NOT NULL DEFAULT '[]'::jsonb,
  points NUMERIC(6,2) NOT NULL DEFAULT 10.00 CHECK (points > 0),
  difficulty public.question_difficulty NOT NULL DEFAULT 'medium',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.3 Claves de respuesta (aisladas con RLS estricto para evitar trampas del lado cliente)
CREATE TABLE public.question_answer_keys (
  question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  -- single_choice: {"option_id": "opt_1"}
  -- multiple_choice: {"option_ids": ["opt_1", "opt_3"]}
  -- true_false: {"value": true}
  -- fill_blank: {"accepted": [["respuesta1", "sinonimo1"], ["respuesta2"]]}
  -- open_ended: {"rubric": "Criterios de evaluación para el instructor"}
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.4 Exámenes / Evaluaciones
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  question_bank_id UUID REFERENCES public.question_banks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_final_exam BOOLEAN NOT NULL DEFAULT FALSE,
  time_limit_minutes INTEGER CHECK (time_limit_minutes IS NULL OR time_limit_minutes > 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  passing_score_percent NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (passing_score_percent >= 0 AND passing_score_percent <= 100),
  random_question_count INTEGER CHECK (random_question_count IS NULL OR random_question_count > 0),
  shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
  shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
  feedback_mode public.quiz_feedback_mode NOT NULL DEFAULT 'after_submit',
  xp_reward INTEGER NOT NULL DEFAULT 150 CHECK (xp_reward >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.5 Preguntas fijas asociadas a un examen (cuando no se usa solo selección aleatoria)
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  points_override NUMERIC(6,2) CHECK (points_override IS NULL OR points_override > 0),
  UNIQUE (quiz_id, question_id)
);

-- 5.6 Intentos de evaluación del alumno
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  status public.attempt_status NOT NULL DEFAULT 'in_progress',
  question_order UUID[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  score_obtained NUMERIC(7,2) NOT NULL DEFAULT 0,
  score_max NUMERIC(7,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, user_id, attempt_number)
);

-- 5.7 Respuestas individuales por intento
CREATE TABLE public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_correct BOOLEAN,
  points_awarded NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  instructor_feedback TEXT,
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

-- ============================================================================
-- 6. EXPERIENCIA MODERNA, NOTAS, FORO Y GAMIFICACIÓN
-- ============================================================================

-- 6.1 Notas personales del alumno por lección (Modo Focus)
CREATE TABLE public.lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  video_timestamp_seconds INTEGER CHECK (video_timestamp_seconds IS NULL OR video_timestamp_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.2 Foro contextual de preguntas y respuestas por lección
CREATE TABLE public.lesson_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.lesson_discussions(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  upvotes_count INTEGER NOT NULL DEFAULT 0 CHECK (upvotes_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.3 Votos útiles en el foro
CREATE TABLE public.lesson_discussion_upvotes (
  discussion_id UUID NOT NULL REFERENCES public.lesson_discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (discussion_id, user_id)
);

-- 6.4 Libro mayor de puntos XP (auditable)
CREATE TABLE public.xp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  source_type public.xp_source_type NOT NULL,
  source_id UUID,
  points INTEGER NOT NULL CHECK (points > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.5 Registro diario de actividad (cálculo preciso de rachas)
CREATE TABLE public.user_activity_days (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, activity_date)
);

-- ============================================================================
-- 7. CERTIFICACIÓN VERIFICABLE Y REPORTES / IMPORTACIÓN RRHH
-- ============================================================================

-- 7.1 Certificados verificables con UUID y QR (/verificar/[codigo])
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  certificate_number TEXT NOT NULL UNIQUE,
  enrollment_id UUID NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Snapshots inmutables al momento de la emisión
  student_name_snapshot TEXT NOT NULL,
  company_name_snapshot TEXT NOT NULL,
  course_title_snapshot TEXT NOT NULL,
  instructor_name_snapshot TEXT,
  final_grade NUMERIC(5,2),
  total_hours NUMERIC(6,2) NOT NULL DEFAULT 1.00,
  pdf_storage_path TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);

-- 7.2 Auditoría de importaciones masivas CSV/Excel por RRHH
CREATE TABLE public.bulk_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  status public.import_job_status NOT NULL DEFAULT 'pending',
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  error_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 8. ÍNDICES DE RENDIMIENTO (MULTI-TENANT Y CONSULTAS FRECUENTES)
-- ============================================================================
CREATE INDEX idx_profiles_company_role ON public.profiles(company_id, role);
CREATE INDEX idx_profiles_company_xp ON public.profiles(company_id, xp_points DESC);
CREATE INDEX idx_cohorts_company ON public.cohorts(company_id);
CREATE INDEX idx_courses_status_instructor ON public.courses(status, instructor_id);
CREATE INDEX idx_licenses_company_active ON public.company_course_licenses(company_id, is_active);
CREATE INDEX idx_modules_course_pos ON public.modules(course_id, position);
CREATE INDEX idx_lessons_module_pos ON public.lessons(module_id, position);
CREATE INDEX idx_lessons_course ON public.lessons(course_id);
CREATE INDEX idx_enrollments_company_status ON public.enrollments(company_id, status);
CREATE INDEX idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX idx_enrollments_due_date ON public.enrollments(due_date) WHERE status <> 'completed';
CREATE INDEX idx_lesson_progress_enrollment ON public.lesson_progress(enrollment_id, status);
CREATE INDEX idx_submissions_course_status ON public.assignment_submissions(course_id, status);
CREATE INDEX idx_submissions_company ON public.assignment_submissions(company_id);
CREATE INDEX idx_questions_bank ON public.questions(bank_id);
CREATE INDEX idx_quiz_attempts_user_quiz ON public.quiz_attempts(user_id, quiz_id);
CREATE INDEX idx_quiz_attempts_company ON public.quiz_attempts(company_id, status);
CREATE INDEX idx_lesson_notes_user_lesson ON public.lesson_notes(user_id, lesson_id);
CREATE INDEX idx_discussions_lesson_created ON public.lesson_discussions(lesson_id, created_at DESC);
CREATE INDEX idx_xp_ledger_user ON public.xp_ledger(user_id, created_at DESC);
CREATE INDEX idx_certificates_company ON public.certificates(company_id);
CREATE INDEX idx_certificates_verification_code ON public.certificates(verification_code);

-- ============================================================================
-- 9. FUNCIONES HELPER DE SEGURIDAD (EVITAN RECURSIÓN EN RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_instructor_of_course(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = p_course_id AND c.instructor_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.course_instructors ci
    WHERE ci.course_id = p_course_id AND ci.instructor_id = auth.uid()
  );
$$;

-- ============================================================================
-- 10. TRIGGERS DE INTEGRIDAD, IDENTIDAD, GAMIFICACIÓN Y CERTIFICADOS
-- ============================================================================

-- 10.1 Actualización automática de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cohorts_updated_at BEFORE UPDATE ON public.cohorts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_licenses_updated_at BEFORE UPDATE ON public.company_course_licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_submissions_updated_at BEFORE UPDATE ON public.assignment_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_question_banks_updated_at BEFORE UPDATE ON public.question_banks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quiz_attempts_updated_at BEFORE UPDATE ON public.quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quiz_answers_updated_at BEFORE UPDATE ON public.quiz_attempt_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lesson_notes_updated_at BEFORE UPDATE ON public.lesson_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_discussions_updated_at BEFORE UPDATE ON public.lesson_discussions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10.2 Creación automática de perfil al registrarse en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role := 'student';
  v_company_id UUID := NULL;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Solo acepta rol desde app_metadata (controlado por servidor/admin) para evitar escalación
  IF NEW.raw_app_meta_data ? 'role' THEN
    BEGIN
      v_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
    EXCEPTION WHEN invalid_text_representation THEN
      v_role := 'student';
    END;
  END IF;

  IF NEW.raw_app_meta_data ? 'company_id' AND NULLIF(NEW.raw_app_meta_data->>'company_id', '') IS NOT NULL THEN
    BEGIN
      v_company_id := (NEW.raw_app_meta_data->>'company_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_company_id := NULL;
    END;
  ELSIF NEW.raw_user_meta_data ? 'company_id' AND NULLIF(NEW.raw_user_meta_data->>'company_id', '') IS NOT NULL THEN
    BEGIN
      v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_company_id := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (
    id,
    company_id,
    role,
    full_name,
    email,
    job_title,
    department,
    employee_code,
    is_active
  )
  VALUES (
    NEW.id,
    v_company_id,
    v_role,
    v_full_name,
    NEW.email,
    NEW.raw_user_meta_data->>'job_title',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'employee_code',
    CASE WHEN v_role IN ('super_admin', 'instructor') OR v_company_id IS NOT NULL THEN TRUE ELSE FALSE END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10.3 Protección anti-escalación de privilegios en profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
BEGIN
  -- Permitir actualizaciones internas desde triggers o service_role (auth.uid() IS NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_role := public.get_my_role();

  IF v_caller_role <> 'super_admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      -- Company admin solo puede alternar entre student/company_admin dentro de su empresa si se desea,
      -- pero nunca crear super_admin ni cambiarse de empresa.
      IF v_caller_role <> 'company_admin' OR NEW.role IN ('super_admin', 'instructor') THEN
        RAISE EXCEPTION 'No tienes permisos para modificar el rol de este usuario.';
      END IF;
    END IF;

    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'No tienes permisos para cambiar la empresa asignada.';
    END IF;

    -- Proteger campos de gamificación contra manipulación directa desde cliente
    IF NEW.xp_points IS DISTINCT FROM OLD.xp_points
       OR NEW.current_streak IS DISTINCT FROM OLD.current_streak
       OR NEW.longest_streak IS DISTINCT FROM OLD.longest_streak THEN
      RAISE EXCEPTION 'Los puntos XP y rachas solo pueden actualizarse mediante el sistema.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_prevent_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 10.4 Sincronización automática de course_id en lessons y lesson_resources
CREATE OR REPLACE FUNCTION public.sync_lesson_course_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT course_id INTO NEW.course_id FROM public.modules WHERE id = NEW.module_id;
  IF NEW.course_id IS NULL THEN
    RAISE EXCEPTION 'El módulo especificado no existe.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lessons_sync_course
  BEFORE INSERT OR UPDATE OF module_id ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.sync_lesson_course_id();

-- 10.5 Motor de XP y Rachas diarias
CREATE OR REPLACE FUNCTION public.record_user_xp_and_streak(
  p_user_id UUID,
  p_company_id UUID,
  p_source_type public.xp_source_type,
  p_source_id UUID,
  p_points INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_date DATE;
  v_curr_streak INTEGER;
  v_longest_streak INTEGER;
  v_already_awarded BOOLEAN;
BEGIN
  -- Evitar duplicación de XP para la misma fuente (idempotencia)
  IF p_source_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.xp_ledger
      WHERE user_id = p_user_id AND source_type = p_source_type AND source_id = p_source_id
    ) INTO v_already_awarded;

    IF v_already_awarded THEN
      RETURN;
    END IF;
  END IF;

  IF p_points > 0 THEN
    INSERT INTO public.xp_ledger (user_id, company_id, source_type, source_id, points, description)
    VALUES (p_user_id, p_company_id, p_source_type, p_source_id, p_points, p_description);
  END IF;

  INSERT INTO public.user_activity_days (user_id, activity_date, lessons_completed, xp_earned)
  VALUES (
    p_user_id,
    v_today,
    CASE WHEN p_source_type = 'lesson_completed' THEN 1 ELSE 0 END,
    GREATEST(p_points, 0)
  )
  ON CONFLICT (user_id, activity_date) DO UPDATE
  SET
    lessons_completed = public.user_activity_days.lessons_completed + CASE WHEN p_source_type = 'lesson_completed' THEN 1 ELSE 0 END,
    xp_earned = public.user_activity_days.xp_earned + GREATEST(p_points, 0);

  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_curr_streak, v_longest_streak
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_last_date IS NULL THEN
    v_curr_streak := 1;
  ELSIF v_last_date = v_today THEN
    v_curr_streak := GREATEST(v_curr_streak, 1);
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    v_curr_streak := v_curr_streak + 1;
  ELSE
    v_curr_streak := 1;
  END IF;

  v_longest_streak := GREATEST(v_longest_streak, v_curr_streak);

  UPDATE public.profiles
  SET
    xp_points = xp_points + GREATEST(p_points, 0),
    current_streak = v_curr_streak,
    longest_streak = v_longest_streak,
    last_activity_date = v_today
  WHERE id = p_user_id;
END;
$$;

-- 10.6 Emisión automática de certificado verificable al completar curso + examen final
CREATE OR REPLACE FUNCTION public.issue_certificate_if_eligible(p_enrollment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enr RECORD;
  v_course RECORD;
  v_existing_cert_id UUID;
  v_has_final_exam BOOLEAN;
  v_final_exam_passed BOOLEAN := TRUE;
  v_best_final_grade NUMERIC(5,2);
  v_student_name TEXT;
  v_company_name TEXT;
  v_instructor_name TEXT;
  v_cert_number TEXT;
  v_new_cert_id UUID;
BEGIN
  SELECT id INTO v_existing_cert_id FROM public.certificates WHERE enrollment_id = p_enrollment_id;
  IF v_existing_cert_id IS NOT NULL THEN
    RETURN v_existing_cert_id;
  END IF;

  SELECT * INTO v_enr FROM public.enrollments WHERE id = p_enrollment_id;
  IF v_enr IS NULL OR v_enr.progress_percentage < 100 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = v_enr.course_id;
  IF v_course IS NULL OR NOT v_course.certificate_enabled THEN
    RETURN NULL;
  END IF;

  -- Verificar si el curso tiene examen final obligatorio
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes WHERE course_id = v_enr.course_id AND is_final_exam = TRUE
  ) INTO v_has_final_exam;

  IF v_has_final_exam THEN
    SELECT MAX(qa.percentage), BOOL_OR(qa.passed)
    INTO v_best_final_grade, v_final_exam_passed
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE qa.enrollment_id = p_enrollment_id
      AND q.is_final_exam = TRUE
      AND qa.status = 'graded';

    IF NOT COALESCE(v_final_exam_passed, FALSE) THEN
      RETURN NULL;
    END IF;
  ELSE
    SELECT AVG(best_pct) INTO v_best_final_grade
    FROM (
      SELECT MAX(qa.percentage) AS best_pct
      FROM public.quiz_attempts qa
      WHERE qa.enrollment_id = p_enrollment_id AND qa.status = 'graded'
      GROUP BY qa.quiz_id
    ) sub;
  END IF;

  SELECT full_name INTO v_student_name FROM public.profiles WHERE id = v_enr.user_id;
  SELECT name INTO v_company_name FROM public.companies WHERE id = v_enr.company_id;
  SELECT full_name INTO v_instructor_name FROM public.profiles WHERE id = v_course.instructor_id;

  v_cert_number := 'CP-' || TO_CHAR(NOW(), 'YYYY') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));

  INSERT INTO public.certificates (
    certificate_number,
    enrollment_id,
    user_id,
    course_id,
    company_id,
    student_name_snapshot,
    company_name_snapshot,
    course_title_snapshot,
    instructor_name_snapshot,
    final_grade,
    total_hours
  )
  VALUES (
    v_cert_number,
    v_enr.id,
    v_enr.user_id,
    v_enr.course_id,
    v_enr.company_id,
    COALESCE(v_student_name, 'Estudiante'),
    COALESCE(v_company_name, 'Organización'),
    v_course.title,
    v_instructor_name,
    COALESCE(v_best_final_grade, v_enr.final_grade, 100.00),
    v_course.estimated_hours
  )
  RETURNING id INTO v_new_cert_id;

  -- Otorgar XP por finalización de curso
  PERFORM public.record_user_xp_and_streak(
    v_enr.user_id,
    v_enr.company_id,
    'course_completed',
    v_enr.course_id,
    v_course.xp_reward,
    'Curso completado: ' || v_course.title
  );

  RETURN v_new_cert_id;
END;
$$;

-- 10.7 Recálculo de progreso al completar una lección
CREATE OR REPLACE FUNCTION public.handle_lesson_progress_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_mandatory INTEGER;
  v_completed_mandatory INTEGER;
  v_pct NUMERIC(5,2);
  v_lesson_xp INTEGER;
  v_lesson_title TEXT;
  v_company_id UUID;
  v_new_status public.enrollment_status;
BEGIN
  SELECT company_id INTO v_company_id FROM public.enrollments WHERE id = NEW.enrollment_id;

  SELECT COUNT(*) INTO v_total_mandatory
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.course_id = NEW.course_id
    AND l.is_published = TRUE
    AND l.is_mandatory = TRUE
    AND m.is_published = TRUE;

  SELECT COUNT(*) INTO v_completed_mandatory
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.id = lp.lesson_id
  WHERE lp.enrollment_id = NEW.enrollment_id
    AND lp.status = 'completed'
    AND l.is_published = TRUE
    AND l.is_mandatory = TRUE;

  IF v_total_mandatory > 0 THEN
    v_pct := ROUND((v_completed_mandatory::NUMERIC / v_total_mandatory::NUMERIC) * 100, 2);
  ELSE
    v_pct := 0;
  END IF;

  IF v_pct >= 100 THEN
    v_new_status := 'completed';
  ELSIF v_pct > 0 OR NEW.status = 'in_progress' THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'not_started';
  END IF;

  UPDATE public.enrollments
  SET
    progress_percentage = LEAST(v_pct, 100.00),
    status = v_new_status,
    completed_at = CASE WHEN v_new_status = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
    last_accessed_at = NOW()
  WHERE id = NEW.enrollment_id;

  -- Otorgar XP cuando pasa a completed
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT xp_reward, title INTO v_lesson_xp, v_lesson_title FROM public.lessons WHERE id = NEW.lesson_id;
    PERFORM public.record_user_xp_and_streak(
      NEW.user_id,
      v_company_id,
      'lesson_completed',
      NEW.lesson_id,
      COALESCE(v_lesson_xp, 50),
      'Lección completada: ' || COALESCE(v_lesson_title, '')
    );
  END IF;

  IF v_pct >= 100 THEN
    PERFORM public.issue_certificate_if_eligible(NEW.enrollment_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lesson_progress_recalc
  AFTER INSERT OR UPDATE OF status ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_lesson_progress_change();

-- 10.8 Disparo de XP, nota final y certificado cuando se califica un examen
CREATE OR REPLACE FUNCTION public.handle_quiz_attempt_graded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz RECORD;
  v_avg_grade NUMERIC(5,2);
BEGIN
  IF NEW.status = 'graded' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'graded' OR NEW.passed IS DISTINCT FROM OLD.passed) THEN
    SELECT * INTO v_quiz FROM public.quizzes WHERE id = NEW.quiz_id;

    -- Recalcular promedio de mejores notas de exámenes del curso
    SELECT ROUND(AVG(best_pct), 2) INTO v_avg_grade
    FROM (
      SELECT MAX(qa.percentage) AS best_pct
      FROM public.quiz_attempts qa
      WHERE qa.enrollment_id = NEW.enrollment_id AND qa.status = 'graded'
      GROUP BY qa.quiz_id
    ) sub;

    UPDATE public.enrollments
    SET final_grade = v_avg_grade, last_accessed_at = NOW()
    WHERE id = NEW.enrollment_id;

    IF NEW.passed THEN
      -- Marcar la lección del quiz como completada automáticamente si existe
      IF v_quiz.lesson_id IS NOT NULL THEN
        INSERT INTO public.lesson_progress (enrollment_id, user_id, course_id, module_id, lesson_id, status, completed_at)
        SELECT NEW.enrollment_id, NEW.user_id, v_quiz.course_id, l.module_id, l.id, 'completed', NOW()
        FROM public.lessons l
        WHERE l.id = v_quiz.lesson_id
        ON CONFLICT (user_id, lesson_id) DO UPDATE
        SET status = 'completed', completed_at = COALESCE(public.lesson_progress.completed_at, NOW());
      END IF;

      PERFORM public.record_user_xp_and_streak(
        NEW.user_id,
        NEW.company_id,
        'quiz_passed',
        NEW.quiz_id,
        COALESCE(v_quiz.xp_reward, 150),
        'Evaluación aprobada: ' || v_quiz.title
      );

      PERFORM public.issue_certificate_if_eligible(NEW.enrollment_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quiz_attempt_graded
  AFTER INSERT OR UPDATE OF status, passed, percentage ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.handle_quiz_attempt_graded();

-- 10.9 Contador de upvotes en foro de lección
CREATE OR REPLACE FUNCTION public.sync_discussion_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lesson_discussions SET upvotes_count = upvotes_count + 1 WHERE id = NEW.discussion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lesson_discussions SET upvotes_count = GREATEST(upvotes_count - 1, 0) WHERE id = OLD.discussion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_discussion_upvotes_sync
  AFTER INSERT OR DELETE ON public.lesson_discussion_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.sync_discussion_upvotes();

-- ============================================================================
-- 11. FUNCIONES RPC DE NEGOCIO (CORRELATIVIDADES, VERIFICACIÓN PÚBLICA Y RRHH)
-- ============================================================================

-- 11.1 Verificar si un alumno puede acceder a un módulo (avance secuencial + examen previo)
CREATE OR REPLACE FUNCTION public.can_access_module(p_user_id UUID, p_module_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mod RECORD;
  v_is_sequential BOOLEAN;
  v_prev_module_id UUID;
  v_prev_requires_quiz BOOLEAN;
  v_uncompleted_lessons INTEGER;
  v_unpassed_quizzes INTEGER;
BEGIN
  SELECT * INTO v_mod FROM public.modules WHERE id = p_module_id;
  IF v_mod IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT is_sequential INTO v_is_sequential FROM public.courses WHERE id = v_mod.course_id;

  -- Determinar módulo prerrequisito (explícito o el inmediato anterior si es secuencial)
  IF v_mod.prerequisite_module_id IS NOT NULL THEN
    v_prev_module_id := v_mod.prerequisite_module_id;
  ELSIF v_is_sequential THEN
    SELECT id INTO v_prev_module_id
    FROM public.modules
    WHERE course_id = v_mod.course_id
      AND is_published = TRUE
      AND position < v_mod.position
    ORDER BY position DESC
    LIMIT 1;
  END IF;

  IF v_prev_module_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Verificar lecciones obligatorias del módulo previo
  SELECT COUNT(*) INTO v_uncompleted_lessons
  FROM public.lessons l
  LEFT JOIN public.lesson_progress lp
    ON lp.lesson_id = l.id AND lp.user_id = p_user_id AND lp.status = 'completed'
  WHERE l.module_id = v_prev_module_id
    AND l.is_published = TRUE
    AND l.is_mandatory = TRUE
    AND lp.id IS NULL;

  IF v_uncompleted_lessons > 0 THEN
    RETURN FALSE;
  END IF;

  -- Verificar exámenes del módulo previo si aplica
  SELECT requires_quiz_pass INTO v_prev_requires_quiz FROM public.modules WHERE id = v_prev_module_id;
  IF v_prev_requires_quiz THEN
    SELECT COUNT(*) INTO v_unpassed_quizzes
    FROM public.quizzes q
    WHERE q.module_id = v_prev_module_id
      AND NOT EXISTS (
        SELECT 1 FROM public.quiz_attempts qa
        WHERE qa.quiz_id = q.id AND qa.user_id = p_user_id AND qa.passed = TRUE
      );

    IF v_unpassed_quizzes > 0 THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- 11.2 Verificación pública de diplomas por UUID (/verificar/[codigo]) sin exponer tablas internas
CREATE OR REPLACE FUNCTION public.verify_certificate(p_verification_code UUID)
RETURNS TABLE (
  certificate_number TEXT,
  student_name TEXT,
  company_name TEXT,
  course_title TEXT,
  instructor_name TEXT,
  final_grade NUMERIC,
  total_hours NUMERIC,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.certificate_number,
    c.student_name_snapshot AS student_name,
    c.company_name_snapshot AS company_name,
    c.course_title_snapshot AS course_title,
    c.instructor_name_snapshot AS instructor_name,
    c.final_grade,
    c.total_hours,
    c.issued_at,
    c.expires_at,
    (c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > NOW())) AS is_valid,
    c.revoked_at,
    c.revoke_reason
  FROM public.certificates c
  WHERE c.verification_code = p_verification_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(UUID) TO anon, authenticated;

-- 11.3 Vista de tabla de posiciones por empresa (respeta RLS del invocador)
CREATE OR REPLACE VIEW public.company_leaderboard
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  p.company_id,
  p.full_name,
  p.avatar_url,
  p.department,
  p.xp_points,
  p.current_streak,
  RANK() OVER (PARTITION BY p.company_id ORDER BY p.xp_points DESC, p.current_streak DESC) AS company_rank
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
WHERE p.role = 'student'
  AND p.is_active = TRUE
  AND COALESCE((c.settings->>'leaderboard_enabled')::BOOLEAN, TRUE) = TRUE;

-- 11.4 RPC de métricas agregadas para Dashboard de RRHH
CREATE OR REPLACE FUNCTION public.get_company_hr_metrics(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role := public.get_my_role();
  v_caller_company UUID := public.get_my_company_id();
  v_inactive_days INTEGER := 14;
  v_result JSONB;
BEGIN
  IF v_caller_role <> 'super_admin' AND NOT (v_caller_role = 'company_admin' AND v_caller_company = p_company_id) THEN
    RAISE EXCEPTION 'Acceso denegado a las métricas de esta empresa.';
  END IF;

  SELECT COALESCE((settings->>'inactive_alert_days')::INTEGER, 14)
  INTO v_inactive_days
  FROM public.companies
  WHERE id = p_company_id;

  SELECT jsonb_build_object(
    'total_employees', (SELECT COUNT(*) FROM public.profiles WHERE company_id = p_company_id AND role = 'student' AND is_active = TRUE),
    'total_enrollments', (SELECT COUNT(*) FROM public.enrollments WHERE company_id = p_company_id),
    'completed_enrollments', (SELECT COUNT(*) FROM public.enrollments WHERE company_id = p_company_id AND status = 'completed'),
    'completion_rate', COALESCE((
      SELECT ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2)
      FROM public.enrollments WHERE company_id = p_company_id
    ), 0),
    'average_grade', COALESCE((
      SELECT ROUND(AVG(final_grade), 2)
      FROM public.enrollments WHERE company_id = p_company_id AND final_grade IS NOT NULL
    ), 0),
    'overdue_enrollments', (
      SELECT COUNT(*) FROM public.enrollments
      WHERE company_id = p_company_id
        AND status <> 'completed'
        AND due_date IS NOT NULL
        AND due_date < NOW()
    ),
    'inactive_students', (
      SELECT COUNT(*) FROM public.profiles
      WHERE company_id = p_company_id
        AND role = 'student'
        AND is_active = TRUE
        AND (last_activity_date IS NULL OR last_activity_date < CURRENT_DATE - v_inactive_days)
    ),
    'certificates_issued', (
      SELECT COUNT(*) FROM public.certificates WHERE company_id = p_company_id AND revoked_at IS NULL
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 12. POLÍTICAS ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_course_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_discussion_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_jobs ENABLE ROW LEVEL SECURITY;

-- 12.1 COMPANIES
CREATE POLICY "companies_super_admin_all" ON public.companies
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "companies_member_select" ON public.companies
  FOR SELECT USING (id = public.get_my_company_id());

CREATE POLICY "companies_admin_update_own" ON public.companies
  FOR UPDATE USING (public.get_my_role() = 'company_admin' AND id = public.get_my_company_id())
  WITH CHECK (public.get_my_role() = 'company_admin' AND id = public.get_my_company_id());

-- 12.2 PROFILES
CREATE POLICY "profiles_super_admin_all" ON public.profiles
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_same_company" ON public.profiles
  FOR SELECT USING (company_id IS NOT NULL AND company_id = public.get_my_company_id());

CREATE POLICY "profiles_instructor_select_enrolled_students" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'instructor' AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = public.profiles.id AND public.is_instructor_of_course(e.course_id)
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_company_admin_update_company_users" ON public.profiles
  FOR UPDATE USING (
    public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id()
  );

-- 12.3 COHORTS & COHORT_MEMBERS
CREATE POLICY "cohorts_super_admin_all" ON public.cohorts
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "cohorts_company_admin_manage" ON public.cohorts
  FOR ALL USING (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id())
  WITH CHECK (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id());

CREATE POLICY "cohorts_student_select_own" ON public.cohorts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cohort_members cm WHERE cm.cohort_id = public.cohorts.id AND cm.user_id = auth.uid())
  );

CREATE POLICY "cohort_members_super_admin_all" ON public.cohort_members
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "cohort_members_company_admin_manage" ON public.cohort_members
  FOR ALL USING (
    public.get_my_role() = 'company_admin' AND EXISTS (
      SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'company_admin' AND EXISTS (
      SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY "cohort_members_select_own" ON public.cohort_members
  FOR SELECT USING (user_id = auth.uid());

-- 12.4 COURSES & COURSE_INSTRUCTORS
CREATE POLICY "courses_super_admin_all" ON public.courses
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "courses_instructor_manage_own" ON public.courses
  FOR ALL USING (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(id))
  WITH CHECK (public.get_my_role() = 'instructor' AND (instructor_id = auth.uid() OR public.is_instructor_of_course(id)));

CREATE POLICY "courses_instructor_insert" ON public.courses
  FOR INSERT WITH CHECK (public.get_my_role() = 'instructor' AND instructor_id = auth.uid());

CREATE POLICY "courses_company_licensed_select" ON public.courses
  FOR SELECT USING (
    status = 'published' AND (
      EXISTS (
        SELECT 1 FROM public.company_course_licenses l
        WHERE l.course_id = public.courses.id
          AND l.company_id = public.get_my_company_id()
          AND l.is_active = TRUE
          AND (l.valid_until IS NULL OR l.valid_until > NOW())
      )
      OR EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.course_id = public.courses.id AND e.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "course_instructors_manage" ON public.course_instructors
  FOR ALL USING (public.is_super_admin() OR public.is_instructor_of_course(course_id))
  WITH CHECK (public.is_super_admin() OR public.is_instructor_of_course(course_id));

CREATE POLICY "course_instructors_select_auth" ON public.course_instructors
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 12.5 COMPANY_COURSE_LICENSES
CREATE POLICY "licenses_super_admin_all" ON public.company_course_licenses
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "licenses_company_admin_select" ON public.company_course_licenses
  FOR SELECT USING (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id());

-- 12.6 MODULES, LESSONS & LESSON_RESOURCES
CREATE POLICY "modules_admin_instructor_all" ON public.modules
  FOR ALL USING (public.is_super_admin() OR public.is_instructor_of_course(course_id))
  WITH CHECK (public.is_super_admin() OR public.is_instructor_of_course(course_id));

CREATE POLICY "modules_enrolled_or_company_admin_select" ON public.modules
  FOR SELECT USING (
    is_published = TRUE AND (
      EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = public.modules.course_id AND e.user_id = auth.uid())
      OR (public.get_my_role() = 'company_admin' AND EXISTS (
        SELECT 1 FROM public.company_course_licenses l
        WHERE l.course_id = public.modules.course_id AND l.company_id = public.get_my_company_id() AND l.is_active = TRUE
      ))
    )
  );

CREATE POLICY "lessons_admin_instructor_all" ON public.lessons
  FOR ALL USING (public.is_super_admin() OR public.is_instructor_of_course(course_id))
  WITH CHECK (public.is_super_admin() OR public.is_instructor_of_course(course_id));

CREATE POLICY "lessons_enrolled_or_company_admin_select" ON public.lessons
  FOR SELECT USING (
    is_published = TRUE AND (
      EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = public.lessons.course_id AND e.user_id = auth.uid())
      OR (public.get_my_role() = 'company_admin' AND EXISTS (
        SELECT 1 FROM public.company_course_licenses l
        WHERE l.course_id = public.lessons.course_id AND l.company_id = public.get_my_company_id() AND l.is_active = TRUE
      ))
    )
  );

CREATE POLICY "lesson_resources_admin_instructor_all" ON public.lesson_resources
  FOR ALL USING (public.is_super_admin() OR public.is_instructor_of_course(course_id))
  WITH CHECK (public.is_super_admin() OR public.is_instructor_of_course(course_id));

CREATE POLICY "lesson_resources_enrolled_select" ON public.lesson_resources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = public.lesson_resources.course_id AND e.user_id = auth.uid())
    OR (public.get_my_role() = 'company_admin' AND EXISTS (
      SELECT 1 FROM public.company_course_licenses l
      WHERE l.course_id = public.lesson_resources.course_id AND l.company_id = public.get_my_company_id()
    ))
  );

-- 12.7 ENROLLMENTS
CREATE POLICY "enrollments_super_admin_all" ON public.enrollments
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "enrollments_company_admin_manage" ON public.enrollments
  FOR ALL USING (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id())
  WITH CHECK (
    public.get_my_role() = 'company_admin'
    AND company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM public.company_course_licenses l
      WHERE l.company_id = public.get_my_company_id()
        AND l.course_id = public.enrollments.course_id
        AND l.is_active = TRUE
    )
  );

CREATE POLICY "enrollments_instructor_select" ON public.enrollments
  FOR SELECT USING (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(course_id));

CREATE POLICY "enrollments_student_select_own" ON public.enrollments
  FOR SELECT USING (user_id = auth.uid());

-- 12.8 LESSON_PROGRESS
CREATE POLICY "lesson_progress_super_admin_all" ON public.lesson_progress
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "lesson_progress_student_manage_own" ON public.lesson_progress
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.id = enrollment_id AND e.user_id = auth.uid() AND e.course_id = course_id
    )
    AND public.can_access_module(auth.uid(), module_id)
  );

CREATE POLICY "lesson_progress_company_admin_select" ON public.lesson_progress
  FOR SELECT USING (
    public.get_my_role() = 'company_admin' AND EXISTS (
      SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY "lesson_progress_instructor_select" ON public.lesson_progress
  FOR SELECT USING (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(course_id));

-- 12.9 ASSIGNMENT_SUBMISSIONS
CREATE POLICY "submissions_super_admin_all" ON public.assignment_submissions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "submissions_student_own" ON public.assignment_submissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "submissions_student_insert" ON public.assignment_submissions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_my_company_id()
    AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.user_id = auth.uid())
  );

CREATE POLICY "submissions_student_update_ungraded" ON public.assignment_submissions
  FOR UPDATE USING (user_id = auth.uid() AND status IN ('submitted', 'resubmit_requested'))
  WITH CHECK (user_id = auth.uid() AND status = 'submitted');

CREATE POLICY "submissions_instructor_grade" ON public.assignment_submissions
  FOR ALL USING (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(course_id))
  WITH CHECK (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(course_id));

CREATE POLICY "submissions_company_admin_select" ON public.assignment_submissions
  FOR SELECT USING (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id());

-- 12.10 QUESTION BANKS, QUESTIONS & ANSWER KEYS (SEGURIDAD ANTI-TRAMPA)
CREATE POLICY "question_banks_manage" ON public.question_banks
  FOR ALL USING (public.is_super_admin() OR public.is_instructor_of_course(course_id))
  WITH CHECK (public.is_super_admin() OR public.is_instructor_of_course(course_id));

CREATE POLICY "questions_manage" ON public.questions
  FOR ALL USING (public.is_super_admin() OR public.is_instructor_of_course(course_id))
  WITH CHECK (public.is_super_admin() OR public.is_instructor_of_course(course_id));

CREATE POLICY "questions_student_select_in_active_attempt" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      WHERE qa.user_id = auth.uid()
        AND q.course_id = public.questions.course_id
        AND public.questions.id = ANY(qa.question_order)
    )
  );

-- Claves de respuesta: EXCLUSIVO Super Admin e Instructor del curso (NUNCA alumnos directamente)
CREATE POLICY "answer_keys_strict_staff_only" ON public.question_answer_keys
  FOR ALL USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_id AND public.is_instructor_of_course(q.course_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_id AND public.is_instructor_of_course(q.course_id)
    )
  );

-- 12.11 QUIZZES, QUIZ_QUESTIONS, ATTEMPTS & ANSWERS
CREATE POLICY "quizzes_manage" ON public.quizzes
  FOR ALL USING (public.is_super_admin() OR public.is_instructor_of_course(course_id))
  WITH CHECK (public.is_super_admin() OR public.is_instructor_of_course(course_id));

CREATE POLICY "quizzes_enrolled_select" ON public.quizzes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = public.quizzes.course_id AND e.user_id = auth.uid())
    OR (public.get_my_role() = 'company_admin' AND EXISTS (
      SELECT 1 FROM public.company_course_licenses l WHERE l.course_id = public.quizzes.course_id AND l.company_id = public.get_my_company_id()
    ))
  );

CREATE POLICY "quiz_questions_manage" ON public.quiz_questions
  FOR ALL USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_instructor_of_course(q.course_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_instructor_of_course(q.course_id)
    )
  );

CREATE POLICY "quiz_attempts_super_admin_all" ON public.quiz_attempts
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "quiz_attempts_student_own" ON public.quiz_attempts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "quiz_attempts_instructor_grade" ON public.quiz_attempts
  FOR ALL USING (
    public.get_my_role() = 'instructor' AND EXISTS (
      SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_instructor_of_course(q.course_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'instructor' AND EXISTS (
      SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_instructor_of_course(q.course_id)
    )
  );

CREATE POLICY "quiz_attempts_company_admin_select" ON public.quiz_attempts
  FOR SELECT USING (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id());

CREATE POLICY "quiz_answers_super_admin_all" ON public.quiz_attempt_answers
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "quiz_answers_student_select_own" ON public.quiz_attempt_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quiz_attempts qa WHERE qa.id = attempt_id AND qa.user_id = auth.uid())
  );

CREATE POLICY "quiz_answers_instructor_grade" ON public.quiz_attempt_answers
  FOR ALL USING (
    public.get_my_role() = 'instructor' AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = attempt_id AND public.is_instructor_of_course(q.course_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'instructor' AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = attempt_id AND public.is_instructor_of_course(q.course_id)
    )
  );

-- 12.12 LESSON_NOTES (PRIVADAS POR ALUMNO)
CREATE POLICY "lesson_notes_own_all" ON public.lesson_notes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 12.13 LESSON_DISCUSSIONS & UPVOTES
CREATE POLICY "discussions_super_admin_all" ON public.lesson_discussions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "discussions_instructor_manage" ON public.lesson_discussions
  FOR ALL USING (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(course_id))
  WITH CHECK (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(course_id));

CREATE POLICY "discussions_enrolled_select" ON public.lesson_discussions
  FOR SELECT USING (
    (company_id IS NULL OR company_id = public.get_my_company_id())
    AND (
      EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = public.lesson_discussions.course_id AND e.user_id = auth.uid())
      OR (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id())
    )
  );

CREATE POLICY "discussions_enrolled_insert" ON public.lesson_discussions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (company_id IS NULL OR company_id = public.get_my_company_id())
    AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = public.lesson_discussions.course_id AND e.user_id = auth.uid())
  );

CREATE POLICY "discussions_author_update_delete" ON public.lesson_discussions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "discussions_author_delete" ON public.lesson_discussions
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "discussion_upvotes_select" ON public.lesson_discussion_upvotes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "discussion_upvotes_own" ON public.lesson_discussion_upvotes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 12.14 XP_LEDGER & USER_ACTIVITY_DAYS
CREATE POLICY "xp_ledger_select_own_or_admin" ON public.xp_ledger
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id())
  );

CREATE POLICY "activity_days_select_own_or_admin" ON public.user_activity_days
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR (public.get_my_role() = 'company_admin' AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.company_id = public.get_my_company_id()
    ))
  );

-- 12.15 CERTIFICATES
CREATE POLICY "certificates_super_admin_all" ON public.certificates
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "certificates_student_select_own" ON public.certificates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "certificates_company_admin_select" ON public.certificates
  FOR SELECT USING (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id());

CREATE POLICY "certificates_instructor_select" ON public.certificates
  FOR SELECT USING (public.get_my_role() = 'instructor' AND public.is_instructor_of_course(course_id));

-- 12.16 BULK_IMPORT_JOBS
CREATE POLICY "bulk_imports_super_admin_all" ON public.bulk_import_jobs
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "bulk_imports_company_admin_own" ON public.bulk_import_jobs
  FOR ALL USING (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id())
  WITH CHECK (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id());

-- ============================================================================
-- 13. SUPABASE STORAGE BUCKETS Y POLÍTICAS DE ACCESO
-- ============================================================================

-- Bucket público: portadas de cursos, logos de empresas y avatares
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-assets',
  'course-assets',
  TRUE,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Bucket privado: PDFs, PPTs y videos de lecciones (acceso vía URLs firmadas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-materials',
  'lesson-materials',
  FALSE,
  524288000, -- 500 MB
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4',
    'video/webm'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Bucket privado: entregas de tareas de alumnos
-- Convención de ruta: {company_id}/{user_id}/{lesson_id}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('assignment-submissions', 'assignment-submissions', FALSE, 52428800) -- 50 MB
ON CONFLICT (id) DO NOTHING;

-- Bucket privado: diplomas PDF generados
-- Convención de ruta: {company_id}/{user_id}/{verification_code}.pdf
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', FALSE, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "storage_course_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'course-assets');

CREATE POLICY "storage_course_assets_staff_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'course-assets' AND public.get_my_role() IN ('super_admin', 'instructor', 'company_admin')
  );

CREATE POLICY "storage_lesson_materials_staff_manage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'lesson-materials' AND public.get_my_role() IN ('super_admin', 'instructor')
  )
  WITH CHECK (
    bucket_id = 'lesson-materials' AND public.get_my_role() IN ('super_admin', 'instructor')
  );

-- Lectura de materiales privados: ruta {course_id}/{lesson_id}/{filename}
CREATE POLICY "storage_lesson_materials_enrolled_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lesson-materials'
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid()
        AND e.course_id::TEXT = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "storage_submissions_student_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'assignment-submissions'
    AND (storage.foldername(name))[1] = public.get_my_company_id()::TEXT
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );

CREATE POLICY "storage_submissions_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'assignment-submissions' AND (
      public.is_super_admin()
      OR (storage.foldername(name))[2] = auth.uid()::TEXT
      OR (public.get_my_role() = 'company_admin' AND (storage.foldername(name))[1] = public.get_my_company_id()::TEXT)
      OR public.get_my_role() = 'instructor'
    )
  );

CREATE POLICY "storage_certificates_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'certificates' AND (
      public.is_super_admin()
      OR (storage.foldername(name))[2] = auth.uid()::TEXT
      OR (public.get_my_role() = 'company_admin' AND (storage.foldername(name))[1] = public.get_my_company_id()::TEXT)
    )
  );

