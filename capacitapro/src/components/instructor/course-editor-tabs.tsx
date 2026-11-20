"use client";

import * as React from "react";
import { BookOpen, HelpCircle, ShieldCheck } from "lucide-react";
import { CurriculumEditor } from "@/components/instructor/curriculum-editor";
import { CourseSettingsTab } from "@/components/instructor/course-settings-tab";
import { QuestionBankManager } from "@/components/instructor/question-bank-manager";
import type {
  Course,
  Lesson,
  LessonResource,
  Module,
  QuestionPublic,
  Quiz,
} from "@/types/database.types";

type TabId = "curriculum" | "settings" | "bank";

export function CourseEditorTabs({
  course,
  modules,
  lessons,
  resources,
  quizzes,
  bankId,
  questions,
}: {
  course: Course;
  modules: Module[];
  lessons: Lesson[];
  resources: LessonResource[];
  quizzes: Quiz[];
  bankId: string | null;
  questions: QuestionPublic[];
}) {
  const [activeTab, setActiveTab] = React.useState<TabId>("curriculum");

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> =
    [
      { id: "curriculum", label: `Temario y PDFs (${modules.length})`, icon: BookOpen },
      { id: "settings", label: "Correlatividad y Ajustes", icon: ShieldCheck },
      { id: "bank", label: `Banco de Preguntas (${questions.length})`, icon: HelpCircle },
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

      {activeTab === "settings" && <CourseSettingsTab course={course} />}

      {activeTab === "bank" && (
        <QuestionBankManager courseId={course.id} bankId={bankId} questions={questions} />
      )}
    </div>
  );
}

