import { NextResponse } from "next/server";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_BUCKETS = new Set(["lesson-materials", "assignment-submissions", "certificates"]);

export async function POST(request: Request) {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { bucket?: string; path?: string };
  if (!body.bucket || !body.path || !ALLOWED_BUCKETS.has(body.bucket)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // Validación estricta de permisos antes de emitir URL firmada
  let authorized = profile.role === "super_admin";

  if (!authorized) {
    const segments = body.path.split("/");
    const supabase = await createClient();

    if (body.bucket === "lesson-materials") {
      // Ruta: {courseId}/{lessonId}/{filename}
      const courseId = segments[0];
      if (profile.role === "instructor") {
        const { data: isOwner } = await supabase.rpc("is_instructor_of_course", {
          p_course_id: courseId,
        });
        authorized = Boolean(isOwner);
      } else {
        const { data: enr } = await supabase
          .from("enrollments")
          .select("id")
          .eq("course_id", courseId)
          .eq("user_id", profile.id)
          .maybeSingle();
        authorized = Boolean(enr);
      }
    } else if (body.bucket === "assignment-submissions" || body.bucket === "certificates") {
      // Ruta: {companyId}/{userId}/...
      const [companyId, ownerId] = segments;
      authorized =
        ownerId === profile.id ||
        profile.role === "instructor" ||
        (profile.role === "company_admin" && companyId === profile.company_id);
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "No tenés permisos para acceder a este archivo privado." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(body.bucket)
    .createSignedUrl(body.path, 300);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo generar la URL firmada." },
      { status: 404 }
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
