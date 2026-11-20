import QRCode from "qrcode";
import { Award } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { CertificateCardActions } from "@/components/certificates/certificate-card-actions";
import { Badge } from "@/components/ui/badge";
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://capacitapro-solutionacademy.vercel.app").replace(
    /\/$/,
    ""
  );

  const enriched = await Promise.all(
    (certificates ?? []).map(async (cert) => {
      const verificationUrl = `${appUrl}/verificar/${cert.verification_code}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        margin: 1,
        width: 110,
        color: { dark: "#0D1B2A", light: "#FFFFFF" },
      });
      return { cert, qrDataUrl };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis Diplomas Verificables</h1>
        <p className="text-sm text-muted-foreground">
          Se emiten automáticamente al completar el 100% de un curso y aprobar su examen final. Cada diploma incluye un código QR único verificable públicamente.
        </p>
      </div>

      {enriched.length === 0 ? (
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
          {enriched.map(({ cert, qrDataUrl }) => (
            <Card key={cert.id} className="overflow-hidden border-primary/25">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Verificable QR</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {cert.certificate_number}
                    </span>
                  </div>
                  <CardTitle className="pt-1 text-lg">{cert.course_title_snapshot}</CardTitle>
                  <CardDescription>
                    Emitido el {formatDate(cert.issued_at)} • {cert.total_hours} hs
                    {cert.final_grade !== null ? ` • Nota final: ${cert.final_grade}%` : ""}
                  </CardDescription>
                </div>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`QR de verificación ${cert.certificate_number}`}
                  className="h-20 w-20 shrink-0 rounded-lg border border-border bg-white p-1"
                />
              </CardHeader>

              <CardFooter>
                <CertificateCardActions verificationCode={cert.verification_code} />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
