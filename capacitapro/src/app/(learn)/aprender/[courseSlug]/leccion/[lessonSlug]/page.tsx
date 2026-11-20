import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSafeVideoEmbedUrl } from "@/lib/utils";
import {
  LessonWorkspace,
  type DiscussionThreadItem,
  type LatestSubmissionView,
  type NavLessonLink,
  type NoteItem,
} from "@/components/player/lesson-workspace";
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

  const [
    { data: canAccess },
    { data: enrollment },
    { data: progress },
    { data: resources },
    { data: notes },
    { data: allDiscussions },
    { data: myUpvotes },
    { data: latestSub },
    { data: allModules },
    { data: allLessons },
  ] = await Promise.all([
    supabase.rpc("can_access_module", { p_user_id: profile.id, p_module_id: lesson.module_id }),
    supabase
      .from("enrollments")
      .select("id, company_id")
      .eq("course_id", course.id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("status, video_last_position_seconds")
      .eq("lesson_id", lesson.id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase.from("lesson_resources").select("*").eq("lesson_id", lesson.id),
    supabase
      .from("lesson_notes")
      .select("id, content, video_timestamp_seconds, created_at")
      .eq("lesson_id", lesson.id)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lesson_discussions")
      .select("id, parent_id, user_id, body, is_resolved, upvotes_count, created_at, author:profiles(full_name, role)")
      .eq("lesson_id", lesson.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("lesson_discussion_upvotes")
      .select("discussion_id")
      .eq("user_id", profile.id),
    supabase
      .from("assignment_submissions")
      .select("status, score, max_score, feedback, file_name, submitted_at")
      .eq("lesson_id", lesson.id)
      .eq("user_id", profile.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("modules")
      .select("id, position")
      .eq("course_id", course.id)
      .eq("is_published", true)
      .order("position", { ascending: true }),
    supabase
      .from("lessons")
      .select("id, module_id, slug, title, lesson_type, position")
      .eq("course_id", course.id)
      .eq("is_published", true)
      .order("position", { ascending: true }),
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

  // Video en bucket privado Storage (si corresponde)
  let storageVideoSignedUrl: string | null = null;
  if (lesson.lesson_type === "video" && lesson.video_provider === "storage" && lesson.video_storage_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from("lesson-materials")
      .createSignedUrl(lesson.video_storage_path, 3600);
    storageVideoSignedUrl = signed?.signedUrl ?? null;
  }

  // Calcular lección anterior y siguiente respetando orden de módulos y lecciones
  const orderedFlat: Array<{ id: string; module_id: string; slug: string; title: string; lesson_type: string }> = [];
  for (const mod of allModules ?? []) {
    const modLessons = (allLessons ?? [])
      .filter((l) => l.module_id === mod.id)
      .sort((a, b) => a.position - b.position);
    orderedFlat.push(...modLessons);
  }

  const currentIdx = orderedFlat.findIndex((l) => l.id === lesson.id);
  const makeLink = async (item: (typeof orderedFlat)[number] | undefined): Promise<NavLessonLink | null> => {
    if (!item) return null;
    let locked = false;
    if (profile.role === "student" && item.module_id !== lesson.module_id) {
      const { data: ok } = await supabase.rpc("can_access_module", {
        p_user_id: profile.id,
        p_module_id: item.module_id,
      });
      locked = !ok;
    }
    return {
      title: item.title,
      href:
        item.lesson_type === "quiz"
          ? `/aprender/${courseSlug}/leccion/${item.slug}/examen`
          : `/aprender/${courseSlug}/leccion/${item.slug}`,
      locked,
    };
  };

  const [prevLesson, nextLesson] = await Promise.all([
    makeLink(currentIdx > 0 ? orderedFlat[currentIdx - 1] : undefined),
    makeLink(currentIdx >= 0 && currentIdx < orderedFlat.length - 1 ? orderedFlat[currentIdx + 1] : undefined),
  ]);

  // Armar hilos de discusión (raíz + respuestas)
  const upvoteSet = new Set((myUpvotes ?? []).map((u) => u.discussion_id as string));
  const rawList = allDiscussions ?? [];
  const rootPosts = rawList.filter((d) => !d.parent_id).reverse();

  const threadedDiscussions: DiscussionThreadItem[] = rootPosts.map((root) => {
    const author = Array.isArray(root.author) ? root.author[0] : root.author;
    const replies = rawList
      .filter((r) => r.parent_id === root.id)
      .map((r) => {
        const ra = Array.isArray(r.author) ? r.author[0] : r.author;
        return {
          id: r.id as string,
          body: r.body as string,
          created_at: r.created_at as string,
          author_name: ra?.full_name || "Participante",
          author_role: ra?.role || "student",
        };
      });

    return {
      id: root.id as string,
      body: root.body as string,
      created_at: root.created_at as string,
      author_id: root.user_id as string,
      author_name: author?.full_name || "Participante",
      author_role: author?.role || "student",
      is_resolved: Boolean(root.is_resolved),
      upvotes_count: Number(root.upvotes_count ?? 0),
      upvoted_by_me: upvoteSet.has(root.id as string),
      replies,
    };
  });

  return (
    <LessonWorkspace
      lesson={lesson as Lesson}
      courseSlug={courseSlug}
      enrollmentId={enrollment?.id ?? ""}
      companyId={enrollment?.company_id ?? profile.company_id ?? ""}
      userId={profile.id}
      userRole={profile.role}
      isCompleted={progress?.status === "completed"}
      videoLastPosition={Number(progress?.video_last_position_seconds ?? 0)}
      embedUrl={getSafeVideoEmbedUrl(lesson.video_url)}
      storageVideoSignedUrl={storageVideoSignedUrl}
      resources={(resources as LessonResource[]) ?? []}
      initialNotes={(notes as NoteItem[]) ?? []}
      initialDiscussions={threadedDiscussions}
      latestSubmission={(latestSub as LatestSubmissionView | null) ?? null}
      prevLesson={prevLesson}
      nextLesson={nextLesson}
    />
  );
}
