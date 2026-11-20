import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { CertificatePdfDocument } from "@/components/certificates/CertificatePdfDocument";
import { SOLUTION_ACADEMY } from "@/lib/solution-academy";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";

async function loadAcademyLogoDataUrl(): Promise<string | null> {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-solution-academy.jpeg");
    const bytes = await readFile(logoPath);
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const { profile } = await getCurrentUserWithProfile();

  const admin = createAdminClient();
  const { data: cert } = await admin
    .from("certificates")
    .select("*")
    .eq("verification_code", code)
    .single();

  if (!cert) {
    return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });
  }

  // Solo el alumno dueño, coordinador del convenio o Dirección/Super Admin pueden descargar el PDF
  if (
    !profile ||
    (profile.role !== "super_admin" &&
      cert.user_id !== profile.id &&
      !(profile.role === "company_admin" && cert.company_id === profile.company_id))
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || SOLUTION_ACADEMY.defaultAppUrl;
  const verificationUrl = `${appUrl.replace(/\/$/, "")}/verificar/${cert.verification_code}`;
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 180,
      color: { dark: SOLUTION_ACADEMY.colors.navy, light: "#FFFFFF" },
    }),
    loadAcademyLogoDataUrl(),
  ]);

  const pdfBuffer = await renderToBuffer(
    CertificatePdfDocument({
      certificateNumber: cert.certificate_number,
      studentName: cert.student_name_snapshot,
      companyName: cert.company_name_snapshot,
      courseTitle: cert.course_title_snapshot,
      instructorName: cert.instructor_name_snapshot || "Dirección Académica",
      finalGrade: cert.final_grade ? Number(cert.final_grade) : null,
      totalHours: Number(cert.total_hours),
      issuedAtFormatted: formatDate(cert.issued_at),
      verificationUrl,
      qrDataUrl,
      logoDataUrl,
    })
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Certificado-SolutionAcademy-${cert.certificate_number}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
