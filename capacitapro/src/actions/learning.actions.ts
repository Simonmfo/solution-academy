"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { discussionPostSchema, lessonNoteSchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/actions/auth.actions";

export async function markLessonCompletedAction(input: {
  enrollmentId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  courseSlug: string;
}): Promise<ActionResult> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Debés iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      enrollment_id: input.enrollmentId,
      user_id: user.id,
      course_id: input.courseId,
      module_id: input.moduleId,
      lesson_id: input.lessonId,
      status: "completed",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) {
    return {
      success: false,
      error: "No podés completar esta lección todavía. Verificá los prerrequisitos del módulo anterior.",
    };
  }

  revalidatePath(`/aprender/${input.courseSlug}`, "layout");
  revalidatePath("/mis-cursos");
  return { success: true };
}

export async function saveLessonNoteAction(input: {
  lessonId: string;
  courseId: string;
  content: string;
  videoTimestampSeconds?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión expirada." };

  const parsed = lessonNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Nota inválida" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_notes")
    .insert({
      user_id: user.id,
      lesson_id: parsed.data.lessonId,
      course_id: parsed.data.courseId,
      content: parsed.data.content,
      video_timestamp_seconds: parsed.data.videoTimestampSeconds ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { id: data.id } };
}

export async function createDiscussionPostAction(input: {
  lessonId: string;
  courseId: string;
  parentId?: string | null;
  title?: string;
  body: string;
}): Promise<ActionResult> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) return { success: false, error: "Sesión requerida." };

  const parsed = discussionPostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lesson_discussions").insert({
    lesson_id: parsed.data.lessonId,
    course_id: parsed.data.courseId,
    company_id: profile.company_id,
    user_id: profile.id,
    parent_id: parsed.data.parentId || null,
    title: parsed.data.title || null,
    body: parsed.data.body,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function submitAssignmentAction(input: {
  lessonId: string;
  courseId: string;
  enrollmentId: string;
  submissionText: string;
  fileStoragePath?: string | null;
  fileName?: string | null;
}): Promise<ActionResult> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || !profile.company_id) {
    return { success: false, error: "Cuenta sin empresa asignada." };
  }

  if (!input.submissionText.trim() && !input.fileStoragePath) {
    return { success: false, error: "Escribí una respuesta o adjuntá un archivo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("assignment_submissions").insert({
    lesson_id: input.lessonId,
    course_id: input.courseId,
    enrollment_id: input.enrollmentId,
    user_id: profile.id,
    company_id: profile.company_id,
    submission_text: input.submissionText.trim() || null,
    file_storage_path: input.fileStoragePath || null,
    file_name: input.fileName || null,
    status: "submitted",
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

