"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Clock, History, Loader2, Plus, Save, Shuffle } from "lucide-react";
import { createQuizWithLessonAction, syncQuizQuestionsAction } from "@/actions/quiz.actions";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Module, QuestionPublic, Quiz, QuizFeedbackMode } from "@/types/database.types";
import type { QuestionBankItem } from "@/components/instructor/question-bank-manager";

export interface InstructorAttemptAuditRow {
  id: string;
  quiz_title: string;
  student_name: string;
  student_email: string;
  attempt_number: number;
  status: string;
  score_obtained: number;
  score_max: number;
  percentage: number;
  passed: boolean;
  submitted_at: string | null;
  started_at: string;
}

export function ExamsManager({
  courseId,
  modules,
  banks,
  questions,
  quizzes,
  quizQuestionLinks,
  recentAttempts,
}: {
  courseId: string;
  modules: Module[];
  banks: QuestionBankItem[];
  questions: QuestionPublic[];
  quizzes: Quiz[];
  quizQuestionLinks: Array<{ quiz_id: string; question_id: string }>;
  recentAttempts: InstructorAttemptAuditRow[];
}) {
  const router = useRouter();

  // New Exam Builder state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [moduleId, setModuleId] = React.useState(modules[0]?.id ?? "");
  const [questionBankId, setQuestionBankId] = React.useState(banks[0]?.id ?? "");
  const [selectionMode, setSelectionMode] = React.useState<"random" | "manual">("random");
  const [randomCount, setRandomCount] = React.useState("5");
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<string[]>([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState(15);
  const [maxAttempts, setMaxAttempts] = React.useState(3);
  const [passingScorePercent, setPassingScorePercent] = React.useState(80);
  const [isFinalExam, setIsFinalExam] = React.useState(false);
  const [shuffleQuestions, setShuffleQuestions] = React.useState(true);
  const [shuffleOptions, setShuffleOptions] = React.useState(true);
  const [feedbackMode, setFeedbackMode] = React.useState<QuizFeedbackMode>("after_submit");
  const [creating, setCreating] = React.useState(false);

  // Manage existing exam questions
  const [editingQuizId, setEditingQuizId] = React.useState<string | null>(null);
  const [editSelectedIds, setEditSelectedIds] = React.useState<string[]>([]);
  const [editBankId, setEditBankId] = React.useState<string>("");
  const [editRandomCount, setEditRandomCount] = React.useState<string>("");
  const [savingSync, setSavingSync] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const toggleManualQ = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) {
      setFeedback({ text: "Primero creá al menos un módulo en el temario.", isError: true });
      return;
    }

    setCreating(true);
    setFeedback(null);

    const res = await createQuizWithLessonAction({
      courseId,
      moduleId,
      questionBankId: questionBankId || null,
      title,
      description,
      isFinalExam,
      timeLimitMinutes: timeLimitMinutes > 0 ? timeLimitMinutes : null,
      maxAttempts,
      passingScorePercent,
      randomQuestionCount:
        selectionMode === "random" && randomCount ? Number(randomCount) : null,
      shuffleQuestions,
      shuffleOptions,
      feedbackMode,
      xpReward: isFinalExam ? 300 : 150,
      selectedQuestionIds: selectionMode === "manual" ? selectedQuestionIds : [],
    });

    setCreating(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "No se pudo crear el examen.", isError: true });
      return;
    }

    setTitle("");
    setDescription("");
    setSelectedQuestionIds([]);
    setFeedback({ text: "Examen creado y agregado automáticamente al módulo seleccionado." });
    router.refresh();
  };

  const openQuizQuestionEditor = (quiz: Quiz) => {
    if (editingQuizId === quiz.id) {
      setEditingQuizId(null);
      return;
    }
    const linked = quizQuestionLinks
      .filter((l) => l.quiz_id === quiz.id)
      .map((l) => l.question_id);
    setEditingQuizId(quiz.id);
    setEditSelectedIds(linked);
    setEditBankId(quiz.question_bank_id ?? banks[0]?.id ?? "");
    setEditRandomCount(quiz.random_question_count ? String(quiz.random_question_count) : "");
  };

  const handleSaveQuizQuestions = async (quizId: string) => {
    setSavingSync(true);
    const res = await syncQuizQuestionsAction({
      quizId,
      courseId,
      questionIds: editSelectedIds,
      questionBankId: editBankId || null,
      randomQuestionCount: editSelectedIds.length === 0 && editRandomCount ? Number(editRandomCount) : null,
    });
    setSavingSync(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "No se pudieron actualizar las preguntas.", isError: true });
      return;
    }
    setEditingQuizId(null);
    setFeedback({ text: "Selección de preguntas del examen guardada." });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-lg border p-3 text-sm font-medium ${
            feedback.isError
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 1. Creador de Examen Completo */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Crear Nuevo Examen / Evaluación
          </CardTitle>
          <CardDescription>
            Configurá temporizador en vivo con auto-envío, intentos máximos, porcentaje de aprobación y selección aleatoria o fija.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateExam} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Título del Examen</Label>
                <Input
                  required
                  placeholder="Ej. Parcial de Seguridad Vial y Check-List"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Módulo donde aparecerá</Label>
                <select
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Instrucciones para el alumno (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Indicaciones previas antes de iniciar el temporizador..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Temporizador (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  max={300}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Intentos Máximos</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">% Mínimo Aprobación</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={passingScorePercent}
                  onChange={(e) => setPassingScorePercent(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retroalimentación</Label>
                <select
                  value={feedbackMode}
                  onChange={(e) => setFeedbackMode(e.target.value as QuizFeedbackMode)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="after_submit">Al entregar el intento</option>
                  <option value="immediate">Inmediata</option>
                  <option value="never">Oculta</option>
                </select>
              </div>
            </div>

            {/* Modo de selección de preguntas */}
            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={selectionMode === "random"}
                    onChange={() => setSelectionMode("random")}
                  />
                  Selección aleatoria desde Banco de Preguntas
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={selectionMode === "manual"}
                    onChange={() => setSelectionMode("manual")}
                  />
                  Elegir preguntas exactas manualmente ({selectedQuestionIds.length})
                </label>
              </div>

              {selectionMode === "random" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Banco Origen</Label>
                    <select
                      value={questionBankId}
                      onChange={(e) => setQuestionBankId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({questions.filter((q) => q.bank_id === b.id).length} preg.)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad de preguntas aleatorias por intento</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Vacío = todas las del banco"
                      value={randomCount}
                      onChange={(e) => setRandomCount(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background p-3">
                  {questions.map((q) => (
                    <label key={q.id} className="flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={() => toggleManualQ(q.id)}
                      />
                      <span>
                        <strong>[{q.question_type}]</strong> {q.prompt} ({q.points} pts)
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-5 pt-1 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                  />
                  Mezclar orden de preguntas
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                  />
                  Mezclar orden de opciones
                </label>
                <label className="flex items-center gap-2 font-semibold text-primary">
                  <input
                    type="checkbox"
                    checked={isFinalExam}
                    onChange={(e) => setIsFinalExam(e.target.checked)}
                  />
                  Examen Final Certificador (habilita Diploma PDF + QR)
                </label>
              </div>
            </div>

            <Button type="submit" disabled={creating || modules.length === 0}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear Examen en el Curso
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2. Exámenes Configurados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exámenes del Curso ({quizzes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no creaste exámenes en este curso.</p>
          ) : (
            quizzes.map((q) => {
              const linkedCount = quizQuestionLinks.filter((l) => l.quiz_id === q.id).length;
              const isOpen = editingQuizId === q.id;
              return (
                <div key={q.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={q.is_final_exam ? "default" : "outline"}>
                          {q.is_final_exam ? "EXAMEN FINAL" : "EVALUACIÓN"}
                        </Badge>
                        <Badge variant="secondary">Aprobación ≥ {q.passing_score_percent}%</Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {q.time_limit_minutes ? `${q.time_limit_minutes} min` : "Sin límite"} • Máx.{" "}
                          {q.max_attempts} intentos
                        </span>
                      </div>
                      <h4 className="mt-1.5 font-semibold">{q.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {linkedCount > 0
                          ? `${linkedCount} preguntas fijas asignadas`
                          : `Selección aleatoria del banco (${q.random_question_count ?? "todas"} preguntas)`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openQuizQuestionEditor(q)}
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      {isOpen ? "Cerrar" : "Configurar Preguntas"}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Banco para modo aleatorio (si no elegís fijas)</Label>
                          <select
                            value={editBankId}
                            onChange={(e) => setEditBankId(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                          >
                            {banks.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cantidad aleatoria (vacío = todas)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={editRandomCount}
                            onChange={(e) => setEditRandomCount(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-3">
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          Preguntas fijas seleccionadas ({editSelectedIds.length}) — dejá en 0 para usar selección aleatoria del banco:
                        </p>
                        {questions.map((ques) => (
                          <label key={ques.id} className="flex cursor-pointer items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={editSelectedIds.includes(ques.id)}
                              onChange={() =>
                                setEditSelectedIds((prev) =>
                                  prev.includes(ques.id)
                                    ? prev.filter((x) => x !== ques.id)
                                    : [...prev, ques.id]
                                )
                              }
                            />
                            <span>
                              <strong>[{ques.question_type}]</strong> {ques.prompt}
                            </span>
                          </label>
                        ))}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={savingSync}
                        onClick={() => handleSaveQuizQuestions(q.id)}
                      >
                        {savingSync ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Guardar Preguntas del Examen
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* 3. Auditoría de Intentos Registrados en Base de Datos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-primary" />
            Registro de Intentos de Alumnos ({recentAttempts.length})
          </CardTitle>
          <CardDescription>
            Historial persistido en <code>public.quiz_attempts</code> con puntaje automático y estado de aprobación.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Alumno</th>
                <th className="py-2 pr-4">Examen</th>
                <th className="py-2 pr-4">Intento</th>
                <th className="py-2 pr-4">Puntaje</th>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentAttempts.map((att) => (
                <tr key={att.id}>
                  <td className="py-2.5 pr-4">
                    <p className="font-semibold">{att.student_name}</p>
                    <p className="text-[11px] text-muted-foreground">{att.student_email}</p>
                  </td>
                  <td className="py-2.5 pr-4 font-medium">{att.quiz_title}</td>
                  <td className="py-2.5 pr-4">#{att.attempt_number}</td>
                  <td className="py-2.5 pr-4 font-semibold">
                    {att.score_obtained}/{att.score_max} ({att.percentage}%)
                  </td>
                  <td className="py-2.5 pr-4">{formatDate(att.submitted_at ?? att.started_at)}</td>
                  <td className="py-2.5">
                    <Badge
                      variant={
                        att.passed
                          ? "success"
                          : att.status === "pending_manual_grading"
                          ? "warning"
                          : att.status === "in_progress"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {att.passed
                        ? "Aprobado"
                        : att.status === "pending_manual_grading"
                        ? "Pendiente manual"
                        : att.status === "in_progress"
                        ? "En curso"
                        : "Desaprobado"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {recentAttempts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Todavía no hay intentos registrados para los exámenes de este curso.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

