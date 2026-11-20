"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  createQuestionSchema,
} from "@/lib/validations/schemas";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/actions/auth.actions";

const updateCourseSchema = createCourseSchema.extend({
  courseId: z.string().uuid(),
  certificateEnabled: z.boolean().default(true),
});

const updateModuleSchema = z.object({
  moduleId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().min(2, "Título del módulo requerido"),
  description: z.string().optional().nullable(),
  prerequisiteModuleId: z.string().uuid().nullable().optional(),
  requiresQuizPass: z.boolean(),
  isPublished: z.boolean(),
});

const updateLessonSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().min(2, "Título requerido"),
  lessonType: z.enum(["video", "reading", "document", "quiz", "assignment"]),
  durationMinutes: z.coerce.number().int().min(0).default(15),
  xpReward: z.coerce.number().int().min(0).default(50),
  isMandatory: z.boolean().default(true),
  isPublished: z.boolean().default(true),
  videoProvider: z.enum(["storage", "youtube", "vimeo", "bunny", "embed"]).nullable().optional(),
  videoUrl: z.string().url("URL inválida").nullable().optional().or(z.literal("")),
  contentMarkdown: z.string().optional().nullable(),
  assignmentInstructions: z.string().optional().nullable(),
});

const updateQuizConfigSchema = z.object({
  quizId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  isFinalExam: z.boolean(),
  timeLimitMinutes: z.coerce.number().int().min(1).nullable().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20),
  passingScorePercent: z.coerce.number().min(0).max(100),
  randomQuestionCount: z.coerce.number().int().min(1).nullable().optional(),
  shuffleQuestions: z.boolean(),
  feedbackMode: z.enum(["immediate", "after_submit", "after_due_date", "never"]),
});

async function assertStaffAccess(courseId?: string) {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { ok: false as const, error: "Solo instructores o super admins pueden editar cursos." };
  }
  if (courseId && profile.role === "instructor") {
    const supabase = await createClient();
    const { data: allowed } = await supabase.rpc("is_instructor_of_course", {
      p_course_id: courseId,
    });
    if (!allowed) {
      return { ok: false as const, error: "No tenés permisos sobre este curso." };
    }
  }
  return { ok: true as const, profile };
}

