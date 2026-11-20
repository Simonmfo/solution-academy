import Link from "next/link";
import { AlertTriangle, Award, BookOpen, CalendarClock, Flame, PlayCircle, Zap } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { formatDate, isOverdue } from "@/lib/utils";
import { StreakXpPanel } from "@/components/gamification/streak-xp-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default async function StudentCoursesPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [{ data: enrollments }, { count: certCount }, { data: activityDays }, { data: recentXp }] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("*, course:courses(id, title, slug, short_description, category, level, estimated_hours, is_sequential)")
        .eq("user_id", profile.id)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("certificates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id),
      supabase
        .from("user_activity_days")
        .select("activity_date, lessons_completed, xp_earned")
        .eq("user_id", profile.id)
        .gte("activity_date", fourteenDaysAgo.toISOString().slice(0, 10))
        .order("activity_date", { ascending: true }),
      supabase
        .from("xp_ledger")
        .select("id, source_type, points, description, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const list = enrollments ?? [];
  const completedCount = list.filter((e) => e.status === "completed").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Hola, {profile.full_name || "Estudiante"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Continuá tus capacitaciones asignadas, acumulá puntos XP y obtené tus diplomas verificables.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/certificados">
            <Button variant="outline" size="sm">
              <Award className="h-4 w-4" /> Mis Diplomas
            </Button>
          </Link>
          <Link href="/mis-cursos/ranking">
            <Button variant="outline" size="sm">
              Ranking Empresa
            </Button>
          </Link>
        </div>
      </div>

      {/* Gamification & Progress KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cursos Activos</p>
              <p className="text-2xl font-bold">{list.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Racha Actual</p>
              <p className="text-2xl font-bold">{profile.current_streak} días</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Puntos XP</p>
              <p className="text-2xl font-bold">{profile.xp_points}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Diplomas Obtenidos</p>
              <p className="text-2xl font-bold">
                {certCount ?? 0}{" "}
                <span className="text-xs font-normal text-muted-foreground">({completedCount} fin.)</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course Grid */}
      {list.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Todavía no tenés cursos asignados</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando RRHH te asigne una capacitación obligatoria u optativa, aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((enr) => {
            const course = Array.isArray(enr.course) ? enr.course[0] : enr.course;
            if (!course) return null;
            const overdue = isOverdue(enr.due_date, enr.status);
            const pct = Number(enr.progress_percentage ?? 0);

            return (
              <Card key={enr.id} className="flex flex-col justify-between transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline">{course.category}</Badge>
                    {enr.status === "completed" ? (
                      <Badge variant="success">Completado</Badge>
                    ) : overdue ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3" /> Vencido
                      </Badge>
                    ) : enr.is_mandatory ? (
                      <Badge variant="warning">Obligatorio</Badge>
                    ) : (
                      <Badge variant="secondary">Optativo</Badge>
                    )}
                  </div>
                  <CardTitle className="line-clamp-2 text-lg">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {course.short_description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Progreso</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Límite: {formatDate(enr.due_date)}
                    </span>
                    {enr.final_grade !== null && (
                      <span className="font-semibold text-foreground">Nota: {enr.final_grade}%</span>
                    )}
                  </div>
                </CardContent>

                <CardFooter>
                  <Link href={`/aprender/${course.slug}`} className="w-full">
                    <Button className="w-full">
                      <PlayCircle className="h-4 w-4" />
                      {pct > 0 ? "Continuar en Modo Focus" : "Comenzar Curso"}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Streak Calendar + XP History Panel */}
      <StreakXpPanel
        xpPoints={profile.xp_points}
        currentStreak={profile.current_streak}
        longestStreak={profile.longest_streak}
        activityDays={
          (activityDays as Array<{
            activity_date: string;
            lessons_completed: number;
            xp_earned: number;
          }>) ?? []
        }
        recentXp={
          (recentXp as Array<{
            id: string;
            source_type: string;
            points: number;
            description: string | null;
            created_at: string;
          }>) ?? []
        }
      />
    </div>
  );
}
