"use client";

import React, { useState } from "react";
import type { Lesson, CalloutBox } from "@/types";
import { dataUrl } from "@/content/paths";
import { usePart } from "@/components/layout/PartProvider";
import { useJson } from "@/lib/fetch-json";
import type { EnglishLesson } from "@/types/english";
import { EnglishSectionText } from "./EnglishSectionText";
import type { CompanionLink } from "../quiz/LessonQuestionBanks";
import dynamic from "next/dynamic";
import { LessonHeader, type LessonFontSize } from "./LessonHeader";
import { LessonReviewTab, hasReviewContent } from "./LessonReviewTab";
import { KeyQuestionAnswer } from "./KeyQuestionAnswer";
import { SectionImageViewer } from "./SectionImageViewer";
import { ComponentErrorBoundary } from "../common/ComponentErrorBoundary";
import { topLevelSections } from "@/lib/sections";

// Helper for resilient chunk loading with automatic retry on network hiccup or build cache shifts
const retryDynamicImport = <T,>(fn: () => Promise<T>, retries = 2, delay = 500): Promise<T> => {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error) => {
        if (retries <= 0) {
          reject(error);
          return;
        }
        setTimeout(() => {
          retryDynamicImport(fn, retries - 1, delay * 1.5)
            .then(resolve)
            .catch(reject);
        }, delay);
      });
  });
};

const OfficialQuestionsTab = dynamic(
  () => retryDynamicImport(() => import("../quiz/LessonQuestionBanks").then((mod) => mod.OfficialQuestionsTab)),
  { ssr: false }
);
const QuizEngine = dynamic(
  () => retryDynamicImport(() => import("../quiz/QuizEngine").then((mod) => mod.QuizEngine)),
  { ssr: false }
);
const DeepQuestionsTab = dynamic(
  () => retryDynamicImport(() => import("../quiz/LessonQuestionBanks").then((mod) => mod.DeepQuestionsTab)),
  { ssr: false }
);
const EssayQuestionsViewer = dynamic(
  () => retryDynamicImport(() => import("../quiz/EssayQuestionsViewer").then((mod) => mod.EssayQuestionsViewer)),
  { ssr: false }
);
const LessonPresentationView = dynamic(
  () => retryDynamicImport(() => import("../presentation/LessonPresentationView").then((mod) => mod.LessonPresentationView)),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-white">جاري تجهيز منصة العرض التقديمي...</p>
        </div>
      </div>
    ),
  }
);
import { Sparkles, Lightbulb, BookOpen, AlertCircle, ArrowRight, PenTool, Brain, Award, BookmarkCheck, Type } from "lucide-react";
import { EyeComfortText, formatInlineText } from "../common/EyeComfortText";
import { getAssetPath } from "@/lib/utils";

/** Question-bank summary computed on the server; the banks themselves are fetched on demand. */
export interface LessonQuizSummary {
  officialCount: number;
  deepCount: number;
  deepCountsBySection: Record<string, number>;
  /** «تركات امتحان» for this lesson, shown in «فهم» as their own difficulty level. */
  trapCount: number;
  companion: CompanionLink | null;
}

type QuizSubTab = "review" | "book" | "official" | "comprehension";

interface Props {
  lesson: Lesson;
  quiz: LessonQuizSummary;
}

function EmptyBank({ text }: { text: string }) {
  return (
    <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-3xl">
      <p className="text-sm">{text}</p>
    </div>
  );
}

