import { Flame, Sparkles, Trophy, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ActivityDay {
  activity_date: string;
  lessons_completed: number;
  xp_earned: number;
}

interface XpEntry {
  id: string;
  source_type: string;
  points: number;
  description: string | null;
  created_at: string;
}

function getLevelInfo(xp: number) {
  const tiers = [
    { level: 1, title: "Aprendiz Técnico", min: 0, max: 300 },
    { level: 2, title: "Operador en Formación", min: 300, max: 800 },
    { level: 3, title: "Especialista Certificado", min: 800, max: 1600 },
    { level: 4, title: "Operador Senior", min: 1600, max: 3000 },
    { level: 5, title: "Maestro Industrial", min: 3000, max: 6000 },
  ];
  const current = tiers.find((t) => xp < t.max) ?? tiers[tiers.length - 1];
  const span = Math.max(1, current.max - current.min);
  const progress = Math.min(100, Math.round(((xp - current.min) / span) * 100));
  return { ...current, progress, remaining: Math.max(0, current.max - xp) };
}

export function StreakXpPanel({
  xpPoints,
  currentStreak,
  longestStreak,
  activityDays,
  recentXp,
}: {
  xpPoints: number;
  currentStreak: number;
  longestStreak: number;
  activityDays: ActivityDay[];
  recentXp: XpEntry[];
}) {
  const levelInfo = getLevelInfo(xpPoints);

  // Construir los últimos 14 días calendario
  const activeMap = new Map(activityDays.map((d) => [d.activity_date, d]));
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const iso = d.toISOString().slice(0, 10);
    const entry = activeMap.get(iso);
    return {
      iso,
      label: d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }),
      xp: entry?.xp_earned ?? 0,
      lessons: entry?.lessons_completed ?? 0,
    };
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Nivel y Racha de 14 días */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5 text-amber-500" />
              Racha de Estudio y Progreso de Nivel
            </CardTitle>
            <Badge variant="default">
              <Sparkles className="h-3 w-3" /> Nivel {levelInfo.level}: {levelInfo.title}
            </Badge>
          </div>
          <CardDescription>
            Racha actual: <strong>{currentStreak} días</strong> • Mejor racha:{" "}
            <strong>{longestStreak} días</strong> • Faltan {levelInfo.remaining} XP para el próximo nivel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-primary">{xpPoints} XP acumulados</span>
              <span className="text-muted-foreground">{levelInfo.max} XP</span>
            </div>
            <Progress value={levelInfo.progress} className="h-2.5" />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Actividad diaria (últimos 14 días)
            </p>
            <div className="grid grid-cols-7 gap-2">
              {last14Days.map((day) => {
                const active = day.xp > 0 || day.lessons > 0;
                return (
                  <div
                    key={day.iso}
                    title={`${day.label}: ${day.xp} XP, ${day.lessons} lección(es)`}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-colors ${
                      active
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-bold">{day.iso.slice(8)}</span>
                    <span
                      className={`mt-1 h-2 w-2 rounded-full ${
                        active ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial de Puntos XP */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" />
            Movimientos de XP
          </CardTitle>
          <CardDescription>Registro automático de logros recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentXp.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Completá tu primera lección o evaluación para empezar a sumar puntos XP.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentXp.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {item.description || item.source_type}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <Badge variant="success" className="shrink-0">
                    <Zap className="h-3 w-3" /> +{item.points}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
