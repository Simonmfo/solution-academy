import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { Card, CardContent } from "@/components/ui/card";
import type { Quiz, QuizAttempt } from "@/types/database.types";

export default async function LessonQuizPage({
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
    .select("id, module_id")
    .eq("course_id", course.id)
    .eq("slug", lessonSlug)
    .single();

  if (!lesson) notFound();

  const [{ data: canAccess }, { data: enrollment }, { data: quiz }] = await Promise.all([
    supabase.rpc("can_access_module", { p_user_id: profile.id, p_module_id: lesson.module_id }),
    supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course.id)
      .eq("user_id", profile.id)
      .single(),
    supabase.from("quizzes").select("*").eq("lesson_id", lesson.id).single(),
  ]);

  if (!canAccess && profile.role === "student") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Lock className="h-10 w-10 text-amber-500" />
          <h2 className="text-xl font-bold">Evaluación Bloqueada</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Completá las lecciones previas requeridas antes de rendir este examen.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!quiz || !enrollment) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Esta evaluación aún no está configurada o no estás matriculado en este curso.
        </CardContent>
      </Card>
    );
  }

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quiz.id)
    .eq("user_id", profile.id)
    .order("attempt_number", { ascending: false });

  return (
    <QuizRunner
      quiz={quiz as Quiz}
      enrollmentId={enrollment.id}
      courseSlug={courseSlug}
      previousAttempts={(attempts as QuizAttempt[]) ?? []}
    />
  );
}

