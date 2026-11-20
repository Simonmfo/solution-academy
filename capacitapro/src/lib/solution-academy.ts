export const SOLUTION_ACADEMY = {
  name: "Solution Academy",
  shortName: "Solution Academy",
  campusTitle: "Campus Virtual Oficial",
  tagline: "Capacitamos • Inspiramos • Transformamos",
  logoPath: "/logo-solution-academy.jpeg",
  instagramUrl: "https://www.instagram.com/solution_academyy/",
  defaultAppUrl: "https://capacitapro-solutionacademy.vercel.app",
  colors: {
    navy: "#0D1B2A",
    blue: "#0D5BD9",
  },
} as const;

export const SOLUTION_ACADEMY_CATEGORIES = [
  {
    value: "Maquinaria Pesada",
    label: "Maquinaria Pesada (Retroexcavadora, Autoelevador, Pala, Bobcat)",
  },
  {
    value: "Construcción y Oficios",
    label: "Construcción y Oficios (Steel Framing, Durlock, Electricidad, Albañilería)",
  },
  {
    value: "Industrial y Seguridad",
    label: "Industrial y Seguridad (Soldadura MIG/TIG, Hidráulica, Higiene y Seguridad)",
  },
] as const;

export function isMainAcademyOrganization(name: string | null | undefined): boolean {
  if (!name) return true;
  const normalized = name.trim().toLowerCase();
  return normalized.includes("solution academy");
}

