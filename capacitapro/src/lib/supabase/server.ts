import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Profile } from "@/types/database.types";

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
 * Deduplicado por request con React.cache() para evitar waterfalls en Server Components
 */
export const getCurrentUserWithProfile = cache(async (): Promise<{
  user: { id: string; email: string } | null;
  profile: Profile | null;
}> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, company:companies(*)")
    .eq("id", user.id)
    .single();

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: (profile as Profile | null) ?? null,
  };
});
