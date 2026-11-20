import { NextResponse } from "next/server";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user } = await getCurrentUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { bucket?: string; path?: string };
  const allowedBuckets = ["lesson-materials", "assignment-submissions", "certificates"];
  if (!body.bucket || !body.path || !allowedBuckets.includes(body.bucket)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // Usa el cliente con sesión del usuario para que las políticas RLS de storage.objects validen el acceso
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(body.bucket)
    .createSignedUrl(body.path, 300); // 5 minutos

  if (error || !data) {
    return NextResponse.json(
      { error: "No tenés acceso a este archivo o no existe." },
      { status: 403 }
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}

