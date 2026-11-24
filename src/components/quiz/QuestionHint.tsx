"use client";

import { Lightbulb } from "lucide-react";
import { formatBookHint, type QuestionHint } from "@/lib/hints";

/** The on-demand hint toggle, sized to sit in the question card's badge row. */
export function QuestionHintButton({ hint, open, onToggle }: { hint: QuestionHint | null; open: boolean; onToggle: () => void }) {
  if (!hint) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
        open
          ? "bg-amber-500/25 text-amber-200 border-amber-400/50"
          : "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
      }`}
    >
      <Lightbulb className="w-3 h-3" />
      <span>{open ? "إخفاء التلميح" : "تلميح"}</span>
    </button>
  );
}

/**
 * The hint itself, shown when open. A book hint is concept names and pages from the book; an
 * authored hint is not from the book, so it carries the «توضيح إضافي» mark.
 */
export function QuestionHintPanel({ hint, open }: { hint: QuestionHint | null; open: boolean }) {
  if (!hint || !open) return null;
  return (
    <div className="p-3 sm:p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-xs sm:text-sm text-amber-100 leading-relaxed animate-fadeIn">
      <strong className="block mb-1 text-amber-300 font-bold">{hint.kind === "authored" ? "💡 توضيح إضافي — تلميح" : "💡 تلميح"}</strong>
      {hint.kind === "authored" ? hint.text : formatBookHint(hint)}
    </div>
  );
}
