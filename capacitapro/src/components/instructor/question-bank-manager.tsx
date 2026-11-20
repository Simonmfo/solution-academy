"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { createQuestionWithKeyAction, deleteQuestionAction } from "@/actions/course.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionDifficulty, QuestionPublic, QuestionType } from "@/types/database.types";

export function QuestionBankManager({
  courseId,
  bankId,
  questions,
}: {
  courseId: string;
  bankId: string | null;
  questions: QuestionPublic[];
}) {
  const router = useRouter();
  const [questionType, setQuestionType] = React.useState<QuestionType>("single_choice");
  const [prompt, setPrompt] = React.useState("");
  const [points, setPoints] = React.useState(20);
  const [difficulty, setDifficulty] = React.useState<QuestionDifficulty>("medium");
  const [explanation, setExplanation] = React.useState("");

  // Options for choice types
  const [optA, setOptA] = React.useState("");
  const [optB, setOptB] = React.useState("");
  const [optC, setOptC] = React.useState("");
  const [singleCorrect, setSingleCorrect] = React.useState<"a" | "b" | "c">("a");
  const [multiCorrect, setMultiCorrect] = React.useState<string[]>(["a"]);
  const [trueFalseCorrect, setTrueFalseCorrect] = React.useState<boolean>(true);
  const [fillBlankAccepted, setFillBlankAccepted] = React.useState("");
  const [openRubric, setOpenRubric] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  if (!bankId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Este curso todavía no tiene un banco de preguntas configurado.
        </CardContent>
      </Card>
    );
  }

  const toggleMulti = (id: string) => {
    setMultiCorrect((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    let optionsPublic: unknown = [];
    let correctAnswer: unknown = {};

    if (questionType === "single_choice" || questionType === "multiple_choice") {
      const opts = [
        { id: "a", label: optA.trim() },
        { id: "b", label: optB.trim() },
        ...(optC.trim() ? [{ id: "c", label: optC.trim() }] : []),
      ];
      optionsPublic = opts;
      correctAnswer =
        questionType === "single_choice"
          ? { option_id: singleCorrect }
          : { option_ids: multiCorrect };
    } else if (questionType === "true_false") {
      optionsPublic = [
        { id: "true", label: "Verdadero" },
        { id: "false", label: "Falso" },
      ];
      correctAnswer = { value: trueFalseCorrect };
    } else if (questionType === "fill_blank") {
      optionsPublic = { blanks_count: 1 };
      const variants = fillBlankAccepted
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      correctAnswer = { accepted: [variants] };
    } else if (questionType === "open_ended") {
      optionsPublic = { min_chars: 20 };
      correctAnswer = { rubric: openRubric.trim() || "Evaluación manual por el instructor." };
    }

    const res = await createQuestionWithKeyAction({
      bankId,
      courseId,
      questionType,
      prompt: prompt.trim(),
      points,
      difficulty,
      optionsPublic,
      correctAnswer,
      explanation: explanation.trim() || undefined,
    });

    setSaving(false);
    if (!res.success) {
      setFeedback(res.error ?? "No se pudo guardar la pregunta.");
      return;
    }

    setPrompt("");
    setOptA("");
    setOptB("");
    setOptC("");
    setFillBlankAccepted("");
    setOpenRubric("");
    setExplanation("");
    setFeedback("Pregunta agregada al banco con clave aislada por RLS.");
    router.refresh();
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm("¿Eliminar esta pregunta del banco?")) return;
    await deleteQuestionAction({ questionId, courseId });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Nueva Pregunta para el Banco del Curso
          </CardTitle>
          <CardDescription>
            Soporta los 5 tipos de preguntas estilo Moodle. Las respuestas correctas se aíslan en{" "}
            <code>question_answer_keys</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Pregunta</Label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="single_choice">Opción Múltiple (Única)</option>
                  <option value="multiple_choice">Opción Múltiple (Varias)</option>
                  <option value="true_false">Verdadero / Falso</option>
                  <option value="fill_blank">Completar Espacios</option>
                  <option value="open_ended">Respuesta Abierta (Manual)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dificultad</Label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="easy">Básica</option>
                  <option value="medium">Intermedia</option>
                  <option value="hard">Avanzada</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Puntaje</Label>
                <Input
                  type="number"
                  min={1}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Enunciado</Label>
              <Textarea
                required
                rows={2}
                placeholder="Escribí la consigna técnica..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {(questionType === "single_choice" || questionType === "multiple_choice") && (
              <div className="space-y-2.5 rounded-lg border border-border bg-secondary/30 p-3">
                <Input
                  required
                  placeholder="Opción A"
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                />
                <Input
                  required
                  placeholder="Opción B"
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                />
                <Input
                  placeholder="Opción C (opcional)"
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                />

                {questionType === "single_choice" ? (
                  <div className="flex items-center gap-3 pt-1 text-xs">
                    <span className="font-semibold">Correcta:</span>
                    {(["a", "b", "c"] as const).map((k) => (
                      <label key={k} className="flex items-center gap-1 uppercase">
                        <input
                          type="radio"
                          name="singleCorrect"
                          checked={singleCorrect === k}
                          onChange={() => setSingleCorrect(k)}
                        />
                        Opción {k}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-1 text-xs">
                    <span className="font-semibold">Correctas:</span>
                    {["a", "b", "c"].map((k) => (
                      <label key={k} className="flex items-center gap-1 uppercase">
                        <input
                          type="checkbox"
                          checked={multiCorrect.includes(k)}
                          onChange={() => toggleMulti(k)}
                        />
                        Opción {k}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {questionType === "true_false" && (
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={trueFalseCorrect}
                    onChange={() => setTrueFalseCorrect(true)}
                  />
                  Respuesta Correcta: Verdadero
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!trueFalseCorrect}
                    onChange={() => setTrueFalseCorrect(false)}
                  />
                  Respuesta Correcta: Falso
                </label>
              </div>
            )}

            {questionType === "fill_blank" && (
              <div className="space-y-1">
                <Label className="text-xs">Respuestas aceptadas (separadas por coma)</Label>
                <Input
                  required
                  placeholder="Ej. estabilizadores, patas estabilizadoras, gatos"
                  value={fillBlankAccepted}
                  onChange={(e) => setFillBlankAccepted(e.target.value)}
                />
              </div>
            )}

            {questionType === "open_ended" && (
              <div className="space-y-1">
                <Label className="text-xs">Rúbrica de corrección para el instructor</Label>
                <Textarea
                  rows={2}
                  placeholder="Criterios que debe mencionar el alumno..."
                  value={openRubric}
                  onChange={(e) => setOpenRubric(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Retroalimentación / Explicación (opcional)</Label>
              <Input
                placeholder="Explicación que verá el alumno tras entregar..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </div>

            {feedback && <p className="text-sm font-medium text-primary">{feedback}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar al Banco de Preguntas
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Preguntas en el Banco ({questions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay preguntas cargadas.</p>
          ) : (
            questions.map((q, idx) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <Badge variant="secondary">{q.question_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {q.points} pts • {q.difficulty}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{q.prompt}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(q.id)}
                  title="Eliminar pregunta"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

