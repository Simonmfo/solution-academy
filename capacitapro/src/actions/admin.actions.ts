"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignLicenseSchema, createCompanySchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/actions/auth.actions";

const createStaffUserSchema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["company_admin", "instructor", "student"]),
  companyId: z.string().uuid("Empresa inválida"),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
});

export async function createCompanyAction(input: {
  name: string;
  slug: string;
  taxId?: string;
  primaryColor?: string;
  maxSeats?: number;
}): Promise<ActionResult<{ id: string }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || profile.role !== "super_admin") {
    return { success: false, error: "Acceso denegado: solo Super Admin." };
  }

  const parsed = createCompanySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      tax_id: parsed.data.taxId || null,
      primary_color: parsed.data.primaryColor,
      max_seats: parsed.data.maxSeats,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/empresas");
  return { success: true, data: { id: data.id } };
}

export async function createCompanyUserAction(input: {
  fullName: string;
  email: string;
  password: string;
  role: "company_admin" | "instructor" | "student";
  companyId: string;
  department?: string;
  jobTitle?: string;
}): Promise<ActionResult<{ userId: string }>> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || profile.role !== "super_admin") {
    return { success: false, error: "Acceso denegado: solo Super Admin." };
  }

  const parsed = createStaffUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: {
      role: parsed.data.role,
      company_id: parsed.data.companyId,
    },
    user_metadata: {
      full_name: parsed.data.fullName.trim(),
      department: parsed.data.department || "Dirección",
      job_title: parsed.data.jobTitle || "Responsable",
    },
  });

  if (error || !data.user) {
    return { success: false, error: error?.message ?? "No se pudo crear el usuario." };
  }

  revalidatePath("/admin/empresas");
  return { success: true, data: { userId: data.user.id } };
}

export async function assignCourseLicenseAction(input: {
  companyId: string;
  courseId: string;
  maxEnrollments?: number | null;
  validUntil?: string | null;
}): Promise<ActionResult> {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile || profile.role !== "super_admin") {
    return { success: false, error: "Acceso denegado: solo Super Admin." };
  }

  const parsed = assignLicenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("company_course_licenses").upsert(
    {
      company_id: parsed.data.companyId,
      course_id: parsed.data.courseId,
      max_enrollments: parsed.data.maxEnrollments ?? null,
      valid_until: parsed.data.validUntil || null,
      is_active: true,
      assigned_by: profile.id,
    },
    { onConflict: "company_id,course_id" }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/empresas");
  return { success: true };
}
