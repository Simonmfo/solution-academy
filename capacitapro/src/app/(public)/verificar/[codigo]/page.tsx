import type { Metadata } from "next";
import Link from "next/link";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Search,
  ShieldAlert,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicCertificateVerification } from "@/types/database.types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchPublicCertificate(
  codigo: string
): Promise<PublicCertificateVerification | null> {
  if (!UUID_REGEX.test(codigo)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate", {
    p_verification_code: codigo,
  });
  if (Array.isArray(data) && data.length > 0) {
    return data[0] as PublicCertificateVerification;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const cert = await fetchPublicCertificate(codigo);
  if (!cert) {
    return { title: "Certificado no encontrado | CapacitaPro" };
  }
  return {
    title: `Diploma Verificado: ${cert.student_name} — ${cert.course_title} | CapacitaPro`,
    description: `Certificado N.° ${cert.certificate_number} emitido por Solution Academy / CapacitaPro para ${cert.student_name} (${cert.company_name}).`,
  };
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const cert = await fetchPublicCertificate(codigo);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Solution Academy • CapacitaPro • Registro Público
          </span>
          <h1 className="mt-1 text-3xl font-extrabold">Verificación de Certificado</h1>
        </div>

        {!cert ? (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-bold">Certificado no encontrado</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                El código <code className="rounded bg-secondary px-1.5 py-0.5">{codigo}</code> no
                corresponde a ningún diploma válido emitido en CapacitaPro.
              </p>
              <div className="mt-2 flex gap-2">
                <Link href="/verificar">
                  <Button variant="outline">
                    <Search className="h-4 w-4" /> Buscar otro código
                  </Button>
                </Link>
                <Link href="/">
                  <Button>Ir al inicio</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card
            className={
              cert.is_valid
                ? "border-emerald-500/40 shadow-lg"
                : "border-destructive/40 shadow-lg"
            }
          >
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border">
              <div className="flex items-center gap-3">
                {cert.is_valid ? (
                  <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-9 w-9 text-destructive" />
                )}
                <div>
                  <CardTitle className="text-lg">
                    {cert.is_valid ? "Diploma Auténtico y Vigente" : "Diploma Revocado o Expirado"}
                  </CardTitle>
                  <p className="font-mono text-xs text-muted-foreground">
                    Registro N.° {cert.certificate_number}
                  </p>
                </div>
              </div>
              <Badge variant={cert.is_valid ? "success" : "destructive"} className="px-3 py-1">
                {cert.is_valid ? "VERIFICADO" : "NO VIGENTE"}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-5 pt-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Programa de Capacitación Aprobado
                </p>
                <p className="mt-1 text-2xl font-bold text-primary">{cert.course_title}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-lg bg-secondary/50 p-3">
                  <User className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Titular del Diploma</p>
                    <p className="text-sm font-semibold">{cert.student_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg bg-secondary/50 p-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa / Organización</p>
                    <p className="text-sm font-semibold">{cert.company_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg bg-secondary/50 p-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de Emisión</p>
                    <p className="text-sm font-semibold">{formatDate(cert.issued_at)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg bg-secondary/50 p-3">
                  <Clock className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Carga Horaria y Calificación</p>
                    <p className="text-sm font-semibold">
                      {cert.total_hours} hs
                      {cert.final_grade !== null ? ` • Nota: ${cert.final_grade}%` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {cert.instructor_name && (
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span>
                    Instructor responsable: <strong className="text-foreground">{cert.instructor_name}</strong>
                  </span>
                </div>
              )}

              {cert.revoke_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Motivo de revocación: {cert.revoke_reason}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-primary" />
                  Código único: <code className="font-mono">{codigo}</code>
                </span>
                <div className="flex items-center gap-3">
                  <Link href="/verificar" className="hover:underline">
                    Validar otro
                  </Link>
                  <Link href="/login" className="font-semibold text-primary hover:underline">
                    Ir al Campus →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
