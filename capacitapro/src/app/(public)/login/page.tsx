"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/schemas";
import { loginAction } from "@/actions/auth.actions";
import { SOLUTION_ACADEMY } from "@/lib/solution-academy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginFormInner() {
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
    window.location.assign(redirectTo);
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-2.5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SOLUTION_ACADEMY.logoPath}
          alt={SOLUTION_ACADEMY.name}
          className="mx-auto h-16 w-16 rounded-2xl border border-border object-cover shadow-md"
        />
        <CardTitle className="text-2xl font-bold">{SOLUTION_ACADEMY.name}</CardTitle>
        <CardDescription>
          {SOLUTION_ACADEMY.campusTitle} • {SOLUTION_ACADEMY.tagline}
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
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="tu.correo@ejemplo.com"
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

          <p className="text-center text-xs text-muted-foreground">
            Acceso exclusivo para alumnos, instructores y equipo de{" "}
            <strong className="text-foreground">{SOLUTION_ACADEMY.name}</strong>. Si todavía no
            tenés usuario, solicitalo a tu instructor o a la dirección académica.
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

