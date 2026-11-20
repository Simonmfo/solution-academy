"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/schemas";
import { loginAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    const res = await loginAction(values);
    if (!res.success) {
      setServerError(res.error ?? "Error al iniciar sesión");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">
          CP
        </div>
        <CardTitle className="text-2xl font-bold">Ingresá a CapacitaPro</CardTitle>
        <CardDescription>
          Campus Virtual Corporativo de Solution Academy
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo corporativo o personal</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="alumno@capacitapro.demo"
                className="pl-9"
                {...register("email")}
              />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-9"
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando acceso...
              </>
            ) : (
              <>
                Ingresar al Campus
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Accesos Demo (tras ejecutar seed.sql):</p>
            <p className="mt-1">Alumno: <code>alumno@capacitapro.demo</code></p>
            <p>RRHH: <code>rrhh@capacitapro.demo</code> • Instructor: <code>instructor@capacitapro.demo</code></p>
            <p>Super Admin: <code>superadmin@capacitapro.demo</code> • Clave: <code>CapacitaPro2026!</code></p>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            ¿Todavía no tenés cuenta?{" "}
            <Link href="/registro" className="font-semibold text-primary hover:underline">
              Registrate acá
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <React.Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <LoginFormInner />
      </React.Suspense>
    </div>
  );
}

