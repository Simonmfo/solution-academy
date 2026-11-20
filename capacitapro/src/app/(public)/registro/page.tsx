"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validations/schemas";
import { registerAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [registered, setRegistered] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { companySlug: "solution-academy-empresas" },
  });

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);
    const res = await registerAction(values);
    if (!res.success) {
      setServerError(res.error ?? "No se pudo completar el registro");
      return;
    }
    setRegistered(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Crear Cuenta en CapacitaPro</CardTitle>
          <CardDescription>
            Vinculate a tu empresa para comenzar tus capacitaciones certificadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registered ? (
            <div className="space-y-4 py-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="text-lg font-semibold">¡Cuenta creada correctamente!</h3>
              <p className="text-sm text-muted-foreground">
                Revisá tu correo si tenés confirmación de email activa en Supabase, o iniciá sesión
                directamente.
              </p>
              <Link href="/login">
                <Button className="w-full">Ir al Inicio de Sesión</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nombre y Apellido</Label>
                <Input id="fullName" placeholder="Ej. Lucas Fernández" {...register("fullName")} />
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" placeholder="nombre@empresa.com" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...register("password")} />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="companySlug">Código de Empresa (slug)</Label>
                <Input
                  id="companySlug"
                  placeholder="solution-academy-empresas"
                  {...register("companySlug")}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear Cuenta
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tenés cuenta?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Iniciá sesión
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

