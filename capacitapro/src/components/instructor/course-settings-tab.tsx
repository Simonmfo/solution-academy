"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, CheckCircle2, Loader2, Lock, Save, ShieldCheck } from "lucide-react";
import { updateCourseAction } from "@/actions/course.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Course, CourseLevel, CourseStatus } from "@/types/database.types";

export function CourseSettingsTab({ course }: { course: Course }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(course.title);
  const [shortDescription, setShortDescription] = React.useState(course.short_description ?? "");
  const [description, setDescription] = React.useState(course.description ?? "");
  const [category, setCategory] = React.useState(course.category);
  const [level, setLevel] = React.useState<CourseLevel>(course.level);
  const [status, setStatus] = React.useState<CourseStatus>(course.status);
  const [isSequential, setIsSequential] = React.useState(course.is_sequential);
  const [passingScore, setPassingScore] = React.useState(Number(course.passing_score));
  const [estimatedHours, setEstimatedHours] = React.useState(Number(course.estimated_hours));
  const [xpReward, setXpReward] = React.useState(course.xp_reward);
  const [certificateEnabled, setCertificateEnabled] = React.useState(course.certificate_enabled);
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const res = await updateCourseAction({
      courseId: course.id,
      title,
      shortDescription,
      description,
      category,
      level,
      status,
      isSequential,
      passingScore,
      estimatedHours,
      xpReward,
      certificateEnabled,
    });

    setSaving(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "Error al guardar los cambios.", isError: true });
      return;
    }

    setFeedback({ text: "Configuración y reglas de correlatividad guardadas correctamente." });
    router.refresh();
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium ${
            feedback.isError
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Correlativity & Approval Rules */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Reglas de Correlatividad y Aprobación
          </CardTitle>
          <CardDescription>
            Estas reglas se aplican en tiempo real tanto en el Modo Focus como a nivel RLS en PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4 text-primary" />
                <span>Bloqueo Secuencial entre Módulos</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Si está activo, el alumno no podrá acceder al Módulo 2 hasta completar todas las
                lecciones obligatorias del Módulo 1 (y aprobar su examen si el módulo lo exige).
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={isSequential}
                onChange={(e) => setIsSequential(e.target.checked)}
                className="h-5 w-5 accent-primary"
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="passingScore">Porcentaje Mínimo de Aprobación</Label>
                <span className="rounded-md bg-primary/15 px-2.5 py-0.5 text-sm font-bold text-primary">
                  {passingScore}%
                </span>
              </div>
              <input
                id="passingScore"
                type="range"
                min={50}
                max={100}
                step={5}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Nota mínima requerida por defecto para aprobar exámenes nuevos y emitir el certificado.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Award className="h-4 w-4 text-emerald-600" />
                  <span>Emisión Automática de Diploma PDF + QR</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Emite certificado verificable al llegar al 100% de progreso y aprobar el examen final.
                </p>
              </div>
              <input
                type="checkbox"
                checked={certificateEnabled}
                onChange={(e) => setCertificateEnabled(e.target.checked)}
                className="mt-1 h-5 w-5 accent-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Course Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Información General del Curso</CardTitle>
          <CardDescription>Datos visibles para alumnos, RRHH y diplomas emitidos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="course-title">Título del Curso</Label>
            <Input
              id="course-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="course-short">Descripción Breve (tarjetas)</Label>
            <Input
              id="course-short"
              required
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="course-desc">Descripción Completa</Label>
            <Textarea
              id="course-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-cat">Categoría</Label>
            <Input
              id="course-cat"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-level">Nivel</Label>
            <select
              id="course-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as CourseLevel)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="beginner">Inicial</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-status">Estado de Publicación</Label>
            <select
              id="course-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="draft">Borrador (Oculto)</option>
              <option value="published">Publicado (Activo)</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="course-hours">Horas (Diploma)</Label>
              <Input
                id="course-hours"
                type="number"
                step="0.5"
                min={0.5}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-xp">Recompensa XP</Label>
              <Input
                id="course-xp"
                type="number"
                min={50}
                step={50}
                value={xpReward}
                onChange={(e) => setXpReward(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar Cambios del Curso
        </Button>
      </div>
    </form>
  );
}

