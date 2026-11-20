"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Lock,
  MessageSquare,
  NotebookPen,
  Pencil,
  Reply,
  Send,
  ThumbsUp,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createDiscussionPostAction,
  deleteLessonNoteAction,
  markDiscussionResolvedAction,
  markLessonCompletedAction,
  saveLessonNoteAction,
  saveVideoPositionAction,
  submitAssignmentAction,
  toggleDiscussionUpvoteAction,
  updateLessonNoteAction,
} from "@/actions/learning.actions";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Lesson, LessonResource, UserRole } from "@/types/database.types";

export interface NoteItem {
  id: string;
  content: string;
  video_timestamp_seconds: number | null;
  created_at: string;
}

export interface DiscussionReplyItem {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_role: string;
}

export interface DiscussionThreadItem {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string;
  author_role: string;
  is_resolved: boolean;
  upvotes_count: number;
  upvoted_by_me: boolean;
  replies: DiscussionReplyItem[];
}

export interface NavLessonLink {
  title: string;
  href: string;
  locked: boolean;
}

export interface LatestSubmissionView {
  status: string;
  score: number | null;
  max_score: number;
  feedback: string | null;
  file_name: string | null;
  submitted_at: string;
}

export function LessonWorkspace({
  lesson,
  courseSlug,
  enrollmentId,
  companyId,
  userId,
  userRole,
  isCompleted,
  videoLastPosition,
  embedUrl,
  storageVideoSignedUrl,
  resources,
  initialNotes,
  initialDiscussions,
  latestSubmission,
  prevLesson,
  nextLesson,
}: {
  lesson: Lesson;
  courseSlug: string;
  enrollmentId: string;
  companyId: string;
  userId: string;
  userRole: UserRole;
  isCompleted: boolean;
  videoLastPosition: number;
  embedUrl: string | null;
  storageVideoSignedUrl: string | null;
  resources: LessonResource[];
  initialNotes: NoteItem[];
  initialDiscussions: DiscussionThreadItem[];
  latestSubmission: LatestSubmissionView | null;
  prevLesson: NavLessonLink | null;
  nextLesson: NavLessonLink | null;
}) {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const lastSavedSecRef = React.useRef(videoLastPosition);

  const [completed, setCompleted] = React.useState(isCompleted);
  const [completing, setCompleting] = React.useState(false);
  const [unlockedCertCode, setUnlockedCertCode] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Notes state (full CRUD)
  const [notes, setNotes] = React.useState<NoteItem[]>(initialNotes);
  const [noteInput, setNoteInput] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = React.useState("");
  const [copiedNotes, setCopiedNotes] = React.useState(false);

  // Forum state (threads, replies, upvotes, resolved)
  const [discussions, setDiscussions] = React.useState<DiscussionThreadItem[]>(initialDiscussions);
  const [forumInput, setForumInput] = React.useState("");
  const [postingForum, setPostingForum] = React.useState(false);
  const [replyingToId, setReplyingToId] = React.useState<string | null>(null);
  const [replyInput, setReplyInput] = React.useState("");
  const [postingReply, setPostingReply] = React.useState(false);

  // Assignment submission state
  const [submissionText, setSubmissionText] = React.useState("");
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [filePath, setFilePath] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [submittingAssignment, setSubmittingAssignment] = React.useState(false);

  const handleMarkComplete = async () => {
    if (!enrollmentId) return;
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
    if (res.data?.certificateCode) {
      setUnlockedCertCode(res.data.certificateCode);
      setStatusMessage("¡Curso 100% completado! Tu Diploma PDF con QR ya fue emitido automáticamente.");
    } else {
      setStatusMessage(`¡Lección completada! Sumaste +${lesson.xp_reward} XP a tu racha.`);
    }
    router.refresh();
  };

  const handleVideoTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !enrollmentId) return;
    const sec = Math.floor(el.currentTime);
    if (Math.abs(sec - lastSavedSecRef.current) >= 15) {
      lastSavedSecRef.current = sec;
      void saveVideoPositionAction({
        enrollmentId,
        courseId: lesson.course_id,
        moduleId: lesson.module_id,
        lessonId: lesson.id,
        seconds: sec,
      });
    }
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

  // --- NOTES CRUD ---
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setSavingNote(true);
    const timestamp = videoRef.current ? Math.floor(videoRef.current.currentTime) : null;
    const res = await saveLessonNoteAction({
      lessonId: lesson.id,
      courseId: lesson.course_id,
      content: noteInput.trim(),
      videoTimestampSeconds: timestamp,
    });
    setSavingNote(false);
    if (res.success && res.data) {
      setNotes((prev) => [
        {
          id: res.data!.id,
          content: noteInput.trim(),
          video_timestamp_seconds: timestamp,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNoteInput("");
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingNoteText.trim()) return;
    const res = await updateLessonNoteAction({ noteId, content: editingNoteText.trim() });
    if (res.success) {
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, content: editingNoteText.trim() } : n))
      );
      setEditingNoteId(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const res = await deleteLessonNoteAction(noteId);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  const handleCopyAllNotes = () => {
    const text = notes.map((n) => `• ${n.content}`).join("\n");
    void navigator.clipboard.writeText(`Notas de "${lesson.title}":\n${text}`);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  // --- FORUM THREADS, REPLIES & UPVOTES ---
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
    if (res.success && res.data) {
      setDiscussions((prev) => [
        {
          id: res.data!.id,
          body: forumInput.trim(),
          created_at: new Date().toISOString(),
          author_id: userId,
          author_name: "Vos",
          author_role: userRole,
          is_resolved: false,
          upvotes_count: 0,
          upvoted_by_me: false,
          replies: [],
        },
        ...prev,
      ]);
      setForumInput("");
      router.refresh();
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!replyInput.trim()) return;
    setPostingReply(true);
    const res = await createDiscussionPostAction({
      lessonId: lesson.id,
      courseId: lesson.course_id,
      parentId,
      body: replyInput.trim(),
    });
    setPostingReply(false);
    if (res.success && res.data) {
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === parentId
            ? {
                ...d,
                replies: [
                  ...d.replies,
                  {
                    id: res.data!.id,
                    body: replyInput.trim(),
                    created_at: new Date().toISOString(),
                    author_name: "Vos",
                    author_role: userRole,
                  },
                ],
              }
            : d
        )
      );
      setReplyInput("");
      setReplyingToId(null);
      router.refresh();
    }
  };

  const handleToggleUpvote = async (discussionId: string) => {
    const res = await toggleDiscussionUpvoteAction(discussionId);
    if (res.success && res.data) {
      const upvoted = res.data.upvoted;
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId
            ? {
                ...d,
                upvoted_by_me: upvoted,
                upvotes_count: Math.max(0, d.upvotes_count + (upvoted ? 1 : -1)),
              }
            : d
        )
      );
    }
  };

  const handleToggleResolved = async (discussionId: string, nextVal: boolean) => {
    const res = await markDiscussionResolvedAction({ discussionId, resolved: nextVal });
    if (res.success) {
      setDiscussions((prev) =>
        prev.map((d) => (d.id === discussionId ? { ...d, is_resolved: nextVal } : d))
      );
    }
  };

  // --- ASSIGNMENT UPLOAD ---
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
      router.refresh();
    } else {
      setStatusMessage(res.error ?? "No se pudo enviar la entrega.");
    }
  };

  const formatTimestamp = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{lesson.lesson_type.toUpperCase()}</Badge>
            <Badge variant="secondary">+{lesson.xp_reward} XP</Badge>
            <span className="text-xs text-muted-foreground">{lesson.duration_minutes} min</span>
            {completed && <Badge variant="success">Completada</Badge>}
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{lesson.title}</h2>
        </div>

        {lesson.lesson_type !== "quiz" && enrollmentId && (
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          <span>{statusMessage}</span>
          {unlockedCertCode && (
            <a href={`/api/certificates/${unlockedCertCode}/pdf`}>
              <Button size="sm">
                <Award className="h-4 w-4" /> Descargar Diploma PDF
              </Button>
            </a>
          )}
        </div>
      )}

      {/* Video Player: Storage native video OR Embed iframe */}
      {lesson.lesson_type === "video" && storageVideoSignedUrl && (
        <div className="overflow-hidden rounded-xl border border-border bg-black shadow-sm">
          <video
            ref={videoRef}
            src={storageVideoSignedUrl}
            controls
            className="aspect-video w-full"
            onLoadedMetadata={() => {
              if (videoRef.current && videoLastPosition > 5) {
                videoRef.current.currentTime = videoLastPosition;
              }
            }}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={() => {
              if (!completed) void handleMarkComplete();
            }}
          />
        </div>
      )}

      {lesson.lesson_type === "video" && !storageVideoSignedUrl && embedUrl && (
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
                  <Download className="h-4 w-4" /> Descargar PDF
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

            {latestSubmission && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    Última entrega ({formatDate(latestSubmission.submitted_at)})
                  </span>
                  <Badge
                    variant={
                      latestSubmission.status === "graded"
                        ? "success"
                        : latestSubmission.status === "resubmit_requested"
                        ? "destructive"
                        : "warning"
                    }
                  >
                    {latestSubmission.status === "graded"
                      ? `Calificada: ${latestSubmission.score}/${latestSubmission.max_score}`
                      : latestSubmission.status}
                  </Badge>
                </div>
                {latestSubmission.feedback && (
                  <p className="mt-1.5 text-muted-foreground">
                    Devolución del instructor: {latestSubmission.feedback}
                  </p>
                )}
              </div>
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
                <Button type="submit" disabled={submittingAssignment || uploadingFile || !enrollmentId}>
                  {submittingAssignment && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar Entrega al Instructor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Previous / Next Lesson Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
        {prevLesson ? (
          <Link href={prevLesson.href}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="max-w-[200px] truncate">{prevLesson.title}</span>
            </Button>
          </Link>
        ) : (
          <span />
        )}

        {nextLesson ? (
          nextLesson.locked ? (
            <Button variant="secondary" size="sm" disabled title="Completá esta unidad para desbloquear">
              <Lock className="h-4 w-4" />
              Siguiente bloqueada
            </Button>
          ) : (
            <Link href={nextLesson.href}>
              <Button size="sm">
                <span className="max-w-[200px] truncate">{nextLesson.title}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )
        ) : (
          <Link href="/certificados">
            <Button variant="outline" size="sm">
              <Award className="h-4 w-4" /> Ir a Mis Diplomas
            </Button>
          </Link>
        )}
      </div>

      {/* Personal Notes (Full CRUD) + Contextual Threaded Q&A Forum */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4 text-primary" />
              Mis Notas Personales ({notes.length})
            </CardTitle>
            {notes.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={handleCopyAllNotes}>
                {copiedNotes ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedNotes ? "Copiadas" : "Copiar"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveNote} className="space-y-2">
              <Textarea
                placeholder="Tomá apuntes privados de esta clase (se guardan en tu cuenta)..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                rows={3}
              />
              <Button type="submit" size="sm" disabled={savingNote}>
                {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar Nota
              </Button>
            </form>

            <div className="space-y-2.5">
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía no guardaste notas en esta clase.
                </p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
                    {editingNoteId === n.id ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => handleUpdateNote(n.id)}>
                            Guardar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingNoteId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-foreground">{n.content}</p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-2">
                            {n.video_timestamp_seconds !== null && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                {formatTimestamp(n.video_timestamp_seconds)}
                              </Badge>
                            )}
                            <span>{formatDate(n.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1 hover:text-primary"
                              onClick={() => {
                                setEditingNoteId(n.id);
                                setEditingNoteText(n.content);
                              }}
                              title="Editar nota"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="p-1 hover:text-destructive"
                              onClick={() => handleDeleteNote(n.id)}
                              title="Eliminar nota"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contextual Threaded Q&A Forum */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              Comentarios y Dudas ({discussions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handlePostForum} className="space-y-2">
              <Textarea
                placeholder="¿Tenés alguna consulta técnica sobre esta clase? Preguntá al instructor o compañeros..."
                value={forumInput}
                onChange={(e) => setForumInput(e.target.value)}
                rows={3}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={postingForum}>
                {postingForum ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Publicar Consulta
              </Button>
            </form>

            <div className="space-y-3">
              {discussions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía no hay consultas en esta lección. ¡Sé el primero en participar!
                </p>
              ) : (
                discussions.map((d) => {
                  const canResolve =
                    userRole === "instructor" || userRole === "super_admin" || d.author_id === userId;
                  return (
                    <div key={d.id} className="space-y-2 rounded-lg border border-border p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{d.author_name}</span>
                          {d.author_role === "instructor" && (
                            <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                              Instructor
                            </Badge>
                          )}
                          {d.is_resolved && (
                            <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                              Resuelta
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(d.created_at)}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap text-foreground/90">{d.body}</p>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleUpvote(d.id)}
                          className={`inline-flex items-center gap-1 font-medium transition-colors ${
                            d.upvoted_by_me ? "text-primary" : "text-muted-foreground hover:text-primary"
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> {d.upvotes_count}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReplyingToId(replyingToId === d.id ? null : d.id)
                          }
                          className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-primary"
                        >
                          <Reply className="h-3.5 w-3.5" /> Responder ({d.replies.length})
                        </button>
                        {canResolve && (
                          <button
                            type="button"
                            onClick={() => handleToggleResolved(d.id, !d.is_resolved)}
                            className="font-medium text-muted-foreground hover:text-emerald-600"
                          >
                            {d.is_resolved ? "Reabrir" : "Marcar resuelta"}
                          </button>
                        )}
                      </div>

                      {/* Nested Replies */}
                      {d.replies.length > 0 && (
                        <div className="mt-2 space-y-2 border-l-2 border-primary/25 pl-3">
                          {d.replies.map((r) => (
                            <div key={r.id} className="rounded bg-secondary/40 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">
                                  {r.author_name}{" "}
                                  {r.author_role === "instructor" && (
                                    <Badge variant="default" className="ml-1 px-1.5 py-0 text-[9px]">
                                      Instructor
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDate(r.created_at)}
                                </span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {replyingToId === d.id && (
                        <div className="mt-2 flex gap-2">
                          <Textarea
                            rows={2}
                            placeholder="Escribí una respuesta..."
                            value={replyInput}
                            onChange={(e) => setReplyInput(e.target.value)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={postingReply}
                            onClick={() => handlePostReply(d.id)}
                          >
                            {postingReply ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
