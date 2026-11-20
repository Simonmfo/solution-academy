"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/actions/auth.actions";
import type { QuestionChoice, QuestionPublic, QuizAttempt } from "@/types/database.types";

const createBankSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2, "Nombre del banco requerido"),
  description: z.string().optional(),
});

const createQuizFullSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid(),
  questionBankId: z.string().uuid().nullable().optional(),
  title: z.string().min(3, "Título del examen requerido"),
  description: z.string().optional(),
  isFinalExam: z.boolean().default(false),
  timeLimitMinutes: z.coerce.number().int().min(1).max(300).nullable().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20).default(3),
  passingScorePercent: z.coerce.number().min(0).max(100).default(80),
  randomQuestionCount: z.coerce.number().int().min(1).nullable().optional(),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  feedbackMode: z.enum(["immediate", "after_submit", "after_due_date", "never"]).default("after_submit"),
  xpReward: z.coerce.number().int().min(0).default(150),
  selectedQuestionIds: z.array(z.string().uuid()).default([]),
});

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shuffle determinístico por seed (attemptId + questionId) para mantener orden de opciones si el alumno recarga
 */
function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    const j = Math.abs(hash) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function assertInstructorOrAdmin(courseId: string) {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { ok: false as const, error: "Sin permisos de instructor." };
  }
  if (profile.role === "instructor") {
    const supabase = await createClient();
    const { data: allowed } = await supabase.rpc("is_instructor_of_course", {
      p_course_id: courseId,
    });
    if (!allowed) return { ok: false as const, error: "No sos instructor de este curso." };
  }
  return { ok: true as const, profile };
}

// ============================================================================
// GESTIÓN DE BANCOS DE PREGUNTAS Y EXÁMENES (INSTRUCTOR)
// ============================================================================

