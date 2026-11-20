"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/schemas";

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
      error: "Credenciales incorrectas o cuenta no habilitada.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * El auto-registro público está deshabilitado por política de seguridad:
 * solo Instructores (alumnos) y Super Admin (instructores, alumnos y RRHH) pueden dar de alta cuentas.
 */
export async function registerAction(): Promise<ActionResult> {
  return {
    success: false,
    error:
      "El registro público está deshabilitado. Solicitá tu acceso a tu Instructor o Administrador.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
