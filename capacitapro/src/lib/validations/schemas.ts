import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresá un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Ingresá tu nombre completo"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  companySlug: z.string().optional(),
});

export const createCompanySchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  slug: z.string().min(2, "Slug requerido").regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  taxId: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido").default("#0D5BD9"),
  maxSeats: z.coerce.number().int().min(1).max(100000).default(50),
});

export const assignLicenseSchema = z.object({
  companyId: z.string().uuid(),
  courseId: z.string().uuid(),
  maxEnrollments: z.coerce.number().int().min(1).nullable().optional(),
  validUntil: z.string().nullable().optional(),
});

export const createCourseSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  shortDescription: z.string().min(10, "Agregá una descripción breve"),
  description: z.string().optional(),
  category: z.string().min(2, "Categoría requerida"),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  isSequential: z.boolean().default(true),
  passingScore: z.coerce.number().min(0).max(100).default(80),
  estimatedHours: z.coerce.number().min(0.5).max(500).default(8),
  xpReward: z.coerce.number().int().min(50).max(10000).default(500),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const createModuleSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2, "Título del módulo requerido"),
  description: z.string().optional(),
  position: z.coerce.number().int().min(0),
  prerequisiteModuleId: z.string().uuid().nullable().optional(),
  requiresQuizPass: z.boolean().default(false),
});

export const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(2, "Título requerido"),
  lessonType: z.enum(["video", "reading", "document", "quiz", "assignment"]),
  position: z.coerce.number().int().min(0).default(0),
  durationMinutes: z.coerce.number().int().min(1).default(15),
  xpReward: z.coerce.number().int().min(0).default(50),
  isMandatory: z.boolean().default(true),
  videoProvider: z.enum(["storage", "youtube", "vimeo", "bunny", "embed"]).nullable().optional(),
  videoUrl: z.string().url("URL inválida").nullable().optional().or(z.literal("")),
  contentMarkdown: z.string().optional(),
  assignmentInstructions: z.string().optional(),
});

export const createQuestionSchema = z.object({
  bankId: z.string().uuid(),
  courseId: z.string().uuid(),
  questionType: z.enum(["single_choice", "multiple_choice", "true_false", "fill_blank", "open_ended"]),
  prompt: z.string().min(5, "Ingresá el enunciado de la pregunta"),
  points: z.coerce.number().min(1).max(1000).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  optionsPublic: z.unknown(),
  correctAnswer: z.unknown(),
  explanation: z.string().optional(),
});

export const assignEnrollmentSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "Seleccioná al menos un empleado"),
  courseId: z.string().uuid(),
  cohortId: z.string().uuid().nullable().optional(),
  isMandatory: z.boolean().default(true),
  dueDate: z.string().nullable().optional(),
});

export const lessonNoteSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  content: z.string().min(1, "La nota no puede estar vacía").max(5000),
  videoTimestampSeconds: z.number().int().min(0).nullable().optional(),
});

export const discussionPostSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  title: z.string().max(200).optional(),
  body: z.string().min(2, "Escribí tu consulta o respuesta").max(4000),
});

export const employeeImportRowSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  department: z.string().optional().default("General"),
  job_title: z.string().optional().default("Colaborador"),
  employee_code: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type EmployeeImportRow = z.infer<typeof employeeImportRowSchema>;

