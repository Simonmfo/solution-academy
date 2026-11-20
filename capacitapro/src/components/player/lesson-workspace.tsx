"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  NotebookPen,
  Send,
  Upload,
} from "lucide-react";
import {
  createDiscussionPostAction,
  markLessonCompletedAction,
  saveLessonNoteAction,
  submitAssignmentAction,
} from "@/actions/learning.actions";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Lesson, LessonResource } from "@/types/database.types";

interface NoteItem {
  id: string;
  content: string;
  created_at: string;
}

interface DiscussionItem {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_role: string;
}

export function LessonWorkspace({
  lesson,
  courseSlug,
  enrollmentId,
  companyId,
  userId,
  isCompleted,
  embedUrl,
  resources,
  initialNotes,
  initialDiscussions,
}: {
  lesson: Lesson;
  courseSlug: string;
  enrollmentId: string;
  companyId: string;
  userId: string;
  isCompleted: boolean;
  embedUrl: string | null;
  resources: LessonResource[];
  initialNotes: NoteItem[];
  initialDiscussions: DiscussionItem[];
}) {
  const router = useRouter();
  const [completed, setCompleted] = React.useState(isCompleted);
  const [completing, setCompleting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = React.useState<NoteItem[]>(initialNotes);
  const [noteInput, setNoteInput] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);

  // Forum state
  const [discussions, setDiscussions] = React.useState<DiscussionItem[]>(initialDiscussions);
  const [forumInput, setForumInput] = React.useState("");
  const [postingForum, setPostingForum] = React.useState(false);

  // Assignment submission state
  const [submissionText, setSubmissionText] = React.useState("");
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [filePath, setFilePath] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [submittingAssignment, setSubmittingAssignment] = React.useState(false);

  const handleMarkComplete = async () => {
    setCompleting(true);
    setStatusMessage(null);
    const res = await markLessonCompletedAction({
      enrollmentId,
      courseId: lesson.course_id,
      moduleId: lesson.module_id,
      lessonId: lesson.id,
      courseSlug,
    });
    setCompleting(false);
    if (!res.success) {
      setStatusMessage(res.error ?? "Error al guardar avance.");
      return;
    }
    setCompleted(true);
    setStatusMessage(`¡Lección completada! Sumaste +${lesson.xp_reward} XP.`);
    router.refresh();
  };

  const handleDownloadResource = async (resItem: LessonResource) => {
    const response = await fetch("/api/storage/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket: "lesson-materials", path: resItem.storage_path }),
    });
    if (response.ok) {
      const { signedUrl } = (await response.json()) as { signedUrl: string };
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setSavingNote(true);
    const res = await saveLessonNoteAction({
      lessonId: lesson.id,
      courseId: lesson.course_id,
      content: noteInput.trim(),
    });
    setSavingNote(false);
    if (res.success && res.data) {
      setNotes((prev) => [
        { id: res.data!.id, content: noteInput.trim(), created_at: new Date().toISOString() },
        ...prev,
      ]);
      setNoteInput("");
    }
  };

  const handlePostForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forumInput.trim()) return;
    setPostingForum(true);
    const res = await createDiscussionPostAction({
      lessonId: lesson.id,
      courseId: lesson.course_id,
      body: forumInput.trim(),
    });
    setPostingForum(false);
    if (res.success) {
      setDiscussions((prev) => [
        {
          id: crypto.randomUUID(),
          body: forumInput.trim(),
          created_at: new Date().toISOString(),
          author_name: "Vos",
          author_role: "student",
        },
        ...prev,
      ]);
      setForumInput("");
      router.refresh();
    }
  };

  const handleUploadAssignmentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const supabase = createClient();
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const storagePath = `${companyId}/${userId}/${lesson.id}/${safeName}`;
    const { error } = await supabase.storage
      .from("assignment-submissions")
      .upload(storagePath, file, { upsert: true });

    setUploadingFile(false);
    if (!error) {
      setFilePath(storagePath);
      setFileName(file.name);
    } else {
      setStatusMessage(`Error al subir archivo: ${error.message}`);
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAssignment(true);
    const res = await submitAssignmentAction({
      lessonId: lesson.id,
      courseId: lesson.course_id,
      enrollmentId,
      submissionText,
      fileStoragePath: filePath,
      fileName,
    });
    setSubmittingAssignment(false);
    if (res.success) {
      setStatusMessage("Tarea enviada correctamente para corrección del instructor.");
      setSubmissionText("");
      setFilePath(null);
      setFileName(null);
    } else {
      setStatusMessage(res.error ?? "No se pudo enviar la entrega.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{lesson.lesson_type.toUpperCase()}</Badge>
            <Badge variant="secondary">+{lesson.xp_reward} XP</Badge>
            {completed && <Badge variant="success">Completada</Badge>}
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{lesson.title}</h2>
        </div>

        {lesson.lesson_type !== "quiz" && (
          <Button
            onClick={handleMarkComplete}
            disabled={completing || completed}
            variant={completed ? "secondary" : "default"}
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {completed ? "Lección Completada" : "Marcar como Completada"}
          </Button>
        )}
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {statusMessage}
        </div>
      )}

      {/* Video Player */}
      {lesson.lesson_type === "video" && embedUrl && (
        <div className="overflow-hidden rounded-xl border border-border bg-black shadow-sm">
          <div className="aspect-video w-full">
            <iframe
              src={embedUrl}
              title={lesson.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Markdown / Reading Content */}
      {lesson.content_markdown && (
        <Card>
          <CardContent className="prose prose-sm max-w-none whitespace-pre-wrap p-6 dark:prose-invert">
            {lesson.content_markdown}
          </CardContent>
        </Card>
      )}

      {/* Private Downloadable Resources */}
      {resources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Material Descargable (Acceso Seguro)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.file_name}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleDownloadResource(r)}>
                  <Download className="h-4 w-4" /> Descargar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Assignment Submission Box */}
      {lesson.lesson_type === "assignment" && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" />
              Entrega de Tarea Práctica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lesson.assignment_instructions && (
              <p className="rounded-lg bg-secondary/60 p-3 text-sm">
                {lesson.assignment_instructions}
              </p>
            )}
            <form onSubmit={handleSubmitAssignment} className="space-y-3">
              <Textarea
                placeholder="Escribí tu respuesta o conclusiones de la práctica..."
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                rows={4}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingFile
                    ? "Subiendo archivo..."
                    : fileName
                    ? `Adjunto: ${fileName}`
                    : "Adjuntar PDF / Evidencia"}
                  <input type="file" className="hidden" onChange={handleUploadAssignmentFile} />
                </label>
                <Button type="submit" disabled={submittingAssignment || uploadingFile}>
                  {submittingAssignment && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar Entrega al Instructor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Personal Notes + Contextual Q&A Forum */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4 text-primary" />
              Mis Notas Personales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveNote} className="space-y-2">
              <Textarea
                placeholder="Tomá apuntes privados de esta clase (se guardan automáticamente en tu cuenta)..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                rows={3}
              />
              <Button type="submit" size="sm" disabled={savingNote}>
                {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar Nota
              </Button>
            </form>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-secondary/50 p-3 text-xs">
                  <p className="whitespace-pre-wrap text-foreground">{n.content}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDate(n.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              Foro de Dudas de esta Clase
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handlePostForum} className="space-y-2">
              <Textarea
                placeholder="¿Tenés alguna pregunta técnica sobre esta lección? Consultale al instructor..."
                value={forumInput}
                onChange={(e) => setForumInput(e.target.value)}
                rows={3}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={postingForum}>
                <Send className="h-3.5 w-3.5" />
                Publicar Consulta
              </Button>
            </form>
            <div className="space-y-2.5">
              {discussions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía no hay consultas en esta lección. ¡Sé el primero en participar!
                </p>
              ) : (
                discussions.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{d.author_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(d.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{d.body}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

