import React from "react";

interface Props {
  keyQuestion: string;
  /** The book's own answer to the key question (official text). */
  answer?: string;
}

/** «السؤال الرئيسي» with the book's model answer, shown once the lesson's sections have been read. */
export function KeyQuestionAnswer({ keyQuestion, answer }: Props) {
  return (
    <section className="rounded-2xl border border-slate-800/80 overflow-hidden shadow-md">
      <div className="bg-slate-950/60 border-r-4 border-r-amber-500 p-4 sm:p-5 text-slate-100 text-sm sm:text-base leading-relaxed">
        <span className="font-bold text-amber-400 ml-1.5">❓ السؤال الرئيسي:</span>
        <span>{keyQuestion}</span>
      </div>
      {answer && (
        <div className="bg-emerald-950/25 border-t border-emerald-500/25 border-r-4 border-r-emerald-500 p-4 sm:p-5">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-bold text-emerald-400 text-sm">✅ الإجابة النموذجية</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              من الكتاب
            </span>
          </div>
          <p className="text-slate-100 text-sm sm:text-base leading-loose">{answer}</p>
        </div>
      )}
    </section>
  );
}
