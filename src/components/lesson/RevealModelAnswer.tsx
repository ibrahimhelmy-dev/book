"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";

interface Props {
  /** Authored model answer (not printed in the book); "\n" separates lines. */
  answer: string;
}

/** A model answer hidden behind a button, marked as additional explanation (💡 توضيح إضافي). */
export function RevealModelAnswer({ answer }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-emerald-500/30 rounded-xl overflow-hidden bg-emerald-950/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-right text-xs sm:text-sm font-bold text-emerald-300 hover:bg-emerald-950/40 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Eye className="w-4 h-4 shrink-0" />
          {open ? "إخفاء الإجابة النموذجية" : "إظهار الإجابة النموذجية"}
        </span>
        {open ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-2 animate-fadeIn">
          <p className="text-[11px] text-sky-300">💡 توضيح إضافي — إجابة مقترحة مبنية على مفاهيم الدرس، وليست من نص الكتاب.</p>
          <p className="text-sm text-slate-100 leading-loose whitespace-pre-line">{answer}</p>
        </div>
      )}
    </div>
  );
}
