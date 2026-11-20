import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ModuleLessonCreator } from "@/components/instructor/course-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: course }, { data: modules }, { data: lessons }, { data: bank }] =
    await Promise.all([
      supabase.from("courses").select("*").eq("id", id).single(),
      supabase
        .from("modules")
        .select("id, title, position, requires_quiz_pass")
        .eq("course_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("lessons")
        .select("id, module_id, title, lesson_type, duration_minutes, xp_reward")
        .eq("course_id", id)
        .order("position", { ascending: true }),
      supabase.from("question_banks").select("id").eq("course_id", id).limit(1).maybeSingle(),
    ]);

  if (!course) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/instructor/cursos">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3">
              <ArrowLeft className="h-4 w-4" /> Volver a Mis Cursos
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
          <p className="text-sm text-muted-foreground">
            Avance secuencial: {course.is_sequential ? "Activo" : "Libre"} • Aprobación:{" "}
            {course.passing_score}%
          </p>
        </div>
      </div>

      <ModuleLessonCreator
        courseId={course.id}
        modules={(modules ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          position: m.position,
        }))}
        bankId={bank?.id ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Estructura Actual del Curso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(modules ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Agregá el primer módulo para comenzar a cargar clases y evaluaciones.
            </p>
          ) : (
            (modules ?? []).map((mod) => (
              <div key={mod.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{mod.title}</h3>
                  {mod.requires_quiz_pass && (
                    <Badge variant="warning">Requiere examen aprobado</Badge>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {(lessons ?? [])
                    .filter((l) => l.module_id === mod.id)
                    .map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between rounded bg-secondary/50 px-3 py-1.5 text-xs"
                      >
                        <span className="font-medium">{l.title}</span>
                        <span className="text-muted-foreground">
                          {l.lesson_type} • {l.duration_minutes} min • +{l.xp_reward} XP
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

