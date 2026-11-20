import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient, getCurrentUserWithProfile } from "@/lib/supabase/server";
import { CreateCourseForm } from "@/components/instructor/course-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InstructorCoursesPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const query = supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: courses } =
    profile.role === "super_admin"
      ? await query
      : await query.eq("instructor_id", profile.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestión de Cursos (Instructor)</h1>
        <p className="text-sm text-muted-foreground">
          Creá cursos, configurá módulos correlativos, lecciones multimedia y bancos de preguntas.
        </p>
      </div>

      <CreateCourseForm />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {(courses ?? []).map((course) => (
          <Card key={course.id} className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Badge variant={course.status === "published" ? "success" : "secondary"}>
                  {course.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{course.estimated_hours} hs</span>
              </div>
              <CardTitle className="mt-2 text-lg">{course.title}</CardTitle>
              <CardDescription className="line-clamp-2">{course.short_description}</CardDescription>
            </CardHeader>
            <CardFooter className="flex gap-2">
              <Link href={`/instructor/cursos/${course.id}/editar`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Pencil className="h-3.5 w-3.5" /> Editar Temario y Banco
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
