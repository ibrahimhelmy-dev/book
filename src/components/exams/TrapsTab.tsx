"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Flame, Timer } from "lucide-react";
import type { ExamsIndex } from "@/types/catalog";
import { TRAP_TYPE_LABELS_AR, type TrapQuestion, type TrapType } from "@/lib/traps";
import { PracticeTab } from "./PracticeTab";
import type { BankState } from "./use-question-banks";
import type { PracticeSession } from "./use-exam-session";

interface TrapsTabProps {
  /** Scope shown after «تركات الامتحان — », e.g. "الوحدة 3: تطبيقات الويب" or "الدرس 3-1". */
  scopeLabel: string;
  /** Chapter picker (exams page only; hidden with fewer than two chapters). */
  chapters?: ExamsIndex["traps"];
  /** Selected chapter ids (empty = every chapter that has traps). */
  chapterIds?: string[];
  onChapterIdsChange?: (ids: string[]) => void;
  bank: Pick<BankState<TrapQuestion>, "status" | "questions" | "error" | "retry">;
  session: PracticeSession;
  /** Omitted = no timed-exam button. */
  onLaunchExam?: (questions: TrapQuestion[]) => void;
}

const NO_IDS: string[] = [];

const CHIP = "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer";
const CHIP_ON = "bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-600/30";
const CHIP_OFF = "bg-slate-950 text-slate-300 border-slate-800 hover:border-rose-500/50 hover:text-white";

/** «تركات الامتحان»: authored trap MCQs, played with the practice player (exams page and lesson quiz tab). */
export function TrapsTab({
  scopeLabel,
  chapters,
  chapterIds = NO_IDS,
  onChapterIdsChange,
  bank,
  session,
  onLaunchExam,
}: TrapsTabProps) {
  const [trapType, setTrapType] = useState<TrapType | "all">("all");
  const [page, setPage] = useState(1);
  const [questionIndex, setQuestionIndex] = useState(0);

  const questions = useMemo(
    () => (trapType === "all" ? bank.questions : bank.questions.filter((q) => q.trapType === trapType)),
    [bank.questions, trapType]
  );
  const typeCounts = useMemo(() => {
    const counts = new Map<TrapType, number>();
    for (const q of bank.questions) counts.set(q.trapType, (counts.get(q.trapType) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [bank.questions]);

  useEffect(() => {
    setPage(1);
    setQuestionIndex(0);
  }, [trapType, chapterIds]);

  return (
    <section className="space-y-6">
      <div className="p-4 sm:p-5 bg-gradient-to-l from-rose-950/70 via-rose-900/30 to-slate-900 border border-rose-500/40 rounded-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-rose-300" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-black text-white">
                تركات الامتحان — {scopeLabel}
                {bank.status === "ready" ? ` (${bank.questions.length} سؤالاً)` : ""}
              </h3>
              <p className="text-xs text-rose-200/80 leading-relaxed">
                أسئلة ملتوية من النوع الذي يُوقِع الطالب الشاطر: كلمة واحدة تقلب المعنى، خيار صحيح لكنه ناقص، استثناء ونفي، ومواقف جديدة.
                بعد كل إجابة يظهر لك الفخ وسبب الإجابة الصحيحة من الكتاب.
              </p>
              <p className="text-[11px] text-amber-300/90">
                💡 توضيح إضافي: هذه الأسئلة مؤلَّفة للتدريب وليست من الكتاب المدرسي، وكل إجابة موثَّقة بصفحات الكتاب.
              </p>
            </div>
          </div>
          {onLaunchExam && (
            <button
              type="button"
              disabled={bank.status !== "ready" || questions.length === 0}
              onClick={() => onLaunchExam(questions)}
              className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>خوضها كامتحان موقوت</span>
            </button>
          )}
        </div>

        {chapters && onChapterIdsChange && chapters.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="اختيار الوحدة">
            <button type="button" aria-pressed={chapterIds.length === 0} onClick={() => onChapterIdsChange([])} className={`${CHIP} ${chapterIds.length === 0 ? CHIP_ON : CHIP_OFF}`}>
              كل الوحدات
            </button>
            {chapters.map((c) => {
              const on = chapterIds.includes(c.chapterId);
              return (
                <button
                  key={c.chapterId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChapterIdsChange(on ? chapterIds.filter((id) => id !== c.chapterId) : [...chapterIds, c.chapterId])}
                  className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                >
                  الوحدة {c.chapterNumber} ({c.count})
                </button>
              );
            })}
          </div>
        )}

        {typeCounts.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="نوع الفخ">
            <span className="text-xs text-slate-400 font-bold">نوع الفخ:</span>
            <button type="button" aria-pressed={trapType === "all"} onClick={() => setTrapType("all")} className={`${CHIP} ${trapType === "all" ? CHIP_ON : CHIP_OFF}`}>
              الكل ({bank.questions.length})
            </button>
            {typeCounts.map(([type, count]) => (
              <button
                key={type}
                type="button"
                aria-pressed={trapType === type}
                onClick={() => setTrapType(type)}
                className={`${CHIP} ${trapType === type ? CHIP_ON : CHIP_OFF}`}
              >
                {TRAP_TYPE_LABELS_AR[type]} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      <PracticeTab
        bank={bank}
        questions={questions}
        page={page}
        onPageChange={setPage}
        questionIndex={questionIndex}
        onQuestionIndexChange={setQuestionIndex}
        session={session}
        reviewBanner={null}
        onResetFilters={() => {
          setTrapType("all");
          onChapterIdsChange?.([]);
        }}
      />
    </section>
  );
}