export async function createCourseAction(input: {
  title: string;
  shortDescription: string;
  description?: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  isSequential: boolean;
  passingScore: number;
  estimatedHours: number;
  xpReward: number;
  status: "draft" | "published" | "archived";
}): Promise<ActionResult<{ id: string }>> {
  const auth = await assertStaffAccess();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = createCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const uniqueSlug = `${slugify(parsed.data.title)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from("courses")
    .insert({
      title: parsed.data.title,
      slug: uniqueSlug,
      short_description: parsed.data.shortDescription,
      description: parsed.data.description || null,
      category: parsed.data.category,
      level: parsed.data.level,
      status: parsed.data.status,
      instructor_id: auth.profile.id,
      is_sequential: parsed.data.isSequential,
      passing_score: parsed.data.passingScore,
      estimated_hours: parsed.data.estimatedHours,
      xp_reward: parsed.data.xpReward,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  await supabase.from("question_banks").insert({
    course_id: data.id,
    title: `Banco Principal — ${parsed.data.title}`,
    created_by: auth.profile.id,
  });

  revalidatePath("/instructor/cursos");
  return { success: true, data: { id: data.id } };
}

export async function updateCourseAction(input: {
  courseId: string;
  title: string;
  shortDescription: string;
  description?: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  status: "draft" | "published" | "archived";
  isSequential: boolean;
  passingScore: number;
  estimatedHours: number;
  xpReward: number;
  certificateEnabled: boolean;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = updateCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      title: parsed.data.title,
      short_description: parsed.data.shortDescription,
      description: parsed.data.description || null,
      category: parsed.data.category,
      level: parsed.data.level,
      status: parsed.data.status,
      is_sequential: parsed.data.isSequential,
      passing_score: parsed.data.passingScore,
      estimated_hours: parsed.data.estimatedHours,
      xp_reward: parsed.data.xpReward,
      certificate_enabled: parsed.data.certificateEnabled,
    })
    .eq("id", parsed.data.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/instructor/cursos");
  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true };
}

export async function createModuleAction(input: {
  courseId: string;
  title: string;
  description?: string;
  position: number;
  prerequisiteModuleId?: string | null;
  requiresQuizPass: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = createModuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .insert({
      course_id: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      position: parsed.data.position,
      prerequisite_module_id: parsed.data.prerequisiteModuleId || null,
      requires_quiz_pass: parsed.data.requiresQuizPass,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true, data: { id: data.id } };
}

export async function updateModuleAction(input: {
  moduleId: string;
  courseId: string;
  title: string;
  description?: string | null;
  prerequisiteModuleId?: string | null;
  requiresQuizPass: boolean;
  isPublished: boolean;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = updateModuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  if (parsed.data.prerequisiteModuleId === parsed.data.moduleId) {
    return { success: false, error: "Un módulo no puede ser prerrequisito de sí mismo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      prerequisite_module_id: parsed.data.prerequisiteModuleId || null,
      requires_quiz_pass: parsed.data.requiresQuizPass,
      is_published: parsed.data.isPublished,
    })
    .eq("id", parsed.data.moduleId)
    .eq("course_id", parsed.data.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true };
}

export async function deleteModuleAction(input: {
  moduleId: string;
  courseId: string;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .delete()
    .eq("id", input.moduleId)
    .eq("course_id", input.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

export async function reorderModulesAction(input: {
  courseId: string;
  orderedModuleIds: string[];
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const updates = input.orderedModuleIds.map((id, idx) =>
    supabase
      .from("modules")
      .update({ position: idx + 1 })
      .eq("id", id)
      .eq("course_id", input.courseId)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { success: false, error: failed.error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

export async function createLessonAction(input: {
  moduleId: string;
  courseId: string;
  title: string;
  lessonType: "video" | "reading" | "document" | "quiz" | "assignment";
  position: number;
  durationMinutes: number;
  xpReward: number;
  isMandatory: boolean;
  videoProvider?: "storage" | "youtube" | "vimeo" | "bunny" | "embed" | null;
  videoUrl?: string | null;
  contentMarkdown?: string;
  assignmentInstructions?: string;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = createLessonSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const slug = `${slugify(parsed.data.title)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      module_id: parsed.data.moduleId,
      course_id: input.courseId,
      title: parsed.data.title,
      slug,
      lesson_type: parsed.data.lessonType,
      position: parsed.data.position,
      duration_minutes: parsed.data.durationMinutes,
      xp_reward: parsed.data.xpReward,
      is_mandatory: parsed.data.isMandatory,
      video_provider: parsed.data.lessonType === "video" ? parsed.data.videoProvider ?? "youtube" : null,
      video_url: parsed.data.videoUrl || null,
      content_markdown: parsed.data.contentMarkdown || null,
      assignment_instructions: parsed.data.assignmentInstructions || null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  if (parsed.data.lessonType === "quiz") {
    const [{ data: bank }, { data: course }] = await Promise.all([
      supabase.from("question_banks").select("id").eq("course_id", input.courseId).limit(1).maybeSingle(),
      supabase.from("courses").select("passing_score").eq("id", input.courseId).single(),
    ]);

    await supabase.from("quizzes").insert({
      lesson_id: lesson.id,
      course_id: input.courseId,
      module_id: parsed.data.moduleId,
      question_bank_id: bank?.id ?? null,
      title: parsed.data.title,
      time_limit_minutes: 20,
      max_attempts: 3,
      passing_score_percent: Number(course?.passing_score ?? 80),
    });
  }

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true, data: { id: lesson.id } };
}

export async function updateLessonAction(input: {
  lessonId: string;
  courseId: string;
  title: string;
  lessonType: "video" | "reading" | "document" | "quiz" | "assignment";
  durationMinutes: number;
  xpReward: number;
  isMandatory: boolean;
  isPublished: boolean;
  videoProvider?: "storage" | "youtube" | "vimeo" | "bunny" | "embed" | null;
  videoUrl?: string | null;
  contentMarkdown?: string | null;
  assignmentInstructions?: string | null;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = updateLessonSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: parsed.data.title,
      lesson_type: parsed.data.lessonType,
      duration_minutes: parsed.data.durationMinutes,
      xp_reward: parsed.data.xpReward,
      is_mandatory: parsed.data.isMandatory,
      is_published: parsed.data.isPublished,
      video_provider: parsed.data.lessonType === "video" ? parsed.data.videoProvider ?? "youtube" : null,
      video_url: parsed.data.videoUrl || null,
      content_markdown: parsed.data.contentMarkdown || null,
      assignment_instructions: parsed.data.assignmentInstructions || null,
    })
    .eq("id", parsed.data.lessonId)
    .eq("course_id", parsed.data.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true };
}

