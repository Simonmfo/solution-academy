import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UserRole } from "@/types/database.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

export function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === "completed") return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    super_admin: "Dirección / Admin",
    company_admin: "Coord. Convenio",
    instructor: "Instructor",
    student: "Alumno",
  };
  return labels[role];
}

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/admin/empresas";
    case "company_admin":
      return "/rrhh";
    case "instructor":
      return "/instructor/cursos";
    case "student":
    default:
      return "/mis-cursos";
  }
}

/**
 * Normaliza URLs de YouTube/Vimeo a formato seguro de iframe embed
 */
export function getSafeVideoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) return url;
      const v = parsed.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?rel=0&modestbranding=1`;
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (parsed.protocol === "https:") return url;
    return null;
  } catch {
    return null;
  }
}

