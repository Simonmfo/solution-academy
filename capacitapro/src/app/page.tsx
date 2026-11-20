import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Award, BookOpenCheck, ShieldCheck, Wrench } from "lucide-react";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { SOLUTION_ACADEMY } from "@/lib/solution-academy";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function HomePage() {
  const { user } = await getCurrentUserWithProfile();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SOLUTION_ACADEMY.logoPath}
              alt={SOLUTION_ACADEMY.name}
              className="h-10 w-10 rounded-lg border border-border object-cover shadow-sm"
            />
            <div>
              <span className="block text-base font-bold leading-none tracking-tight">
                {SOLUTION_ACADEMY.name}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {SOLUTION_ACADEMY.campusTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button size="sm">
                Iniciar Sesión
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 md:py-22">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-primary">
            {SOLUTION_ACADEMY.name.toUpperCase()} • {SOLUTION_ACADEMY.tagline.toUpperCase()}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Campus Virtual de{" "}
            <span className="text-primary">{SOLUTION_ACADEMY.name}</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Formación técnica práctica en Operación de Maquinaria Pesada, Construcción y Oficios,
            Soldadura y Seguridad Industrial. Accedé a tus clases, material técnico, exámenes y
            diplomas oficiales verificables con QR.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg">
                Ingresar al Campus
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/verificar">
              <Button size="lg" variant="outline">
                Validar Certificado QR
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Wrench,
              title: "Especialidades Técnicas",
              desc: "Retroexcavadora, Autoelevador (Clark), Pala Cargadora, Steel Framing, Electricidad y Soldadura.",
            },
            {
              icon: BookOpenCheck,
              title: "Cursado Guiado y Correlativo",
              desc: "Clases en video, manuales PDF descargables, notas personales y consultas directas al instructor.",
            },
            {
              icon: ShieldCheck,
              title: "Exámenes Técnicos Certificadores",
              desc: "Evaluaciones cronometradas con banco de preguntas oficial y seguimiento real de tu avance.",
            },
            {
              icon: Award,
              title: "Diploma Oficial con QR",
              desc: "Certificado PDF de Solution Academy emitido automáticamente al aprobar, verificable online.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
