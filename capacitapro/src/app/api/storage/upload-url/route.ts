import { NextResponse } from "next/server";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
  "video/webm",
]);

/**
 * Emite una Signed Upload URL para subir PDFs/PPTs/videos directo al bucket privado `lesson-materials`
 * sin pasar por el límite de 4.5MB de Vercel Serverless Functions.
 * Convención de ruta exigida por RLS: {courseId}/{lessonId}/{timestamp}-{safeFileName}
 */
export async function POST(request: Request) {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Solo instructores o super admins pueden subir materiales." }, { status: 403 });
  }

  const body = (await request.json()) as {
    courseId?: string;
    lessonId?: string;
    fileName?: string;
    mimeType?: string;
  };

  if (!body.courseId || !body.lessonId || !body.fileName) {
    return NextResponse.json({ error: "Faltan courseId, lessonId o fileName." }, { status: 400 });
  }

  if (body.mimeType && !ALLOWED_MIME_TYPES.has(body.mimeType)) {
    return NextResponse.json(
      { error: "Formato no permitido. Subí archivos PDF, PPTX, DOCX, XLSX, MP4 o WEBM." },
      { status: 400 }
    );
  }

  // Verificar que el instructor sea dueño/co-instructor del curso (o super_admin)
  if (profile.role === "instructor") {
    const supabase = await createClient();
    const { data: allowed } = await supabase.rpc("is_instructor_of_course", {
      p_course_id: body.courseId,
    });
    if (!allowed) {
      return NextResponse.json({ error: "No sos instructor de este curso." }, { status: 403 });
    }
  }

  const sanitizedName = body.fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const storagePath = `${body.courseId}/${body.lessonId}/${Date.now()}-${sanitizedName}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("lesson-materials")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo generar la URL de subida segura." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    storagePath,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}

