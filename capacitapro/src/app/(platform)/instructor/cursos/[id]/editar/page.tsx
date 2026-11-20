import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CourseEditorTabs } from "@/components/instructor/course-editor-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  Course,
  Lesson,
  LessonResource,
  Module,
  QuestionPublic,
  Quiz,
} from "@/types/database.types";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: course },
    { data: modules },
    { data: lessons },
    { data: resources },
    { data: quizzes },
    { data: bank },
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).single(),
    supabase.from("modules").select("*").eq("course_id", id).order("position", { ascending: true }),
    supabase.from("lessons").select("*").eq("course_id", id).order("position", { ascending: true }),
    supabase
      .from("lesson_resources")
      .select("*")
      .eq("course_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("quizzes").select("*").eq("course_id", id),
    supabase.from("question_banks").select("id").eq("course_id", id).limit(1).maybeSingle(),
  ]);

  if (!course) notFound();

  const { data: questions } = bank?.id
    ? await supabase
        .from("questions")
        .select("id, bank_id, course_id, question_type, prompt, options_public, points, difficulty")
        .eq("bank_id", bank.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/instructor/cursos">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3">
              <ArrowLeft className="h-4 w-4" /> Volver a Mis Cursos
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={course.status === "published" ? "success" : "secondary"}>
              {course.status}
            </Badge>
            <Badge variant="outline">
              <Lock className="h-3 w-3" />
              {course.is_sequential ? "Bloqueo Secuencial Activo" : "Avance Libre"}
            </Badge>
            <Badge variant="outline">
              <ShieldCheck className="h-3 w-3" />
              Aprobación ≥ {course.passing_score}%
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1>
        </div>

        <Link href={`/aprender/${course.slug}`} target="_blank">
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4" />
            Vista Previa Modo Focus
          </Button>
        </Link>
      </div>

      <CourseEditorTabs
        course={course as Course}
        modules={(modules as Module[]) ?? []}
        lessons={(lessons as Lesson[]) ?? []}
        resources={(resources as LessonResource[]) ?? []}
        quizzes={(quizzes as Quiz[]) ?? []}
        bankId={bank?.id ?? null}
        questions={(questions as QuestionPublic[]) ?? []}
      />
    </div>
  );
}
