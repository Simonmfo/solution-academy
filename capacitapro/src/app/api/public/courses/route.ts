import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Catálogo público de cursos publicados en CapacitaPro para sincronizar
 * en vivo con la home page de Solution Academy.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: courses, error } = await admin
      .from("courses")
      .select(
        "id, slug, title, short_description, description, category, level, estimated_hours, passing_score, is_sequential, certificate_enabled, xp_reward, created_at"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message, courses: [] },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const courseIds = (courses ?? []).map((c) => c.id as string);
    const [{ data: modules }, { data: lessons }] =
      courseIds.length > 0
        ? await Promise.all([
            admin
              .from("modules")
              .select("id, course_id, title, description, position")
              .in("course_id", courseIds)
              .eq("is_published", true)
              .order("position", { ascending: true }),
            admin
              .from("lessons")
              .select("id, course_id, module_id, lesson_type")
              .in("course_id", courseIds)
              .eq("is_published", true),
          ])
        : [{ data: [] }, { data: [] }];

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "https://capacitapro-solutionacademy.vercel.app"
    ).replace(/\/$/, "");

    const payload = (courses ?? []).map((course) => {
      const courseModules = (modules ?? []).filter((m) => m.course_id === course.id);
      const courseLessons = (lessons ?? []).filter((l) => l.course_id === course.id);

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        short_description: course.short_description,
        description: course.description,
        category: course.category,
        level: course.level,
        estimated_hours: Number(course.estimated_hours ?? 1),
        passing_score: Number(course.passing_score ?? 80),
        is_sequential: Boolean(course.is_sequential),
        certificate_enabled: Boolean(course.certificate_enabled),
        xp_reward: Number(course.xp_reward ?? 500),
        total_lessons: courseLessons.length,
        modules: courseModules.map((m) => ({
          title: m.title,
          description: m.description,
          lessons_count: courseLessons.filter((l) => l.module_id === m.id).length,
        })),
        campus_url: `${appUrl}/login?redirect=${encodeURIComponent(`/aprender/${course.slug}`)}`,
      };
    });

    return NextResponse.json(
      { courses: payload, synced_at: new Date().toISOString() },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error cargando catálogo", courses: [] },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

