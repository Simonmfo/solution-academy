import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { FocusShell, type SidebarModuleItem } from "@/components/player/focus-sidebar";
import type { LessonType } from "@/types/database.types";

export default async function LearnCourseLayout({
  params,
  children,
}: {
  params: Promise<{ courseSlug: string }>;
  children: React.ReactNode;
}) {
  const { courseSlug } = await params;
  const { user } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("slug", courseSlug)
    .single();

  if (!course) notFound();

  const [{ data: enrollment }, { data: modules }, { data: lessons }, { data: progressRows }] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("id, progress_percentage")
        .eq("course_id", course.id)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("modules")
        .select("id, title, position, requires_quiz_pass")
        .eq("course_id", course.id)
        .eq("is_published", true)
        .order("position", { ascending: true }),
      supabase
        .from("lessons")
        .select("id, module_id, slug, title, lesson_type, duration_minutes, position")
        .eq("course_id", course.id)
        .eq("is_published", true)
        .order("position", { ascending: true }),
      supabase
        .from("lesson_progress")
        .select("lesson_id, status")
        .eq("course_id", course.id)
        .eq("user_id", user.id),
    ]);

  const completedSet = new Set(
    (progressRows ?? []).filter((r) => r.status === "completed").map((r) => r.lesson_id as string)
  );

  // Evaluar acceso secuencial por módulo en paralelo usando la RPC can_access_module
  const unlockChecks = await Promise.all(
    (modules ?? []).map(async (m) => {
      const { data: allowed } = await supabase.rpc("can_access_module", {
        p_user_id: user.id,
        p_module_id: m.id,
      });
      return { id: m.id, unlocked: Boolean(allowed) };
    })
  );

  const unlockMap = new Map(unlockChecks.map((u) => [u.id, u.unlocked]));

  const sidebarModules: SidebarModuleItem[] = (modules ?? []).map((mod) => ({
    id: mod.id,
    title: mod.title,
    position: mod.position,
    unlocked: unlockMap.get(mod.id) ?? true,
    requires_quiz_pass: mod.requires_quiz_pass,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === mod.id)
      .map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        lesson_type: l.lesson_type as LessonType,
        duration_minutes: l.duration_minutes,
        completed: completedSet.has(l.id),
      })),
  }));

  return (
    <FocusShell
      courseTitle={course.title}
      courseSlug={course.slug}
      progressPercentage={Number(enrollment?.progress_percentage ?? 0)}
      modules={sidebarModules}
    >
      {children}
    </FocusShell>
  );
}

