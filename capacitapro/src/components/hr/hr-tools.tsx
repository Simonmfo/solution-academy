"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { assignCourseToEmployeesAction, bulkImportEmployeesAction } from "@/actions/hr.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BulkImportEmployeesCard() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isError, setIsError] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setMessage(null);
    setIsError(false);

    const res = await bulkImportEmployeesAction(formData);
    setLoading(false);

    if (!res.success || !res.data) {
      setIsError(true);
      setMessage(res.error ?? "No se pudo procesar el archivo.");
      return;
    }

    setMessage(
      `Importación completada: ${res.data.created} creados, ${res.data.skipped} ya existentes, ${res.data.failed} con error.`
    );
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          Importación Masiva de Empleados (CSV / Excel)
        </CardTitle>
        <CardDescription>
          Subí una planilla <code>.xlsx</code> o <code>.csv</code> con columnas:{" "}
          <code>email</code>, <code>full_name</code>, <code>department</code>,{" "}
          <code>job_title</code>, <code>employee_code</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="file" name="file" accept=".xlsx,.xls,.csv" required />
          {message && (
            <div
              className={`rounded-lg p-3 text-sm ${
                isError
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {message}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Procesar e Importar Nómina
            </Button>
            <a href="/api/hr/employees/template">
              <Button type="button" variant="outline">
                <Download className="h-4 w-4" />
                Descargar Plantilla .xlsx
              </Button>
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AssignCourseCard({
  employees,
  courses,
}: {
  employees: Array<{ id: string; full_name: string; email: string }>;
  courses: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [dueDate, setDueDate] = React.useState("");
  const [isMandatory, setIsMandatory] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || selectedUsers.length === 0) {
      setFeedback("Seleccioná al menos un empleado y un curso.");
      return;
    }
    setLoading(true);
    setFeedback(null);
    const res = await assignCourseToEmployeesAction({
      userIds: selectedUsers,
      courseId,
      isMandatory,
      dueDate: dueDate || null,
    });
    setLoading(false);
    if (!res.success) {
      setFeedback(res.error ?? "No se pudo asignar el curso.");
      return;
    }
    setFeedback(`Curso asignado a ${res.data?.count ?? 0} colaboradores.`);
    setSelectedUsers([]);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-primary" />
          Asignar Curso Obligatorio con Fecha Límite
        </CardTitle>
        <CardDescription>
          Solo se muestran los cursos licenciados para tu empresa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAssign} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Curso Licenciado</Label>
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
            <div className="space-y-1.5">
              <Label>Fecha Límite (Vencimiento)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
            />
            Marcar como capacitación obligatoria (genera alerta de vencimiento)
          </label>

          <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Seleccioná colaboradores ({selectedUsers.length})</span>
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() =>
                  setSelectedUsers(
                    selectedUsers.length === employees.length ? [] : employees.map((e) => e.id)
                  )
                }
              >
                {selectedUsers.length === employees.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            </div>
            {employees.map((emp) => (
              <label key={emp.id} className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(emp.id)}
                  onChange={() => toggleUser(emp.id)}
                />
                <span className="font-medium">{emp.full_name}</span>
                <span className="text-muted-foreground">({emp.email})</span>
              </label>
            ))}
          </div>

          {feedback && <p className="text-sm font-medium text-primary">{feedback}</p>}

          <Button type="submit" disabled={loading || courses.length === 0}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Asignar Capacitación
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

