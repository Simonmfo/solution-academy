import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CourseEntryRedirectPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .single();

  if (!course) notFound();

  const { data: firstModule } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", course.id)
    .eq("is_published", true)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (!firstModule) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">Este curso todavía no tiene módulos publicados.</h2>
      </div>
    );
  }

  const { data: firstLesson } = await supabase
    .from("lessons")
    .select("slug, lesson_type")
    .eq("module_id", firstModule.id)
    .eq("is_published", true)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (!firstLesson) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">Este módulo todavía no tiene lecciones cargadas.</h2>
      </div>
    );
  }

  const target =
    firstLesson.lesson_type === "quiz"
      ? `/aprender/${courseSlug}/leccion/${firstLesson.slug}/examen`
      : `/aprender/${courseSlug}/leccion/${firstLesson.slug}`;

  redirect(target);
}

