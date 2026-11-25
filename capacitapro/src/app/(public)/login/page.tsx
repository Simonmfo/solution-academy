"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Copy, Loader2, Lock, Mail } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/schemas";
import { loginAction } from "@/actions/auth.actions";
import { SOLUTION_ACADEMY } from "@/lib/solution-academy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_PASSWORD = "CapacitaPro2026!";

const DEMO_ACCOUNTS = [
  { role: "Dirección / Admin", email: "superadmin@capacitapro.demo" },
  { role: "Instructor", email: "instructor@capacitapro.demo" },
  { role: "Alumno", email: "alumno@capacitapro.demo" },
  { role: "Coord. Convenio", email: "rrhh@capacitapro.demo" },
] as const;

function LoginFormInner() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const handleCopy = (key: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleFillAccount = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setServerError(null);
  };

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

          <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">Accesos de Prueba</p>
              <button
                type="button"
                onClick={() => handleCopy("pass", DEMO_PASSWORD)}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground hover:bg-accent"
                title="Copiar contraseña"
              >
                Clave: {DEMO_PASSWORD}
                {copiedKey === "pass" ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.email}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{acc.role}</p>
                    <code className="block truncate text-[11px] text-muted-foreground select-all">
                      {acc.email}
                    </code>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(acc.email, acc.email)}
                      className="rounded border border-border p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Copiar correo"
                    >
                      {copiedKey === acc.email ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillAccount(acc.email)}
                      className="rounded bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
                    >
                      Usar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

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

