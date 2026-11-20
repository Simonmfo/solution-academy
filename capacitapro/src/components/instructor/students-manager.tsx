"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookPlus, Check, Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
import {
  createStudentByInstructorAction,
  enrollStudentsByInstructorAction,
} from "@/actions/instructor-students.actions";
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

export function InstructorStudentsManager({
  isSuperAdmin,
  companies,
  courses,
  existingStudents,
}: {
  isSuperAdmin: boolean;
  companies: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; title: string }>;
  existingStudents: Array<{ id: string; full_name: string; email: string }>;
}) {
  const router = useRouter();

  // Form 1: Crear nuevo alumno
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [companyId, setCompanyId] = React.useState(companies[0]?.id ?? "");
  const [department, setDepartment] = React.useState("");
  const [employeeCode, setEmployeeCode] = React.useState("");
  const [selectedCourses, setSelectedCourses] = React.useState<string[]>(
    courses[0]?.id ? [courses[0].id] : []
  );
  const [dueDate, setDueDate] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Última credencial creada (para copiar y enviar al alumno)
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = React.useState(false);

  // Form 2: Matricular alumnos existentes
  const [enrollCourseId, setEnrollCourseId] = React.useState(courses[0]?.id ?? "");
  const [enrollStudentIds, setEnrollStudentIds] = React.useState<string[]>([]);
  const [enrollDueDate, setEnrollDueDate] = React.useState("");
  const [enrolling, setEnrolling] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const toggleCourse = (id: string) => {
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleExistingStudent = (id: string) => {
    setEnrollStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    setCreatedCredentials(null);

    const res = await createStudentByInstructorAction({
      fullName,
      email,
      password,
      companyId: isSuperAdmin ? companyId || null : null,
      department,
      employeeCode,
      courseIds: selectedCourses,
      dueDate: dueDate || null,
    });

    setCreating(false);
    if (!res.success || !res.data) {
      setFeedback({ text: res.error ?? "No se pudo crear el alumno.", isError: true });
      return;
    }

    setCreatedCredentials({ email: email.trim().toLowerCase(), password });
    setFeedback({
      text: `Alumno "${fullName}" creado correctamente${
        res.data.enrolledCount > 0
          ? ` y matriculado en ${res.data.enrolledCount} curso(s).`
          : "."
      }`,
    });
    setFullName("");
    setEmail("");
    setPassword("");
    setDepartment("");
    setEmployeeCode("");
    router.refresh();
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const url = `${window.location.origin}/login`;
    const msg = `Acceso al Campus Virtual de ${SOLUTION_ACADEMY.name}:\nURL: ${url}\nUsuario: ${createdCredentials.email}\nContraseña: ${createdCredentials.password}`;
    void navigator.clipboard.writeText(msg);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  const handleEnrollExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollCourseId || enrollStudentIds.length === 0) {
      setFeedback({ text: "Seleccioná un curso y al menos un alumno.", isError: true });
      return;
    }
    setEnrolling(true);
    setFeedback(null);
    const res = await enrollStudentsByInstructorAction({
      courseId: enrollCourseId,
      studentIds: enrollStudentIds,
      isMandatory: true,
      dueDate: enrollDueDate || null,
    });
    setEnrolling(false);
    if (!res.success) {
      setFeedback({ text: res.error ?? "No se pudo matricular.", isError: true });
      return;
    }
    setEnrollStudentIds([]);
    setFeedback({ text: `Se matricularon ${res.data?.count ?? 0} alumno(s) en el curso.` });
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Alta de Nuevo Alumno */}
        <Card className="border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-primary" />
              Dar de Alta Nuevo Alumno
            </CardTitle>
            <CardDescription>
              Creá la cuenta del alumno (sin auto-registro público) y matriculalo en tus cursos en un solo paso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateStudent} className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre y Apellido *</Label>
                  <Input
                    required
                    placeholder="Ej. Martín Gómez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Correo Electrónico *</Label>
                  <Input
                    type="email"
                    required
                    placeholder="alumno@solutionacademy.com.ar"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Contraseña Inicial *</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setPassword(generateTempPassword())}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Generar
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Legajo / DNI (opcional)</Label>
                  <Input
                    placeholder="Ej. 38451200"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Área / Grupo</Label>
                  <Input
                    placeholder="Ej. Operaciones Viales"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>

              {isSuperAdmin && companies.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs">Sede / Convenio</Label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
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

              {courses.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Matricular inmediatamente en:</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-8 w-40 text-xs"
                      title="Fecha límite opcional"
                    />
                  </div>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {courses.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(c.id)}
                          onChange={() => toggleCourse(c.id)}
                        />
                        <span className="truncate font-medium">{c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Crear Cuenta de Alumno
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 2. Matricular Alumnos Existentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookPlus className="h-5 w-5 text-primary" />
              Matricular Alumnos Existentes en mis Cursos
            </CardTitle>
            <CardDescription>
              Asigná uno de tus cursos a alumnos que ya tienen cuenta en la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnrollExisting} className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Curso</Label>
                  <select
                    value={enrollCourseId}
                    onChange={(e) => setEnrollCourseId(e.target.value)}
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
                  <Label className="text-xs">Fecha Límite (opcional)</Label>
                  <Input
                    type="date"
                    value={enrollDueDate}
                    onChange={(e) => setEnrollDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  Alumnos seleccionados ({enrollStudentIds.length})
                </p>
                {existingStudents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Todavía no hay alumnos creados.</p>
                ) : (
                  existingStudents.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={enrollStudentIds.includes(s.id)}
                        onChange={() => toggleExistingStudent(s.id)}
                      />
                      <span className="font-medium">{s.full_name}</span>
                      <span className="text-muted-foreground">({s.email})</span>
                    </label>
                  ))
                )}
              </div>

              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={enrolling || courses.length === 0 || existingStudents.length === 0}
              >
                {enrolling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BookPlus className="h-4 w-4" />
                )}
                Matricular en el Curso
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

