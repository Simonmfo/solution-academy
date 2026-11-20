import { createClient } from "@/lib/supabase/server";
import { GradeSubmissionInline } from "@/components/instructor/course-builder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InstructorGradingInboxPage() {
  const supabase = await createClient();

  const [{ data: pendingSubmissions }, { data: pendingOpenAnswers }] = await Promise.all([
    supabase
      .from("assignment_submissions")
      .select(
        "id, submission_text, file_name, max_score, status, student:profiles!assignment_submissions_user_id_fkey(full_name, email), lesson:lessons(title)"
      )
      .in("status", ["submitted", "under_review"])
      .order("submitted_at", { ascending: true }),
    supabase
      .from("quiz_attempt_answers")
      .select(
        "id, answer_payload, max_points, question:questions(prompt), attempt:quiz_attempts(user_id, student:profiles!quiz_attempts_user_id_fkey(full_name))"
      )
      .is("is_correct", null)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bandeja de Correcciones</h1>
        <p className="text-sm text-muted-foreground">
          Corregí tareas prácticas entregadas y respuestas abiertas de exámenes. Al aprobar el examen final se emite el diploma automáticamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entregas de Tareas Pendientes ({pendingSubmissions?.length ?? 0})</CardTitle>
          <CardDescription>Prácticas enviadas por alumnos de tus cursos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pendingSubmissions || pendingSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay entregas pendientes de corrección.</p>
          ) : (
            pendingSubmissions.map((sub) => {
              const student = Array.isArray(sub.student) ? sub.student[0] : sub.student;
              const lesson = Array.isArray(sub.lesson) ? sub.lesson[0] : sub.lesson;
              return (
                <div key={sub.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{lesson?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {student?.full_name} ({student?.email})
                      </p>
                    </div>
                    <Badge variant="warning">Pendiente</Badge>
                  </div>
                  {sub.submission_text && (
                    <p className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm">{sub.submission_text}</p>
                  )}
                  {sub.file_name && (
                    <p className="mt-2 text-xs text-primary">Archivo adjunto: {sub.file_name}</p>
                  )}
                  <GradeSubmissionInline
                    type="assignment"
                    id={sub.id}
                    maxPoints={Number(sub.max_score ?? 100)}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Respuestas Abiertas de Exámenes ({pendingOpenAnswers?.length ?? 0})</CardTitle>
          <CardDescription>Preguntas de desarrollo que requieren calificación manual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pendingOpenAnswers || pendingOpenAnswers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay preguntas abiertas pendientes.</p>
          ) : (
            pendingOpenAnswers.map((ans) => {
              const q = Array.isArray(ans.question) ? ans.question[0] : ans.question;
              const payload = ans.answer_payload as { value?: string };
              return (
                <div key={ans.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold">{q?.prompt}</p>
                  <p className="mt-2 rounded-lg bg-secondary/50 p-3 text-sm">
                    {payload?.value ?? "(Sin respuesta)"}
                  </p>
                  <GradeSubmissionInline
                    type="open_answer"
                    id={ans.id}
                    maxPoints={Number(ans.max_points ?? 20)}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

