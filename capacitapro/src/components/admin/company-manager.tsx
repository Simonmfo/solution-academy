"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
import {
  assignCourseLicenseAction,
  createCompanyAction,
  createCompanyUserAction,
} from "@/actions/admin.actions";
import { slugify } from "@/lib/utils";
import { SOLUTION_ACADEMY, isMainAcademyOrganization } from "@/lib/solution-academy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "Sa!";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function SuperAdminCompanyTools({
  defaultCompanyId,
  companies,
  courses,
}: {
  defaultCompanyId: string;
  companies: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();

  // Form 1 (Principal): Alta de Instructores, Alumnos o Coord. de Convenio
  const [staffCompanyId, setStaffCompanyId] = React.useState(
    defaultCompanyId || companies[0]?.id || ""
  );
  const [staffName, setStaffName] = React.useState("");
  const [staffEmail, setStaffEmail] = React.useState("");
  const [staffPassword, setStaffPassword] = React.useState("");
  const [staffRole, setStaffRole] = React.useState<"instructor" | "student" | "company_admin">(
    "instructor"
  );
  const [savingStaff, setSavingStaff] = React.useState(false);
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string;
    password: string;
    role: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = React.useState(false);

  // Form 2 (Opcional): Nuevo Convenio Corporativo con Empresa Cliente
  const [name, setName] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [maxSeats, setMaxSeats] = React.useState(50);
  const [savingCompany, setSavingCompany] = React.useState(false);

  // Form 3 (Opcional): Habilitar curso a un Convenio
  const [companyId, setCompanyId] = React.useState(defaultCompanyId || companies[0]?.id || "");
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [maxEnrollments, setMaxEnrollments] = React.useState("");
  const [savingLicense, setSavingLicense] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCompany = staffCompanyId || defaultCompanyId || companies[0]?.id;
    if (!targetCompany) return;
    setSavingStaff(true);
    setFeedback(null);
    setCreatedCredentials(null);
    const res = await createCompanyUserAction({
      fullName: staffName,
      email: staffEmail,
      password: staffPassword,
      role: staffRole,
      companyId: targetCompany,
    });
    setSavingStaff(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "No se pudo crear el usuario.", isError: true });
      return;
    }
    const roleName =
      staffRole === "instructor"
        ? "Instructor"
        : staffRole === "student"
          ? "Alumno"
          : "Coordinador de Convenio";
    setCreatedCredentials({
      email: staffEmail.trim().toLowerCase(),
      password: staffPassword,
      role: roleName,
    });
    setStaffName("");
    setStaffEmail("");
    setStaffPassword("");
    setFeedback({
      text: `${roleName} creado y habilitado en el Campus Virtual de ${SOLUTION_ACADEMY.name}.`,
    });
    router.refresh();
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const url = `${window.location.origin}/login`;
    const msg = `Acceso al Campus Virtual de ${SOLUTION_ACADEMY.name} (${createdCredentials.role}):\nURL: ${url}\nUsuario: ${createdCredentials.email}\nContraseña: ${createdCredentials.password}`;
    void navigator.clipboard.writeText(msg);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    setFeedback(null);
    const res = await createCompanyAction({
      name,
      slug: slugify(name),
      taxId,
      primaryColor: SOLUTION_ACADEMY.colors.blue,
      maxSeats,
    });
    setSavingCompany(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "No se pudo registrar el convenio.", isError: true });
      return;
    }
    setName("");
    setTaxId("");
    setFeedback({ text: "Convenio corporativo registrado correctamente." });
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
      text: res.success ? "Curso habilitado para el convenio seleccionado." : (res.error ?? "Error"),
      isError: !res.success,
    });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 text-sm font-medium ${
            feedback.isError
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          <span>{feedback.text}</span>
          {createdCredentials && (
            <Button type="button" size="sm" variant="outline" onClick={handleCopyCredentials}>
              {copiedCreds ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedCreds ? "Credenciales copiadas" : "Copiar acceso para WhatsApp"}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 1. Principal: Alta de Instructores y Alumnos de Solution Academy */}
        <Card className="border-primary/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-primary" />
              Crear Instructores y Alumnos de {SOLUTION_ACADEMY.name}
            </CardTitle>
            <CardDescription>
              El auto-registro público está deshabilitado: desde acá habilitás cuentas de
              Instructores, Alumnos o Coordinadores de convenios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateStaff} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nombre y Apellido *</Label>
                <Input
                  required
                  placeholder="Ej. Carlos Méndez"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Rol en la Academia *</Label>
                <select
                  value={staffRole}
                  onChange={(e) =>
                    setStaffRole(e.target.value as "instructor" | "student" | "company_admin")
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="instructor">Instructor de Solution Academy</option>
                  <option value="student">Alumno</option>
                  <option value="company_admin">Coordinador de Convenio (Empresa)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Correo Electrónico *</Label>
                <Input
                  type="email"
                  required
                  placeholder="instructor@solutionacademy.com.ar"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Contraseña Inicial *</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setStaffPassword(generateTempPassword())}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Generar
                  </Button>
                </div>
              </div>
              {companies.length > 1 && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>Sede / Convenio Asociado</Label>
                  <select
                    value={staffCompanyId}
                    onChange={(e) => setStaffCompanyId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isMainAcademyOrganization(c.name)
                          ? `${SOLUTION_ACADEMY.name} (Sede Principal)`
                          : `Convenio: ${c.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={savingStaff || companies.length === 0}
                >
                  {savingStaff ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Crear Cuenta en {SOLUTION_ACADEMY.name}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 2. Convenios Corporativos Opcionales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
              Convenios con Empresas
            </CardTitle>
            <CardDescription>
              Opcional: registrá empresas o municipios que capacitan personal con{" "}
              {SOLUTION_ACADEMY.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Empresa / Municipio</Label>
                <Input
                  required
                  placeholder="Ej. Constructora del Sur S.A."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">CUIT / RUT</Label>
                  <Input
                    placeholder="30-12345678-9"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cupos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxSeats}
                    onChange={(e) => setMaxSeats(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button type="submit" variant="secondary" className="w-full" disabled={savingCompany}>
                {savingCompany && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar Convenio
              </Button>
            </form>

            {companies.length > 0 && courses.length > 0 && (
              <form
                onSubmit={handleAssignLicense}
                className="space-y-2.5 border-t border-border pt-4"
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  Habilitar curso a un convenio
                </p>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isMainAcademyOrganization(c.name) ? SOLUTION_ACADEMY.name : c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Cupo (opcional)"
                    value={maxEnrollments}
                    onChange={(e) => setMaxEnrollments(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={savingLicense}>
                    {savingLicense ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Habilitar"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
