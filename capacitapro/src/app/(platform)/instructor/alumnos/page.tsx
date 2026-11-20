import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InstructorStudentsManager } from "@/components/instructor/students-manager";
import { SOLUTION_ACADEMY, isMainAcademyOrganization } from "@/lib/solution-academy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InstructorStudentsPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return null;
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const isSuperAdmin = profile.role === "super_admin";

  const coursesQuery = supabase
    .from("courses")
    .select("id, title")
    .order("title", { ascending: true });

  const studentsQuery = admin
    .from("profiles")
    .select("id, full_name, email, department, employee_code, xp_points, current_streak, is_active, company:companies(name)")
    .eq("role", "student")
    .order("created_at", { ascending: false });

  const [{ data: courses }, { data: students }, { data: companies }] = await Promise.all([
    isSuperAdmin ? coursesQuery : coursesQuery.eq("instructor_id", profile.id),
    !isSuperAdmin && profile.company_id
      ? studentsQuery.eq("company_id", profile.company_id)
      : studentsQuery,
    isSuperAdmin
      ? admin.from("companies").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const studentList = students ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Gestión de Alumnos
        </h1>
        <p className="text-sm text-muted-foreground">
          Creá cuentas de alumnos, entregales sus credenciales de ingreso y matriculalos en tus cursos.
        </p>
      </div>

      <InstructorStudentsManager
        isSuperAdmin={isSuperAdmin}
        companies={(companies as Array<{ id: string; name: string }>) ?? []}
        courses={(courses as Array<{ id: string; title: string }>) ?? []}
        existingStudents={studentList.map((s) => ({
          id: s.id as string,
          full_name: (s.full_name as string) || "Alumno",
          email: s.email as string,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Alumnos Habilitados ({studentList.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">Alumno</th>
                <th className="py-3 pr-4">Legajo / DNI</th>
                <th className="py-3 pr-4">Área / Comisión</th>
                <th className="py-3 pr-4">Sede / Convenio</th>
                <th className="py-3 pr-4">XP / Racha</th>
                <th className="py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {studentList.map((stu) => {
                const comp = Array.isArray(stu.company) ? stu.company[0] : stu.company;
                return (
                  <tr key={stu.id as string}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{stu.full_name as string}</p>
                      <p className="text-xs text-muted-foreground">{stu.email as string}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs">{(stu.employee_code as string | null) ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs">{(stu.department as string | null) ?? "General"}</td>
                    <td className="py-3 pr-4 text-xs">
                      {!comp?.name || isMainAcademyOrganization(comp.name)
                        ? SOLUTION_ACADEMY.name
                        : `Convenio: ${comp.name}`}
                    </td>
                    <td className="py-3 pr-4 text-xs font-semibold">
                      {stu.xp_points as number} XP • {stu.current_streak as number}d
                    </td>
                    <td className="py-3">
                      <Badge variant={stu.is_active ? "success" : "secondary"}>
                        {stu.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {studentList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay alumnos registrados. Creá el primero usando el formulario de arriba.
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

