"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  FileText,
  GripVertical,
  Loader2,
  Lock,
  PlayCircle,
  Plus,
  Save,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createLessonAction,
  createModuleAction,
  deleteLessonAction,
  deleteLessonResourceAction,
  deleteModuleAction,
  registerLessonResourceAction,
  reorderLessonsAction,
  reorderModulesAction,
  updateLessonAction,
  updateModuleAction,
  updateQuizConfigAction,
} from "@/actions/course.actions";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  Lesson,
  LessonResource,
  LessonType,
  Module,
  Quiz,
  QuizFeedbackMode,
} from "@/types/database.types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function LessonTypeIcon({ type }: { type: LessonType }) {
  switch (type) {
    case "video":
      return <PlayCircle className="h-4 w-4 text-primary" />;
    case "quiz":
      return <ClipboardList className="h-4 w-4 text-amber-500" />;
    case "assignment":
      return <Upload className="h-4 w-4 text-indigo-500" />;
    default:
      return <FileText className="h-4 w-4 text-emerald-600" />;
  }
}

export function CurriculumEditor({
  courseId,
  initialModules,
  initialLessons,
  initialResources,
  initialQuizzes,
}: {
  courseId: string;
  initialModules: Module[];
  initialLessons: Lesson[];
  initialResources: LessonResource[];
  initialQuizzes: Quiz[];
}) {
  const router = useRouter();
  const [modules, setModules] = React.useState<Module[]>(initialModules);
  const [lessons, setLessons] = React.useState<Lesson[]>(initialLessons);
  const [resources, setResources] = React.useState<LessonResource[]>(initialResources);
  const [quizzes, setQuizzes] = React.useState<Quiz[]>(initialQuizzes);

  React.useEffect(() => {
    setModules(initialModules);
    setLessons(initialLessons);
    setResources(initialResources);
    setQuizzes(initialQuizzes);
  }, [initialModules, initialLessons, initialResources, initialQuizzes]);

  const [expandedModuleId, setExpandedModuleId] = React.useState<string | null>(null);
  const [expandedLessonId, setExpandedLessonId] = React.useState<string | null>(null);
  const [addingLessonToModuleId, setAddingLessonToModuleId] = React.useState<string | null>(null);

  // Drag & Drop state
  const [draggedModuleId, setDraggedModuleId] = React.useState<string | null>(null);
  const [draggedLesson, setDraggedLesson] = React.useState<{
    lessonId: string;
    moduleId: string;
  } | null>(null);

  const [busyMessage, setBusyMessage] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ text: string; isError?: boolean } | null>(null);

  // New module form
  const [newModTitle, setNewModTitle] = React.useState("");
  const [newModRequiresQuiz, setNewModRequiresQuiz] = React.useState(true);
  const [creatingMod, setCreatingMod] = React.useState(false);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  // --- REORDER MODULES (Buttons + Drag & Drop) ---
  const commitModuleOrder = async (nextModules: Module[]) => {
    setModules(nextModules);
    setBusyMessage("Guardando orden de módulos...");
    const res = await reorderModulesAction({
      courseId,
      orderedModuleIds: nextModules.map((m) => m.id),
    });
    setBusyMessage(null);
    if (!res.success) {
      showToast(res.error ?? "No se pudo reordenar los módulos.", true);
      router.refresh();
    } else {
      showToast("Orden de módulos actualizado.");
      router.refresh();
    }
  };

  const moveModule = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    const copy = [...modules];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    void commitModuleOrder(copy);
  };

  const handleModuleDrop = (targetModuleId: string) => {
    if (!draggedModuleId || draggedModuleId === targetModuleId) {
      setDraggedModuleId(null);
      return;
    }
    const fromIdx = modules.findIndex((m) => m.id === draggedModuleId);
    const toIdx = modules.findIndex((m) => m.id === targetModuleId);
    if (fromIdx === -1 || toIdx === -1) return;
    const copy = [...modules];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setDraggedModuleId(null);
    void commitModuleOrder(copy);
  };

  // --- REORDER LESSONS (Buttons + Drag & Drop) ---
  const commitLessonOrder = async (moduleId: string, orderedModuleLessons: Lesson[]) => {
    const others = lessons.filter((l) => l.module_id !== moduleId);
    const updatedForModule = orderedModuleLessons.map((l, idx) => ({
      ...l,
      module_id: moduleId,
      position: idx + 1,
    }));
    setLessons([...others, ...updatedForModule]);

    setBusyMessage("Guardando orden de lecciones...");
    const res = await reorderLessonsAction({
      courseId,
      moduleId,
      orderedLessonIds: orderedModuleLessons.map((l) => l.id),
    });
    setBusyMessage(null);
    if (!res.success) {
      showToast(res.error ?? "No se pudo guardar el orden de lecciones.", true);
      router.refresh();
    } else {
      showToast("Orden de lecciones guardado.");
      router.refresh();
    }
  };

  const moveLesson = (moduleId: string, index: number, direction: -1 | 1) => {
    const modLessons = lessons
      .filter((l) => l.module_id === moduleId)
      .sort((a, b) => a.position - b.position);
    const target = index + direction;
    if (target < 0 || target >= modLessons.length) return;
    const copy = [...modLessons];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    void commitLessonOrder(moduleId, copy);
  };

  const handleLessonDrop = (targetModuleId: string, targetLessonId: string) => {
    if (!draggedLesson || draggedLesson.lessonId === targetLessonId) {
      setDraggedLesson(null);
      return;
    }
    const draggedObj = lessons.find((l) => l.id === draggedLesson.lessonId);
    if (!draggedObj) {
      setDraggedLesson(null);
      return;
    }

    const targetList = lessons
      .filter((l) => l.module_id === targetModuleId && l.id !== draggedObj.id)
      .sort((a, b) => a.position - b.position);
    const targetIdx = targetList.findIndex((l) => l.id === targetLessonId);
    targetList.splice(targetIdx === -1 ? targetList.length : targetIdx, 0, draggedObj);
    setDraggedLesson(null);
    void commitLessonOrder(targetModuleId, targetList);
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModTitle.trim()) return;
    setCreatingMod(true);
    const prevMod = modules[modules.length - 1];
    const res = await createModuleAction({
      courseId,
      title: newModTitle.trim(),
      position: modules.length + 1,
      prerequisiteModuleId: prevMod?.id ?? null,
      requiresQuizPass: newModRequiresQuiz,
    });
    setCreatingMod(false);
    if (!res.success) {
      showToast(res.error ?? "Error al crear módulo.", true);
      return;
    }
    setNewModTitle("");
    showToast("Módulo agregado.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {(toast || busyMessage) && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium ${
            toast?.isError
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            {busyMessage && <Loader2 className="h-4 w-4 animate-spin" />}
            {busyMessage ?? toast?.text}
          </span>
        </div>
      )}

      {/* Module List with Drag & Drop + Reorder Controls */}
      <div className="space-y-4">
        {modules.map((mod, modIdx) => {
          const modLessons = lessons
            .filter((l) => l.module_id === mod.id)
            .sort((a, b) => a.position - b.position);
          const prereqMod = modules.find((m) => m.id === mod.prerequisite_module_id);
          const isModExpanded = expandedModuleId === mod.id;

          return (
            <Card
              key={mod.id}
              draggable
              onDragStart={(e) => {
                if ((e.target as HTMLElement).closest("[data-lesson-item]")) return;
                setDraggedModuleId(mod.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedModuleId) handleModuleDrop(mod.id);
              }}
              className={`transition-all ${
                draggedModuleId === mod.id ? "opacity-50 ring-2 ring-primary" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      title="Arrastrá para reordenar el módulo"
                      className="cursor-grab text-muted-foreground hover:text-foreground"
                    >
                      <GripVertical className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Módulo {modIdx + 1}</Badge>
                        {mod.requires_quiz_pass && (
                          <Badge variant="warning">
                            <Lock className="h-3 w-3" /> Exige aprobar examen
                          </Badge>
                        )}
                        {prereqMod && (
                          <Badge variant="secondary" className="max-w-[220px] truncate">
                            Req: {prereqMod.title}
                          </Badge>
                        )}
                        {!mod.is_published && <Badge variant="destructive">Oculto</Badge>}
                      </div>
                      <CardTitle className="mt-1.5 text-base">{mod.title}</CardTitle>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={modIdx === 0}
                      onClick={() => moveModule(modIdx, -1)}
                      title="Subir módulo"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={modIdx === modules.length - 1}
                      onClick={() => moveModule(modIdx, 1)}
                      title="Bajar módulo"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedModuleId(isModExpanded ? null : mod.id)
                      }
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Reglas
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setAddingLessonToModuleId(
                          addingLessonToModuleId === mod.id ? null : mod.id
                        )
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Lección
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Inline Module Settings & Correlativity Editor */}
                {isModExpanded && (
                  <ModuleInlineSettings
                    courseId={courseId}
                    moduleItem={mod}
                    allModules={modules}
                    onSaved={() => {
                      setExpandedModuleId(null);
                      showToast("Reglas del módulo actualizadas.");
                      router.refresh();
                    }}
                    onDeleted={() => {
                      setExpandedModuleId(null);
                      showToast("Módulo eliminado.");
                      router.refresh();
                    }}
                    onError={(err) => showToast(err, true)}
                  />
                )}

                {/* Quick Add Lesson Form inside this Module */}
                {addingLessonToModuleId === mod.id && (
                  <AddLessonInlineForm
                    courseId={courseId}
                    moduleId={mod.id}
                    nextPosition={modLessons.length + 1}
                    onCreated={() => {
                      setAddingLessonToModuleId(null);
                      showToast("Lección creada correctamente.");
                      router.refresh();
                    }}
                    onCancel={() => setAddingLessonToModuleId(null)}
                    onError={(err) => showToast(err, true)}
                  />
                )}

                {/* Lessons inside this Module */}
                {modLessons.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-muted-foreground">
                    Este módulo todavía no tiene lecciones. Hacé clic en &quot;+ Lección&quot; para agregar una.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {modLessons.map((lesson, lIdx) => {
                      const lessonRes = resources.filter((r) => r.lesson_id === lesson.id);
                      const lessonQuiz = quizzes.find((q) => q.lesson_id === lesson.id) ?? null;
                      const isLessonExpanded = expandedLessonId === lesson.id;

                      return (
                        <div
                          key={lesson.id}
                          data-lesson-item
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedLesson({ lessonId: lesson.id, moduleId: mod.id });
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.stopPropagation();
                            if (draggedLesson) handleLessonDrop(mod.id, lesson.id);
                          }}
                          className={`rounded-lg border border-border bg-background transition-all ${
                            draggedLesson?.lessonId === lesson.id ? "opacity-50 ring-2 ring-primary" : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                              <LessonTypeIcon type={lesson.lesson_type} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{lesson.title}</p>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                  <span>{lesson.lesson_type}</span>
                                  <span>• {lesson.duration_minutes} min</span>
                                  <span>• +{lesson.xp_reward} XP</span>
                                  {lessonRes.length > 0 && (
                                    <span className="font-semibold text-primary">
                                      • {lessonRes.length} archivo(s) privado(s)
                                    </span>
                                  )}
                                  {lessonQuiz && (
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      • Aprobación {lessonQuiz.passing_score_percent}%
                                      {lessonQuiz.is_final_exam ? " (Final)" : ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={lIdx === 0}
                                onClick={() => moveLesson(mod.id, lIdx, -1)}
                                title="Subir lección"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={lIdx === modLessons.length - 1}
                                onClick={() => moveLesson(mod.id, lIdx, 1)}
                                title="Bajar lección"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setExpandedLessonId(isLessonExpanded ? null : lesson.id)
                                }
                              >
                                {isLessonExpanded ? (
                                  <>
                                    <ChevronUp className="h-3.5 w-3.5" /> Cerrar
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3.5 w-3.5" /> Editar / PDFs
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {isLessonExpanded && (
                            <LessonInlineEditor
                              courseId={courseId}
                              lesson={lesson}
                              resources={lessonRes}
                              quiz={lessonQuiz}
                              onSaved={(msg) => {
                                showToast(msg);
                                router.refresh();
                              }}
                              onDeleted={() => {
                                setExpandedLessonId(null);
                                showToast("Lección eliminada.");
                                router.refresh();
                              }}
                              onError={(err) => showToast(err, true)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add New Module Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Agregar Nuevo Módulo / Unidad</CardTitle>
          <CardDescription>
            Podés reordenarlos después arrastrando desde el ícono ⋮⋮ o con las flechas ↑ / ↓.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateModule} className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="Ej. Módulo 3: Mantenimiento Hidráulico Preventivo"
                value={newModTitle}
                onChange={(e) => setNewModTitle(e.target.value)}
                required
              />
              <Button type="submit" disabled={creatingMod} className="shrink-0">
                {creatingMod ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Agregar Módulo
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={newModRequiresQuiz}
                onChange={(e) => setNewModRequiresQuiz(e.target.checked)}
              />
              Exigir aprobar el examen de este módulo para desbloquear el siguiente
            </label>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENT: MODULE INLINE CORRELATIVITY & SETTINGS EDITOR
// ============================================================================
function ModuleInlineSettings({
  courseId,
  moduleItem,
  allModules,
  onSaved,
  onDeleted,
  onError,
}: {
  courseId: string;
  moduleItem: Module;
  allModules: Module[];
  onSaved: () => void;
  onDeleted: () => void;
  onError: (err: string) => void;
}) {
  const [title, setTitle] = React.useState(moduleItem.title);
  const [description, setDescription] = React.useState(moduleItem.description ?? "");
  const [prereqId, setPrereqId] = React.useState(moduleItem.prerequisite_module_id ?? "");
  const [requiresQuizPass, setRequiresQuizPass] = React.useState(moduleItem.requires_quiz_pass);
  const [isPublished, setIsPublished] = React.useState(moduleItem.is_published);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateModuleAction({
      moduleId: moduleItem.id,
      courseId,
      title,
      description,
      prerequisiteModuleId: prereqId || null,
      requiresQuizPass,
      isPublished,
    });
    setSaving(false);
    if (!res.success) {
      onError(res.error ?? "No se pudo actualizar el módulo.");
      return;
    }
    onSaved();
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar el módulo "${moduleItem.title}" y todas sus lecciones?`)) return;
    setSaving(true);
    const res = await deleteModuleAction({ moduleId: moduleItem.id, courseId });
    setSaving(false);
    if (!res.success) {
      onError(res.error ?? "Error al eliminar el módulo.");
      return;
    }
    onDeleted();
  };

  return (
    <form
      onSubmit={handleSave}
      className="space-y-3 rounded-xl border border-primary/25 bg-secondary/40 p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Título del Módulo</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Módulo Prerrequisito (Correlatividad)</Label>
          <select
            value={prereqId}
            onChange={(e) => setPrereqId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Automático (según orden secuencial del curso)</option>
            {allModules
              .filter((m) => m.id !== moduleItem.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  Requiere completar: {m.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Descripción (opcional)</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Resumen de objetivos de esta unidad..."
        />
      </div>

      <div className="flex flex-wrap items-center gap-5 text-xs">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={requiresQuizPass}
            onChange={(e) => setRequiresQuizPass(e.target.checked)}
          />
          Exigir aprobar el examen del módulo para avanzar
        </label>
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Módulo publicado (visible para alumnos)
        </label>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
          <Trash2 className="h-3.5 w-3.5" /> Eliminar Módulo
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar Reglas
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// SUBCOMPONENT: ADD LESSON INLINE FORM
// ============================================================================
function AddLessonInlineForm({
  courseId,
  moduleId,
  nextPosition,
  onCreated,
  onCancel,
  onError,
}: {
  courseId: string;
  moduleId: string;
  nextPosition: number;
  onCreated: () => void;
  onCancel: () => void;
  onError: (err: string) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [lessonType, setLessonType] = React.useState<LessonType>("video");
  const [duration, setDuration] = React.useState(15);
  const [videoUrl, setVideoUrl] = React.useState("");
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await createLessonAction({
      moduleId,
      courseId,
      title: title.trim(),
      lessonType,
      position: nextPosition,
      durationMinutes: duration,
      xpReward: lessonType === "quiz" ? 150 : 60,
      isMandatory: true,
      videoUrl: lessonType === "video" ? videoUrl : null,
      contentMarkdown: content,
      assignmentInstructions: lessonType === "assignment" ? content : undefined,
    });
    setSaving(false);
    if (!res.success) {
      onError(res.error ?? "No se pudo crear la lección.");
      return;
    }
    onCreated();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Nueva Lección</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          className="sm:col-span-2"
          placeholder="Título de la lección o evaluación"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <select
          value={lessonType}
          onChange={(e) => setLessonType(e.target.value as LessonType)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="video">Video</option>
          <option value="reading">Lectura (Markdown)</option>
          <option value="document">Documento PDF / PPT</option>
          <option value="quiz">Evaluación / Examen</option>
          <option value="assignment">Entrega de Tarea</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {lessonType === "video" && (
          <Input
            className="sm:col-span-2"
            placeholder="URL de YouTube / Vimeo embed (https://...)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        )}
        <Input
          type="number"
          min={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          placeholder="Duración (min)"
        />
      </div>

      <Textarea
        rows={2}
        placeholder="Contenido Markdown, resumen de clase o consigna de la tarea..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Crear Lección
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// SUBCOMPONENT: LESSON INLINE EDITOR + PRIVATE PDF UPLOADER + QUIZ CONFIG
// ============================================================================
function LessonInlineEditor({
  courseId,
  lesson,
  resources,
  quiz,
  onSaved,
  onDeleted,
  onError,
}: {
  courseId: string;
  lesson: Lesson;
  resources: LessonResource[];
  quiz: Quiz | null;
  onSaved: (msg: string) => void;
  onDeleted: () => void;
  onError: (err: string) => void;
}) {
  const [title, setTitle] = React.useState(lesson.title);
  const [lessonType, setLessonType] = React.useState<LessonType>(lesson.lesson_type);
  const [duration, setDuration] = React.useState(lesson.duration_minutes);
  const [xpReward, setXpReward] = React.useState(lesson.xp_reward);
  const [isMandatory, setIsMandatory] = React.useState(lesson.is_mandatory);
  const [isPublished, setIsPublished] = React.useState(lesson.is_published);
  const [videoUrl, setVideoUrl] = React.useState(lesson.video_url ?? "");
  const [contentMarkdown, setContentMarkdown] = React.useState(lesson.content_markdown ?? "");
  const [assignmentInstructions, setAssignmentInstructions] = React.useState(
    lesson.assignment_instructions ?? ""
  );
  const [saving, setSaving] = React.useState(false);

  // Private PDF Upload state
  const [resourceTitle, setResourceTitle] = React.useState("");
  const [uploadingPdf, setUploadingPdf] = React.useState(false);

  // Quiz config state (when lesson_type === 'quiz')
  const [quizPassing, setQuizPassing] = React.useState(Number(quiz?.passing_score_percent ?? 80));
  const [quizTimeLimit, setQuizTimeLimit] = React.useState(quiz?.time_limit_minutes ?? 20);
  const [quizMaxAttempts, setQuizMaxAttempts] = React.useState(quiz?.max_attempts ?? 3);
  const [quizIsFinal, setQuizIsFinal] = React.useState(quiz?.is_final_exam ?? false);
  const [quizRandomCount, setQuizRandomCount] = React.useState(
    quiz?.random_question_count ? String(quiz.random_question_count) : ""
  );
  const [quizFeedbackMode, setQuizFeedbackMode] = React.useState<QuizFeedbackMode>(
    quiz?.feedback_mode ?? "after_submit"
  );

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateLessonAction({
      lessonId: lesson.id,
      courseId,
      title,
      lessonType,
      durationMinutes: duration,
      xpReward,
      isMandatory,
      isPublished,
      videoUrl: lessonType === "video" ? videoUrl : null,
      contentMarkdown,
      assignmentInstructions: lessonType === "assignment" ? assignmentInstructions : null,
    });

    if (!res.success) {
      setSaving(false);
      onError(res.error ?? "Error al guardar la lección.");
      return;
    }

    if (quiz && lessonType === "quiz") {
      const qRes = await updateQuizConfigAction({
        quizId: quiz.id,
        courseId,
        title,
        isFinalExam: quizIsFinal,
        timeLimitMinutes: quizTimeLimit > 0 ? quizTimeLimit : null,
        maxAttempts: quizMaxAttempts,
        passingScorePercent: quizPassing,
        randomQuestionCount: quizRandomCount ? Number(quizRandomCount) : null,
        shuffleQuestions: true,
        feedbackMode: quizFeedbackMode,
      });
      if (!qRes.success) {
        setSaving(false);
        onError(qRes.error ?? "Lección guardada, pero falló la configuración del examen.");
        return;
      }
    }

    setSaving(false);
    onSaved("Lección actualizada correctamente.");
  };

  const handleUploadPrivateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdf(true);
    try {
      // 1. Solicitar Signed Upload URL verificada por servidor (evita límite 4.5MB de Vercel)
      const signResp = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId: lesson.id,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
        }),
      });

      const signData = (await signResp.json()) as {
        storagePath?: string;
        token?: string;
        error?: string;
      };

      if (!signResp.ok || !signData.storagePath || !signData.token) {
        onError(signData.error ?? "No se pudo autorizar la subida al bucket privado.");
        setUploadingPdf(false);
        return;
      }

      // 2. Subir archivo directo a Supabase Storage (bucket privado `lesson-materials`)
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("lesson-materials")
        .uploadToSignedUrl(signData.storagePath, signData.token, file, {
          contentType: file.type || "application/pdf",
        });

      if (uploadErr) {
        onError(`Error subiendo a Storage: ${uploadErr.message}`);
        setUploadingPdf(false);
        return;
      }

      // 3. Registrar metadatos en public.lesson_resources
      const regRes = await registerLessonResourceAction({
        lessonId: lesson.id,
        courseId,
        title: resourceTitle.trim() || file.name,
        storagePath: signData.storagePath,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        fileSizeBytes: file.size,
      });

      if (!regRes.success) {
        onError(regRes.error ?? "El archivo subió pero falló el registro en base de datos.");
      } else {
        setResourceTitle("");
        onSaved(`Archivo "${file.name}" subido al bucket privado.`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error inesperado al subir el archivo.");
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  };

  const handlePreviewResource = async (storagePath: string) => {
    const resp = await fetch("/api/storage/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket: "lesson-materials", path: storagePath }),
    });
    if (resp.ok) {
      const { signedUrl } = (await resp.json()) as { signedUrl: string };
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } else {
      onError("No se pudo generar la URL firmada de previsualización.");
    }
  };

  const handleDeleteResource = async (r: LessonResource) => {
    if (!window.confirm(`¿Eliminar el archivo "${r.title}" del bucket privado?`)) return;
    const res = await deleteLessonResourceAction({
      resourceId: r.id,
      courseId,
      storagePath: r.storage_path,
    });
    if (!res.success) {
      onError(res.error ?? "Error al eliminar el recurso.");
    } else {
      onSaved("Archivo eliminado.");
    }
  };

  const handleDeleteLesson = async () => {
    if (!window.confirm(`¿Eliminar la lección "${lesson.title}"?`)) return;
    setSaving(true);
    const res = await deleteLessonAction({ lessonId: lesson.id, courseId });
    setSaving(false);
    if (!res.success) {
      onError(res.error ?? "Error al eliminar la lección.");
    } else {
      onDeleted();
    }
  };

  return (
    <div className="space-y-5 border-t border-border bg-secondary/20 p-4">
      <form onSubmit={handleSaveLesson} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Lección</Label>
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value as LessonType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="video">Video</option>
              <option value="reading">Lectura (Markdown)</option>
              <option value="document">Documento PDF / PPT</option>
              <option value="quiz">Evaluación / Examen</option>
              <option value="assignment">Entrega de Tarea</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Duración (min)</Label>
            <Input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Puntos XP</Label>
            <Input
              type="number"
              min={0}
              value={xpReward}
              onChange={(e) => setXpReward(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col justify-center gap-1.5 pt-4 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
              />
              Obligatoria para progreso 100%
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              Publicada
            </label>
          </div>
        </div>

        {lessonType === "video" && (
          <div className="space-y-1">
            <Label className="text-xs">URL del Video (YouTube / Vimeo / Embed)</Label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/embed/..."
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Contenido / Guía en Markdown</Label>
          <Textarea
            rows={3}
            value={contentMarkdown}
            onChange={(e) => setContentMarkdown(e.target.value)}
          />
        </div>

        {lessonType === "assignment" && (
          <div className="space-y-1">
            <Label className="text-xs">Consigna de Entrega Práctica</Label>
            <Textarea
              rows={2}
              value={assignmentInstructions}
              onChange={(e) => setAssignmentInstructions(e.target.value)}
            />
          </div>
        )}

        {/* Quiz Parameters if this lesson is a Quiz */}
        {lessonType === "quiz" && quiz && (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Reglas de Aprobación de esta Evaluación
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">% Mínimo Aprobación</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={quizPassing}
                  onChange={(e) => setQuizPassing(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tiempo Límite (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={quizTimeLimit}
                  onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Intentos Máximos</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={quizMaxAttempts}
                  onChange={(e) => setQuizMaxAttempts(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preguntas Aleatorias</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Todas"
                  value={quizRandomCount}
                  onChange={(e) => setQuizRandomCount(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={quizIsFinal}
                  onChange={(e) => setQuizIsFinal(e.target.checked)}
                />
                Es el Examen Final Certificador (requerido para emitir diploma PDF)
              </label>
              <select
                value={quizFeedbackMode}
                onChange={(e) => setQuizFeedbackMode(e.target.value as QuizFeedbackMode)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="after_submit">Feedback al enviar</option>
                <option value="immediate">Feedback inmediato</option>
                <option value="never">Sin retroalimentación</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="destructive" size="sm" onClick={handleDeleteLesson} disabled={saving}>
            <Trash2 className="h-3.5 w-3.5" /> Eliminar Lección
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar Lección
          </Button>
        </div>
      </form>

      {/* Private Bucket PDF / Material Uploader */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Documentos Privados (Bucket Supabase Storage: lesson-materials)
          </p>
          <p className="text-xs text-muted-foreground">
            Los alumnos matriculados descargan estos PDFs/PPTs mediante URLs firmadas temporales (5 min).
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Nombre visible del material (ej. Manual de Seguridad Hidráulica)"
            value={resourceTitle}
            onChange={(e) => setResourceTitle(e.target.value)}
          />
          <label className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90">
            {uploadingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Subir PDF / PPT
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.ppt,.pptx,.docx,.xlsx,.mp4,.webm"
              disabled={uploadingPdf}
              onChange={handleUploadPrivateFile}
            />
          </label>
        </div>

        {resources.length > 0 && (
          <div className="space-y-1.5">
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.file_name} • {formatFileSize(r.file_size_bytes)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewResource(r.storage_path)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteResource(r)}
                    title="Eliminar archivo"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

