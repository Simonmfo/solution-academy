import { redirect } from "next/navigation";
import { AlertTriangle, LogOut } from "lucide-react";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { PlatformShell } from "@/components/layout/platform-shell";
import { signOutAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, profileError } = await getCurrentUserWithProfile();

  if (!user) {
    redirect("/login");
  }

  // Nunca redirigir a /login si user ya está autenticado (evita ERR_TOO_MANY_REDIRECTS)
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Perfil no encontrado en la base de datos
            </CardTitle>
            <CardDescription>
              Iniciaste sesión como <strong>{user.email}</strong>, pero no se pudo cargar tu registro
              en <code>public.profiles</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {profileError && (
              <div className="rounded-lg bg-destructive/10 p-3 font-mono text-xs text-destructive">
                Detalle técnico: {profileError}
              </div>
            )}
            <p className="text-muted-foreground">
              Verificá que <code>SUPABASE_SERVICE_ROLE_KEY</code> esté cargada en Vercel /{" "}
              <code>.env.local</code> y que hayas ejecutado la migración SQL y <code>seed.sql</code>{" "}
              en Supabase.
            </p>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="w-full">
                <LogOut className="h-4 w-4" />
                Cerrar Sesión y Volver al Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PlatformShell profile={profile}>{children}</PlatformShell>;
}
