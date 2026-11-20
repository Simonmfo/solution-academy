"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/actions/auth.actions";
import type { QuestionPublic, QuizAttempt } from "@/types/database.types";

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Inicia un intento de examen en servidor:
 * - Valida matriculación, prerrequisitos y límite de max_attempts
 * - Selecciona preguntas aleatorias del banco o fijas
 * - Calcula expires_at si hay tiempo límite
 */
export async function startQuizAttemptAction(input: {
  quizId: string;
  enrollmentId: string;
}): Promise<ActionResult<{ attempt: QuizAttempt; questions: QuestionPublic[] }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || !profile.company_id) {
    return { success: false, error: "Debés iniciar sesión con una cuenta corporativa activa." };
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

  // Retomar intento en curso si no expiró
  const activeAttempt = (existingAttempts ?? []).find((a) => {
    if (a.status !== "in_progress") return false;
    if (!a.expires_at) return true;
    return new Date(a.expires_at).getTime() > Date.now();
  });

  if (activeAttempt) {
    const { data: activeQuestions } = await admin
      .from("questions")
      .select("id, bank_id, course_id, question_type, prompt, options_public, points, difficulty")
      .in("id", activeAttempt.question_order);

    const ordered = (activeAttempt.question_order as string[])
      .map((qid) => activeQuestions?.find((q) => q.id === qid))
      .filter((q): q is QuestionPublic => Boolean(q));

    return { success: true, data: { attempt: activeAttempt as QuizAttempt, questions: ordered } };
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
      questions: selected,
    },
  };
}

/**
 * Envía y corrige automáticamente un examen en servidor contra question_answer_keys.
 * Soporta single_choice, multiple_choice, true_false, fill_blank y deriva open_ended a revisión manual.
 */
export async function submitQuizAttemptAction(input: {
  attemptId: string;
  answers: Record<string, unknown>;
  courseSlug: string;
}): Promise<
  ActionResult<{
    status: string;
    percentage: number;
    passed: boolean;
    scoreObtained: number;
    scoreMax: number;
    feedback: Array<{
      questionId: string;
      isCorrect: boolean | null;
      pointsAwarded: number;
      explanation: string | null;
    }>;
  }>
> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión expirada." };

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("*, quiz:quizzes(*)")
    .eq("id", input.attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status !== "in_progress") {
    return { success: false, error: "Intento inválido o ya enviado." };
  }

  const questionIds = (attempt.question_order as string[]) ?? [];
  const [{ data: questions }, { data: answerKeys }] = await Promise.all([
    admin.from("questions").select("id, question_type, points").in("id", questionIds),
    admin.from("question_answer_keys").select("question_id, correct_answer, explanation").in("question_id", questionIds),
  ]);

  const keyMap = new Map(
    (answerKeys ?? []).map((k) => [k.question_id as string, k])
  );

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
    isCorrect: boolean | null;
    pointsAwarded: number;
    explanation: string | null;
  }> = [];

  for (const q of questions ?? []) {
    const maxPts = Number(q.points);
    scoreMax += maxPts;
    const rawUserAnswer = input.answers[q.id];
    const key = keyMap.get(q.id);
    const correctObj = (key?.correct_answer ?? {}) as Record<string, unknown>;

    let isCorrect: boolean | null = false;
    let pointsAwarded = 0;

    if (q.question_type === "single_choice") {
      isCorrect = String(rawUserAnswer ?? "") === String(correctObj.option_id ?? "");
      pointsAwarded = isCorrect ? maxPts : 0;
    } else if (q.question_type === "true_false") {
      const normalized = rawUserAnswer === true || rawUserAnswer === "true";
      isCorrect = normalized === Boolean(correctObj.value);
      pointsAwarded = isCorrect ? maxPts : 0;
    } else if (q.question_type === "multiple_choice") {
      const selected = Array.isArray(rawUserAnswer) ? [...rawUserAnswer].map(String).sort() : [];
      const expected = Array.isArray(correctObj.option_ids)
        ? [...correctObj.option_ids].map(String).sort()
        : [];
      isCorrect =
        selected.length === expected.length &&
        selected.every((val, idx) => val === expected[idx]);
      pointsAwarded = isCorrect ? maxPts : 0;
    } else if (q.question_type === "fill_blank") {
      const userVal = String(rawUserAnswer ?? "").trim().toLowerCase();
      const acceptedGroups = (correctObj.accepted as string[][] | undefined) ?? [];
      const acceptedFlat = acceptedGroups[0] ?? [];
      isCorrect = acceptedFlat.some((acc) => acc.trim().toLowerCase() === userVal);
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
      answer_payload: { value: rawUserAnswer ?? null },
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      max_points: maxPts,
    });

    feedbackItems.push({
      questionId: q.id,
      isCorrect,
      pointsAwarded,
      explanation: attempt.quiz.feedback_mode === "never" ? null : (key?.explanation ?? null),
    });
  }

  await admin.from("quiz_attempt_answers").upsert(answerRows, {
    onConflict: "attempt_id,question_id",
  });

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

  revalidatePath(`/aprender/${input.courseSlug}`, "layout");
  revalidatePath("/mis-cursos");

  return {
    success: true,
    data: {
      status: finalStatus,
      percentage,
      passed,
      scoreObtained,
      scoreMax,
      feedback: feedbackItems,
    },
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

  // Verificar si quedan respuestas sin calificar en el intento
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

