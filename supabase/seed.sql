-- ============================================================================
-- CapacitaPro LMS — Seed Inicial para Supabase (Ejecutar después de la migración)
-- Archivo: supabase/seed.sql
--
-- Incluye:
--   1. Empresa demo ("Solution Academy Empresas") + Cohorte Q4
--   2. Dos cursos publicados con módulos correlativos y lecciones completas
--   3. Banco de preguntas con los 5 tipos (única, múltiple, V/F, completar, abierta)
--   4. Exámenes (módulo 1 obligatorio para desbloquear módulo 2 + examen final)
--   5. 4 usuarios demo listos para iniciar sesión (contraseña: CapacitaPro2026!)
--      - superadmin@capacitapro.demo  (Super Admin)
--      - rrhh@capacitapro.demo        (Admin de Empresa / RRHH)
--      - instructor@capacitapro.demo  (Instructor)
--      - alumno@capacitapro.demo      (Alumno / Empleado)
--   6. Helper SQL public.assign_demo_role_and_enroll(email, role) para asignar
--      rápidamente cualquier usuario que crees desde Auth Dashboard.
-- ============================================================================

DO $$
DECLARE
  -- IDs determinísticos para re-ejecución idempotente
  v_company_id      UUID := '11111111-1111-4111-8111-111111111111';
  v_cohort_id       UUID := '11111111-2222-4111-8111-111111111111';

  v_superadmin_id   UUID := '22222222-0001-4222-8222-222222222222';
  v_hr_id           UUID := '22222222-0002-4222-8222-222222222222';
  v_instructor_id   UUID := '22222222-0003-4222-8222-222222222222';
  v_student_id      UUID := '22222222-0004-4222-8222-222222222222';

  v_course1_id      UUID := '33333333-0001-4333-8333-333333333333';
  v_course2_id      UUID := '33333333-0002-4333-8333-333333333333';

  v_c1_mod1_id      UUID := '44444444-0001-4444-8444-444444444444';
  v_c1_mod2_id      UUID := '44444444-0002-4444-8444-444444444444';
  v_c2_mod1_id      UUID := '44444444-0003-4444-8444-444444444444';

  v_l1_video_id     UUID := '55555555-0001-4555-8555-555555555555';
  v_l2_read_id      UUID := '55555555-0002-4555-8555-555555555555';
  v_l3_quiz1_id     UUID := '55555555-0003-4555-8555-555555555555';
  v_l4_doc_id       UUID := '55555555-0004-4555-8555-555555555555';
  v_l5_assign_id    UUID := '55555555-0005-4555-8555-555555555555';
  v_l6_final_id     UUID := '55555555-0006-4555-8555-555555555555';
  v_c2_l1_id        UUID := '55555555-0007-4555-8555-555555555555';

  v_bank1_id        UUID := '66666666-0001-4666-8666-666666666666';
  v_q1_id           UUID := '77777777-0001-4777-8777-777777777777';
  v_q2_id           UUID := '77777777-0002-4777-8777-777777777777';
  v_q3_id           UUID := '77777777-0003-4777-8777-777777777777';
  v_q4_id           UUID := '77777777-0004-4777-8777-777777777777';
  v_q5_id           UUID := '77777777-0005-4777-8777-777777777777';

  v_quiz_mod1_id    UUID := '88888888-0001-4888-8888-888888888888';
  v_quiz_final_id   UUID := '88888888-0002-4888-8888-888888888888';

  v_enr1_id         UUID := '99999999-0001-4999-8999-999999999999';
  v_enr2_id         UUID := '99999999-0002-4999-8999-999999999999';

  v_password_hash   TEXT := extensions.crypt('CapacitaPro2026!', extensions.gen_salt('bf'));
