import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CourseEditorTabs } from "@/components/instructor/course-editor-tabs";
import type { InstructorAttemptAuditRow } from "@/components/instructor/exams-manager";
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
    { data: banks },
    { data: questions },
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).single(),
    supabase.from("modules").select("*").eq("course_id", id).order("position", { ascending: true }),
    supabase.from("lessons").select("*").eq("course_id", id).order("position", { ascending: true }),
    supabase
      .from("lesson_resources")
      .select("*")
      .eq("course_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("quizzes").select("*").eq("course_id", id).order("created_at", { ascending: true }),
    supabase
      .from("question_banks")
      .select("id, title, description")
      .eq("course_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("questions")
      .select("id, bank_id, course_id, question_type, prompt, options_public, points, difficulty")
      .eq("course_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!course) notFound();

  const quizIds = (quizzes ?? []).map((q) => q.id as string);
  const [{ data: quizQuestionLinks }, { data: attemptsRaw }] =
    quizIds.length > 0
      ? await Promise.all([
          supabase.from("quiz_questions").select("quiz_id, question_id").in("quiz_id", quizIds),
          supabase
            .from("quiz_attempts")
            .select(
              "id, quiz_id, attempt_number, status, score_obtained, score_max, percentage, passed, started_at, submitted_at, student:profiles!quiz_attempts_user_id_fkey(full_name, email)"
            )
            .in("quiz_id", quizIds)
            .order("started_at", { ascending: false })
            .limit(40),
        ])
      : [{ data: [] }, { data: [] }];

  const quizTitleMap = new Map((quizzes ?? []).map((q) => [q.id as string, q.title as string]));
  const recentAttempts: InstructorAttemptAuditRow[] = (attemptsRaw ?? []).map((row) => {
    const stu = Array.isArray(row.student) ? row.student[0] : row.student;
    return {
      id: row.id as string,
      quiz_title: quizTitleMap.get(row.quiz_id as string) ?? "Evaluación",
      student_name: stu?.full_name || "Alumno",
      student_email: stu?.email || "",
      attempt_number: row.attempt_number as number,
      status: row.status as string,
      score_obtained: Number(row.score_obtained ?? 0),
      score_max: Number(row.score_max ?? 0),
      percentage: Number(row.percentage ?? 0),
      passed: Boolean(row.passed),
      started_at: row.started_at as string,
      submitted_at: (row.submitted_at as string | null) ?? null,
    };
  });

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
        quizQuestionLinks={
          (quizQuestionLinks as Array<{ quiz_id: string; question_id: string }>) ?? []
        }
        banks={(banks as Array<{ id: string; title: string; description: string | null }>) ?? []}
        questions={(questions as QuestionPublic[]) ?? []}
        recentAttempts={recentAttempts}
      />
    </div>
  );
}
