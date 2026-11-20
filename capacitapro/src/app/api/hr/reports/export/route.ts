import { NextResponse } from "next/server";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { generateHrReportWorkbook, type HrReportRow } from "@/lib/excel/hr-excel";
import { formatDate } from "@/lib/utils";
import type { HrCompanyMetrics } from "@/types/database.types";

export const runtime = "nodejs";

export async function GET() {
  const { profile } = await getCurrentUserWithProfile();
  if (
    !profile ||
    (profile.role !== "company_admin" && profile.role !== "super_admin") ||
    !profile.company_id
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const [{ data: metrics }, { data: enrollments }] = await Promise.all([
    supabase.rpc("get_company_hr_metrics", { p_company_id: profile.company_id }),
    supabase
      .from("enrollments")
      .select(
        "status, progress_percentage, final_grade, is_mandatory, due_date, completed_at, profile:profiles!enrollments_user_id_fkey(full_name, email, employee_code, department), course:courses(title)"
      )
      .eq("company_id", profile.company_id)
      .order("updated_at", { ascending: false }),
  ]);

  const m = (metrics as HrCompanyMetrics | null) ?? {
    total_employees: 0,
    total_enrollments: 0,
    completed_enrollments: 0,
    completion_rate: 0,
    average_grade: 0,
    overdue_enrollments: 0,
    inactive_students: 0,
    certificates_issued: 0,
  };

  const rows: HrReportRow[] = (enrollments ?? []).map((enr) => {
    const p = Array.isArray(enr.profile) ? enr.profile[0] : enr.profile;
    const c = Array.isArray(enr.course) ? enr.course[0] : enr.course;
    return {
      empleado: p?.full_name ?? "Sin nombre",
      email: p?.email ?? "",
      legajo: p?.employee_code ?? "-",
      departamento: p?.department ?? "General",
      curso: c?.title ?? "Curso",
      obligatorio: enr.is_mandatory ? "Sí" : "No",
      estado: enr.status,
      progreso_pct: Number(enr.progress_percentage ?? 0),
      nota_final: enr.final_grade !== null ? Number(enr.final_grade) : "-",
      fecha_limite: formatDate(enr.due_date),
      fecha_completado: formatDate(enr.completed_at),
    };
  });

  const companyName = profile.company?.name ?? "Empresa";
  const buffer = generateHrReportWorkbook(
    companyName,
    {
      "Total Empleados Activos": m.total_employees,
      "Total Matriculaciones": m.total_enrollments,
      "Cursos Completados": m.completed_enrollments,
      "Tasa de Finalización (%)": m.completion_rate,
      "Promedio de Calificaciones (%)": m.average_grade,
      "Cursos Vencidos": m.overdue_enrollments,
      "Alumnos Inactivos": m.inactive_students,
      "Certificados Emitidos": m.certificates_issued,
    },
    rows
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Reporte-RRHH-${companyName.replace(/\s+/g, "_")}.xlsx"`,
    },
  });
}