function SectionNoteButton({ note }: { note: CalloutBox }) {
  const [isOpen, setIsOpen] = useState(false);

  const getNoteBadge = () => {
    switch (note.type) {
      case "pause_and_reflect":
        return {
          icon: <Lightbulb className="w-4 h-4 text-amber-400" />,
          btnClass: "bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 shadow-amber-950/40",
          borderClass: "border-amber-500/40",
          bgBadge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          label: "توقّف وفكّر",
        };
      case "important_note":
        return {
          icon: <AlertCircle className="w-4 h-4 text-blue-400" />,
          btnClass: "bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border-blue-500/40 shadow-blue-950/40",
          borderClass: "border-blue-500/40",
          bgBadge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
          label: "ملحوظة مهمة",
        };
      case "enrichment":
      case "pro_tip":
      case "hint":
      default:
        return {
          icon: <Sparkles className="w-4 h-4 text-purple-400" />,
          btnClass: "bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border-purple-500/40 shadow-purple-950/40",
          borderClass: "border-purple-500/40",
          bgBadge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          label: "لمحة خارج المنهج / تلميح",
        };
    }
  };

  const badge = getNoteBadge();

  return (
    <div className="relative inline-block text-right">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-lg hover:scale-105 ${badge.btnClass}`}
        title={note.title}
        aria-label={note.title}
      >
        {badge.icon}
        <span className="text-[11px] hidden md:inline">{badge.label}</span>
      </button>

      {/* Floating Popover on Hover/Click (rendered only when open to avoid GPU layer bloat) */}
      {isOpen && (
        <div
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute left-0 top-full mt-2 w-72 sm:w-96 max-w-[90vw] p-4 bg-slate-950 border ${badge.borderClass} rounded-2xl shadow-2xl z-50 text-right animate-fadeIn`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bgBadge}`}>
              {badge.label}
            </span>
            <span className="text-xs font-bold text-white line-clamp-1">{note.title}</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-normal mb-2.5 whitespace-pre-line">
            {note.content}
          </p>

          {note.question && (
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
              <strong className="text-amber-400 block mb-1 font-bold text-[11px]">الإجابة والتحليل:</strong>
              <p className="text-slate-300 leading-relaxed text-[11px] font-normal">{note.question}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const headingSize: Record<LessonFontSize, string> = {
  "5xlarge": "text-4xl sm:text-5xl md:text-6xl",
  "4xlarge": "text-3xl sm:text-4xl md:text-5xl",
  "3xlarge": "text-3xl sm:text-4xl",
  "2xlarge": "text-2xl sm:text-3xl",
  xlarge: "text-2xl sm:text-3xl",
  large: "text-xl sm:text-2xl",
  normal: "text-lg sm:text-xl",
};

const subHeadingSize: Record<LessonFontSize, string> = {
  "5xlarge": "text-3xl sm:text-4xl md:text-5xl",
  "4xlarge": "text-3xl sm:text-4xl",
  "3xlarge": "text-2xl sm:text-3xl",
  "2xlarge": "text-xl sm:text-2xl",
  xlarge: "text-xl sm:text-2xl",
  large: "text-lg sm:text-xl",
  normal: "text-base sm:text-lg",
};

export function LessonContent({ lesson, quiz }: Props) {
  const { key: partKey, englishLessonIds } = usePart();
  const [activeTab, setActiveTab] = useState<"lesson" | "quiz">("lesson");

  // Lesson language: Arabic only (default) or Arabic + the official English text, for language schools
  const hasEnglish = (englishLessonIds ?? []).includes(lesson.id);
  const [bilingual, setBilingual] = useState<boolean>(false);
  React.useEffect(() => {
    try {
      setBilingual(localStorage.getItem("lesson_language") === "ar-en");
    } catch {}
  }, []);
  const handleLanguageChange = (next: boolean) => {
    setBilingual(next);
    try {
      localStorage.setItem("lesson_language", next ? "ar-en" : "ar");
    } catch {}
  };
  const english = useJson<EnglishLesson>(
    bilingual && hasEnglish ? dataUrl(partKey, `english/${lesson.id}.json`) : null
  );
  const [quizSubTab, setQuizSubTab] = useState<QuizSubTab>(() => (hasReviewContent(lesson) ? "review" : "book"));
  const [isPresentationOpen, setIsPresentationOpen] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<LessonFontSize>("normal");

  // Floating Toast for Font Size Feedback
  const [fontToast, setFontToast] = useState<{ message: string; subtext: string } | null>(null);
  const fontToastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showFontToast = React.useCallback((message: string, subtext: string) => {
    if (fontToastTimeoutRef.current) {
      clearTimeout(fontToastTimeoutRef.current);
    }
    setFontToast({ message, subtext });
    fontToastTimeoutRef.current = setTimeout(() => {
      setFontToast(null);
    }, 1500);
  }, []);

  // Load font size preference from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("lesson_font_size") as LessonFontSize;
      if (saved && ["normal", "large", "xlarge", "2xlarge", "3xlarge", "4xlarge", "5xlarge"].includes(saved)) {
        setFontSize(saved);
      }
    } catch {}
  }, []);

  const handleFontSizeChange = React.useCallback((size: LessonFontSize) => {
    setFontSize(size);
    try {
      localStorage.setItem("lesson_font_size", size);
    } catch {}
    if (size === "5xlarge") {
      showFontToast("أقصى تكبير للخط: 320% 🔍", "الحد الأقصى المطلق للتكبير (خط فائق الضخامة)");
    } else if (size === "4xlarge") {
      showFontToast("حجم الخط: فائق الضخامة (280%)", "اختصار: [-] تصغير | [0] عادي");
    } else if (size === "3xlarge") {
      showFontToast("حجم الخط: عملاق (240%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
    } else if (size === "2xlarge") {
      showFontToast("حجم الخط: ضخم (200% - ضعف الحجم)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
    } else if (size === "xlarge") {
      showFontToast("حجم الخط: كبير جداً (165%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
    } else if (size === "large") {
      showFontToast("حجم الخط: كبير (130%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
    } else {
      showFontToast("حجم الخط: عادي (100% الافتراضي)", "الحجم القياسي • اختصار: [+] تكبير");
    }
  }, [showFontToast]);

  const increaseFontSize = React.useCallback(() => {
    setFontSize((prev) => {
      let next: LessonFontSize = prev;
      if (prev === "normal") {
        next = "large";
        showFontToast("تم تكبير الخط: كبير (130%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "large") {
        next = "xlarge";
        showFontToast("تم تكبير الخط: كبير جداً (165%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "xlarge") {
        next = "2xlarge";
        showFontToast("تم تكبير الخط: ضخم (200% - ضعف الحجم)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "2xlarge") {
        next = "3xlarge";
        showFontToast("تم تكبير الخط: عملاق (240%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "3xlarge") {
        next = "4xlarge";
        showFontToast("تم تكبير الخط: فائق الضخامة (280%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "4xlarge") {
        next = "5xlarge";
        showFontToast("أقصى تكبير للخط: 320% 🔍", "الحد الأقصى المطلق للتكبير (خط فائق الضخامة)");
      } else {
        showFontToast("الحد الأقصى لحجم الخط (320% أقصى تكبير)", "استخدم [-] للتصغير أو [0] للاستعادة");
      }
      try {
        localStorage.setItem("lesson_font_size", next);
      } catch {}
      return next;
    });
  }, [showFontToast]);

  const decreaseFontSize = React.useCallback(() => {
    setFontSize((prev) => {
      let next: LessonFontSize = prev;
      if (prev === "5xlarge") {
        next = "4xlarge";
        showFontToast("تم تصغير الخط: فائق الضخامة (280%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "4xlarge") {
        next = "3xlarge";
        showFontToast("تم تصغير الخط: عملاق (240%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "3xlarge") {
        next = "2xlarge";
        showFontToast("تم تصغير الخط: ضخم (200%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "2xlarge") {
        next = "xlarge";
        showFontToast("تم تصغير الخط: كبير جداً (165%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "xlarge") {
        next = "large";
        showFontToast("تم تصغير الخط: كبير (130%)", "اختصار: [+] تكبير | [-] تصغير | [0] عادي");
      } else if (prev === "large") {
        next = "normal";
        showFontToast("تم استعادة حجم الخط: عادي (100% الافتراضي)", "الحجم القياسي • اختصار: [+] تكبير");
      } else {
        showFontToast("الحجم الافتراضي للخط (100% عادي)", "استخدم [+] للتكبير");
      }
      try {
        localStorage.setItem("lesson_font_size", next);
      } catch {}
      return next;
    });
  }, [showFontToast]);


  const resetFontSize = React.useCallback(() => {
    setFontSize("normal");
    showFontToast("تم استعادة حجم الخط: عادي (الافتراضي 100%)", "الحجم القياسي • اختصار: [+] تكبير");
    try {
      localStorage.setItem("lesson_font_size", "normal");
    } catch {}
  }, [showFontToast]);

  // Global Keyboard Shortcuts for Font Size Adjustment (+, -, 0, Ctrl++, Ctrl+-, Ctrl+0)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable);

      const isZoomInKey =
        e.key === "+" ||
        e.key === "=" ||
        e.code === "NumpadAdd" ||
        e.code === "Equal";

      const isZoomOutKey =
        e.key === "-" ||
        e.key === "_" ||
        e.code === "NumpadSubtract" ||
        e.code === "Minus";

      const isResetKey =
        e.key === "0" ||
        e.code === "Digit0" ||
        e.code === "Numpad0";

      // If Ctrl / Meta / Alt is held
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (isZoomInKey) {
          e.preventDefault();
          increaseFontSize();
          return;
        }
        if (isZoomOutKey) {
          e.preventDefault();
          decreaseFontSize();
          return;
        }
        if (isResetKey) {
          e.preventDefault();
          resetFontSize();
          return;
        }
      }

      // Single key when NOT typing in an input field
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          increaseFontSize();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          decreaseFontSize();
        } else if (e.key === "0") {
          e.preventDefault();
          resetFontSize();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (fontToastTimeoutRef.current) clearTimeout(fontToastTimeoutRef.current);
    };
  }, [increaseFontSize, decreaseFontSize, resetFontSize]);

  // Reset optional accordions on lesson switch so they remain closed by default
  React.useEffect(() => {
    setQuizSubTab(hasReviewContent(lesson) ? "review" : "book");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);


  // Official booklet + deep question counts come from the server; banks load when their tab opens
  const sectionQuestionsCount = quiz.deepCountsBySection;

  // Split lesson questions into objective textbook exercises and essay writing questions
  const textbookQuestions = React.useMemo(() => {
    return (lesson.questions || []).filter((q) => q.type !== "essay");
  }, [lesson.questions]);

  const essayQuestions = React.useMemo(() => {
    return (lesson.questions || []).filter((q) => q.type === "essay");
  }, [lesson.questions]);

  const [selectedComprehensionSectionId, setSelectedComprehensionSectionId] = useState<string | null>(null);

  const handleJumpToSectionQuestions = (sectionId: string) => {
    setSelectedComprehensionSectionId(sectionId);
    setActiveTab("quiz");
    setQuizSubTab("comprehension");
  };

  const totalQuestionsCount =
    quiz.officialCount +
    textbookQuestions.length +
    essayQuestions.length +
    quiz.deepCount +
    quiz.trapCount;

  // «فهم» = the lesson's deep questions + its «تركات امتحان» (a difficulty level inside the same viewer).
  const comprehensionCount = quiz.deepCount + quiz.trapCount;

  const bookQuestionsCount = textbookQuestions.length + essayQuestions.length;

  // Question tabs in study order: review what the lesson says, then the book's own questions,
  // then the official assessments booklet, then the deeper comprehension bank.
  const quizTabs: { id: QuizSubTab; label: string; Icon: typeof Award; active: string }[] = [
    ...(hasReviewContent(lesson)
      ? [{ id: "review" as const, label: "مراجعة", Icon: BookmarkCheck, active: "bg-indigo-600 shadow-indigo-600/30" }]
      : []),
    { id: "book", label: `الكتاب (${bookQuestionsCount})`, Icon: BookOpen, active: "bg-emerald-600 shadow-emerald-600/30" },
    { id: "official", label: `التقييمات (${quiz.officialCount})`, Icon: Award, active: "bg-amber-600 shadow-amber-600/30" },
    { id: "comprehension", label: `فهم (${comprehensionCount})`, Icon: Brain, active: "bg-purple-600 shadow-purple-600/30" },
  ];

  const quizSectionRef = React.useRef<HTMLDivElement>(null);

  // Automatically scroll to top for lessons or main tabs, or smart-scroll to quiz section
  React.useEffect(() => {
    if (activeTab === "quiz") {
      const timer = setTimeout(() => {
        if (quizSectionRef.current) {
          // Use window.scrollTo instead of scrollIntoView to avoid browser viewport
          // recalibration on mobile (which causes the "zoom/grow" effect)
          const rect = quizSectionRef.current.getBoundingClientRect();
          const targetTop = window.scrollY + rect.top - 72; // 72px offset for sticky header
          window.scrollTo({ top: Math.max(0, targetTop), left: 0, behavior: "smooth" });
        }
      }, 60);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }, [lesson.id, activeTab]);

  const isQuizMode = activeTab === "quiz";

  return (
    <article className={`max-w-5xl mx-auto w-full max-w-full overflow-x-clip min-w-0 ${isQuizMode ? "px-3 sm:px-4 py-3 sm:py-8" : "px-4 py-8"}`}>
      {/* Lesson header (title, intro, objectives) — only on the lesson view; the questions view stays minimal */}
      {!isQuizMode && (
        <LessonHeader
          lesson={lesson}
          onOpenPresentation={() => setIsPresentationOpen(true)}
          activeTab={activeTab}
          onToggleTab={() => setActiveTab((prev) => (prev === "lesson" ? "quiz" : "lesson"))}
          questionsCount={totalQuestionsCount}
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
        />
      )}

      {/* Fullscreen Presentation Modal View */}
      {isPresentationOpen && (
        <ComponentErrorBoundary fallbackTitle="تعذر تشغيل العرض التقديمي">
          <LessonPresentationView
            lesson={lesson}
            onExitPresentation={() => setIsPresentationOpen(false)}
          />
        </ComponentErrorBoundary>
      )}

      {/* Main Lesson View */}
      {activeTab === "lesson" && (
        <div className={`space-y-8 font-reading lesson-font-${fontSize}`} data-font-size={fontSize}>


          {/* Detailed Sections with In-Section Notes Button */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 px-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <h2 className="text-base sm:text-lg font-bold text-white">أقسام وشرح الدرس</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                  ({topLevelSections(lesson.sections).length} أقسام)
                </span>
                {hasEnglish && (
                  <div
                    role="radiogroup"
                    aria-label="لغة الشرح"
                    title="النص الإنجليزي منقول من نسخة الوزارة لمدارس اللغات، ويظهر تحت القسم المقابل له"
                    className="font-ui inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5"
                  >
                    {[
                      { value: false, label: "عربي" },
                      { value: true, label: "عربي + EN" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        role="radio"
                        aria-checked={bilingual === opt.value}
                        onClick={() => handleLanguageChange(opt.value)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          bilingual === opt.value
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                {bilingual && english.status === "loading" && (
                  <span className="text-[11px] text-slate-500">جارٍ التحميل…</span>
                )}
                {bilingual && english.status === "error" && (
                  <span className="text-[11px] text-rose-400">تعذر تحميل النص الإنجليزي</span>
                )}
              </div>
              <span className="text-xs text-slate-500">النص المعتمد من كتاب الوزارة</span>
            </div>

            {topLevelSections(lesson.sections).map((top) => (
              <section
                key={top.id}
                id={top.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 md:p-8 text-white space-y-4 shadow-lg relative scroll-mt-24"
              >
                {/* A heading and the numbered items the book prints under it (kept as their own sections in the data) */}
                {[top, ...lesson.sections.filter((s) => s.parentId === top.id)].map((sec) => {
                  const isSub = sec !== top;
                  const sectionNotes = [
                    ...(sec.notes || []),
                    ...(lesson.callouts || []).filter(
                      (c) => c.sectionId === sec.id || (!c.sectionId && sec.id === lesson.sections[0]?.id)
                    ),
                  ];

                  return (
                    <div
                      key={sec.id}
                      id={isSub ? sec.id : undefined}
                      className={isSub ? "space-y-4 pt-5 border-t border-dashed border-slate-700 scroll-mt-24" : "space-y-4"}
                    >
                      <div className={`font-ui flex items-center justify-between gap-3 ${isSub ? "" : "border-b border-slate-800 pb-3"}`}>
                        <div className="flex flex-wrap items-center gap-2.5">
                          {isSub ? (
                            <h4 className={`font-bold text-indigo-200 leading-snug transition-all duration-200 ${subHeadingSize[fontSize]}`}>
                              {sec.title}
                            </h4>
                          ) : (
                            <h3 className={`font-bold text-white leading-snug transition-all duration-200 ${headingSize[fontSize]}`}>
                              {sec.title}
                            </h3>
                          )}
                          {sec.origin === "explanation" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              <span>💡</span>
                              <span>شرح وتوضيح إثرائي</span>
                            </span>
                          )}
                        </div>

                        {/* Header Actions: Simple Comprehension Icon + Section Notes */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Simple Minimalist Icon Button for Section Comprehension Questions */}
                          {(sectionQuestionsCount[sec.id] || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => handleJumpToSectionQuestions(sec.id)}
                              className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 hover:text-white border border-purple-500/30 hover:border-purple-400/50 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm hover:scale-105 active:scale-95"
                              title={`أسئلة الفهم الخاصة بهذا القسم (${sectionQuestionsCount[sec.id]} أسئلة)`}
                              aria-label={`أسئلة الفهم الخاصة بهذا القسم (${sectionQuestionsCount[sec.id]} أسئلة)`}
                            >
                              <Brain className="w-4 h-4 text-purple-400" />
                              <span className="text-[11px] font-mono font-bold hidden sm:inline">
                                {sectionQuestionsCount[sec.id]}
                              </span>
                            </button>
                          )}

                          {sectionNotes.length > 0 && (
                            sectionNotes.map((note) => (
                              <SectionNoteButton key={note.id} note={note} />
                            ))
                          )}
                        </div>
                      </div>

                      <div
                        className={`transition-all duration-200 ${
                          fontSize === "5xlarge"
                            ? "text-3xl sm:text-4xl md:text-5xl text-white leading-loose font-bold"
                            : fontSize === "4xlarge"
                            ? "text-2xl sm:text-3xl md:text-4xl text-slate-100 leading-loose font-semibold"
                            : fontSize === "3xlarge"
                            ? "text-xl sm:text-2xl md:text-3xl text-slate-100 leading-loose font-medium"
                            : fontSize === "2xlarge"
                            ? "text-lg sm:text-xl md:text-2xl text-slate-100 leading-loose font-medium"
                            : fontSize === "xlarge"
                            ? "text-base sm:text-lg md:text-xl text-slate-100 leading-loose font-medium"
                            : fontSize === "large"
                            ? "text-base sm:text-lg md:text-xl text-slate-200 leading-loose"
                            : "text-[1.0625rem] sm:text-lg text-slate-200 leading-[1.95]"
                        }`}
                      >
                        <EyeComfortText
                          content={sec.content}
                          theme="dark"
                          fontSize={fontSize}
                          keyConcepts={lesson.keyConcepts}
                        />
                      </div>

                      {/* Section Diagram / Image with Compact Size & Lightbox */}
                      {sec.image && (
                        <SectionImageViewer image={sec.image} />
                      )}

                      {/* Section Table if present */}
                      {sec.table && (
                        <div className="overflow-x-auto my-4 rounded-xl border border-slate-800 bg-slate-950 custom-scrollbar">
                          <table
                            className={`w-full min-w-[420px] text-right transition-all duration-200 ${
                              fontSize === "5xlarge"
                                ? "text-2xl sm:text-3xl"
                                : fontSize === "4xlarge"
                                ? "text-xl sm:text-2xl"
                                : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                                ? "text-base sm:text-lg"
                                : fontSize === "large"
                                ? "text-sm sm:text-base"
                                : "text-xs"
                            }`}
                          >
                            <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                              <tr>
                                {sec.table.headers.map((h, i) => (
                                  <th
                                    key={i}
                                    className={`font-semibold text-slate-200 ${
                                      fontSize === "5xlarge"
                                        ? "p-6"
                                        : fontSize === "4xlarge"
                                        ? "p-5"
                                        : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                                        ? "p-4"
                                        : fontSize === "large"
                                        ? "p-3.5"
                                        : "p-3"
                                    }`}
                                  >
                                    {formatInlineText(h, "dark")}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-300">
                              {sec.table.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`leading-relaxed ${
                                        fontSize === "5xlarge"
                                          ? "p-6"
                                          : fontSize === "4xlarge"
                                          ? "p-5"
                                          : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                                          ? "p-4"
                                          : fontSize === "large"
                                          ? "p-3.5"
                                          : "p-3"
                                      }`}
                                    >
                                      {formatInlineText(cell, "dark")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>

                        </div>
                      )}
                    </div>
                  );
                })}

                {bilingual && english.status === "ready" && english.data.sections[top.id] && (
                  <EnglishSectionText section={english.data.sections[top.id]} fontSize={fontSize} />
                )}
              </section>
            ))}
          </div>

          {/* The key question and the book's answer, after the lesson has been read */}
          {lesson.keyQuestion && <KeyQuestionAnswer keyQuestion={lesson.keyQuestion} answer={lesson.mainQuestionAnswer} />}
        </div>
      )}

      {/* Questions view: review + question banks */}
      {activeTab === "quiz" && (
        <div ref={quizSectionRef} className={`space-y-4 sm:space-y-6 mobile-quiz-scroll-anchor quiz-font-${fontSize}`}>
          {/* One compact bar: back to the lesson + which lesson this is */}
          <button
            type="button"
            onClick={() => setActiveTab("lesson")}
            title="العودة إلى شرح الدرس"
            className="w-full flex items-center gap-2 bg-slate-900/90 border border-slate-800/80 rounded-2xl px-3 sm:px-4 py-2.5 text-right cursor-pointer group hover:border-indigo-500/40 transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-indigo-600/30 text-indigo-300 font-mono font-black shrink-0">
              {lesson.number}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white truncate">{lesson.title}</span>
            <span className="mr-auto text-[11px] sm:text-xs font-bold text-indigo-300 group-hover:text-white shrink-0">شرح الدرس 📖</span>
          </button>

          {/* Question tabs: segmented control */}
          <div
            role="tablist"
            aria-label="أقسام الأسئلة والتمارين"
            className="h-11 sm:h-12 p-1 bg-slate-900/95 border border-slate-800 rounded-2xl flex items-center gap-1 sm:gap-1.5 shadow-lg overflow-x-auto"
          >
            {quizTabs.map((t) => {
              const selected = quizSubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setQuizSubTab(t.id)}
                  className={`h-full min-w-fit flex-auto px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    selected ? `${t.active} text-white shadow-md font-black` : "text-slate-400 hover:text-white hover:bg-slate-800/80"
                  }`}
                >
                  <t.Icon className="hidden sm:block w-4 h-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* مراجعة: summary, solved example, applied task, challenge yourself */}
          {quizSubTab === "review" && (
            <ComponentErrorBoundary fallbackTitle="تعذر عرض المراجعة">
              <LessonReviewTab lesson={lesson} fontSize={fontSize} />
            </ComponentErrorBoundary>
          )}

          {/* الكتاب: the book's objective questions, then its essay questions */}
          {quizSubTab === "book" && (
            <ComponentErrorBoundary fallbackTitle="تعذر تشغيل أسئلة الكتاب">
              {bookQuestionsCount === 0 ? (
                <EmptyBank text="لا توجد أسئلة من الكتاب لهذا الدرس." />
              ) : (
                <div className="space-y-6">
                  <QuizEngine
                    lessonId={lesson.id}
                    questions={textbookQuestions}
                    title="أسئلة وتمارين الكتاب المدرسي 📘"
                    subtitle="الأسئلة الموضوعية الواردة بالكتاب (اختيار من متعدد، صواب وخطأ، أكمل الفراغ) مع التصحيح الفوري"
                  />
                  {essayQuestions.length > 0 && (
                    <section className="space-y-3">
                      <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-blue-300 px-1">
                        <PenTool className="w-4 h-4 shrink-0" />
                        <span>أسئلة مقالية من الكتاب ({essayQuestions.length}) ✍️</span>
                      </h3>
                      <EssayQuestionsViewer lessonId={lesson.id} questions={essayQuestions} />
                    </section>
                  )}
                </div>
              )}
            </ComponentErrorBoundary>
          )}

          {/* التقييمات الرسمية: the official assessments booklet */}
          {quizSubTab === "official" && (
            <ComponentErrorBoundary fallbackTitle="تعذر تشغيل تقييمات الوزارة الرسمية">
              {quiz.companion && quiz.officialCount > 0 ? (
                <OfficialQuestionsTab partKey={partKey} lesson={lesson} companion={quiz.companion} />
              ) : (
                <EmptyBank text="لا توجد تقييمات رسمية لهذا الدرس." />
              )}
            </ComponentErrorBoundary>
          )}

          {/* فهم: deep comprehension questions */}
          {quizSubTab === "comprehension" && (
            <ComponentErrorBoundary fallbackTitle="تعذر تشغيل أسئلة الفهم المعمقة">
              {comprehensionCount > 0 ? (
                <DeepQuestionsTab
                  partKey={partKey}
                  lesson={lesson}
                  withTricks={quiz.trapCount > 0}
                  targetSectionId={selectedComprehensionSectionId}
                  onClearTargetSection={() => setSelectedComprehensionSectionId(null)}
                />
              ) : (
                <EmptyBank text="لا توجد أسئلة فهم مُعدّة لهذا الدرس بعد." />
              )}
            </ComponentErrorBoundary>
          )}
        </div>
      )}

      {/* Floating Toast for Font Size Feedback */}
      {fontToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-indigo-500/50 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fadeIn text-white text-xs sm:text-sm font-bold pointer-events-none transition-all duration-200"
        >
          <div className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Type className="w-4 h-4" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-slate-100 font-extrabold">{fontToast.message}</span>
            <span className="text-[11px] text-slate-400 font-normal">{fontToast.subtext}</span>
          </div>
        </div>
      )}
    </article>
  );
}
