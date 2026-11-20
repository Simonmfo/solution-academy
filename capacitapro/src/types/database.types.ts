export type UserRole = "super_admin" | "company_admin" | "instructor" | "student";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "published" | "archived";
export type LessonType = "video" | "reading" | "document" | "quiz" | "assignment";
export type VideoProvider = "storage" | "youtube" | "vimeo" | "bunny" | "embed";
export type EnrollmentStatus = "not_started" | "in_progress" | "completed" | "overdue" | "expired";
export type LessonProgressStatus = "not_started" | "in_progress" | "completed";
export type SubmissionStatus = "submitted" | "under_review" | "graded" | "resubmit_requested";
export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "fill_blank" | "open_ended";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuizFeedbackMode = "immediate" | "after_submit" | "after_due_date" | "never";
export type AttemptStatus = "in_progress" | "submitted" | "pending_manual_grading" | "graded" | "expired";
export type XpSourceType =
  | "lesson_completed"
  | "quiz_passed"
  | "assignment_graded"
  | "course_completed"
  | "streak_bonus"
  | "discussion_helpful";

export interface CompanySettings {
  leaderboard_enabled: boolean;
  allow_self_enrollment: boolean;
  inactive_alert_days: number;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  tax_id: string | null;
  logo_url: string | null;
  primary_color: string;
  max_seats: number;
  is_active: boolean;
  settings: CompanySettings;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  company_id: string | null;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  employee_code: string | null;
  xp_points: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company?: Company | null;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  level: CourseLevel;
  status: CourseStatus;
  instructor_id: string | null;
  is_sequential: boolean;
  passing_score: number;
  xp_reward: number;
  estimated_hours: number;
  certificate_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  prerequisite_module_id: string | null;
  requires_quiz_pass: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  slug: string;
  lesson_type: LessonType;
  position: number;
  duration_minutes: number;
  xp_reward: number;
  is_mandatory: boolean;
  is_preview: boolean;
  is_published: boolean;
  prerequisite_lesson_id: string | null;
  video_provider: VideoProvider | null;
  video_url: string | null;
  video_storage_path: string | null;
  content_markdown: string | null;
  assignment_instructions: string | null;
  assignment_max_score: number | null;
  assignment_allowed_extensions: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface LessonResource {
  id: string;
  lesson_id: string;
  course_id: string;
  title: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  company_id: string;
  cohort_id: string | null;
  assigned_by: string | null;
  is_mandatory: boolean;
  status: EnrollmentStatus;
  progress_percentage: number;
  final_grade: number | null;
  starts_at: string;
  due_date: string | null;
  completed_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
  course?: Course;
  profile?: Pick<Profile, "id" | "full_name" | "email" | "department" | "job_title" | "employee_code">;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  user_id: string;
  course_id: string;
  module_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
  video_last_position_seconds: number;
  time_spent_seconds: number;
  completed_at: string | null;
}

export interface QuestionChoice {
  id: string;
  label: string;
}

export interface QuestionPublic {
  id: string;
  bank_id: string;
  course_id: string;
  question_type: QuestionType;
  prompt: string;
  options_public: QuestionChoice[] | { blanks_count?: number; hint?: string; min_chars?: number };
  points: number;
  difficulty: QuestionDifficulty;
}

export interface Quiz {
  id: string;
  lesson_id: string | null;
  course_id: string;
  module_id: string | null;
  question_bank_id: string | null;
  title: string;
  description: string | null;
  is_final_exam: boolean;
  time_limit_minutes: number | null;
  max_attempts: number;
  passing_score_percent: number;
  random_question_count: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  feedback_mode: QuizFeedbackMode;
  xp_reward: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  user_id: string;
  company_id: string;
  attempt_number: number;
  status: AttemptStatus;
  question_order: string[];
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  score_obtained: number;
  score_max: number;
  percentage: number;
  passed: boolean;
}

export interface Certificate {
  id: string;
  verification_code: string;
  certificate_number: string;
  enrollment_id: string;
  user_id: string;
  course_id: string;
  company_id: string;
  student_name_snapshot: string;
  company_name_snapshot: string;
  course_title_snapshot: string;
  instructor_name_snapshot: string | null;
  final_grade: number | null;
  total_hours: number;
  pdf_storage_path: string | null;
  issued_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
}

export interface PublicCertificateVerification {
  certificate_number: string;
  student_name: string;
  company_name: string;
  course_title: string;
  instructor_name: string | null;
  final_grade: number | null;
  total_hours: number;
  issued_at: string;
  expires_at: string | null;
  is_valid: boolean;
  revoked_at: string | null;
  revoke_reason: string | null;
}

export interface HrCompanyMetrics {
  total_employees: number;
  total_enrollments: number;
  completed_enrollments: number;
  completion_rate: number;
  average_grade: number;
  overdue_enrollments: number;
  inactive_students: number;
  certificates_issued: number;
}