BEGIN
  -- 1. EMPRESA DEMO
  INSERT INTO public.companies (id, name, slug, tax_id, primary_color, max_seats, settings)
  VALUES (
    v_company_id,
    'Solution Academy Empresas',
    'solution-academy-empresas',
    '30-71548291-4',
    '#0D5BD9',
    250,
    '{"leaderboard_enabled": true, "allow_self_enrollment": false, "inactive_alert_days": 14}'::jsonb
  )
  ON CONFLICT (slug) DO NOTHING;

  -- 2. USUARIOS DEMO EN AUTH.USERS (con contraseñas listas para login)
  -- Si tu instancia de Supabase restringe inserts directos en auth.users,
  -- el bloque captura el error sin abortar el resto del seed.
  BEGIN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES
      (
        '00000000-0000-0000-0000-000000000000', v_superadmin_id, 'authenticated', 'authenticated',
        'superadmin@capacitapro.demo', v_password_hash, NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', 'super_admin'),
        jsonb_build_object('full_name', 'Dirección Global CapacitaPro'),
        NOW(), NOW(), '', '', '', ''
      ),
      (
        '00000000-0000-0000-0000-000000000000', v_hr_id, 'authenticated', 'authenticated',
        'rrhh@capacitapro.demo', v_password_hash, NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', 'company_admin', 'company_id', v_company_id),
        jsonb_build_object('full_name', 'Carolina Méndez (RRHH)', 'job_title', 'Gerente de Capacitación', 'department', 'Recursos Humanos'),
        NOW(), NOW(), '', '', '', ''
      ),
      (
        '00000000-0000-0000-0000-000000000000', v_instructor_id, 'authenticated', 'authenticated',
        'instructor@capacitapro.demo', v_password_hash, NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', 'instructor', 'company_id', v_company_id),
        jsonb_build_object('full_name', 'Ing. Martín Acosta', 'job_title', 'Instructor Senior Maquinaria Vial', 'department', 'Académico'),
        NOW(), NOW(), '', '', '', ''
      ),
      (
        '00000000-0000-0000-0000-000000000000', v_student_id, 'authenticated', 'authenticated',
        'alumno@capacitapro.demo', v_password_hash, NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', 'student', 'company_id', v_company_id),
        jsonb_build_object('full_name', 'Lucas Fernández', 'job_title', 'Operador Junior', 'department', 'Operaciones Viales', 'employee_code', 'EMP-1042'),
        NOW(), NOW(), '', '', '', ''
      )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    )
    VALUES
      (gen_random_uuid(), v_superadmin_id, jsonb_build_object('sub', v_superadmin_id::text, 'email', 'superadmin@capacitapro.demo'), 'email', v_superadmin_id::text, NOW(), NOW(), NOW()),
      (gen_random_uuid(), v_hr_id,         jsonb_build_object('sub', v_hr_id::text,         'email', 'rrhh@capacitapro.demo'),       'email', v_hr_id::text,         NOW(), NOW(), NOW()),
      (gen_random_uuid(), v_instructor_id, jsonb_build_object('sub', v_instructor_id::text, 'email', 'instructor@capacitapro.demo'), 'email', v_instructor_id::text, NOW(), NOW(), NOW()),
      (gen_random_uuid(), v_student_id,    jsonb_build_object('sub', v_student_id::text,    'email', 'alumno@capacitapro.demo'),     'email', v_student_id::text,    NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudieron insertar usuarios directamente en auth.users (%). Crea los usuarios en Authentication > Users y ejecuta public.assign_demo_role_and_enroll(email, role).', SQLERRM;
  END;

  -- 3. COHORTE DEMO
  INSERT INTO public.cohorts (id, company_id, name, description, start_date, end_date, created_by)
  VALUES (
    v_cohort_id,
    v_company_id,
    'Cohorte Operaciones Viales 2026',
    'Grupo obligatorio de seguridad y operación de maquinaria pesada.',
    NOW(),
    NOW() + INTERVAL '45 days',
    CASE WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = v_hr_id) THEN v_hr_id ELSE NULL END
  )
  ON CONFLICT (company_id, name) DO NOTHING;

  -- 4. CURSOS PUBLICADOS
  INSERT INTO public.courses (
    id, title, slug, short_description, description, category, level, status,
    instructor_id, is_sequential, passing_score, xp_reward, estimated_hours, certificate_enabled
  )
  VALUES
    (
      v_course1_id,
      'Operador de Retroexcavadora y Seguridad Vial',
      'operador-retroexcavadora-seguridad-vial',
      'Domina la inspección pre-operacional, operación segura en cabina, excavación de zanjas y protocolos de seguridad en obra.',
      'Programa corporativo certificado orientado a operadores de maquinaria vial. Incluye avance secuencial obligatorio, evaluación de seguridad en Módulo 1, tarea práctica de check-list y examen final habilitante.',
      'Maquinaria Pesada',
      'intermediate',
      'published',
      CASE WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = v_instructor_id) THEN v_instructor_id ELSE NULL END,
      TRUE,
      80.00,
      600,
      24.00,
      TRUE
    ),
    (
      v_course2_id,
      'Construcción en Seco: Steel Framing y Durlock',
      'construccion-en-seco-steel-framing',
      'Lectura de planos, montaje de paneles estructurales PGC/PGU, aislaciones y cómputo de materiales en obra.',
      'Capacitación técnico-práctica sobre sistemas de construcción en seco industrializada para cuadrillas y contratistas.',
      'Construcción y Oficios',
      'beginner',
      'published',
      CASE WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = v_instructor_id) THEN v_instructor_id ELSE NULL END,
      FALSE,
      75.00,
      450,
      18.00,
      TRUE
    )
  ON CONFLICT (slug) DO NOTHING;

  -- Licencias de ambos cursos para la empresa demo
  INSERT INTO public.company_course_licenses (company_id, course_id, max_enrollments, is_active)
  VALUES
    (v_company_id, v_course1_id, 200, TRUE),
    (v_company_id, v_course2_id, 200, TRUE)
  ON CONFLICT (company_id, course_id) DO NOTHING;

  -- 5. MÓDULOS CON CORRELATIVIDAD (Módulo 2 bloqueado hasta aprobar Módulo 1)
  INSERT INTO public.modules (id, course_id, title, description, position, prerequisite_module_id, requires_quiz_pass, is_published)
  VALUES
    (v_c1_mod1_id, v_course1_id, 'Módulo 1: Seguridad Operativa e Inspección Pre-Operacional', 'Fundamentos obligatorios antes de encender el equipo.', 1, NULL, TRUE, TRUE),
    (v_c1_mod2_id, v_course1_id, 'Módulo 2: Maniobras de Excavación, Zanjeo y Certificación', 'Se desbloquea al completar el Módulo 1 y aprobar su evaluación.', 2, v_c1_mod1_id, TRUE, TRUE),
    (v_c2_mod1_id, v_course2_id, 'Módulo 1: Perfilería Estructural y Replanteo', 'Introducción a perfiles galvanizados, fijaciones y herramientas.', 1, NULL, FALSE, TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- 6. LECCIONES DE TODOS LOS TIPOS (Video, Lectura, Evaluación, Documento, Tarea)
  INSERT INTO public.lessons (
    id, module_id, course_id, title, slug, lesson_type, position, duration_minutes, xp_reward,
    is_mandatory, is_published, video_provider, video_url, content_markdown, assignment_instructions
  )
  VALUES
    (
      v_l1_video_id, v_c1_mod1_id, v_course1_id,
      'Reconocimiento de Cabina, Mandos y Estabilizadores',
      'reconocimiento-cabina-mandos',
      'video', 1, 15, 75, TRUE, TRUE,
      'youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      '### Objetivos de la clase\n- Identificar los joysticks de control del brazo retroexcavador y el balde frontal.\n- Aplicar la regla de los **3 puntos de apoyo** al subir y bajar de la máquina.\n- Verificar trabas mecánicas de transporte antes de circular.',
      NULL
    ),
    (
      v_l2_read_id, v_c1_mod1_id, v_course1_id,
      'Protocolo de Check-List Diario y Sistemas Hidráulicos',
      'protocolo-checklist-hidraulico',
      'reading', 2, 12, 60, TRUE, TRUE,
      NULL, NULL,
      E'# Protocolo Pre-Operacional Diario (Check-List)\n\nAntes de poner en marcha cualquier retroexcavadora, el operador certificado **debe** completar una inspección de 360°:\n\n1. **Fluidos en frío:** Nivel de aceite de motor, aceite hidráulico en mirilla, refrigerante y combustible.\n2. **Circuito hidráulico:** Revisar mangueras, acoples rápidos y cilindros en busca de exudaciones o fugas.\n3. **Neumáticos y estructura:** Presión uniforme, ajuste de bulones de rueda y ausencia de fisuras en pernos.\n4. **Seguridad en cabina:** Cinturón de seguridad retráctil, alarma de retroceso, espejos y baliza giratoria.\n\n> **Regla crítica:** Nunca intentes detectar una fuga hidráulica de alta presión con la mano desnuda; utiliza siempre un cartón o madera.',
      NULL
    ),
    (
      v_l3_quiz1_id, v_c1_mod1_id, v_course1_id,
      'Evaluación de Seguridad — Módulo 1 (Habilitante)',
      'evaluacion-seguridad-modulo-1',
      'quiz', 3, 15, 150, TRUE, TRUE,
      NULL, NULL,
      'Debes obtener al menos **80%** en esta evaluación para desbloquear el Módulo 2.',
      NULL
    ),
    (
      v_l4_doc_id, v_c1_mod2_id, v_course1_id,
      'Manual de Maniobras de Zanjeo y Tabla de Taludes',
      'manual-maniobras-zanjeo',
      'document', 1, 20, 80, TRUE, TRUE,
      NULL, NULL,
      'Descargá el manual oficial de estabilidad en excavaciones y revisá las distancias mínimas de acopio de tierra desde el borde de zanja (mínimo 1 metro).',
      NULL
    ),
    (
      v_l5_assign_id, v_c1_mod2_id, v_course1_id,
      'Tarea Práctica: Informe de Inspección en Obra',
      'tarea-informe-inspeccion',
      'assignment', 2, 30, 120, TRUE, TRUE,
      NULL, NULL,
      'Completá tu informe práctico basado en un escenario de excavación urbana.',
      'Subí un archivo PDF o escribí el detalle de los 5 riesgos críticos que verificarías antes de excavar una zanja de 2 metros en vía pública y qué EPP exigirías al señalero.'
    ),
    (
      v_l6_final_id, v_c1_mod2_id, v_course1_id,
      'Examen Final Certificador de Operador',
      'examen-final-certificador',
      'quiz', 3, 25, 250, TRUE, TRUE,
      NULL, NULL,
      'Al aprobar este examen final con al menos **80%** y tener el 100% del curso completo, el sistema emitirá automáticamente tu Diploma Verificable con QR.',
      NULL
    ),
    (
      v_c2_l1_id, v_c2_mod1_id, v_course2_id,
      'Diferencias entre Perfiles PGC, PGU y Drywall',
      'perfiles-pgc-pgu-drywall',
      'reading', 1, 15, 60, TRUE, TRUE,
      NULL, NULL,
      E'# Perfilería Estructural en Steel Framing\n\n- **PGU (Solera):** Perfil en forma de U que conforma el borde superior e inferior del panel.\n- **PGC (Montante):** Perfil en forma de C con labios rigidizadores que absorbe cargas verticales.\n- **Drywall:** Perfilería liviana calibre 25/26 únicamente para tabiques interiores no portantes.',
      NULL
    )
  ON CONFLICT (course_id, slug) DO NOTHING;

  -- 7. BANCO DE PREGUNTAS (5 TIPOS) + CLAVES PROTEGIDAS
  INSERT INTO public.question_banks (id, course_id, title, description)
  VALUES (v_bank1_id, v_course1_id, 'Banco Principal - Retroexcavadora y Seguridad', 'Preguntas técnicas sobre seguridad vial, hidráulica y operación.')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.questions (id, bank_id, course_id, question_type, prompt, options_public, points, difficulty)
  VALUES
    (
      v_q1_id, v_bank1_id, v_course1_id, 'single_choice',
      '¿Cuál es la regla obligatoria para ascender y descender de la cabina de una retroexcavadora?',
      '[{"id":"a","label":"Saltar desde el último escalón para evitar resbalones"},{"id":"b","label":"Mantener siempre 3 puntos de apoyo mirando hacia la máquina"},{"id":"c","label":"Sujetarse del volante de dirección al subir"},{"id":"d","label":"Subir de espaldas a los peldaños"}]'::jsonb,
      20, 'easy'
    ),
    (
      v_q2_id, v_bank1_id, v_course1_id, 'multiple_choice',
      'Selecciona TODOS los elementos que deben verificarse durante el check-list pre-operacional diario:',
      '[{"id":"a","label":"Nivel de aceite hidráulico y de motor"},{"id":"b","label":"Funcionamiento de alarma sonora de retroceso"},{"id":"c","label":"Estado de mangueras y cilindros sin fugas"},{"id":"d","label":"Pintura estética exterior de la cabina"}]'::jsonb,
      25, 'medium'
    ),
    (
      v_q3_id, v_bank1_id, v_course1_id, 'true_false',
      'Es seguro buscar una fuga de aceite hidráulico a alta presión pasando la mano desnuda cerca de la manguera.',
      '[{"id":"true","label":"Verdadero"},{"id":"false","label":"Falso"}]'::jsonb,
      15, 'easy'
    ),
    (
      v_q4_id, v_bank1_id, v_course1_id, 'fill_blank',
      'Antes de operar el brazo retroexcavador trasero, se deben bajar y apoyar firmemente los _____ para nivelar y dar estabilidad al equipo.',
      '{"blanks_count": 1, "hint": "Elementos laterales hidráulicos de apoyo"}'::jsonb,
      20, 'medium'
    ),
    (
      v_q5_id, v_bank1_id, v_course1_id, 'open_ended',
      'Explica brevemente qué protocolo de seguridad aplicarías si detectas cables subterráneos no señalizados durante una excavación.',
      '{"min_chars": 20}'::jsonb,
      20, 'hard'
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.question_answer_keys (question_id, correct_answer, explanation)
  VALUES
    (v_q1_id, '{"option_id":"b"}'::jsonb, 'La regla de 3 puntos de apoyo (dos manos y un pie, o dos pies y una mano) mirando a la máquina previene caídas.'),
    (v_q2_id, '{"option_ids":["a","b","c"]}'::jsonb, 'Fluidos, alarmas de seguridad e integridad hidráulica son críticos antes de iniciar maniobras.'),
    (v_q3_id, '{"value":false}'::jsonb, 'Una fuga de aceite a alta presión puede penetrar la piel y causar lesiones graves; siempre usa un cartón o madera.'),
    (v_q4_id, '{"accepted":[["estabilizadores","gatos estabilizadores","patas estabilizadoras","apoyos estabilizadores"]]}'::jsonb, 'Los estabilizadores descargan el peso sobre terreno firme y evitan vuelcos.'),
    (v_q5_id, '{"rubric":"Debe mencionar: detener inmediatamente la excavación, alejar personal, señalizar/acordonar la zona y notificar al supervisor y empresa de servicios."}'::jsonb, 'Esta respuesta es evaluada manualmente por el instructor.')
  ON CONFLICT (question_id) DO NOTHING;

  -- 8. EXÁMENES (MÓDULO 1 + FINAL CERTIFICADOR)
  INSERT INTO public.quizzes (
    id, lesson_id, course_id, module_id, question_bank_id, title, description,
    is_final_exam, time_limit_minutes, max_attempts, passing_score_percent,
    random_question_count, shuffle_questions, shuffle_options, feedback_mode, xp_reward
  )
  VALUES
    (
      v_quiz_mod1_id, v_l3_quiz1_id, v_course1_id, v_c1_mod1_id, v_bank1_id,
      'Evaluación de Seguridad — Módulo 1',
      'Aprueba con al menos 80% para desbloquear el Módulo 2.',
      FALSE, 15, 3, 80.00, NULL, TRUE, TRUE, 'after_submit', 150
    ),
    (
      v_quiz_final_id, v_l6_final_id, v_course1_id, v_c1_mod2_id, v_bank1_id,
      'Examen Final de Certificación — Retroexcavadora',
      'Evaluación integradora final (incluye pregunta abierta evaluada por instructor).',
      TRUE, 25, 3, 80.00, NULL, TRUE, TRUE, 'after_submit', 300
    )
  ON CONFLICT (id) DO NOTHING;

  -- Preguntas del Quiz Módulo 1 (4 preguntas auto-corregibles para desbloqueo inmediato)
  INSERT INTO public.quiz_questions (quiz_id, question_id, position)
  VALUES
    (v_quiz_mod1_id, v_q1_id, 1),
    (v_quiz_mod1_id, v_q2_id, 2),
    (v_quiz_mod1_id, v_q3_id, 3),
    (v_quiz_mod1_id, v_q4_id, 4),
    -- Examen final incluye también la pregunta abierta (v_q5_id)
    (v_quiz_final_id, v_q1_id, 1),
    (v_quiz_final_id, v_q2_id, 2),
    (v_quiz_final_id, v_q3_id, 3),
    (v_quiz_final_id, v_q4_id, 4),
    (v_quiz_final_id, v_q5_id, 5)
  ON CONFLICT (quiz_id, question_id) DO NOTHING;

  -- 9. MATRICULACIONES INICIALES DEL ALUMNO DEMO (SI EXISTE)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id) THEN
    INSERT INTO public.cohort_members (cohort_id, user_id)
    VALUES (v_cohort_id, v_student_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.enrollments (id, user_id, course_id, company_id, cohort_id, is_mandatory, status, due_date)
    VALUES
      (v_enr1_id, v_student_id, v_course1_id, v_company_id, v_cohort_id, TRUE, 'not_started', NOW() + INTERVAL '20 days'),
      (v_enr2_id, v_student_id, v_course2_id, v_company_id, v_cohort_id, FALSE, 'not_started', NOW() + INTERVAL '35 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- HELPER PARA PROBAR CUALQUIER USUARIO QUE CREES MANUALMENTE EN SUPABASE AUTH
-- Uso en SQL Editor:
--   SELECT public.assign_demo_role_and_enroll('mi-email@dominio.com', 'super_admin');
--   SELECT public.assign_demo_role_and_enroll('otro@dominio.com', 'student');
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_demo_role_and_enroll(
  p_email TEXT,
  p_role public.user_role DEFAULT 'student'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID := '11111111-1111-4111-8111-111111111111';
  v_course1_id UUID := '33333333-0001-4333-8333-333333333333';
  v_course2_id UUID := '33333333-0002-4333-8333-333333333333';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN 'Usuario no encontrado en auth.users: ' || p_email;
  END IF;

  UPDATE public.profiles
  SET role = p_role, company_id = v_company_id, is_active = TRUE
  WHERE id = v_user_id;

  IF p_role = 'instructor' THEN
    UPDATE public.courses SET instructor_id = v_user_id WHERE id IN (v_course1_id, v_course2_id);
  ELSIF p_role = 'student' THEN
    INSERT INTO public.enrollments (user_id, course_id, company_id, is_mandatory, due_date)
    VALUES
      (v_user_id, v_course1_id, v_company_id, TRUE, NOW() + INTERVAL '20 days'),
      (v_user_id, v_course2_id, v_company_id, FALSE, NOW() + INTERVAL '35 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  RETURN 'OK: ' || p_email || ' configurado como ' || p_role::TEXT || ' en Solution Academy Empresas.';
END;
$$;
