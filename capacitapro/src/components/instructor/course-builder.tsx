"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import {
  createCourseAction,
  createLessonAction,
  createModuleAction,
  createQuestionWithKeyAction,
  gradeAssignmentSubmissionAction,
} from "@/actions/course.actions";
import { gradeOpenQuizAnswerAction } from "@/actions/quiz.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateCourseForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [shortDescription, setShortDescription] = React.useState("");
  const [category, setCategory] = React.useState("Maquinaria Pesada");
  const [level, setLevel] = React.useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [isSequential, setIsSequential] = React.useState(true);
  const [passingScore, setPassingScore] = React.useState(80);
  const [estimatedHours, setEstimatedHours] = React.useState(12);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createCourseAction({
      title,
      shortDescription,
      category,
      level,
      isSequential,
      passingScore,
      estimatedHours,
      xpReward: 500,
      status: "published",
    });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "No se pudo crear el curso.");
      return;
    }
    router.push(`/instructor/cursos/${res.data.id}/editar`);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo Curso Académico</CardTitle>
        <CardDescription>
          Creá el curso y automáticamente se generará su banco de preguntas asociado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Título del Curso</Label>
            <Input
              required
              placeholder="Ej. Operador de Autoelevador (Normativa SRT 960/15)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Descripción Breve</Label>
            <Textarea
              required
              placeholder="Objetivos prácticos y salida laboral..."
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nivel</Label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as "beginner" | "intermediate" | "advanced")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="beginner">Inicial</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Nota mínima de aprobación (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Carga horaria estimada (hs)</Label>
            <Input
              type="number"
              min={1}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={isSequential}
              onChange={(e) => setIsSequential(e.target.checked)}
            />
            Bloquear avance secuencial (correlatividad obligatoria entre módulos)
          </label>

          {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}

          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear Curso y Abrir Editor
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ModuleLessonCreator({
  courseId,
  modules,
  bankId,
}: {
  courseId: string;
  modules: Array<{ id: string; title: string; position: number }>;
  bankId: string | null;
}) {
  const router = useRouter();
  const [modTitle, setModTitle] = React.useState("");
  const [requiresQuizPass, setRequiresQuizPass] = React.useState(true);
  const [savingMod, setSavingMod] = React.useState(false);

  const [lessonModuleId, setLessonModuleId] = React.useState(modules[0]?.id ?? "");
  const [lessonTitle, setLessonTitle] = React.useState("");
  const [lessonType, setLessonType] = React.useState<"video" | "reading" | "document" | "quiz" | "assignment">("video");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [contentMarkdown, setContentMarkdown] = React.useState("");
  const [savingLesson, setSavingLesson] = React.useState(false);

  // Quick Question creator
  const [prompt, setPrompt] = React.useState("");
  const [optA, setOptA] = React.useState("");
  const [optB, setOptB] = React.useState("");
  const [correctOpt, setCorrectOpt] = React.useState<"a" | "b">("a");
  const [savingQ, setSavingQ] = React.useState(false);

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modTitle.trim()) return;
    setSavingMod(true);
    const prev = modules[modules.length - 1];
    await createModuleAction({
      courseId,
      title: modTitle.trim(),
      position: modules.length + 1,
      prerequisiteModuleId: prev?.id ?? null,
      requiresQuizPass,
    });
    setSavingMod(false);
    setModTitle("");
    router.refresh();
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonModuleId || !lessonTitle.trim()) return;
    setSavingLesson(true);
    await createLessonAction({
      moduleId: lessonModuleId,
      courseId,
      title: lessonTitle.trim(),
      lessonType,
      position: 10,
      durationMinutes: 15,
      xpReward: lessonType === "quiz" ? 150 : 60,
      isMandatory: true,
      videoUrl: lessonType === "video" ? videoUrl : null,
      contentMarkdown,
      assignmentInstructions: lessonType === "assignment" ? contentMarkdown : undefined,
    });
    setSavingLesson(false);
    setLessonTitle("");
    setVideoUrl("");
    setContentMarkdown("");
    router.refresh();
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankId || !prompt.trim() || !optA.trim() || !optB.trim()) return;
    setSavingQ(true);
    await createQuestionWithKeyAction({
      bankId,
      courseId,
      questionType: "single_choice",
      prompt: prompt.trim(),
      points: 20,
      difficulty: "medium",
      optionsPublic: [
        { id: "a", label: optA.trim() },
        { id: "b", label: optB.trim() },
      ],
      correctAnswer: { option_id: correctOpt },
    });
    setSavingQ(false);
    setPrompt("");
    setOptA("");
    setOptB("");
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Agregar Módulo / Unidad</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddModule} className="space-y-3">
            <Input
              placeholder="Ej. Módulo 3: Mantenimiento Preventivo"
              value={modTitle}
              onChange={(e) => setModTitle(e.target.value)}
              required
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={requiresQuizPass}
                onChange={(e) => setRequiresQuizPass(e.target.checked)}
              />
              Exigir examen aprobado para desbloquear el siguiente módulo
            </label>
            <Button type="submit" size="sm" disabled={savingMod}>
              {savingMod && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Agregar Módulo
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Agregar Lección / Evaluación</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddLesson} className="space-y-3">
            <select
              value={lessonModuleId}
              onChange={(e) => setLessonModuleId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Título de la lección"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                required
              />
              <select
                value={lessonType}
                onChange={(e) =>
                  setLessonType(
                    e.target.value as "video" | "reading" | "document" | "quiz" | "assignment"
                  )
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="video">Video</option>
                <option value="reading">Lectura (Markdown)</option>
                <option value="document">Documento PDF/PPT</option>
                <option value="quiz">Evaluación / Examen</option>
                <option value="assignment">Entrega de Tarea</option>
              </select>
            </div>
            {lessonType === "video" && (
              <Input
                placeholder="URL de YouTube / Vimeo embed"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            )}
            <Textarea
              placeholder="Contenido en Markdown o consigna de la tarea..."
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              rows={2}
            />
            <Button type="submit" size="sm" disabled={savingLesson || modules.length === 0}>
              {savingLesson && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Agregar Lección
            </Button>
          </form>
        </CardContent>
      </Card>

      {bankId && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">3. Agregar Pregunta al Banco del Curso</CardTitle>
            <CardDescription>
              La clave correcta se guarda aislada en <code>question_answer_keys</code> protegida por RLS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddQuestion} className="grid gap-3 md:grid-cols-2">
              <Input
                className="md:col-span-2"
                placeholder="Enunciado de la pregunta..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
              <Input placeholder="Opción A" value={optA} onChange={(e) => setOptA(e.target.value)} required />
              <Input placeholder="Opción B" value={optB} onChange={(e) => setOptB(e.target.value)} required />
              <select
                value={correctOpt}
                onChange={(e) => setCorrectOpt(e.target.value as "a" | "b")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="a">Respuesta Correcta: Opción A</option>
                <option value="b">Respuesta Correcta: Opción B</option>
              </select>
              <Button type="submit" disabled={savingQ}>
                {savingQ && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar en Banco de Preguntas
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function GradeSubmissionInline({
  type,
  id,
  maxPoints,
}: {
  type: "assignment" | "open_answer";
  id: string;
  maxPoints: number;
}) {
  const router = useRouter();
  const [score, setScore] = React.useState(maxPoints);
  const [feedback, setFeedback] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleGrade = async () => {
    setSaving(true);
    if (type === "assignment") {
      await gradeAssignmentSubmissionAction({
        submissionId: id,
        score,
        feedback,
        approve: score >= maxPoints * 0.6,
      });
    } else {
      await gradeOpenQuizAnswerAction({
        answerId: id,
        pointsAwarded: score,
        feedback,
      });
    }
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <Input
        type="number"
        min={0}
        max={maxPoints}
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
        className="w-24"
      />
      <Input
        placeholder="Devolución para el alumno..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className="min-w-[200px] flex-1"
      />
      <Button size="sm" onClick={handleGrade} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Calificar ({maxPoints} pts)
      </Button>
    </div>
  );
}

