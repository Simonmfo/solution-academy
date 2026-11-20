import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { AssignCourseCard, BulkImportEmployeesCard } from "@/components/hr/hr-tools";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HrEmployeesPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile?.company_id) return null;

  const supabase = await createClient();
  const [{ data: employees }, { data: licenses }, { data: importJobs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, department, job_title, employee_code, xp_points, current_streak, is_active")
      .eq("company_id", profile.company_id)
      .eq("role", "student")
      .order("full_name", { ascending: true }),
    supabase
      .from("company_course_licenses")
      .select("course:courses(id, title)")
      .eq("company_id", profile.company_id)
      .eq("is_active", true),
    supabase
      .from("bulk_import_jobs")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const licensedCourses = (licenses ?? [])
    .map((l) => (Array.isArray(l.course) ? l.course[0] : l.course))
    .filter((c): c is { id: string; title: string } => Boolean(c));

  const employeeList = employees ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nómina de Empleados y Asignaciones</h1>
        <p className="text-sm text-muted-foreground">
          Importá empleados masivamente desde Excel/CSV y asignales capacitaciones obligatorias con fecha límite.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BulkImportEmployeesCard />
        <AssignCourseCard
          employees={employeeList.map((e) => ({
            id: e.id,
            full_name: e.full_name,
            email: e.email,
          }))}
          courses={licensedCourses}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colaboradores Registrados ({employeeList.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">Nombre</th>
                <th className="py-3 pr-4">Legajo</th>
                <th className="py-3 pr-4">Departamento</th>
                <th className="py-3 pr-4">Puesto</th>
                <th className="py-3 pr-4">XP / Racha</th>
                <th className="py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employeeList.map((emp) => (
                <tr key={emp.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{emp.full_name}</p>
                    <p className="text-xs text-muted-foreground">{emp.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-xs">{emp.employee_code ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs">{emp.department ?? "General"}</td>
                  <td className="py-3 pr-4 text-xs">{emp.job_title ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs font-semibold">
                    {emp.xp_points} XP • {emp.current_streak}d
                  </td>
                  <td className="py-3">
                    <Badge variant={emp.is_active ? "success" : "secondary"}>
                      {emp.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {importJobs && importJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de Importaciones Excel/CSV</CardTitle>
            <CardDescription>Auditoría de cargas masivas recientes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Archivo</th>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Procesados</th>
                  <th className="py-2 pr-4">Errores</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {importJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-2.5 pr-4 font-medium">{job.file_name}</td>
                    <td className="py-2.5 pr-4">{formatDate(job.created_at)}</td>
                    <td className="py-2.5 pr-4">
                      {job.processed_rows} / {job.total_rows}
                    </td>
                    <td className="py-2.5 pr-4">{job.failed_rows}</td>
                    <td className="py-2.5">
                      <Badge variant={job.failed_rows > 0 ? "warning" : "success"}>
                        {job.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
