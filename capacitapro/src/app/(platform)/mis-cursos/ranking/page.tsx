import { Flame, Trophy, Zap } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LeaderboardPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("company_leaderboard")
    .select("*")
    .eq("company_id", profile.company_id ?? "")
    .order("company_rank", { ascending: true })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tabla de Posiciones</h1>
        <p className="text-sm text-muted-foreground">
          Ranking de puntos XP y rachas activas dentro de {profile.company?.name ?? "tu organización"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Colaboradores en Capacitación
          </CardTitle>
          <CardDescription>
            Sumás XP al completar lecciones, aprobar evaluaciones y mantener tu racha diaria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!rows || rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              El ranking está desactivado para tu empresa o todavía no hay actividad registrada.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => {
                const isMe = row.user_id === profile.id;
                return (
                  <div
                    key={row.user_id}
                    className={`flex items-center justify-between gap-4 py-3.5 ${
                      isMe ? "rounded-lg bg-primary/5 px-3" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                        #{row.company_rank}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          {row.full_name} {isMe && <Badge className="ml-1.5">Vos</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{row.department ?? "General"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-semibold">
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Flame className="h-4 w-4" /> {row.current_streak}d
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Zap className="h-4 w-4" /> {row.xp_points} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

