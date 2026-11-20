"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Play,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  getAttemptReviewAction,
  saveDraftAnswerAction,
  startQuizAttemptAction,
  submitQuizAttemptAction,
} from "@/actions/quiz.actions";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionChoice, QuestionPublic, Quiz, QuizAttempt } from "@/types/database.types";

interface FeedbackItem {
  questionId: string;
  prompt: string;
  isCorrect: boolean | null;
  pointsAwarded: number;
  maxPoints: number;
  explanation: string | null;
  instructorFeedback?: string | null;
}

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
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  const [totalDurationSecs, setTotalDurationSecs] = React.useState<number | null>(null);

  // Refs to ensure auto-submit fires once with the latest answers
  const answersRef = React.useRef<Record<string, unknown>>({});
  const autoSubmittedRef = React.useRef(false);

  React.useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const [result, setResult] = React.useState<{
    status: string;
    percentage: number;
    passed: boolean;
    scoreObtained: number;
    scoreMax: number;
    timedOut: boolean;
    feedback: FeedbackItem[];
  } | null>(null);

  // Past attempt review state
  const [reviewingAttemptId, setReviewingAttemptId] = React.useState<string | null>(null);
  const [reviewItems, setReviewItems] = React.useState<FeedbackItem[]>([]);
  const [loadingReview, setLoadingReview] = React.useState(false);

  const executeSubmit = React.useCallback(
    async (timedOut: boolean) => {
      if (!attempt || submitting) return;
      setSubmitting(true);
      setError(null);
      const res = await submitQuizAttemptAction({
        attemptId: attempt.id,
        answers: answersRef.current,
        courseSlug,
        timedOut,
      });
      setSubmitting(false);
      if (!res.success || !res.data) {
        setError(res.error ?? "Error al enviar la evaluación.");
        return;
      }
      setResult(res.data);
      setAttempt(null);
      setSecondsLeft(null);
      router.refresh();
    },
    [attempt, courseSlug, router, submitting]
  );

  // Live countdown timer with guaranteed single auto-submit at 00:00
  React.useEffect(() => {
    if (!attempt?.expires_at) return;
    autoSubmittedRef.current = false;
    const expiryMs = new Date(attempt.expires_at).getTime();
    const startMs = new Date(attempt.started_at).getTime();
    setTotalDurationSecs(Math.max(1, Math.floor((expiryMs - startMs) / 1000)));

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        void executeSubmit(true);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt?.expires_at, attempt?.started_at, executeSubmit]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setReviewingAttemptId(null);
    const res = await startQuizAttemptAction({ quizId: quiz.id, enrollmentId });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "No se pudo iniciar la evaluación.");
      return;
    }
    setAttempt(res.data.attempt);
    setQuestions(res.data.questions);
    setAnswers(res.data.draftAnswers ?? {});
  };

  const updateAnswer = (qId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    if (attempt) {
      setSavingDraft(true);
      void saveDraftAnswerAction({ attemptId: attempt.id, questionId: qId, value }).finally(() =>
        setSavingDraft(false)
      );
    }
  };

  const toggleMultiChoice = (qId: string, optionId: string) => {
    const current = Array.isArray(answers[qId]) ? (answers[qId] as string[]) : [];
    const next = current.includes(optionId)
      ? current.filter((x) => x !== optionId)
      : [...current, optionId];
    updateAnswer(qId, next);
  };

  const isQuestionAnswered = (qId: string): boolean => {
    const val = answers[qId];
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  };

  const answeredCount = questions.filter((q) => isQuestionAnswered(q.id)).length;

  const handleManualSubmit = () => {
    if (answeredCount < questions.length) {
      const unanswered = questions.length - answeredCount;
      const ok = window.confirm(
        `Tenés ${unanswered} pregunta(s) sin responder. ¿Querés enviar la evaluación de todas formas?`
      );
      if (!ok) return;
    }
    void executeSubmit(false);
  };

  const handleReviewPastAttempt = async (attemptId: string) => {
    if (reviewingAttemptId === attemptId) {
      setReviewingAttemptId(null);
      return;
    }
    setLoadingReview(true);
    setReviewingAttemptId(attemptId);
    const res = await getAttemptReviewAction(attemptId);
    setLoadingReview(false);
    if (res.success && res.data) {
      setReviewItems(res.data);
    } else {
      setReviewItems([]);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const hasActiveInProgress = previousAttempts.some(
    (a) =>
      a.status === "in_progress" &&
      (!a.expires_at || new Date(a.expires_at).getTime() > Date.now())
  );
  const completedAttemptsCount = previousAttempts.filter((a) => a.status !== "in_progress").length;
  const attemptsExhausted = !hasActiveInProgress && completedAttemptsCount >= quiz.max_attempts;
  const alreadyPassed = previousAttempts.some((a) => a.passed);

  const timerPct =
    secondsLeft !== null && totalDurationSecs
      ? Math.max(0, Math.min(100, Math.round((secondsLeft / totalDurationSecs) * 100)))
      : 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={quiz.is_final_exam ? "default" : "outline"}>
                {quiz.is_final_exam ? "EXAMEN FINAL CERTIFICADOR" : "EVALUACIÓN DE MÓDULO"}
              </Badge>
              {alreadyPassed && <Badge variant="success">Aprobada</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Aprobación mínima: {quiz.passing_score_percent}%</span>
              <span>•</span>
              <span>
                Intentos usados: {completedAttemptsCount}/{quiz.max_attempts}
              </span>
              {quiz.time_limit_minutes && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Clock className="h-3.5 w-3.5" /> {quiz.time_limit_minutes} min (auto-envío)
                  </span>
                </>
              )}
            </div>
          </div>
          <CardTitle className="mt-2 text-2xl">{quiz.title}</CardTitle>
          {quiz.description && <CardDescription>{quiz.description}</CardDescription>}
        </CardHeader>

        {!attempt && (
          <CardContent className="space-y-5">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Detailed Scorecard after submission */}
            {result && (
              <div
                className={`space-y-4 rounded-xl border p-5 ${
                  result.passed
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : result.status === "pending_manual_grading"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-destructive/40 bg-destructive/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {result.passed ? (
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    ) : result.status === "pending_manual_grading" ? (
                      <Clock className="h-8 w-8 text-amber-500" />
                    ) : (
                      <XCircle className="h-8 w-8 text-destructive" />
                    )}
                    <div>
                      <h3 className="text-lg font-bold">
                        {result.status === "pending_manual_grading"
                          ? "Evaluación enviada — Esperando corrección manual"
                          : result.passed
                          ? `¡Aprobaste con ${result.percentage}%!`
                          : `Calificación: ${result.percentage}% (mínimo ${quiz.passing_score_percent}%)`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Puntaje: {result.scoreObtained} / {result.scoreMax} pts
                        {result.timedOut ? " • Enviado automáticamente al finalizar el tiempo" : ""}
                      </p>
                    </div>
                  </div>
                  {result.passed && quiz.is_final_exam && (
                    <Link href="/certificados">
                      <Button size="sm">
                        <Award className="h-4 w-4" /> Ver mi Diploma PDF
                      </Button>
                    </Link>
                  )}
                </div>

                {result.feedback.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3 text-xs">
                    <p className="font-semibold">Detalle por pregunta:</p>
                    {result.feedback.map((f, idx) => (
                      <div
                        key={f.questionId}
                        className="rounded-lg border border-border/60 bg-background/80 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">
                            {idx + 1}. {f.prompt}
                          </span>
                          <Badge
                            variant={
                              f.isCorrect === null
                                ? "warning"
                                : f.isCorrect
                                ? "success"
                                : "destructive"
                            }
                          >
                            {f.isCorrect === null
                              ? "Pendiente manual"
                              : `${f.pointsAwarded}/${f.maxPoints} pts`}
                          </Badge>
                        </div>
                        {f.explanation && (
                          <p className="mt-1.5 text-muted-foreground">{f.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleStart}
                disabled={loading || attemptsExhausted}
                size="lg"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {hasActiveInProgress
                  ? "Retomar Intento en Curso"
                  : attemptsExhausted
                  ? "Intentos Agotados"
                  : completedAttemptsCount > 0
                  ? "Iniciar Nuevo Intento"
                  : "Comenzar Evaluación"}
              </Button>
              {attemptsExhausted && !alreadyPassed && (
                <span className="text-xs text-destructive">
                  Alcanzaste el límite de {quiz.max_attempts} intentos. Consultá con tu instructor.
                </span>
              )}
            </div>

            {/* Historical Attempts Registered in DB */}
            {previousAttempts.length > 0 && (
              <div className="pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Historial de Intentos Registrados
                </p>
                <div className="space-y-2">
                  {previousAttempts.map((a) => (
                    <div key={a.id} className="rounded-lg border border-border p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold">Intento #{a.attempt_number}</span>
                          <span className="text-muted-foreground">
                            {formatDate(a.submitted_at ?? a.started_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">
                            {a.score_obtained}/{a.score_max} pts ({a.percentage}%)
                          </span>
                          <Badge
                            variant={
                              a.passed
                                ? "success"
                                : a.status === "pending_manual_grading"
                                ? "warning"
                                : a.status === "in_progress"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {a.passed
                              ? "Aprobado"
                              : a.status === "pending_manual_grading"
                              ? "Pendiente revisión"
                              : a.status === "in_progress"
                              ? "En curso"
                              : "Desaprobado"}
                          </Badge>
                          {a.status !== "in_progress" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReviewPastAttempt(a.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {reviewingAttemptId === a.id ? "Ocultar" : "Revisar"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {reviewingAttemptId === a.id && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          {loadingReview ? (
                            <p className="text-muted-foreground">Cargando detalle...</p>
                          ) : (
                            reviewItems.map((item, idx) => (
                              <div key={item.questionId} className="rounded bg-secondary/40 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">
                                    {idx + 1}. {item.prompt}
                                  </span>
                                  <span className="font-bold">
                                    {item.isCorrect === null
                                      ? "Manual"
                                      : `${item.pointsAwarded}/${item.maxPoints} pts`}
                                  </span>
                                </div>
                                {item.explanation && (
                                  <p className="mt-1 text-muted-foreground">{item.explanation}</p>
                                )}
                                {item.instructorFeedback && (
                                  <p className="mt-1 font-medium text-primary">
                                    Instructor: {item.instructorFeedback}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Active Timed Quiz Workspace */}
      {attempt && (
        <div className="space-y-5">
          {/* Sticky Live Timer & Question Navigator */}
          <div className="sticky top-16 z-20 space-y-3 rounded-xl border border-primary/30 bg-card/95 p-4 shadow-md backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>
                  Intento #{attempt.attempt_number} • {answeredCount}/{questions.length} respondidas
                </span>
                {savingDraft && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (guardando borrador...)
                  </span>
                )}
              </div>

              {secondsLeft !== null && (
                <Badge
                  variant={
                    secondsLeft < 60
                      ? "destructive"
                      : secondsLeft < 300
                      ? "warning"
                      : "default"
                  }
                  className={`px-3 py-1 text-sm tabular-nums ${secondsLeft < 60 ? "animate-pulse" : ""}`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimer(secondsLeft)}
                </Badge>
              )}
            </div>

            {secondsLeft !== null && <Progress value={timerPct} className="h-1.5" />}

            {/* Question Navigator Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {questions.map((q, i) => {
                const answered = isQuestionAnswered(q.id);
                return (
                  <a
                    key={q.id}
                    href={`#q-${q.id}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                      answered
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-secondary/50 text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {i + 1}
                  </a>
                );
              })}
            </div>
          </div>

          {questions.map((q, idx) => {
            const choices = Array.isArray(q.options_public)
              ? (q.options_public as QuestionChoice[])
              : [];

            return (
              <Card key={q.id} id={`q-${q.id}`} className="scroll-mt-44">
                <CardHeader>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Pregunta {idx + 1} de {questions.length}
                    </span>
                    <Badge variant="outline">{q.points} puntos</Badge>
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
                          onChange={() => updateAnswer(q.id, opt.id)}
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
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                    />
                  )}

                  {q.question_type === "open_ended" && (
                    <Textarea
                      rows={4}
                      placeholder="Desarrollá tu respuesta técnica (será evaluada por el instructor)..."
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {answeredCount < questions.length && (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Te faltan {questions.length - answeredCount} pregunta(s) por responder.
                </>
              )}
            </span>
            <Button size="lg" onClick={handleManualSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Finalizar y Enviar Evaluación
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
