/**
 * Question hints (pure, client-safe).
 *
 * A hint points the learner at the right concept without giving the answer away:
 * - authored: a question's own `hint` (a guiding question, marked «توضيح إضافي» in the UI);
 * - book: built at data-build time from the question's concepts (their official names) and
 *   source pages. A concept whose name appears in the answer but not in the question is left
 *   out, and when no concept is left the hint is just the pages.
 */
import { normalizeArabicText } from "@/lib/arabic";

/** Concept names + source pages, built by build:data (stored on a question as `bookHint`). */
export interface BookHint {
  terms: string[];
  pages: number[];
}

export type QuestionHint = { kind: "authored"; text: string } | ({ kind: "book" } & BookHint);

/** Arabic-normalized, punctuation-free, «ال»-less words, joined with single spaces and padded for whole-word matching. */
function normalizeForMatch(text: string): string {
  const words = normalizeArabicText(text.replace(/[()[\]«»"'.,،؛:!?؟\-–—/]/g, " "))
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.startsWith("ال") ? w.slice(2) : w));
  return ` ${words.join(" ")} `;
}

/** The forms a concept name can appear in: the Arabic name without its parenthetical, and each parenthetical part (e.g. «API»). */
export function termVariants(termAr: string, termEn?: string): string[] {
  const inParens = [...termAr.matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1].split(/[،,/]/));
  const base = termAr.replace(/\([^)]*\)/g, " ");
  return [base, ...inParens, termEn || ""]
    .map((v) => normalizeForMatch(v).trim())
    .filter((v) => v.length >= 2);
}

/** True when any form of the concept name occurs as whole words in `text`. */
export function mentionsTerm(text: string, variants: string[]): boolean {
  const hay = normalizeForMatch(text);
  return variants.some((v) => hay.includes(` ${v} `));
}

export interface HintConcept {
  termAr: string;
  termEn?: string;
}

/**
 * The book hint for a question: the concept names that do not leak the answer, plus its pages.
 * Returns null when there is nothing to show (no concepts left and no pages).
 */
export function buildBookHint(opts: {
  concepts: HintConcept[];
  pages: number[];
  /** What the learner sees before answering (stem; options for an mcq). */
  stem: string;
  /** The answer texts that must not be given away (correct option, correction, blank answers). */
  answers: string[];
}): BookHint | null {
  const answerText = opts.answers.filter(Boolean).join(" ");
  const terms: string[] = [];
  for (const c of opts.concepts) {
    const variants = termVariants(c.termAr, c.termEn);
    if (variants.length === 0) continue;
    const leaks = mentionsTerm(answerText, variants) && !mentionsTerm(opts.stem, variants);
    if (!leaks && !terms.includes(c.termAr)) terms.push(c.termAr);
  }
  const pages = [...new Set(opts.pages.filter((p) => Number.isFinite(p)))].sort((a, b) => a - b);
  if (terms.length === 0 && pages.length === 0) return null;
  return { terms, pages };
}

/** The hint to show for a question: its authored `hint`, else the book hint built by build:data, else none. */
export function questionHint(q: { hint?: string; bookHint?: BookHint }): QuestionHint | null {
  if (typeof q.hint === "string" && q.hint.trim()) return { kind: "authored", text: q.hint.trim() };
  if (q.bookHint && (q.bookHint.terms.length > 0 || q.bookHint.pages.length > 0)) return { kind: "book", ...q.bookHint };
  return null;
}

/** One-line Arabic text of a book hint («فكّر في: … — راجع ص 51، 58»). */
export function formatBookHint(hint: BookHint): string {
  const pages = hint.pages.length ? `راجع ص ${hint.pages.join("، ")}` : "";
  if (hint.terms.length === 0) return pages;
  return `فكّر في: ${hint.terms.join(" · ")}${pages ? ` — ${pages}` : ""}`;
}
