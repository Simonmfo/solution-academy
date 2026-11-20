"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, Play, ShieldCheck, XCircle } from "lucide-react";
import { startQuizAttemptAction, submitQuizAttemptAction } from "@/actions/quiz.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionChoice, QuestionPublic, Quiz, QuizAttempt } from "@/types/database.types";

export function QuizRunner({
  quiz,
  enrollmentId,
  courseSlug,
  previousAttempts,
}: {
  quiz: Quiz;
  enrollmentId: string;
  courseSlug: string;
  previousAttempts: QuizAttempt[];
}) {
  const router = useRouter();
  const [attempt, setAttempt] = React.useState<QuizAttempt | null>(null);
  const [questions, setQuestions] = React.useState<QuestionPublic[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<{
    status: string;
    percentage: number;
    passed: boolean;
    scoreObtained: number;
    scoreMax: number;
    feedback: Array<{
      questionId: string;
      isCorrect: boolean | null;
      pointsAwarded: number;
      explanation: string | null;
    }>;
  } | null>(null);

  const handleSubmit = React.useCallback(async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await submitQuizAttemptAction({
      attemptId: attempt.id,
      answers,
      courseSlug,
    });
    setSubmitting(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Error al enviar la evaluación.");
      return;
    }
    setResult(res.data);
    setAttempt(null);
    router.refresh();
  }, [attempt, answers, courseSlug, router, submitting]);

  // Countdown Timer
  React.useEffect(() => {
    if (!attempt?.expires_at) return;
    const expiryMs = new Date(attempt.expires_at).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        void handleSubmit();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt?.expires_at, handleSubmit]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await startQuizAttemptAction({ quizId: quiz.id, enrollmentId });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "No se pudo iniciar la evaluación.");
      return;
    }
    setAttempt(res.data.attempt);
    setQuestions(res.data.questions);
    setAnswers({});
  };

  const toggleMultiChoice = (qId: string, optionId: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qId]) ? (prev[qId] as string[]) : [];
      const next = current.includes(optionId)
        ? current.filter((x) => x !== optionId)
        : [...current, optionId];
      return { ...prev, [qId]: next };
    });
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant={quiz.is_final_exam ? "default" : "outline"}>
              {quiz.is_final_exam ? "EXAMEN FINAL CERTIFICADOR" : "EVALUACIÓN DE MÓDULO"}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Aprobación mínima: {quiz.passing_score_percent}%</span>
              <span>•</span>
              <span>
                Intentos: {previousAttempts.length}/{quiz.max_attempts}
              </span>
              {quiz.time_limit_minutes && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {quiz.time_limit_minutes} min
                  </span>
                </>
              )}
            </div>
          </div>
          <CardTitle className="mt-2 text-2xl">{quiz.title}</CardTitle>
          {quiz.description && <CardDescription>{quiz.description}</CardDescription>}
        </CardHeader>

        {!attempt && (
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {result && (
              <div
                className={`rounded-xl border p-5 ${
                  result.passed
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : result.status === "pending_manual_grading"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-destructive/40 bg-destructive/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.passed ? (
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  ) : (
                    <XCircle className="h-7 w-7 text-amber-500" />
                  )}
                  <div>
                    <h3 className="text-lg font-bold">
                      {result.status === "pending_manual_grading"
                        ? "Enviado — Pendiente de corrección manual"
                        : result.passed
                        ? `¡Evaluación Aprobada! (${result.percentage}%)`
                        : `No alcanzada la nota mínima (${result.percentage}%)`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Puntaje automático: {result.scoreObtained} / {result.scoreMax} pts
                    </p>
                  </div>
                </div>

                {result.feedback.some((f) => f.explanation) && (
                  <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
                    <p className="font-semibold">Retroalimentación:</p>
                    {result.feedback.map((f, idx) => (
                      <div key={f.questionId} className="rounded bg-background/70 p-2">
                        <span className="font-semibold">Pregunta {idx + 1}:</span>{" "}
                        {f.isCorrect === null
                          ? "Revisión pendiente por instructor."
                          : f.isCorrect
                          ? "Correcta."
                          : "Incorrecta."}{" "}
                        {f.explanation && <span className="text-muted-foreground">{f.explanation}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleStart} disabled={loading} size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {previousAttempts.length > 0 ? "Iniciar Nuevo Intento" : "Comenzar Evaluación"}
            </Button>

            {previousAttempts.length > 0 && (
              <div className="pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Historial de Intentos
                </p>
                <div className="space-y-2">
                  {previousAttempts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      <span>Intento #{a.attempt_number}</span>
                      <span>
                        {a.score_obtained}/{a.score_max} pts ({a.percentage}%)
                      </span>
                      <Badge
                        variant={
                          a.passed
                            ? "success"
                            : a.status === "pending_manual_grading"
                            ? "warning"
                            : "outline"
                        }
                      >
                        {a.passed
                          ? "Aprobado"
                          : a.status === "pending_manual_grading"
                          ? "Pendiente revisión"
                          : a.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Active Quiz Form */}
      {attempt && (
        <div className="space-y-5">
          {secondsLeft !== null && (
            <div className="sticky top-16 z-20 flex items-center justify-between rounded-xl border border-primary/30 bg-card px-4 py-3 shadow-md">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Intento #{attempt.attempt_number} en progreso
              </span>
              <Badge variant={secondsLeft < 120 ? "destructive" : "default"} className="text-sm">
                <Clock className="h-3.5 w-3.5" /> {formatTimer(secondsLeft)}
              </Badge>
            </div>
          )}

          {questions.map((q, idx) => {
            const choices = Array.isArray(q.options_public)
              ? (q.options_public as QuestionChoice[])
              : [];

            return (
              <Card key={q.id}>
                <CardHeader>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pregunta {idx + 1} de {questions.length}</span>
                    <span>{q.points} puntos</span>
                  </div>
                  <CardTitle className="mt-1 text-base leading-relaxed">{q.prompt}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {(q.question_type === "single_choice" || q.question_type === "true_false") &&
                    choices.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                          answers[q.id] === opt.id
                            ? "border-primary bg-primary/10 font-medium"
                            : "border-border hover:bg-accent/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt.id}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}

                  {q.question_type === "multiple_choice" &&
                    choices.map((opt) => {
                      const selected =
                        Array.isArray(answers[q.id]) &&
                        (answers[q.id] as string[]).includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 font-medium"
                              : "border-border hover:bg-accent/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleMultiChoice(q.id, opt.id)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}

                  {q.question_type === "fill_blank" && (
                    <Input
                      placeholder="Escribí la palabra o frase exacta..."
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                  )}

                  {q.question_type === "open_ended" && (
                    <Textarea
                      rows={4}
                      placeholder="Desarrollá tu respuesta técnica (será evaluada por el instructor)..."
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Finalizar y Enviar Evaluación
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

