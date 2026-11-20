import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Award, BarChart3, BookOpenCheck, ShieldCheck } from "lucide-react";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function HomePage() {
  const { user } = await getCurrentUserWithProfile();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              CP
            </div>
            <div>
              <span className="block text-base font-bold leading-none tracking-tight">CapacitaPro</span>
              <span className="text-[11px] font-medium text-muted-foreground">
                Campus Virtual • Solution Academy
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

      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            LMS Empresarial Multi-Tenant B2B
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Formación técnica y corporativa de{" "}
            <span className="text-primary">nivel producción</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Rigor académico y evaluaciones avanzadas estilo Moodle con una experiencia moderna,
            rápida y gamificada para empresas, instructores y alumnos.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg">
                Acceder al Campus Virtual
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/registro">
              <Button size="lg" variant="outline">
                Crear Cuenta de Alumno
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: BookOpenCheck,
              title: "Modo Focus & Correlatividades",
              desc: "Avance secuencial por módulo, notas personales y foro contextual debajo de cada clase.",
            },
            {
              icon: ShieldCheck,
              title: "Evaluaciones Avanzadas",
              desc: "Bancos aleatorios, timer en vivo, 5 tipos de preguntas y corrección automática + manual.",
            },
            {
              icon: Award,
              title: "Diplomas PDF con QR",
              desc: "Emisión automática al 100% + examen aprobado con ruta pública /verificar/[codigo].",
            },
            {
              icon: BarChart3,
              title: "Analítica RRHH & Excel",
              desc: "Importación masiva de nóminas, asignación con fecha límite y reportes exportables.",
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

