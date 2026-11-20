import { Award, BookOpen, Building2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuperAdminCompanyTools } from "@/components/admin/company-manager";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SuperAdminCompaniesPage() {
  const supabase = await createClient();

  const [
    { data: companies },
    { data: courses },
    { count: totalUsers },
    { count: totalCerts },
  ] = await Promise.all([
    supabase.from("companies").select("*").order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title").order("title", { ascending: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("certificates").select("id", { count: "exact", head: true }),
  ]);

  const companyList = companies ?? [];
  const courseList = courses ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Administración Global — CapacitaPro
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión de empresas clientes (B2B), asignación de licencias de cursos y métricas globales.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Empresas Clientes", value: companyList.length, icon: Building2 },
          { label: "Usuarios Totales", value: totalUsers ?? 0, icon: Users },
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
        companies={companyList.map((c) => ({ id: c.id, name: c.name }))}
        courses={courseList}
      />

      <Card>
        <CardHeader>
          <CardTitle>Empresas Registradas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">Empresa</th>
                <th className="py-3 pr-4">Slug</th>
                <th className="py-3 pr-4">CUIT/RUT</th>
                <th className="py-3 pr-4">Asientos</th>
                <th className="py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companyList.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-4 font-semibold">{c.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{c.slug}</td>
                  <td className="py-3 pr-4 text-xs">{c.tax_id ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs">{c.max_seats}</td>
                  <td className="py-3">
                    <Badge variant={c.is_active ? "success" : "secondary"}>
                      {c.is_active ? "Activa" : "Suspendida"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

