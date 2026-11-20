"use client";

import * as React from "react";
import { BookOpen, ClipboardCheck, HelpCircle, ShieldCheck } from "lucide-react";
import { CurriculumEditor } from "@/components/instructor/curriculum-editor";
import { CourseSettingsTab } from "@/components/instructor/course-settings-tab";
import {
  QuestionBankManager,
  type QuestionBankItem,
} from "@/components/instructor/question-bank-manager";
import {
  ExamsManager,
  type InstructorAttemptAuditRow,
} from "@/components/instructor/exams-manager";
import type {
  Course,
  Lesson,
  LessonResource,
  Module,
  QuestionPublic,
  Quiz,
} from "@/types/database.types";

type TabId = "curriculum" | "settings" | "bank" | "exams";

export function CourseEditorTabs({
  course,
  modules,
  lessons,
  resources,
  quizzes,
  quizQuestionLinks,
  banks,
  questions,
  recentAttempts,
}: {
  course: Course;
  modules: Module[];
  lessons: Lesson[];
  resources: LessonResource[];
  quizzes: Quiz[];
  quizQuestionLinks: Array<{ quiz_id: string; question_id: string }>;
  banks: QuestionBankItem[];
  questions: QuestionPublic[];
  recentAttempts: InstructorAttemptAuditRow[];
}) {
  const [activeTab, setActiveTab] = React.useState<TabId>("curriculum");

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> =
    [
      { id: "curriculum", label: `Temario y PDFs (${modules.length})`, icon: BookOpen },
      { id: "bank", label: `Bancos de Preguntas (${questions.length})`, icon: HelpCircle },
      { id: "exams", label: `Exámenes e Intentos (${quizzes.length})`, icon: ClipboardCheck },
      { id: "settings", label: "Correlatividad y Ajustes", icon: ShieldCheck },
    ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "curriculum" && (
        <CurriculumEditor
          courseId={course.id}
          initialModules={modules}
          initialLessons={lessons}
          initialResources={resources}
          initialQuizzes={quizzes}
        />
      )}

      {activeTab === "bank" && (
        <QuestionBankManager courseId={course.id} banks={banks} questions={questions} />
      )}

      {activeTab === "exams" && (
        <ExamsManager
          courseId={course.id}
          modules={modules}
          banks={banks}
          questions={questions}
          quizzes={quizzes}
          quizQuestionLinks={quizQuestionLinks}
          recentAttempts={recentAttempts}
        />
      )}

      {activeTab === "settings" && <CourseSettingsTab course={course} />}
    </div>
  );
}
