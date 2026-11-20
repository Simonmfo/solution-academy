"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import {
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  createQuestionSchema,
} from "@/lib/validations/schemas";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/actions/auth.actions";

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
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { success: false, error: "Solo instructores o super admins pueden crear cursos." };
  }

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
      instructor_id: profile.id,
      is_sequential: parsed.data.isSequential,
      passing_score: parsed.data.passingScore,
      estimated_hours: parsed.data.estimatedHours,
      xp_reward: parsed.data.xpReward,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Crear banco de preguntas predeterminado para el curso
  await supabase.from("question_banks").insert({
    course_id: data.id,
    title: `Banco Principal — ${parsed.data.title}`,
    created_by: profile.id,
  });

  revalidatePath("/instructor/cursos");
  return { success: true, data: { id: data.id } };
}

export async function createModuleAction(input: {
  courseId: string;
  title: string;
  description?: string;
  position: number;
  prerequisiteModuleId?: string | null;
  requiresQuizPass: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos." };
  }

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
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos." };
  }

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

  // Si es una lección de tipo evaluación, crear automáticamente la configuración de quiz vinculada
  if (parsed.data.lessonType === "quiz") {
    const { data: bank } = await supabase
      .from("question_banks")
      .select("id")
      .eq("course_id", input.courseId)
      .limit(1)
      .single();

    await supabase.from("quizzes").insert({
      lesson_id: lesson.id,
      course_id: input.courseId,
      module_id: parsed.data.moduleId,
      question_bank_id: bank?.id ?? null,
      title: parsed.data.title,
      time_limit_minutes: 20,
      max_attempts: 3,
      passing_score_percent: 80,
    });
  }

  revalidatePath(`/instructor/cursos/${input.courseId}/editar`);
  return { success: true, data: { id: lesson.id } };
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
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos." };
  }

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
      created_by: profile.id,
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

export async function gradeAssignmentSubmissionAction(input: {
  submissionId: string;
  score: number;
  feedback: string;
  approve: boolean;
}): Promise<ActionResult> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos." };
  }

  const supabase = await createClient();
  const { data: sub, error } = await supabase
    .from("assignment_submissions")
    .update({
      score: input.score,
      feedback: input.feedback,
      status: input.approve ? "graded" : "resubmit_requested",
      graded_by: profile.id,
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

