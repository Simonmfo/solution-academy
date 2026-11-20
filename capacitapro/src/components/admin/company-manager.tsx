"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Loader2, UserPlus } from "lucide-react";
import {
  assignCourseLicenseAction,
  createCompanyAction,
  createCompanyUserAction,
} from "@/actions/admin.actions";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SuperAdminCompanyTools({
  companies,
  courses,
}: {
  companies: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();

  // Form 1: Create Company
  const [name, setName] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [primaryColor, setPrimaryColor] = React.useState("#0D5BD9");
  const [maxSeats, setMaxSeats] = React.useState(50);
  const [savingCompany, setSavingCompany] = React.useState(false);

  // Form 2: Assign License
  const [companyId, setCompanyId] = React.useState(companies[0]?.id ?? "");
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [maxEnrollments, setMaxEnrollments] = React.useState("");
  const [savingLicense, setSavingLicense] = React.useState(false);

  // Form 3: Create Company Admin / Instructor
  const [staffCompanyId, setStaffCompanyId] = React.useState(companies[0]?.id ?? "");
  const [staffName, setStaffName] = React.useState("");
  const [staffEmail, setStaffEmail] = React.useState("");
  const [staffPassword, setStaffPassword] = React.useState("");
  const [staffRole, setStaffRole] = React.useState<"company_admin" | "instructor" | "student">(
    "company_admin"
  );
  const [savingStaff, setSavingStaff] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    setFeedback(null);
    const res = await createCompanyAction({
      name,
      slug: slugify(name),
      taxId,
      primaryColor,
      maxSeats,
    });
    setSavingCompany(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "No se pudo crear la empresa.", isError: true });
      return;
    }
    setName("");
    setTaxId("");
    setFeedback({ text: "Empresa cliente creada correctamente." });
    router.refresh();
  };

  const handleAssignLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !courseId) return;
    setSavingLicense(true);
    setFeedback(null);
    const res = await assignCourseLicenseAction({
      companyId,
      courseId,
      maxEnrollments: maxEnrollments ? Number(maxEnrollments) : null,
    });
    setSavingLicense(false);
    setFeedback({
      text: res.success ? "Licencia de curso activada para la empresa." : (res.error ?? "Error"),
      isError: !res.success,
    });
    router.refresh();
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffCompanyId) return;
    setSavingStaff(true);
    setFeedback(null);
    const res = await createCompanyUserAction({
      fullName: staffName,
      email: staffEmail,
      password: staffPassword,
      role: staffRole,
      companyId: staffCompanyId,
    });
    setSavingStaff(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "No se pudo crear el usuario.", isError: true });
      return;
    }
    setStaffName("");
    setStaffEmail("");
    setStaffPassword("");
    setFeedback({ text: "Usuario creado y confirmado correctamente en Supabase Auth." });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`rounded-lg border p-3 text-sm font-medium ${
            feedback.isError
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 1. Nueva Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
              1. Nueva Empresa Cliente
            </CardTitle>
            <CardDescription>
              Crea un tenant B2B aislado por <code>company_id</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div className="space-y-1">
                <Label>Razón Social / Nombre</Label>
                <Input
                  required
                  placeholder="Ej. Constructora del Sur S.A."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {name && (
                  <p className="text-[11px] text-muted-foreground">
                    Slug: <code>{slugify(name)}</code>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>CUIT / RUT</Label>
                  <Input
                    placeholder="30-12345678-9"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Asientos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxSeats}
                    onChange={(e) => setMaxSeats(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="primaryColor" className="text-xs">
                  Color Corporativo
                </Label>
                <input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-input bg-background"
                />
              </div>
              <Button type="submit" className="w-full" disabled={savingCompany}>
                {savingCompany && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear Empresa
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 2. Crear Admin RRHH / Instructor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-primary" />
              2. Crear Admin RRHH / Staff
            </CardTitle>
            <CardDescription>
              Da de alta cuentas administrativas con rol asignado en <code>app_metadata</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <select
                  value={staffCompanyId}
                  onChange={(e) => setStaffCompanyId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input
                    required
                    placeholder="Ana Torres"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Rol</Label>
                  <select
                    value={staffRole}
                    onChange={(e) =>
                      setStaffRole(e.target.value as "company_admin" | "instructor" | "student")
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="company_admin">Admin RRHH</option>
                    <option value="instructor">Instructor</option>
                    <option value="student">Alumno</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  placeholder="rrhh@empresa.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Contraseña Inicial</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={savingStaff || companies.length === 0}>
                {savingStaff && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear Usuario
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 3. Asignar Licencia de Curso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5 text-primary" />
              3. Asignar Licencia de Curso
            </CardTitle>
            <CardDescription>
              Habilita cursos del catálogo global para que RRHH matricule empleados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAssignLicense} className="space-y-3">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Curso</Label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Cupo máximo (opcional)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={maxEnrollments}
                  onChange={(e) => setMaxEnrollments(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={savingLicense || companies.length === 0 || courses.length === 0}
              >
                {savingLicense && <Loader2 className="h-4 w-4 animate-spin" />}
                Activar Licencia
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
