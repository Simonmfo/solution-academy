import Link from "next/link";
import { AlertTriangle, Award, CheckCircle2, Download, TrendingUp, UserX, Users } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { formatDate, isOverdue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { HrCompanyMetrics } from "@/types/database.types";

export default async function HrDashboardPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const companyId = profile.company_id;

  if (!companyId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Tu usuario Super Admin/RRHH aún no tiene una empresa seleccionada. Creá o vinculá una empresa en Administración.
        </CardContent>
      </Card>
    );
  }

  const [{ data: metricsRaw }, { data: enrollments }] = await Promise.all([
    supabase.rpc("get_company_hr_metrics", { p_company_id: companyId }),
    supabase
      .from("enrollments")
      .select(
        "id, status, progress_percentage, final_grade, is_mandatory, due_date, profile:profiles!enrollments_user_id_fkey(full_name, email, department), course:courses(title)"
      )
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const metrics: HrCompanyMetrics = (metricsRaw as HrCompanyMetrics | null) ?? {
    total_employees: 0,
    total_enrollments: 0,
    completed_enrollments: 0,
    completion_rate: 0,
    average_grade: 0,
    overdue_enrollments: 0,
    inactive_students: 0,
    certificates_issued: 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Panel de Convenio — {profile.company?.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Seguimiento de capacitación en Solution Academy, alertas de vencimientos y reportes en Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/rrhh/empleados">
            <Button variant="outline">Gestionar Empleados</Button>
          </Link>
          <a href="/api/hr/reports/export">
            <Button>
              <Download className="h-4 w-4" />
              Exportar Reporte Excel
            </Button>
          </a>
        </div>
      </div>

      {/* HR KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Empleados Activos", value: metrics.total_employees, icon: Users, tone: "text-primary" },
          { label: "Tasa Finalización", value: `${metrics.completion_rate}%`, icon: CheckCircle2, tone: "text-emerald-600" },
          { label: "Promedio Notas", value: `${metrics.average_grade}%`, icon: TrendingUp, tone: "text-indigo-600" },
          { label: "Cursos Vencidos", value: metrics.overdue_enrollments, icon: AlertTriangle, tone: "text-destructive" },
          { label: "Alumnos Inactivos", value: metrics.inactive_students, icon: UserX, tone: "text-amber-600" },
          { label: "Diplomas Emitidos", value: metrics.certificates_issued, icon: Award, tone: "text-emerald-600" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.tone}`} />
              </div>
              <p className="mt-2 text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Seguimiento de Capacitaciones por Colaborador</CardTitle>
          <CardDescription>
            Datos aislados exclusivamente a tu empresa por políticas Row Level Security (RLS).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">Empleado</th>
                <th className="py-3 pr-4">Área</th>
                <th className="py-3 pr-4">Curso</th>
                <th className="py-3 pr-4">Progreso</th>
                <th className="py-3 pr-4">Nota</th>
                <th className="py-3 pr-4">Vencimiento</th>
                <th className="py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(enrollments ?? []).map((row) => {
                const emp = Array.isArray(row.profile) ? row.profile[0] : row.profile;
                const course = Array.isArray(row.course) ? row.course[0] : row.course;
                const overdue = isOverdue(row.due_date, row.status);
                return (
                  <tr key={row.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{emp?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{emp?.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs">{emp?.department ?? "General"}</td>
                    <td className="py-3 pr-4 font-medium">{course?.title}</td>
                    <td className="w-36 py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Progress value={Number(row.progress_percentage)} className="h-2" />
                        <span className="text-xs font-semibold">{row.progress_percentage}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs font-semibold">
                      {row.final_grade !== null ? `${row.final_grade}%` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-xs">{formatDate(row.due_date)}</td>
                    <td className="py-3">
                      {row.status === "completed" ? (
                        <Badge variant="success">Completado</Badge>
                      ) : overdue ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : (
                        <Badge variant="secondary">{row.status}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!enrollments || enrollments.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay asignaciones registradas. Asigná cursos desde la pestaña Empleados.
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

