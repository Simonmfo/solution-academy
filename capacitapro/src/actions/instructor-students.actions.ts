"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/actions/auth.actions";

const createStudentSchema = z.object({
  fullName: z.string().min(2, "Ingresá el nombre completo del alumno"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  companyId: z.string().uuid().optional().nullable(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employeeCode: z.string().optional(),
  courseIds: z.array(z.string().uuid()).default([]),
  dueDate: z.string().optional().nullable(),
});

const enrollStudentsSchema = z.object({
  courseId: z.string().uuid("Seleccioná un curso válido"),
  studentIds: z.array(z.string().uuid()).min(1, "Seleccioná al menos un alumno"),
  isMandatory: z.boolean().default(true),
  dueDate: z.string().optional().nullable(),
});

/**
 * Permite a un Instructor (o Super Admin) dar de alta un nuevo Alumno y matricularlo
 * inmediatamente en uno o más de sus cursos.
 */
export async function createStudentByInstructorAction(input: {
  fullName: string;
  email: string;
  password: string;
  companyId?: string | null;
  department?: string;
  jobTitle?: string;
  employeeCode?: string;
  courseIds: string[];
  dueDate?: string | null;
}): Promise<ActionResult<{ userId: string; enrolledCount: number }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return {
      success: false,
      error: "Solo Instructores o Super Admin pueden crear cuentas de alumnos.",
    };
  }

  const parsed = createStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();

  // Resolver empresa destino: Instructor usa la suya (o la primera activa si es instructor global)
  let targetCompanyId =
    profile.role === "super_admin"
      ? parsed.data.companyId || profile.company_id
      : profile.company_id;

  if (!targetCompanyId) {
    const { data: firstCompany } = await admin
      .from("companies")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    targetCompanyId = firstCompany?.id ?? null;
  }

  if (!targetCompanyId) {
    return {
      success: false,
      error: "No hay ninguna empresa activa registrada para vincular al alumno.",
    };
  }

  // Verificar que los cursos seleccionados pertenezcan al instructor (si no es super_admin)
  const supabase = await createClient();
  const allowedCourseIds: string[] = [];
  for (const cid of parsed.data.courseIds) {
    if (profile.role === "super_admin") {
      allowedCourseIds.push(cid);
    } else {
      const { data: isOwner } = await supabase.rpc("is_instructor_of_course", {
        p_course_id: cid,
      });
      if (isOwner) allowedCourseIds.push(cid);
    }
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: {
      role: "student",
      company_id: targetCompanyId,
    },
    user_metadata: {
      full_name: parsed.data.fullName.trim(),
      department: parsed.data.department?.trim() || "General",
      job_title: parsed.data.jobTitle?.trim() || "Alumno",
      employee_code: parsed.data.employeeCode?.trim() || null,
    },
  });

  if (createErr || !created.user) {
    return {
      success: false,
      error: createErr?.message ?? "No se pudo crear el alumno (verificá si el email ya existe).",
    };
  }

  let enrolledCount = 0;
  if (allowedCourseIds.length > 0) {
    // Asegurar licencia activa del curso para la empresa del alumno
    await admin.from("company_course_licenses").upsert(
      allowedCourseIds.map((courseId) => ({
        company_id: targetCompanyId!,
        course_id: courseId,
        is_active: true,
        assigned_by: profile.id,
      })),
      { onConflict: "company_id,course_id" }
    );

    const { error: enrErr } = await admin.from("enrollments").upsert(
      allowedCourseIds.map((courseId) => ({
        user_id: created.user.id,
        course_id: courseId,
        company_id: targetCompanyId!,
        assigned_by: profile.id,
        is_mandatory: true,
        due_date: parsed.data.dueDate ? new Date(parsed.data.dueDate).toISOString() : null,
      })),
      { onConflict: "user_id,course_id" }
    );

    if (!enrErr) enrolledCount = allowedCourseIds.length;
  }

  revalidatePath("/instructor/alumnos");
  revalidatePath("/admin/empresas");
  revalidatePath("/rrhh/empleados");

  return { success: true, data: { userId: created.user.id, enrolledCount } };
}

/**
 * Permite al Instructor (o Super Admin) matricular alumnos existentes en uno de sus cursos
 */
export async function enrollStudentsByInstructorAction(input: {
  courseId: string;
  studentIds: string[];
  isMandatory?: boolean;
  dueDate?: string | null;
}): Promise<ActionResult<{ count: number }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
    return { success: false, error: "Sin permisos." };
  }

  const parsed = enrollStudentsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  if (profile.role === "instructor") {
    const supabase = await createClient();
    const { data: isOwner } = await supabase.rpc("is_instructor_of_course", {
      p_course_id: parsed.data.courseId,
    });
    if (!isOwner) {
      return { success: false, error: "Solo podés matricular alumnos en tus propios cursos." };
    }
  }

  const admin = createAdminClient();
  const { data: students } = await admin
    .from("profiles")
    .select("id, company_id")
    .in("id", parsed.data.studentIds)
    .eq("role", "student");

  const validStudents = (students ?? []).filter((s) => Boolean(s.company_id));
  if (validStudents.length === 0) {
    return { success: false, error: "Los alumnos seleccionados no tienen una empresa asignada." };
  }

  const uniqueCompanyIds = Array.from(new Set(validStudents.map((s) => s.company_id as string)));
  await admin.from("company_course_licenses").upsert(
    uniqueCompanyIds.map((companyId) => ({
      company_id: companyId,
      course_id: parsed.data.courseId,
      is_active: true,
      assigned_by: profile.id,
    })),
    { onConflict: "company_id,course_id" }
  );

  const { error } = await admin.from("enrollments").upsert(
    validStudents.map((s) => ({
      user_id: s.id,
      course_id: parsed.data.courseId,
      company_id: s.company_id as string,
      assigned_by: profile.id,
      is_mandatory: parsed.data.isMandatory,
      due_date: parsed.data.dueDate ? new Date(parsed.data.dueDate).toISOString() : null,
    })),
    { onConflict: "user_id,course_id" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath("/instructor/alumnos");
  return { success: true, data: { count: validStudents.length } };
}

