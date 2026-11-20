"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flame,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Upload,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { LessonType } from "@/types/database.types";

export interface SidebarLessonItem {
  id: string;
  slug: string;
  title: string;
  lesson_type: LessonType;
  duration_minutes: number;
  completed: boolean;
}

export interface SidebarModuleItem {
  id: string;
  title: string;
  position: number;
  unlocked: boolean;
  requires_quiz_pass: boolean;
  lessons: SidebarLessonItem[];
}

function getLessonIcon(type: LessonType) {
  switch (type) {
    case "video":
      return PlayCircle;
    case "quiz":
      return ClipboardList;
    case "assignment":
      return Upload;
    default:
      return FileText;
  }
}

export function FocusShell({
  courseTitle,
  courseSlug,
  progressPercentage,
  xpPoints,
  currentStreak,
  certificateCode,
  modules,
  children,
}: {
  courseTitle: string;
  courseSlug: string;
  progressPercentage: number;
  xpPoints: number;
  currentStreak: number;
  certificateCode: string | null;
  modules: SidebarModuleItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Focus Topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <Link href="/mis-cursos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Mis Cursos</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Alternar temario"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
          <h1 className="max-w-[180px] truncate text-sm font-bold sm:max-w-md">{courseTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          {certificateCode && (
            <a href={`/api/certificates/${certificateCode}/pdf`}>
              <Button size="sm" variant="default" className="hidden bg-emerald-600 hover:bg-emerald-700 md:inline-flex">
                <Award className="h-4 w-4" />
                Descargar Diploma
              </Button>
            </a>
          )}
          <div className="hidden items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold lg:flex">
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Flame className="h-3.5 w-3.5" /> {currentStreak}d
            </span>
            <span className="text-border">|</span>
            <span className="inline-flex items-center gap-1 text-primary">
              <Zap className="h-3.5 w-3.5" /> {xpPoints} XP
            </span>
          </div>
          <div className="hidden w-36 items-center gap-2 sm:flex">
            <Progress value={progressPercentage} className="h-2" />
            <span className="text-xs font-semibold tabular-nums">{progressPercentage}%</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Collapsible Syllabus Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Temario del Curso
              </p>
              <span className="text-xs font-bold text-primary">{progressPercentage}%</span>
            </div>

            {certificateCode && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <Award className="h-4 w-4" /> ¡Curso Certificado!
                </p>
                <div className="mt-2 flex gap-2">
                  <a href={`/api/certificates/${certificateCode}/pdf`} className="font-semibold text-primary underline">
                    Descargar PDF
                  </a>
                  <span>•</span>
                  <Link href={`/verificar/${certificateCode}`} target="_blank" className="font-semibold text-primary underline">
                    Ver QR
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {modules.map((mod) => (
                <div key={mod.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 px-2 py-1">
                    <p className="text-xs font-bold text-foreground">{mod.title}</p>
                    {!mod.unlocked && (
                      <span title="Completá el módulo anterior y aprobá su examen">
                        <Lock className="h-3.5 w-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {mod.lessons.map((lesson) => {
                      const href =
                        lesson.lesson_type === "quiz"
                          ? `/aprender/${courseSlug}/leccion/${lesson.slug}/examen`
                          : `/aprender/${courseSlug}/leccion/${lesson.slug}`;
                      const isActive = pathname === href;
                      const Icon = getLessonIcon(lesson.lesson_type);

                      if (!mod.unlocked) {
                        return (
                          <div
                            key={lesson.id}
                            className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground opacity-55"
                          >
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{lesson.title}</span>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={lesson.id}
                          href={href}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {lesson.completed ? (
                              <CheckCircle2
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  isActive ? "text-primary-foreground" : "text-emerald-500"
                                )}
                              />
                            ) : (
                              <Icon className="h-4 w-4 shrink-0" />
                            )}
                            <span className="truncate">{lesson.title}</span>
                          </div>
                          <span className="shrink-0 text-[10px] opacity-75">
                            {lesson.duration_minutes}m
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto p-5 md:p-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
