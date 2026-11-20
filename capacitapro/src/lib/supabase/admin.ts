import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente privilegiado con Service Role Key.
 * USAR EXCLUSIVAMENTE en Server Actions y Route Handlers tras verificar sesión y rol del llamador.
 * Nunca importar desde componentes client ("use client").
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

