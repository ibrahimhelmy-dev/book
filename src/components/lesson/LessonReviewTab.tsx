"use client";

import React from "react";
import type { Lesson } from "@/types";
import { CheckCircle, FileCheck, Lightbulb, Sparkles } from "lucide-react";
import type { LessonFontSize } from "./LessonHeader";
import { SolvedExampleAccordion } from "./SolvedExampleAccordion";
import { RevealModelAnswer } from "./RevealModelAnswer";
import { ThinkLikeEngineer } from "./ThinkLikeEngineer";

/** True when the lesson has anything for the «مراجعة» tab. */
export function hasReviewContent(lesson: Lesson): boolean {
  return Boolean(
    lesson.summary?.length ||
      lesson.solvedExample ||
      lesson.appliedTask ||
      lesson.challengeYourself?.reflect ||
      lesson.challengeYourself?.challenge ||
      lesson.engineerChallenge,
  );
}

interface Props {
  lesson: Lesson;
  fontSize: LessonFontSize;
}

/**
 * «مراجعة» tab of the questions view: the lesson summary, the book's solved example,
 * «طبّق ما تعلمته», «تأمل ذاتي / تحدّ نفسك» and «فكر كمهندس» — in study order.
 */
export function LessonReviewTab({ lesson, fontSize }: Props) {
  return (
    <div className="space-y-6">
      {/* 1. Lesson summary (⭐ خلاصة وتذكرة الدرس) */}
      {lesson.summary && (
        <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 sm:p-6 text-white shadow-md space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-amber-400">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <span>⭐ خلاصة وتذكرة الدرس:</span>
          </div>
          {Array.isArray(lesson.summary) ? (
            <ul
              className={`space-y-2.5 transition-all duration-200 ${
                fontSize === "5xlarge"
                  ? "text-3xl sm:text-4xl text-slate-100 leading-loose font-bold"
                  : fontSize === "4xlarge"
                  ? "text-2xl sm:text-3xl text-slate-100 leading-loose font-semibold"
                  : fontSize === "3xlarge"
                  ? "text-xl sm:text-2xl text-slate-100 leading-loose font-semibold"
                  : fontSize === "2xlarge"
                  ? "text-lg sm:text-xl text-slate-100 leading-loose font-medium"
                  : fontSize === "xlarge"
                  ? "text-lg sm:text-xl text-slate-100 leading-loose font-medium"
                  : fontSize === "large"
                  ? "text-base sm:text-lg text-slate-200 leading-loose"
                  : "text-xs sm:text-sm text-slate-300"
              }`}
            >
              {lesson.summary.map((sumItem, i) => (
                <li key={i} className="flex items-start gap-2.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                  <span className="text-amber-400 font-bold text-base leading-none">•</span>
                  <span className="leading-relaxed">{sumItem}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p
              className={`leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800 transition-all duration-200 ${
                fontSize === "5xlarge"
                  ? "text-3xl sm:text-4xl text-slate-100 leading-loose font-bold"
                  : fontSize === "4xlarge"
                  ? "text-2xl sm:text-3xl text-slate-100 leading-loose font-semibold"
                  : fontSize === "3xlarge"
                  ? "text-xl sm:text-2xl text-slate-100 leading-loose font-semibold"
                  : fontSize === "2xlarge"
                  ? "text-lg sm:text-xl text-slate-100 leading-loose font-medium"
                  : fontSize === "xlarge"
                  ? "text-lg sm:text-xl text-slate-100 leading-loose font-medium"
                  : fontSize === "large"
                  ? "text-base sm:text-lg text-slate-200 leading-loose"
                  : "text-xs sm:text-sm text-slate-300"
              }`}
            >
              {lesson.summary}
            </p>
          )}
        </div>
      )}

      {/* 2. Solved example from the book */}
      {lesson.solvedExample && (
        <div className="rounded-2xl overflow-hidden">
          <SolvedExampleAccordion example={lesson.solvedExample} fontSize={fontSize} />
        </div>
      )}

      {/* 3. Applied task (طبّق ما تعلمته) */}
      {lesson.appliedTask && (
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5 font-bold text-sm text-indigo-400">
              <FileCheck className="w-5 h-5 text-indigo-400" />
              <span>{lesson.appliedTask.title || "طبّق ما تعلمته"}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
              تطبيق عملي
            </span>
          </div>

          {lesson.appliedTask.scenario && (
            <div
              className={`p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 leading-relaxed transition-all duration-200 ${
                fontSize === "5xlarge"
                  ? "text-2xl sm:text-3xl text-slate-100 font-semibold"
                  : fontSize === "4xlarge"
                  ? "text-xl sm:text-2xl text-slate-100 font-medium"
                  : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                  ? "text-base sm:text-lg text-slate-100 font-medium"
                  : fontSize === "large"
                  ? "text-sm sm:text-base text-slate-200"
                  : "text-xs text-slate-300"
              }`}
            >
              <span className="font-bold text-indigo-400 ml-1">السيناريو:</span>
              {lesson.appliedTask.scenario}
            </div>
          )}

          <div className="space-y-1.5">
            <span
              className={`font-bold text-slate-300 block transition-all duration-200 ${
                fontSize === "5xlarge"
                  ? "text-2xl"
                  : fontSize === "4xlarge"
                  ? "text-xl"
                  : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                  ? "text-base"
                  : fontSize === "large"
                  ? "text-sm"
                  : "text-xs"
              }`}
            >
              التدريب المطلوب:
            </span>
            <p
              className={`font-semibold text-slate-200 leading-relaxed transition-all duration-200 ${
                fontSize === "5xlarge"
                  ? "text-3xl sm:text-4xl font-black"
                  : fontSize === "4xlarge"
                  ? "text-2xl sm:text-3xl font-black"
                  : fontSize === "3xlarge"
                  ? "text-xl sm:text-2xl font-black"
                  : fontSize === "2xlarge"
                  ? "text-lg sm:text-xl font-bold"
                  : fontSize === "xlarge"
                  ? "text-lg sm:text-xl font-bold"
                  : fontSize === "large"
                  ? "text-base sm:text-lg"
                  : "text-xs sm:text-sm"
              }`}
            >
              {lesson.appliedTask.prompt}
            </p>
          </div>

          {lesson.appliedTask.sampleAnswer && (
            <div
              className={`p-4 bg-emerald-950/25 rounded-xl border border-emerald-500/30 leading-relaxed text-slate-300 shadow-inner transition-all duration-200 ${
                fontSize === "5xlarge"
                  ? "text-2xl sm:text-3xl text-slate-100"
                  : fontSize === "4xlarge"
                  ? "text-xl sm:text-2xl text-slate-100"
                  : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                  ? "text-base sm:text-lg text-slate-100"
                  : fontSize === "large"
                  ? "text-sm sm:text-base text-slate-200"
                  : "text-xs text-slate-300"
              }`}
            >
              <strong className="text-emerald-400 flex items-center gap-1.5 font-bold mb-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>الحل النموذجي (نموذج الإجابة المقترحة):</span>
              </strong>
              <p className="text-slate-300 leading-relaxed">{lesson.appliedTask.sampleAnswer}</p>
            </div>
          )}
        </div>
      )}

      {/* 4. Challenge yourself (⭐ تأمل ذاتي & ⚡ تحدّ نفسك) */}
      {lesson.challengeYourself && (lesson.challengeYourself.reflect || lesson.challengeYourself.challenge) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lesson.challengeYourself.reflect && (
            <div className="p-5 bg-slate-900 border border-purple-500/30 rounded-2xl shadow-md space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                <Lightbulb className="w-4 h-4 text-purple-400 shrink-0" />
                <span>⭐ تأمل ذاتي:</span>
              </div>
              <p
                className={`leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 transition-all duration-200 ${
                  fontSize === "5xlarge"
                    ? "text-2xl sm:text-3xl text-slate-100 leading-loose font-semibold"
                    : fontSize === "4xlarge"
                    ? "text-xl sm:text-2xl text-slate-100 leading-loose font-medium"
                    : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                    ? "text-base sm:text-lg text-slate-100 leading-loose font-medium"
                    : fontSize === "large"
                    ? "text-sm sm:text-base text-slate-200 leading-loose"
                    : "text-xs sm:text-sm text-slate-300"
                }`}
              >
                {lesson.challengeYourself.reflect}
              </p>
              {lesson.challengeYourself.modelAnswers?.reflect && (
                <RevealModelAnswer answer={lesson.challengeYourself.modelAnswers.reflect} />
              )}
            </div>
          )}
          {lesson.challengeYourself.challenge && (
            <div className="p-5 bg-slate-900 border border-pink-500/30 rounded-2xl shadow-md space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-pink-400">
                <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
                <span>⚡ تحدّ نفسك:</span>
              </div>
              <p
                className={`leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 transition-all duration-200 ${
                  fontSize === "5xlarge"
                    ? "text-2xl sm:text-3xl text-slate-100 leading-loose font-semibold"
                    : fontSize === "4xlarge"
                    ? "text-xl sm:text-2xl text-slate-100 leading-loose font-medium"
                    : fontSize === "3xlarge" || fontSize === "2xlarge" || fontSize === "xlarge"
                    ? "text-base sm:text-lg text-slate-100 leading-loose font-medium"
                    : fontSize === "large"
                    ? "text-sm sm:text-base text-slate-200 leading-loose"
                    : "text-xs sm:text-sm text-slate-300"
                }`}
              >
                {lesson.challengeYourself.challenge}
              </p>
              {lesson.challengeYourself.modelAnswers?.challenge && (
                <RevealModelAnswer answer={lesson.challengeYourself.modelAnswers.challenge} />
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Think like an engineer (فكر كمهندس) */}
      {lesson.engineerChallenge && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap px-1">
            <span className="text-sm sm:text-base font-bold text-amber-300">فكر كمهندس ⚙️</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
              إثرائي اختياري
            </span>
          </div>
          <ThinkLikeEngineer challenge={lesson.engineerChallenge} />
        </section>
      )}
    </div>
  );
}
