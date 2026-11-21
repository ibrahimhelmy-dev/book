"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { SimulatorMeta } from "@/types";
import { ComponentErrorBoundary } from "../common/ComponentErrorBoundary";

// One lazy chunk per simulator; nothing loads until the section is opened.
const SimulatorRenderer = dynamic(() => import("./SimulatorRenderer").then((mod) => mod.SimulatorRenderer), {
  ssr: false,
  loading: () => <div className="h-40 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />,
});

interface Props {
  simulators: SimulatorMeta[];
}

/** A lesson's interactive lab simulators, collapsed by default, with a switcher when there are several. */
export function LessonSimulators({ simulators }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(simulators[0]?.id ?? "");
  if (simulators.length === 0) return null;

  return (
    <section className="border border-purple-500/30 bg-slate-900/60 rounded-3xl overflow-hidden shadow-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-right hover:bg-slate-800/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 text-right">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-white">جرّب بنفسك: المحاكيات التفاعلية المعملية ⚡</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                ({simulators.length})
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">تجربة المفاهيم عمليًا — إثرائي اختياري (غير مطلوب للامتحان)</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-purple-400 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/70 animate-fadeIn">
          {simulators.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6 p-2 bg-slate-900 border border-slate-800 rounded-2xl">
              {simulators.map((sim, idx) => {
                const isSelected = selectedId === sim.id;
                return (
                  <button
                    key={sim.id}
                    type="button"
                    onClick={() => setSelectedId(sim.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40"
                        : "bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-75">#{idx + 1}</span>
                    <span>{sim.title.replace(/^\d+\.\s*/, "")}</span>
                  </button>
                );
              })}
            </div>
          )}

          <ComponentErrorBoundary fallbackTitle="تعذر تشغيل المحاكي التفاعلي">
            <SimulatorRenderer simulatorId={selectedId} />
          </ComponentErrorBoundary>
        </div>
      )}
    </section>
  );
}