export async function deleteLessonAction(input: {
  lessonId: string;
  courseId: string;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", input.lessonId)
    .eq("course_id", input.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

export async function reorderLessonsAction(input: {
  courseId: string;
  moduleId: string;
  orderedLessonIds: string[];
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const updates = input.orderedLessonIds.map((id, idx) =>
    supabase
      .from("lessons")
      .update({ position: idx + 1, module_id: input.moduleId })
      .eq("id", id)
      .eq("course_id", input.courseId)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { success: false, error: failed.error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

export async function registerLessonResourceAction(input: {
  lessonId: string;
  courseId: string;
  title: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_resources")
    .insert({
      lesson_id: input.lessonId,
      course_id: input.courseId,
      title: input.title.trim() || input.fileName,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType || "application/pdf",
      file_size_bytes: input.fileSizeBytes,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true, data: { id: data.id } };
}

export async function deleteLessonResourceAction(input: {
  resourceId: string;
  courseId: string;
  storagePath: string;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();
  await admin.storage.from("lesson-materials").remove([input.storagePath]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_resources")
    .delete()
    .eq("id", input.resourceId)
    .eq("course_id", input.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

export async function updateQuizConfigAction(input: {
  quizId: string;
  courseId: string;
  title: string;
  description?: string | null;
  isFinalExam: boolean;
  timeLimitMinutes?: number | null;
  maxAttempts: number;
  passingScorePercent: number;
  randomQuestionCount?: number | null;
  shuffleQuestions: boolean;
  feedbackMode: "immediate" | "after_submit" | "after_due_date" | "never";
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = updateQuizConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Configuración inválida" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("quizzes")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      is_final_exam: parsed.data.isFinalExam,
      time_limit_minutes: parsed.data.timeLimitMinutes ?? null,
      max_attempts: parsed.data.maxAttempts,
      passing_score_percent: parsed.data.passingScorePercent,
      random_question_count: parsed.data.randomQuestionCount ?? null,
      shuffle_questions: parsed.data.shuffleQuestions,
      feedback_mode: parsed.data.feedbackMode,
    })
    .eq("id", parsed.data.quizId)
    .eq("course_id", parsed.data.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true };
}

export async function createQuestionWithKeyAction(input: {
  bankId: string;
  courseId: string;
  questionType: "single_choice" | "multiple_choice" | "true_false" | "fill_blank" | "open_ended";
  prompt: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  optionsPublic: unknown;
  correctAnswer: unknown;
  explanation?: string;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = createQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { data: q, error } = await supabase
    .from("questions")
    .insert({
      bank_id: parsed.data.bankId,
      course_id: parsed.data.courseId,
      question_type: parsed.data.questionType,
      prompt: parsed.data.prompt,
      options_public: parsed.data.optionsPublic,
      points: parsed.data.points,
      difficulty: parsed.data.difficulty,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  const { error: keyErr } = await supabase.from("question_answer_keys").insert({
    question_id: q.id,
    correct_answer: parsed.data.correctAnswer,
    explanation: parsed.data.explanation || null,
  });

  if (keyErr) return { success: false, error: keyErr.message };

  revalidatePath(`/instructor/cursos/${parsed.data.courseId}/editar`);
  return { success: true, data: { id: q.id } };
}

export async function deleteQuestionAction(input: {
  questionId: string;
  courseId: string;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess(input.courseId);
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", input.questionId)
    .eq("course_id", input.courseId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true };
}

export async function gradeAssignmentSubmissionAction(input: {
  submissionId: string;
  score: number;
  feedback: string;
  approve: boolean;
}): Promise<ActionResult> {
  const auth = await assertStaffAccess();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data: sub, error } = await supabase
    .from("assignment_submissions")
    .update({
      score: input.score,
      feedback: input.feedback,
      status: input.approve ? "graded" : "resubmit_requested",
      graded_by: auth.profile.id,
      graded_at: new Date().toISOString(),
    })
    .eq("id", input.submissionId)
    .select("enrollment_id, user_id, course_id, lesson_id")
    .single();

  if (error) return { success: false, error: error.message };

  if (input.approve && sub) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("module_id")
      .eq("id", sub.lesson_id)
      .single();

    if (lesson) {
      await supabase.from("lesson_progress").upsert(
        {
          enrollment_id: sub.enrollment_id,
          user_id: sub.user_id,
          course_id: sub.course_id,
          module_id: lesson.module_id,
          lesson_id: sub.lesson_id,
          status: "completed",
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      );
    }
  }

  revalidatePath("/instructor/correcciones");
  return { success: true };
}
