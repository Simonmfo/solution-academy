import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HrCertificatesPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile?.company_id) return null;

  const supabase = await createClient();
  const { data: certs } = await supabase
    .from("certificates")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("issued_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificados Emitidos de la Empresa</h1>
        <p className="text-sm text-muted-foreground">
          Descargá copias en PDF con QR verificable para legajos internos o auditorías de seguridad e higiene.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Diplomas ({certs?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">N.° Registro</th>
                <th className="py-3 pr-4">Colaborador</th>
                <th className="py-3 pr-4">Curso</th>
                <th className="py-3 pr-4">Nota</th>
                <th className="py-3 pr-4">Emisión</th>
                <th className="py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(certs ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-4 font-mono text-xs">{c.certificate_number}</td>
                  <td className="py-3 pr-4 font-medium">{c.student_name_snapshot}</td>
                  <td className="py-3 pr-4">{c.course_title_snapshot}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="success">{c.final_grade ?? 100}%</Badge>
                  </td>
                  <td className="py-3 pr-4 text-xs">{formatDate(c.issued_at)}</td>
                  <td className="flex gap-2 py-3">
                    <a href={`/api/certificates/${c.verification_code}/pdf`}>
                      <Button size="sm" variant="outline">
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
                    </a>
                    <Link href={`/verificar/${c.verification_code}`} target="_blank">
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3.5 w-3.5" /> QR
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {(!certs || certs.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no se emitieron certificados en esta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