export async function createQuestionBankAction(input: {
  courseId: string;
  title: string;
  description?: string;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await assertInstructorOrAdmin(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = createBankSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_banks")
    .insert({
      course_id: parsed.data.courseId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true, data: { id: data.id } };
}

export async function deleteQuestionBankAction(input: {
  bankId: string;
  courseId: string;
}): Promise<ActionResult> {
  const auth = await assertInstructorOrAdmin(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("question_banks")
    .delete()
    .eq("id", input.bankId)
    .eq("course_id", input.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

export async function createQuizWithLessonAction(input: {
  courseId: string;
  moduleId: string;
  questionBankId?: string | null;
  title: string;
  description?: string;
  isFinalExam: boolean;
  timeLimitMinutes?: number | null;
  maxAttempts: number;
  passingScorePercent: number;
  randomQuestionCount?: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  feedbackMode: "immediate" | "after_submit" | "after_due_date" | "never";
  xpReward: number;
  selectedQuestionIds: string[];
}): Promise<ActionResult<{ quizId: string; lessonId: string }>> {
  const auth = await assertInstructorOrAdmin(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = createQuizFullSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos de examen inválidos" };
  }

  const supabase = await createClient();
  const { count: existingLessonsCount } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", parsed.data.moduleId);

  const slug = `${slugify(parsed.data.title)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: lesson, error: lessonErr } = await supabase
    .from("lessons")
    .insert({
      module_id: parsed.data.moduleId,
      course_id: parsed.data.courseId,
      title: parsed.data.title.trim(),
      slug,
      lesson_type: "quiz",
      position: (existingLessonsCount ?? 0) + 1,
      duration_minutes: parsed.data.timeLimitMinutes ?? 20,
      xp_reward: parsed.data.xpReward,
      is_mandatory: true,
      is_published: true,
      content_markdown: parsed.data.description?.trim() || null,
    })
    .select("id")
    .single();

  if (lessonErr || !lesson) {
    return { success: false, error: lessonErr?.message ?? "No se pudo crear la lección de examen." };
  }

  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      lesson_id: lesson.id,
      course_id: parsed.data.courseId,
      module_id: parsed.data.moduleId,
      question_bank_id: parsed.data.questionBankId || null,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      is_final_exam: parsed.data.isFinalExam,
      time_limit_minutes: parsed.data.timeLimitMinutes ?? null,
      max_attempts: parsed.data.maxAttempts,
      passing_score_percent: parsed.data.passingScorePercent,
      random_question_count:
        parsed.data.selectedQuestionIds.length === 0 ? parsed.data.randomQuestionCount ?? null : null,
      shuffle_questions: parsed.data.shuffleQuestions,
      shuffle_options: parsed.data.shuffleOptions,
      feedback_mode: parsed.data.feedbackMode,
      xp_reward: parsed.data.xpReward,
    })
    .select("id")
    .single();

  if (quizErr || !quiz) {
    return { success: false, error: quizErr?.message ?? "No se pudo crear el examen." };
  }

  if (parsed.data.selectedQuestionIds.length > 0) {
    await supabase.from("quiz_questions").insert(
      parsed.data.selectedQuestionIds.map((qId, idx) => ({
        quiz_id: quiz.id,
        question_id: qId,
        position: idx + 1,
      }))
    );
  }

  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true, data: { quizId: quiz.id, lessonId: lesson.id } };
}

export async function syncQuizQuestionsAction(input: {
  quizId: string;
  courseId: string;
  questionIds: string[];
  questionBankId?: string | null;
  randomQuestionCount?: number | null;
}): Promise<ActionResult> {
  const auth = await assertInstructorOrAdmin(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();

  await supabase
    .from("quizzes")
    .update({
      question_bank_id: input.questionBankId ?? null,
      random_question_count: input.questionIds.length === 0 ? input.randomQuestionCount ?? null : null,
    })
    .eq("id", input.quizId)
    .eq("course_id", input.courseId);

  await supabase.from("quiz_questions").delete().eq("quiz_id", input.quizId);

  if (input.questionIds.length > 0) {
    const { error } = await supabase.from("quiz_questions").insert(
      input.questionIds.map((qId, idx) => ({
        quiz_id: input.quizId,
        question_id: qId,
        position: idx + 1,
      }))
    );
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

// ============================================================================
// MOTOR DE EVALUACIÓN EN VIVO (ALUMNO)
// ============================================================================

/**
 * Helper interno para calificar un intento contra question_answer_keys en servidor
 */
async function evaluateAndFinalizeAttempt(
  attemptId: string,
  answersMap: Record<string, unknown>,
  timedOut = false
) {
  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("*, quiz:quizzes(*)")
    .eq("id", attemptId)
    .single();

  if (!attempt) {
    throw new Error("Intento no encontrado.");
  }

  const questionIds = (attempt.question_order as string[]) ?? [];
  const [{ data: questions }, { data: answerKeys }] = await Promise.all([
    admin.from("questions").select("id, question_type, prompt, points").in("id", questionIds),
    admin
      .from("question_answer_keys")
      .select("question_id, correct_answer, explanation")
      .in("question_id", questionIds),
  ]);

  const keyMap = new Map((answerKeys ?? []).map((k) => [k.question_id as string, k]));
  const questionMap = new Map((questions ?? []).map((q) => [q.id as string, q]));

  let scoreObtained = 0;
  let scoreMax = 0;
  let hasOpenEnded = false;

  const answerRows: Array<{
    attempt_id: string;
    question_id: string;
    answer_payload: unknown;
    is_correct: boolean | null;
    points_awarded: number;
    max_points: number;
  }> = [];

  const feedbackItems: Array<{
    questionId: string;
    prompt: string;
    isCorrect: boolean | null;
    pointsAwarded: number;
    maxPoints: number;
    explanation: string | null;
  }> = [];

  for (const qId of questionIds) {
    const q = questionMap.get(qId);
    if (!q) continue;

    const maxPts = Number(q.points);
    scoreMax += maxPts;
    const rawUserAnswer = answersMap[q.id];
    const key = keyMap.get(q.id);
    const correctObj = (key?.correct_answer ?? {}) as Record<string, unknown>;

    let isCorrect: boolean | null = false;
    let pointsAwarded = 0;

    if (q.question_type === "single_choice") {
      isCorrect = String(rawUserAnswer ?? "") === String(correctObj.option_id ?? "");
      pointsAwarded = isCorrect ? maxPts : 0;
    } else if (q.question_type === "true_false") {
      const answered = rawUserAnswer !== undefined && rawUserAnswer !== null && rawUserAnswer !== "";
      const normalized = rawUserAnswer === true || rawUserAnswer === "true";
      isCorrect = answered && normalized === Boolean(correctObj.value);
      pointsAwarded = isCorrect ? maxPts : 0;
    } else if (q.question_type === "multiple_choice") {
      const selected = Array.isArray(rawUserAnswer) ? [...rawUserAnswer].map(String).sort() : [];
      const expected = Array.isArray(correctObj.option_ids)
        ? [...correctObj.option_ids].map(String).sort()
        : [];
      isCorrect =
        selected.length > 0 &&
        selected.length === expected.length &&
        selected.every((val, idx) => val === expected[idx]);
      pointsAwarded = isCorrect ? maxPts : 0;
    } else if (q.question_type === "fill_blank") {
      const userVal = String(rawUserAnswer ?? "").trim().toLowerCase();
      const acceptedGroups = (correctObj.accepted as string[][] | undefined) ?? [];
      const acceptedFlat = acceptedGroups[0] ?? [];
      isCorrect = userVal.length > 0 && acceptedFlat.some((acc) => acc.trim().toLowerCase() === userVal);
      pointsAwarded = isCorrect ? maxPts : 0;
    } else if (q.question_type === "open_ended") {
      hasOpenEnded = true;
      isCorrect = null;
      pointsAwarded = 0;
    }

    scoreObtained += pointsAwarded;
    answerRows.push({
      attempt_id: attempt.id,
      question_id: q.id,
      answer_payload: { value: rawUserAnswer ?? null, timedOut },
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      max_points: maxPts,
    });

    feedbackItems.push({
      questionId: q.id,
      prompt: q.prompt,
      isCorrect,
      pointsAwarded,
      maxPoints: maxPts,
      explanation: attempt.quiz.feedback_mode === "never" ? null : (key?.explanation ?? null),
    });
  }

  if (answerRows.length > 0) {
    await admin.from("quiz_attempt_answers").upsert(answerRows, {
      onConflict: "attempt_id,question_id",
    });
  }

  const percentage = scoreMax > 0 ? Number(((scoreObtained / scoreMax) * 100).toFixed(2)) : 0;
  const finalStatus = hasOpenEnded ? "pending_manual_grading" : "graded";
  const passed = !hasOpenEnded && percentage >= Number(attempt.quiz.passing_score_percent);

  await admin
    .from("quiz_attempts")
    .update({
      status: finalStatus,
      submitted_at: new Date().toISOString(),
      score_obtained: scoreObtained,
      score_max: scoreMax,
      percentage,
      passed,
      graded_at: hasOpenEnded ? null : new Date().toISOString(),
    })
    .eq("id", attempt.id);

  return {
    status: finalStatus,
    percentage,
    passed,
    scoreObtained,
    scoreMax,
    timedOut,
    feedback: feedbackItems,
  };
}

/**
 * Auto-guarda un borrador de respuesta mientras el examen está en curso (anti-pérdida por F5)
 */
export async function saveDraftAnswerAction(input: {
  attemptId: string;
  questionId: string;
  value: unknown;
}): Promise<ActionResult> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión expirada." };

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("id, status, expires_at, question_order")
    .eq("id", input.attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status !== "in_progress") {
    return { success: false, error: "Intento no activo." };
  }

  if (attempt.expires_at && new Date(attempt.expires_at).getTime() < Date.now() - 5000) {
    return { success: false, error: "El tiempo del intento expiró." };
  }

  const { data: q } = await admin
    .from("questions")
    .select("points")
    .eq("id", input.questionId)
    .single();

  await admin.from("quiz_attempt_answers").upsert(
    {
      attempt_id: attempt.id,
      question_id: input.questionId,
      answer_payload: { value: input.value ?? null },
      max_points: Number(q?.points ?? 0),
    },
    { onConflict: "attempt_id,question_id" }
  );

  return { success: true };
}

/**
 * Inicia o retoma un intento de evaluación:
 * - Cierra automáticamente intentos vencidos si expires_at ya pasó
 * - Valida max_attempts y arma selección aleatoria/fija + shuffle de opciones
 * - Devuelve borradores guardados si se retoma tras recargar página
 */
export async function startQuizAttemptAction(input: {
  quizId: string;
  enrollmentId: string;
}): Promise<
  ActionResult<{
    attempt: QuizAttempt;
    questions: QuestionPublic[];
    draftAnswers: Record<string, unknown>;
  }>
> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || !profile.company_id) {
    return { success: false, error: "Debés iniciar sesión con una cuenta activa de Solution Academy." };
  }

  const admin = createAdminClient();

  const [{ data: quiz }, { data: enrollment }, { data: existingAttempts }] = await Promise.all([
    admin.from("quizzes").select("*").eq("id", input.quizId).single(),
    admin
      .from("enrollments")
      .select("id, user_id, course_id, company_id")
      .eq("id", input.enrollmentId)
      .eq("user_id", profile.id)
      .single(),
    admin
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_id", input.quizId)
      .eq("user_id", profile.id)
      .order("attempt_number", { ascending: false }),
  ]);

  if (!quiz || !enrollment) {
    return { success: false, error: "Evaluación o inscripción no encontrada." };
  }

  const prepareQuestions = (rawList: QuestionPublic[], attemptId: string): QuestionPublic[] => {
    if (!quiz.shuffle_options) return rawList;
    return rawList.map((q) => {
      if (
        (q.question_type === "single_choice" || q.question_type === "multiple_choice") &&
        Array.isArray(q.options_public)
      ) {
        return {
          ...q,
          options_public: deterministicShuffle(
            q.options_public as QuestionChoice[],
            `${attemptId}:${q.id}`
          ),
        };
      }
      return q;
    });
  };

  // Auto-cerrar cualquier intento in_progress que haya expirado previamente
  for (const att of existingAttempts ?? []) {
    if (att.status === "in_progress" && att.expires_at && new Date(att.expires_at).getTime() <= Date.now()) {
      const { data: savedRows } = await admin
        .from("quiz_attempt_answers")
        .select("question_id, answer_payload")
        .eq("attempt_id", att.id);

      const draftMap: Record<string, unknown> = {};
      for (const row of savedRows ?? []) {
        draftMap[row.question_id as string] = (row.answer_payload as { value?: unknown })?.value;
      }
      await evaluateAndFinalizeAttempt(att.id, draftMap, true);
      att.status = "graded";
    }
  }

  // Retomar intento en curso si todavía tiene tiempo
  const activeAttempt = (existingAttempts ?? []).find((a) => {
    if (a.status !== "in_progress") return false;
    if (!a.expires_at) return true;
    return new Date(a.expires_at).getTime() > Date.now();
  });

  if (activeAttempt) {
    const [{ data: activeQuestions }, { data: savedRows }] = await Promise.all([
      admin
        .from("questions")
        .select("id, bank_id, course_id, question_type, prompt, options_public, points, difficulty")
        .in("id", activeAttempt.question_order),
      admin
        .from("quiz_attempt_answers")
        .select("question_id, answer_payload")
        .eq("attempt_id", activeAttempt.id),
    ]);

    const ordered = (activeAttempt.question_order as string[])
      .map((qid) => activeQuestions?.find((q) => q.id === qid))
      .filter((q): q is QuestionPublic => Boolean(q));

    const draftAnswers: Record<string, unknown> = {};
    for (const row of savedRows ?? []) {
      draftAnswers[row.question_id as string] = (row.answer_payload as { value?: unknown })?.value;
    }

    return {
      success: true,
      data: {
        attempt: activeAttempt as QuizAttempt,
        questions: prepareQuestions(ordered, activeAttempt.id),
        draftAnswers,
      },
    };
  }

  const attemptsCount = existingAttempts?.length ?? 0;
  if (attemptsCount >= quiz.max_attempts) {
    return {
      success: false,
      error: `Alcanzaste el máximo de ${quiz.max_attempts} intentos permitidos para esta evaluación.`,
    };
  }

  // Seleccionar preguntas fijas o aleatorias del banco
  const { data: fixedLinks } = await admin
    .from("quiz_questions")
    .select("question_id, position")
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true });

  let poolQuestions: QuestionPublic[] = [];

  if (fixedLinks && fixedLinks.length > 0) {
    const ids = fixedLinks.map((l) => l.question_id);
    const { data } = await admin
      .from("questions")
      .select("id, bank_id, course_id, question_type, prompt, options_public, points, difficulty")
      .in("id", ids);
    poolQuestions = (data as QuestionPublic[]) ?? [];
  } else if (quiz.question_bank_id) {
    const { data } = await admin
      .from("questions")
      .select("id, bank_id, course_id, question_type, prompt, options_public, points, difficulty")
      .eq("bank_id", quiz.question_bank_id);
    poolQuestions = (data as QuestionPublic[]) ?? [];
  } else {
    // Fallback al banco general del curso si el quiz no especificó banco
    const { data } = await admin
      .from("questions")
      .select("id, bank_id, course_id, question_type, prompt, options_public, points, difficulty")
      .eq("course_id", quiz.course_id);
    poolQuestions = (data as QuestionPublic[]) ?? [];
  }

  if (poolQuestions.length === 0) {
    return { success: false, error: "Esta evaluación aún no tiene preguntas cargadas." };
  }

  let selected = quiz.shuffle_questions ? shuffleArray(poolQuestions) : poolQuestions;
  if (quiz.random_question_count && quiz.random_question_count < selected.length) {
    selected = selected.slice(0, quiz.random_question_count);
  }

  const scoreMax = selected.reduce((acc, q) => acc + Number(q.points), 0);
  const expiresAt = quiz.time_limit_minutes
    ? new Date(Date.now() + quiz.time_limit_minutes * 60 * 1000).toISOString()
    : null;

  const { data: newAttempt, error: insertErr } = await admin
    .from("quiz_attempts")
    .insert({
      quiz_id: quiz.id,
      enrollment_id: enrollment.id,
      user_id: profile.id,
      company_id: enrollment.company_id,
      attempt_number: attemptsCount + 1,
      status: "in_progress",
      question_order: selected.map((q) => q.id),
      expires_at: expiresAt,
      score_max: scoreMax,
    })
    .select("*")
    .single();

  if (insertErr || !newAttempt) {
    return { success: false, error: insertErr?.message ?? "No se pudo iniciar el examen." };
  }

  return {
    success: true,
    data: {
      attempt: newAttempt as QuizAttempt,
      questions: prepareQuestions(selected, newAttempt.id),
      draftAnswers: {},
    },
  };
}

/**
 * Envía y corrige automáticamente un examen en servidor contra question_answer_keys.
 */
export async function submitQuizAttemptAction(input: {
  attemptId: string;
  answers: Record<string, unknown>;
  courseSlug: string;
  timedOut?: boolean;
}): Promise<
  ActionResult<{
    status: string;
    percentage: number;
    passed: boolean;
    scoreObtained: number;
    scoreMax: number;
    timedOut: boolean;
    feedback: Array<{
      questionId: string;
      prompt: string;
      isCorrect: boolean | null;
      pointsAwarded: number;
      maxPoints: number;
      explanation: string | null;
    }>;
  }>
> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión expirada." };

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("id, status, user_id")
    .eq("id", input.attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status !== "in_progress") {
    return { success: false, error: "Intento inválido o ya enviado." };
  }

  const result = await evaluateAndFinalizeAttempt(
    attempt.id,
    input.answers,
    Boolean(input.timedOut)
  );

  revalidatePath(`/aprender/${input.courseSlug}`, "layout");
  revalidatePath("/mis-cursos");
  revalidatePath("/certificados");

  return { success: true, data: result };
}

/**
 * Obtiene el detalle de un intento finalizado para revisión del alumno
 */
export async function getAttemptReviewAction(attemptId: string): Promise<
  ActionResult<
    Array<{
      questionId: string;
      prompt: string;
      isCorrect: boolean | null;
      pointsAwarded: number;
      maxPoints: number;
      instructorFeedback: string | null;
      explanation: string | null;
    }>
  >
> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "No autenticado." };

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("id, user_id, status, quiz:quizzes(feedback_mode)")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status === "in_progress") {
    return { success: false, error: "Solo podés revisar intentos finalizados." };
  }

  const quizMeta = Array.isArray(attempt.quiz) ? attempt.quiz[0] : attempt.quiz;
  const allowFeedback = (quizMeta as { feedback_mode?: string } | null)?.feedback_mode !== "never";

  const { data: answers } = await admin
    .from("quiz_attempt_answers")
    .select("question_id, is_correct, points_awarded, max_points, instructor_feedback, question:questions(prompt)")
    .eq("attempt_id", attempt.id);

  const qIds = (answers ?? []).map((a) => a.question_id as string);
  const { data: keys } = allowFeedback
    ? await admin.from("question_answer_keys").select("question_id, explanation").in("question_id", qIds)
    : { data: [] };

  const expMap = new Map((keys ?? []).map((k) => [k.question_id as string, k.explanation as string | null]));

  return {
    success: true,
    data: (answers ?? []).map((row) => {
      const q = Array.isArray(row.question) ? row.question[0] : row.question;
      return {
        questionId: row.question_id as string,
        prompt: q?.prompt ?? "Pregunta",
        isCorrect: row.is_correct as boolean | null,
        pointsAwarded: Number(row.points_awarded),
        maxPoints: Number(row.max_points),
        instructorFeedback: row.instructor_feedback as string | null,
        explanation: allowFeedback ? (expMap.get(row.question_id as string) ?? null) : null,
      };
    }),
  };
}

/**
 * Calificación manual por instructor de una respuesta abierta en un examen
 */
export async function gradeOpenQuizAnswerAction(input: {
  answerId: string;
  pointsAwarded: number;
  feedback: string;
}): Promise<ActionResult> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos." };
  }

  const admin = createAdminClient();
  const { data: answer, error } = await admin
    .from("quiz_attempt_answers")
    .update({
      points_awarded: input.pointsAwarded,
      is_correct: input.pointsAwarded > 0,
      instructor_feedback: input.feedback,
      graded_by: profile.id,
      graded_at: new Date().toISOString(),
    })
    .eq("id", input.answerId)
    .select("attempt_id")
    .single();

  if (error || !answer) return { success: false, error: error?.message ?? "Respuesta no encontrada" };

  const { data: allAnswers } = await admin
    .from("quiz_attempt_answers")
    .select("points_awarded, max_points, is_correct")
    .eq("attempt_id", answer.attempt_id);

  const hasPending = (allAnswers ?? []).some((a) => a.is_correct === null);
  if (!hasPending) {
    const scoreObtained = (allAnswers ?? []).reduce((sum, a) => sum + Number(a.points_awarded), 0);
    const scoreMax = (allAnswers ?? []).reduce((sum, a) => sum + Number(a.max_points), 0);
    const percentage = scoreMax > 0 ? Number(((scoreObtained / scoreMax) * 100).toFixed(2)) : 0;

    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("quiz:quizzes(passing_score_percent)")
      .eq("id", answer.attempt_id)
      .single();

    const quizRef = Array.isArray(attempt?.quiz) ? attempt?.quiz[0] : attempt?.quiz;
    const passing = Number((quizRef as { passing_score_percent?: number } | null)?.passing_score_percent ?? 80);

    await admin
      .from("quiz_attempts")
      .update({
        status: "graded",
        score_obtained: scoreObtained,
        score_max: scoreMax,
        percentage,
        passed: percentage >= passing,
        graded_by: profile.id,
        graded_at: new Date().toISOString(),
      })
      .eq("id", answer.attempt_id);
  }

  revalidatePath("/instructor/correcciones");
  return { success: true };
}
