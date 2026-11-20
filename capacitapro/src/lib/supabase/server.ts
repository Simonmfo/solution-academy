import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Company, Profile, UserRole } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll puede ser invocado desde un Server Component donde no se pueden mutar cookies;
            // el middleware se encarga del refresh de sesión.
          }
        },
      },
    }
  );
}

/**
 * Deduplicado por request con React.cache().
 * Consulta profiles por separado de companies y auto-repara el perfil si un usuario
 * autenticado aún no tenía fila en public.profiles, evitando cualquier loop de redirección.
 */
export const getCurrentUserWithProfile = cache(async (): Promise<{
  user: { id: string; email: string } | null;
  profile: Profile | null;
  profileError?: string;
}> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  let rawProfile: Profile | null = null;
  let lastError: string | undefined;

  const { data: ownProfile, error: ownErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (ownProfile) {
    rawProfile = ownProfile as Profile;
  } else {
    if (ownErr) lastError = ownErr.message;

    // Fallback seguro en servidor: buscar o auto-crear el perfil si falta en public.profiles
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createAdminClient();
        const { data: adminProfile, error: adminReadErr } = await admin
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (adminProfile) {
          rawProfile = adminProfile as Profile;
        } else {
          if (adminReadErr) lastError = adminReadErr.message;

          const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
          const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
          const validRoles: UserRole[] = ["super_admin", "company_admin", "instructor", "student"];
          const rawRole = String(appMeta.role ?? "student") as UserRole;
          const role: UserRole = validRoles.includes(rawRole) ? rawRole : "student";

          let companyId =
            (typeof appMeta.company_id === "string" && appMeta.company_id) ||
            (typeof userMeta.company_id === "string" && userMeta.company_id) ||
            null;

          if (!companyId && (role === "student" || role === "company_admin")) {
            const { data: defaultCompany } = await admin
              .from("companies")
              .select("id")
              .eq("is_active", true)
              .limit(1)
              .maybeSingle();
            companyId = defaultCompany?.id ?? null;
          }

          const { data: created, error: createErr } = await admin
            .from("profiles")
            .upsert(
              {
                id: user.id,
                email: user.email ?? "",
                full_name:
                  (typeof userMeta.full_name === "string" && userMeta.full_name.trim()) ||
                  (user.email ?? "Usuario").split("@")[0],
                role,
                company_id: companyId,
                is_active: role === "super_admin" || role === "instructor" || Boolean(companyId),
              },
              { onConflict: "id" }
            )
            .select("*")
            .single();

          if (created) {
            rawProfile = created as Profile;
            lastError = undefined;
          } else if (createErr) {
            lastError = createErr.message;
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Error leyendo perfil de usuario";
      }
    }
  }

  if (!rawProfile) {
    return {
      user: { id: user.id, email: user.email ?? "" },
      profile: null,
      profileError: lastError ?? "No se encontró el perfil del usuario en public.profiles.",
    };
  }

  // Cargar empresa por separado para que nunca falle la lectura del perfil
  let company: Company | null = null;
  if (rawProfile.company_id) {
    const { data: comp } = await supabase
      .from("companies")
      .select("*")
      .eq("id", rawProfile.company_id)
      .maybeSingle();
    company = (comp as Company | null) ?? null;
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: { ...rawProfile, company },
  };
});
