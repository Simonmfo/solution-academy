import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/database.types";
import { getDefaultRouteForRole } from "@/lib/utils";

const PUBLIC_PATHS = ["/", "/login", "/registro", "/verificar", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectWithCookies(url: URL, sourceResponse: NextResponse): NextResponse {
  const response = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  // Sin sesión intentando acceder a ruta privada -> /login
  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return redirectWithCookies(redirectUrl, supabaseResponse);
  }

  // Con sesión en /login o /registro -> redirigir directo al home de su rol (sin pasar en loop por /dashboard)
  if (
    user &&
    (pathname === "/login" || pathname === "/registro") &&
    !request.nextUrl.searchParams.has("error")
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const appRole = (user.app_metadata as { role?: UserRole } | undefined)?.role;
    const role = (profile?.role as UserRole | undefined) ?? appRole ?? "student";
    const targetPath = getDefaultRouteForRole(role);

    if (targetPath !== pathname) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = targetPath;
      redirectUrl.search = "";
      return redirectWithCookies(redirectUrl, supabaseResponse);
    }
  }

  // Control de acceso por rol en rutas administrativas (redirige al home real del rol, nunca en loop)
  if (
    user &&
    (pathname.startsWith("/admin") ||
      pathname.startsWith("/rrhh") ||
      pathname.startsWith("/instructor"))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // Si el perfil aún no se puede leer desde middleware, dejamos que el Server Layout lo resuelva o muestre error sin loop
    const appRole = (user.app_metadata as { role?: UserRole } | undefined)?.role;
    const role = (profile?.role as UserRole | undefined) ?? appRole;

    if (role) {
      const fallbackPath = getDefaultRouteForRole(role);

      if (pathname.startsWith("/admin") && role !== "super_admin" && fallbackPath !== pathname) {
        return redirectWithCookies(new URL(fallbackPath, request.url), supabaseResponse);
      }
      if (
        pathname.startsWith("/rrhh") &&
        role !== "company_admin" &&
        role !== "super_admin" &&
        fallbackPath !== pathname
      ) {
        return redirectWithCookies(new URL(fallbackPath, request.url), supabaseResponse);
      }
      if (
        pathname.startsWith("/instructor") &&
        role !== "instructor" &&
        role !== "super_admin" &&
        fallbackPath !== pathname
      ) {
        return redirectWithCookies(new URL(fallbackPath, request.url), supabaseResponse);
      }
    }
  }

  return supabaseResponse;
}
