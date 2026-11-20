"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmployeesSpreadsheet } from "@/lib/excel/hr-excel";
import { assignEnrollmentSchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/actions/auth.actions";

export async function bulkImportEmployeesAction(formData: FormData): Promise<
  ActionResult<{ created: number; skipped: number; failed: number }>
> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "company_admin" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos para importar empleados." };
  }

  const companyId = profile.company_id;
  if (!companyId) {
    return { success: false, error: "Tu cuenta no tiene una empresa asignada." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Adjuntá un archivo .xlsx o .csv válido." };
  }

  const buffer = await file.arrayBuffer();
  const { validRows, errors } = parseEmployeesSpreadsheet(buffer);

  if (validRows.length === 0) {
    return {
      success: false,
      error: errors[0]?.message ?? "No se encontraron filas válidas en el archivo.",
    };
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("bulk_import_jobs")
    .insert({
      company_id: companyId,
      uploaded_by: profile.id,
      file_name: file.name,
      status: "processing",
      total_rows: validRows.length + errors.length,
    })
    .select("id")
    .single();

  let created = 0;
  let skipped = 0;
  const runtimeErrors: Array<{ row: number; message: string }> = [...errors];

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    try {
      const tempPassword = `Cp!${Math.random().toString(36).slice(2, 10)}9A`;
      const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
        email: row.email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: {
          role: "student",
          company_id: companyId,
        },
        user_metadata: {
          full_name: row.full_name,
          department: row.department,
          job_title: row.job_title,
          employee_code: row.employee_code ?? null,
        },
      });

      if (createErr) {
        if (createErr.message.toLowerCase().includes("already")) {
          skipped++;
        } else {
          runtimeErrors.push({ row: i + 2, message: `${row.email}: ${createErr.message}` });
        }
      } else if (createdUser.user) {
        created++;
      }
    } catch (err) {
      runtimeErrors.push({
        row: i + 2,
        message: `${row.email}: ${err instanceof Error ? err.message : "Error inesperado"}`,
      });
    }
  }

  if (job?.id) {
    await admin
      .from("bulk_import_jobs")
      .update({
        status: "completed",
        processed_rows: created + skipped,
        failed_rows: runtimeErrors.length,
        error_log: runtimeErrors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  revalidatePath("/rrhh");
  revalidatePath("/rrhh/empleados");

  return {
    success: true,
    data: { created, skipped, failed: runtimeErrors.length },
  };
}

export async function assignCourseToEmployeesAction(input: {
  userIds: string[];
  courseId: string;
  cohortId?: string | null;
  isMandatory?: boolean;
  dueDate?: string | null;
}): Promise<ActionResult<{ count: number }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "company_admin" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos para asignar cursos." };
  }

  if (!profile.company_id) {
    return { success: false, error: "Empresa no configurada." };
  }

  const parsed = assignEnrollmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const rows = parsed.data.userIds.map((userId) => ({
    user_id: userId,
    course_id: parsed.data.courseId,
    company_id: profile.company_id!,
    cohort_id: parsed.data.cohortId || null,
    assigned_by: profile.id,
    is_mandatory: parsed.data.isMandatory,
    due_date: parsed.data.dueDate ? new Date(parsed.data.dueDate).toISOString() : null,
  }));

  const { error } = await supabase
    .from("enrollments")
    .upsert(rows, { onConflict: "user_id,course_id" });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/rrhh");
  revalidatePath("/rrhh/empleados");
  return { success: true, data: { count: rows.length } };
}

