"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { createQuestionWithKeyAction, deleteQuestionAction } from "@/actions/course.actions";
import { createQuestionBankAction, deleteQuestionBankAction } from "@/actions/quiz.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionDifficulty, QuestionPublic, QuestionType } from "@/types/database.types";

export interface QuestionBankItem {
  id: string;
  title: string;
  description: string | null;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Opción Múltiple (Única)",
  multiple_choice: "Opción Múltiple (Varias)",
  true_false: "Verdadero / Falso",
  fill_blank: "Completar Espacios",
  open_ended: "Respuesta Abierta",
};

export function QuestionBankManager({
  courseId,
  banks,
  questions,
}: {
  courseId: string;
  banks: QuestionBankItem[];
  questions: QuestionPublic[];
}) {
  const router = useRouter();
  const [selectedBankId, setSelectedBankId] = React.useState<string>(banks[0]?.id ?? "");
  const [filterBankId, setFilterBankId] = React.useState<string>("all");
  const [filterType, setFilterType] = React.useState<string>("all");

  // Create Bank form
  const [newBankTitle, setNewBankTitle] = React.useState("");
  const [newBankDesc, setNewBankDesc] = React.useState("");
  const [savingBank, setSavingBank] = React.useState(false);

  // Create Question form
  const [questionType, setQuestionType] = React.useState<QuestionType>("single_choice");
  const [prompt, setPrompt] = React.useState("");
  const [points, setPoints] = React.useState(20);
  const [difficulty, setDifficulty] = React.useState<QuestionDifficulty>("medium");
  const [explanation, setExplanation] = React.useState("");

  // Dynamic choice list (2 to 6 options)
  const [choices, setChoices] = React.useState<Array<{ id: string; label: string }>>([
    { id: "a", label: "" },
    { id: "b", label: "" },
    { id: "c", label: "" },
    { id: "d", label: "" },
  ]);
  const [singleCorrect, setSingleCorrect] = React.useState<string>("a");
  const [multiCorrect, setMultiCorrect] = React.useState<string[]>(["a"]);
  const [trueFalseCorrect, setTrueFalseCorrect] = React.useState<boolean>(true);
  const [fillBlankAccepted, setFillBlankAccepted] = React.useState("");
  const [openRubric, setOpenRubric] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ text: string; isError?: boolean } | null>(null);

  React.useEffect(() => {
    if (!selectedBankId && banks.length > 0) {
      setSelectedBankId(banks[0].id);
    }
  }, [banks, selectedBankId]);

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankTitle.trim()) return;
    setSavingBank(true);
    setFeedback(null);
    const res = await createQuestionBankAction({
      courseId,
      title: newBankTitle.trim(),
      description: newBankDesc.trim() || undefined,
    });
    setSavingBank(false);
    if (!res.success || !res.data) {
      setFeedback({ text: res.error ?? "No se pudo crear el banco.", isError: true });
      return;
    }
    setNewBankTitle("");
    setNewBankDesc("");
    setSelectedBankId(res.data.id);
    setFeedback({ text: "Nuevo banco de preguntas creado." });
    router.refresh();
  };

  const handleDeleteBank = async (bank: QuestionBankItem) => {
    if (
      !window.confirm(
        `¿Eliminar el banco "${bank.title}" y todas las preguntas que contiene?`
      )
    )
      return;
    const res = await deleteQuestionBankAction({ bankId: bank.id, courseId });
    if (!res.success) {
      setFeedback({ text: res.error ?? "Error eliminando banco.", isError: true });
    } else {
      setFeedback({ text: "Banco eliminado." });
      router.refresh();
    }
  };

  const addChoiceSlot = () => {
    if (choices.length >= 6) return;
    const nextLetter = String.fromCharCode(97 + choices.length);
    setChoices((prev) => [...prev, { id: nextLetter, label: "" }]);
  };

  const removeChoiceSlot = (id: string) => {
    if (choices.length <= 2) return;
    setChoices((prev) => prev.filter((c) => c.id !== id));
    setMultiCorrect((prev) => prev.filter((x) => x !== id));
    if (singleCorrect === id) setSingleCorrect(choices[0]?.id ?? "a");
  };

  const toggleMulti = (id: string) => {
    setMultiCorrect((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankId) {
      setFeedback({ text: "Primero creá o seleccioná un banco de preguntas.", isError: true });
      return;
    }

    setSaving(true);
    setFeedback(null);

    let optionsPublic: unknown = [];
    let correctAnswer: unknown = {};

    if (questionType === "single_choice" || questionType === "multiple_choice") {
      const filled = choices
        .map((c) => ({ id: c.id, label: c.label.trim() }))
        .filter((c) => c.label.length > 0);

      if (filled.length < 2) {
        setSaving(false);
        setFeedback({ text: "Cargá al menos 2 opciones de respuesta.", isError: true });
        return;
      }

      optionsPublic = filled;
      if (questionType === "single_choice") {
        const validCorrect = filled.some((c) => c.id === singleCorrect)
          ? singleCorrect
          : filled[0].id;
        correctAnswer = { option_id: validCorrect };
      } else {
        const validMulti = multiCorrect.filter((id) => filled.some((c) => c.id === id));
        if (validMulti.length === 0) {
          setSaving(false);
          setFeedback({ text: "Marcá al menos una opción correcta.", isError: true });
          return;
        }
        correctAnswer = { option_ids: validMulti };
      }
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
      if (variants.length === 0) {
        setSaving(false);
        setFeedback({ text: "Ingresá al menos una palabra aceptada.", isError: true });
        return;
      }
      correctAnswer = { accepted: [variants] };
    } else if (questionType === "open_ended") {
      optionsPublic = { min_chars: 20 };
      correctAnswer = { rubric: openRubric.trim() || "Evaluación manual por el instructor." };
    }

    const res = await createQuestionWithKeyAction({
      bankId: selectedBankId,
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
      setFeedback({ text: res.error ?? "No se pudo guardar la pregunta.", isError: true });
      return;
    }

    setPrompt("");
    setChoices([
      { id: "a", label: "" },
      { id: "b", label: "" },
      { id: "c", label: "" },
      { id: "d", label: "" },
    ]);
    setFillBlankAccepted("");
    setOpenRubric("");
    setExplanation("");
    setFeedback({ text: "Pregunta guardada en el banco con clave protegida por RLS." });
    router.refresh();
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm("¿Eliminar esta pregunta del banco?")) return;
    await deleteQuestionAction({ questionId, courseId });
    router.refresh();
  };

  const bankNameMap = new Map(banks.map((b) => [b.id, b.title]));
  const filteredQuestions = questions.filter((q) => {
    if (filterBankId !== "all" && q.bank_id !== filterBankId) return false;
    if (filterType !== "all" && q.question_type !== filterType) return false;
    return true;
  });

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

      {/* 1. Gestión de Bancos de Preguntas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="h-5 w-5 text-primary" />
            Bancos de Preguntas del Curso ({banks.length})
          </CardTitle>
          <CardDescription>
            Organizá tus preguntas por unidad temática para generar exámenes aleatorios desde cualquier banco.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateBank} className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Ej. Banco Módulo 2: Hidráulica y Estabilidad"
              value={newBankTitle}
              onChange={(e) => setNewBankTitle(e.target.value)}
              required
            />
            <Input
              placeholder="Descripción breve (opcional)"
              value={newBankDesc}
              onChange={(e) => setNewBankDesc(e.target.value)}
            />
            <Button type="submit" disabled={savingBank}>
              {savingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear Banco
            </Button>
          </form>

          {banks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {banks.map((bank) => {
                const count = questions.filter((q) => q.bank_id === bank.id).length;
                return (
                  <div
                    key={bank.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs"
                  >
                    <span className="font-semibold">{bank.title}</span>
                    <Badge variant="outline">{count} preg.</Badge>
                    {banks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBank(bank)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Eliminar banco"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Creador de Preguntas (5 tipos) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Agregar Pregunta al Banco
          </CardTitle>
          <CardDescription>
            Las respuestas correctas se almacenan aisladas en <code>question_answer_keys</code> y nunca se envían al navegador del alumno.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateQuestion} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Banco Destino</Label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
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
              <Label className="text-xs">Enunciado de la Pregunta</Label>
              <Textarea
                required
                rows={2}
                placeholder="Escribí la consigna técnica..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {(questionType === "single_choice" || questionType === "multiple_choice") && (
              <div className="space-y-2.5 rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    Opciones de Respuesta (marcá{" "}
                    {questionType === "single_choice" ? "la correcta" : "todas las correctas"})
                  </span>
                  {choices.length < 6 && (
                    <Button type="button" variant="outline" size="sm" onClick={addChoiceSlot}>
                      <Plus className="h-3.5 w-3.5" /> Opción
                    </Button>
                  )}
                </div>

                {choices.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    {questionType === "single_choice" ? (
                      <input
                        type="radio"
                        name="singleCorrect"
                        checked={singleCorrect === c.id}
                        onChange={() => setSingleCorrect(c.id)}
                        title="Marcar como respuesta correcta"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={multiCorrect.includes(c.id)}
                        onChange={() => toggleMulti(c.id)}
                        title="Marcar como respuesta correcta"
                      />
                    )}
                    <span className="w-6 text-xs font-bold uppercase text-muted-foreground">
                      {c.id})
                    </span>
                    <Input
                      placeholder={`Texto de la opción ${c.id.toUpperCase()}`}
                      value={c.label}
                      onChange={(e) =>
                        setChoices((prev) =>
                          prev.map((item) =>
                            item.id === c.id ? { ...item, label: e.target.value } : item
                          )
                        )
                      }
                    />
                    {choices.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeChoiceSlot(c.id)}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {questionType === "true_false" && (
              <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-secondary/30 p-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="radio"
                    checked={trueFalseCorrect}
                    onChange={() => setTrueFalseCorrect(true)}
                  />
                  Respuesta Correcta: Verdadero
                </label>
                <label className="flex cursor-pointer items-center gap-2 font-medium">
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
                <Label className="text-xs">Rúbrica de evaluación para el instructor</Label>
                <Textarea
                  rows={2}
                  placeholder="Criterios que debe incluir el alumno para aprobar..."
                  value={openRubric}
                  onChange={(e) => setOpenRubric(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Retroalimentación / Explicación (opcional)</Label>
              <Input
                placeholder="Explicación que verá el alumno al finalizar el intento..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={saving || banks.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Guardar Pregunta en el Banco
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 3. Listado Filtrable de Preguntas */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Preguntas Cargadas ({filteredQuestions.length})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterBankId}
              onChange={(e) => setFilterBankId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">Todos los bancos</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">Todos los tipos</option>
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {filteredQuestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay preguntas con el filtro actual.
            </p>
          ) : (
            filteredQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <Badge variant="secondary">{QUESTION_TYPE_LABELS[q.question_type]}</Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {bankNameMap.get(q.bank_id) ?? "Banco"}
                    </Badge>
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
                  onClick={() => handleDeleteQuestion(q.id)}
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
