import Link from "next/link";
import { Award, Download, ExternalLink } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudentCertificatesPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: certificates } = await supabase
    .from("certificates")
    .select("*")
    .eq("user_id", profile.id)
    .order("issued_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis Diplomas Verificables</h1>
        <p className="text-sm text-muted-foreground">
          Se emiten automáticamente al completar el 100% de un curso y aprobar su examen final. Cada diploma incluye código QR de validación pública.
        </p>
      </div>

      {!certificates || certificates.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Award className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Aún no tenés certificados emitidos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Completá tus cursos al 100% y aprobá la evaluación final para desbloquear tu diploma PDF con QR.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="success">Verificable QR</Badge>
                  <span className="text-xs text-muted-foreground">{cert.certificate_number}</span>
                </div>
                <CardTitle className="mt-2 text-lg">{cert.course_title_snapshot}</CardTitle>
                <CardDescription>
                  Emitido el {formatDate(cert.issued_at)} • {cert.total_hours} hs
                  {cert.final_grade !== null ? ` • Nota: ${cert.final_grade}%` : ""}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-2">
                <a href={`/api/certificates/${cert.verification_code}/pdf`} className="flex-1">
                  <Button className="w-full" size="sm">
                    <Download className="h-4 w-4" /> Descargar PDF
                  </Button>
                </a>
                <Link href={`/verificar/${cert.verification_code}`} target="_blank">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" /> Validar QR
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

