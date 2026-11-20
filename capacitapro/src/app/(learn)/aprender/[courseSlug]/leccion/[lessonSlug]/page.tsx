import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { getSafeVideoEmbedUrl } from "@/lib/utils";
import { LessonWorkspace } from "@/components/player/lesson-workspace";
import { Card, CardContent } from "@/components/ui/card";
import type { Lesson, LessonResource } from "@/types/database.types";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await params;
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .single();

  if (!course) notFound();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", course.id)
    .eq("slug", lessonSlug)
    .single();

  if (!lesson) notFound();

  if (lesson.lesson_type === "quiz") {
    redirect(`/aprender/${courseSlug}/leccion/${lessonSlug}/examen`);
  }

  const [{ data: canAccess }, { data: enrollment }, { data: progress }, { data: resources }, { data: notes }, { data: discussions }] =
    await Promise.all([
      supabase.rpc("can_access_module", { p_user_id: profile.id, p_module_id: lesson.module_id }),
      supabase
        .from("enrollments")
        .select("id, company_id")
        .eq("course_id", course.id)
        .eq("user_id", profile.id)
        .single(),
      supabase
        .from("lesson_progress")
        .select("status")
        .eq("lesson_id", lesson.id)
        .eq("user_id", profile.id)
        .maybeSingle(),
      supabase.from("lesson_resources").select("*").eq("lesson_id", lesson.id),
      supabase
        .from("lesson_notes")
        .select("id, content, created_at")
        .eq("lesson_id", lesson.id)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("lesson_discussions")
        .select("id, body, created_at, author:profiles(full_name, role)")
        .eq("lesson_id", lesson.id)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  if (!canAccess && profile.role === "student") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Lock className="h-10 w-10 text-amber-500" />
          <h2 className="text-xl font-bold">Módulo Bloqueado por Correlatividad</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Debés completar todas las lecciones obligatorias del módulo anterior y aprobar su
            evaluación para desbloquear esta clase.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formattedDiscussions = (discussions ?? []).map((d) => {
    const author = Array.isArray(d.author) ? d.author[0] : d.author;
    return {
      id: d.id as string,
      body: d.body as string,
      created_at: d.created_at as string,
      author_name: author?.full_name || "Participante",
      author_role: author?.role || "student",
    };
  });

  return (
    <LessonWorkspace
      lesson={lesson as Lesson}
      courseSlug={courseSlug}
      enrollmentId={enrollment?.id ?? ""}
      companyId={enrollment?.company_id ?? profile.company_id ?? ""}
      userId={profile.id}
      isCompleted={progress?.status === "completed"}
      embedUrl={getSafeVideoEmbedUrl(lesson.video_url)}
      resources={(resources as LessonResource[]) ?? []}
      initialNotes={(notes as Array<{ id: string; content: string; created_at: string }>) ?? []}
      initialDiscussions={formattedDiscussions}
    />
  );
}

