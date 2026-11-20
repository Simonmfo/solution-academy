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
}): Promise<ActionResult<{ certificateCode?: string | null }>> {
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

  // Verificar si el trigger emitió automáticamente un certificado al llegar al 100%
  const { data: cert } = await supabase
    .from("certificates")
    .select("verification_code")
    .eq("enrollment_id", input.enrollmentId)
    .maybeSingle();

  revalidatePath(`/aprender/${input.courseSlug}`, "layout");
  revalidatePath("/mis-cursos");
  revalidatePath("/certificados");
  return { success: true, data: { certificateCode: cert?.verification_code ?? null } };
}

export async function saveVideoPositionAction(input: {
  enrollmentId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  seconds: number;
}): Promise<ActionResult> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "No autenticado." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("status")
    .eq("user_id", user.id)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  await supabase.from("lesson_progress").upsert(
    {
      enrollment_id: input.enrollmentId,
      user_id: user.id,
      course_id: input.courseId,
      module_id: input.moduleId,
      lesson_id: input.lessonId,
      status: existing?.status === "completed" ? "completed" : "in_progress",
      video_last_position_seconds: Math.max(0, Math.floor(input.seconds)),
    },
    { onConflict: "user_id,lesson_id" }
  );

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

export async function updateLessonNoteAction(input: {
  noteId: string;
  content: string;
}): Promise<ActionResult> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión expirada." };
  if (!input.content.trim()) return { success: false, error: "La nota no puede estar vacía." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_notes")
    .update({ content: input.content.trim() })
    .eq("id", input.noteId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteLessonNoteAction(noteId: string): Promise<ActionResult> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function createDiscussionPostAction(input: {
  lessonId: string;
  courseId: string;
  parentId?: string | null;
  title?: string;
  body: string;
}): Promise<ActionResult<{ id: string }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) return { success: false, error: "Sesión requerida." };

  const parsed = discussionPostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_discussions")
    .insert({
      lesson_id: parsed.data.lessonId,
      course_id: parsed.data.courseId,
      company_id: profile.company_id,
      user_id: profile.id,
      parent_id: parsed.data.parentId || null,
      title: parsed.data.title || null,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { id: data.id } };
}

export async function toggleDiscussionUpvoteAction(discussionId: string): Promise<
  ActionResult<{ upvoted: boolean }>
> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión requerida." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("lesson_discussion_upvotes")
    .select("discussion_id")
    .eq("discussion_id", discussionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("lesson_discussion_upvotes")
      .delete()
      .eq("discussion_id", discussionId)
      .eq("user_id", user.id);
    return { success: true, data: { upvoted: false } };
  }

  const { error } = await supabase.from("lesson_discussion_upvotes").insert({
    discussion_id: discussionId,
    user_id: user.id,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, data: { upvoted: true } };
}

export async function markDiscussionResolvedAction(input: {
  discussionId: string;
  resolved: boolean;
}): Promise<ActionResult> {
  const { user } = await getCurrentUserWithProfile();
  if (!user) return { success: false, error: "Sesión requerida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_discussions")
    .update({ is_resolved: input.resolved })
    .eq("id", input.discussionId);

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
