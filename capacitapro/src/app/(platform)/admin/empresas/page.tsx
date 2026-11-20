import { Award, BookOpen, GraduationCap, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuperAdminCompanyTools } from "@/components/admin/company-manager";
import { getRoleLabel } from "@/lib/utils";
import { SOLUTION_ACADEMY, isMainAcademyOrganization } from "@/lib/solution-academy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserRole } from "@/types/database.types";

export default async function SuperAdminAcademyPage() {
  const supabase = await createClient();

  const [
    { data: companies },
    { data: courses },
    { data: usersList },
    { count: totalCerts },
  ] = await Promise.all([
    supabase.from("companies").select("*").order("created_at", { ascending: true }),
    supabase.from("courses").select("id, title").order("title", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, company:companies(name)")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("certificates").select("id", { count: "exact", head: true }),
  ]);

  const companyList = companies ?? [];
  const courseList = courses ?? [];
  const allUsers = usersList ?? [];

  const mainAcademy =
    companyList.find((c) => isMainAcademyOrganization(c.name)) ?? companyList[0] ?? null;
  const corporateAgreements = companyList.filter((c) => c.id !== mainAcademy?.id);

  const instructorCount = allUsers.filter((u) => u.role === "instructor").length;
  const studentCount = allUsers.filter((u) => u.role === "student").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Administración — {SOLUTION_ACADEMY.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestioná el equipo docente, alumnos, cursos y convenios corporativos de{" "}
          {SOLUTION_ACADEMY.name}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Instructores Activos", value: instructorCount, icon: GraduationCap },
          { label: "Alumnos Registrados", value: studentCount, icon: Users },
          { label: "Cursos en Catálogo", value: courseList.length, icon: BookOpen },
          { label: "Certificados Emitidos", value: totalCerts ?? 0, icon: Award },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <SuperAdminCompanyTools
        defaultCompanyId={mainAcademy?.id ?? ""}
        companies={companyList.map((c) => ({ id: c.id, name: c.name }))}
        courses={courseList}
      />

      <Card>
        <CardHeader>
          <CardTitle>Equipo y Alumnos de {SOLUTION_ACADEMY.name} ({allUsers.length})</CardTitle>
          <CardDescription>
            Listado general de cuentas habilitadas en el Campus Virtual (el auto-registro público está deshabilitado).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">Usuario</th>
                <th className="py-3 pr-4">Rol</th>
                <th className="py-3 pr-4">Sede / Convenio</th>
                <th className="py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allUsers.map((u) => {
                const comp = Array.isArray(u.company) ? u.company[0] : u.company;
                const orgLabel =
                  !comp?.name || isMainAcademyOrganization(comp.name)
                    ? SOLUTION_ACADEMY.name
                    : `Convenio: ${comp.name}`;
                return (
                  <tr key={u.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{u.full_name || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{getRoleLabel(u.role as UserRole)}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-xs">{orgLabel}</td>
                    <td className="py-3">
                      <Badge variant={u.is_active ? "success" : "secondary"}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {corporateAgreements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Empresas con Convenio Corporativo ({corporateAgreements.length})</CardTitle>
            <CardDescription>
              Organizaciones que capacitan a su personal mediante convenios con {SOLUTION_ACADEMY.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Empresa en Convenio</th>
                  <th className="py-3 pr-4">CUIT / RUT</th>
                  <th className="py-3 pr-4">Cupo Máximo</th>
                  <th className="py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {corporateAgreements.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4 font-semibold">{c.name}</td>
                    <td className="py-3 pr-4 text-xs">{c.tax_id ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs">{c.max_seats} cupos</td>
                    <td className="py-3">
                      <Badge variant={c.is_active ? "success" : "secondary"}>
                        {c.is_active ? "Vigente" : "Pausado"}
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
