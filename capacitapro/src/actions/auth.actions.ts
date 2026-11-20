"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema, registerSchema } from "@/lib/validations/schemas";

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: "Credenciales incorrectas o cuenta no confirmada.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function registerAction(formData: {
  fullName: string;
  email: string;
  password: string;
  companySlug?: string;
}): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  let companyId: string | undefined;
  if (parsed.data.companySlug && parsed.data.companySlug.trim()) {
    const admin = createAdminClient();
    const { data: company } = await admin
      .from("companies")
      .select("id")
      .eq("slug", parsed.data.companySlug.trim().toLowerCase())
      .eq("is_active", true)
      .single();

    if (!company) {
      return { success: false, error: "Código de empresa no encontrado o inactivo." };
    }
    companyId = company.id;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        ...(companyId ? { company_id: companyId } : {}),
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

