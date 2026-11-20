"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  Flame,
  GraduationCap,
  LogOut,
  Menu,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Profile, UserRole } from "@/types/database.types";
import { cn, getRoleLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { signOutAction } from "@/actions/auth.actions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Mis Cursos", href: "/mis-cursos", icon: BookOpen, roles: ["student"] },
  { label: "Ranking Empresa", href: "/mis-cursos/ranking", icon: Trophy, roles: ["student"] },
  { label: "Mis Diplomas", href: "/certificados", icon: Award, roles: ["student"] },

  { label: "Dashboard RRHH", href: "/rrhh", icon: BarChart3, roles: ["company_admin", "super_admin"] },
  { label: "Empleados e Importación", href: "/rrhh/empleados", icon: Users, roles: ["company_admin", "super_admin"] },
  { label: "Certificados Empresa", href: "/rrhh/certificados", icon: Award, roles: ["company_admin", "super_admin"] },

  { label: "Gestión de Cursos", href: "/instructor/cursos", icon: GraduationCap, roles: ["instructor", "super_admin"] },
  { label: "Gestión de Alumnos", href: "/instructor/alumnos", icon: Users, roles: ["instructor", "super_admin"] },
  { label: "Bandeja de Correcciones", href: "/instructor/correcciones", icon: ClipboardCheck, roles: ["instructor", "super_admin"] },

  { label: "Empresas y Usuarios", href: "/admin/empresas", icon: Building2, roles: ["super_admin"] },
];

export function PlatformShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            CP
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-none">CapacitaPro</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile.company?.name ?? "Plataforma Global"}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {allowedNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 rounded-lg bg-secondary/70 p-3">
            <p className="truncate text-sm font-semibold">{profile.full_name || profile.email}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-[11px]">
                {getRoleLabel(profile.role)}
              </Badge>
              {profile.role === "student" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <Zap className="h-3.5 w-3.5" /> {profile.xp_points} XP
                </span>
              )}
            </div>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Abrir menú"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <span className="text-sm font-semibold text-muted-foreground">
              {profile.company?.name ?? "Solution Academy • CapacitaPro"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {profile.role === "student" && (
              <div className="hidden items-center gap-3 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold sm:flex">
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Flame className="h-4 w-4" /> {profile.current_streak} días
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  <Zap className="h-4 w-4" /> {profile.xp_points} XP
                </span>
              </div>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="border-b border-border bg-card p-3 lg:hidden">
            <nav className="space-y-1">
              {allowedNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

