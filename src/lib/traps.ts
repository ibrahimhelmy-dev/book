/**
 * Exam tricks (تركات الامتحان): authored, deliberately twisted 4-option MCQs
 * per chapter, read from authored/trap-questions/chapter-N.json.
 *
 * Pure (no data imports): the data build validates and converts them once into
 * traps/chapter-N.json; the exams page only fetches and renders them with the practice player.
 */
import type { EnrichedSimpleQuestion } from "@/lib/practice";
import type { DeepChallengingQuestion } from "@/types/deep-questions";

export const TRAP_TYPES = [
  "keyword",
  "partial",
  "negation",
  "lookalike",
  "scenario",
  "sequence",
  "cause-effect",
  "generalization",
  "cross-lesson",
] as const;

export type TrapType = (typeof TRAP_TYPES)[number];

export const TRAP_TYPE_LABELS_AR: Record<TrapType, string> = {
  keyword: "كلمة تقلب المعنى",
  partial: "صحيح لكن ناقص",
  negation: "النفي والاستثناء",
  lookalike: "مصطلحات متشابهة",
  scenario: "موقف جديد",
  sequence: "ترتيب الخطوات",
  "cause-effect": "قلب السبب والنتيجة",
  generalization: "تعميم خاطئ",
  "cross-lesson": "ربط بين الدروس",
};

/** Canonical record (authored/trap-questions/chapter-N.json). `lessonId` is a lesson id or "chapter-N" for cross-lesson items. */
export interface RawTrapQuestion {
  id: string;
  lessonId: string;
  trapType: TrapType;
  difficulty: "hard" | "very-hard";
  question: string;
  options: string[];
  correctAnswer: number;
  correctAnswerText: string;
  trap: string;
  explanation: string;
  conceptIds: string[];
  source: { pages: number[] };
}

/** Generated record (traps/chapter-N.json): a practice question plus its trap metadata. */
export interface TrapQuestion extends EnrichedSimpleQuestion {
  /** Lessons the question belongs to: its own lesson, or every lesson whose concepts a cross-lesson item uses. */
  lessonIds: string[];
  trapType: TrapType;
  trap: string;
  /** Book-backed reasoning plus the page line (the explanation without the trap). */
  reasoning: string;
  conceptIds: string[];
  pages: number[];
  contentOrigin: "authored";
}

interface LessonInfo {
  id: string;
  number: string;
  title: string;
  pages: number[];
  conceptIds: string[];
}

export interface TrapChapterInfo {
  id: string;
  number: number;
  title: string;
  lessons: LessonInfo[];
}

function trapReasoning(q: Pick<RawTrapQuestion, "explanation" | "source">): string {
  return `${q.explanation.trim()}\n\n📖 من الكتاب المدرسي: ص ${q.source.pages.join("، ")}`;
}

/** Explanation shown after answering: the trap first, then the book-backed reasoning and pages. */
export function trapExplanation(q: Pick<RawTrapQuestion, "trap" | "explanation" | "source">): string {
  return `🪤 الفخ: ${q.trap.trim()}\n\n${trapReasoning(q)}`;
}

/** A trap question in the comprehension viewer's shape: an MCQ flagged as «تركات امتحان». */
export function trapToDeepQuestion(q: TrapQuestion): DeepChallengingQuestion {
  return {
    id: q.id,
    lessonId: q.lessonId,
    type: "mcq",
    question: q.question,
    options: q.options,
    answer: q.answer,
    correctAnswer: q.options.indexOf(q.answer),
    correctAnswerText: q.answer,
    difficulty: "very-hard",
    isExamTrick: true,
    trapType: q.trapType,
    conceptIds: q.conceptIds,
    misconceptionTrap: q.trap,
    depthExplanation: q.reasoning,
    contentOrigin: "authored",
  };
}

/**
 * Validates one chapter's raw trap questions and converts them. Throws with every problem listed
 * (field rules match HOW_TO_EDIT_DATA.md: exactly 4 options, correctAnswer 0–3 whose text matches,
 * pages within the lesson's range, conceptIds that exist in the lesson).
 */
export function convertTrapQuestions(raw: RawTrapQuestion[], chapter: TrapChapterInfo): TrapQuestion[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const crossKey = `chapter-${chapter.number}`;
  const allPages = chapter.lessons.flatMap((l) => l.pages);
  const allConcepts = chapter.lessons.flatMap((l) => l.conceptIds);

  const out = raw.map((q, i): TrapQuestion | null => {
    const tag = q.id || `#${i + 1}`;
    const fail = (msg: string) => {
      errors.push(`${tag}: ${msg}`);
      return null;
    };
    if (!q.id) return fail("missing id");
    if (seen.has(q.id)) return fail("duplicate id");
    seen.add(q.id);

    const lesson = chapter.lessons.find((l) => l.id === q.lessonId);
    const isCross = q.lessonId === crossKey;
    if (!lesson && !isCross) return fail(`lessonId "${q.lessonId}" is not a lesson of ${chapter.id} or "${crossKey}"`);
    if (!TRAP_TYPES.includes(q.trapType)) return fail(`unknown trapType "${q.trapType}"`);
    if (q.difficulty !== "hard" && q.difficulty !== "very-hard") return fail(`difficulty must be hard | very-hard`);
    if (!q.question?.trim() || !q.trap?.trim() || !q.explanation?.trim()) return fail("empty question, trap or explanation");

    const options = Array.isArray(q.options) ? q.options.map((o) => (typeof o === "string" ? o.trim() : "")) : [];
    if (options.length !== 4 || options.some((o) => !o) || new Set(options).size !== 4) {
      return fail("needs exactly 4 distinct non-empty options");
    }
    if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > 3) return fail("correctAnswer must be 0–3");
    if (options[q.correctAnswer] !== q.correctAnswerText?.trim()) return fail("correctAnswerText does not match options[correctAnswer]");

    const pages = q.source?.pages ?? [];
    const pageRange = lesson ? lesson.pages : allPages;
    if (pages.length === 0 || pages.some((p) => !pageRange.includes(p))) return fail(`source.pages [${pages}] outside the lesson's pages`);
    const concepts = lesson ? lesson.conceptIds : allConcepts;
    const unknown = (q.conceptIds ?? []).filter((c) => !concepts.includes(c));
    if (!q.conceptIds?.length || unknown.length) return fail(`unknown or missing conceptIds [${unknown}]`);

    const lessonIds = lesson
      ? [lesson.id]
      : chapter.lessons.filter((l) => q.conceptIds.some((c) => l.conceptIds.includes(c))).map((l) => l.id);

    return {
      id: q.id,
      lessonIds,
      question: q.question.trim(),
      options,
      answer: options[q.correctAnswer],
      difficulty: "hard",
      lessonKey: lesson ? lesson.number : `${chapter.number}-review`,
      lessonId: lesson ? lesson.id : crossKey,
      lessonTitle: lesson ? lesson.title : `ربط بين دروس الوحدة ${chapter.number}`,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      explanation: trapExplanation({ ...q, source: { pages } }),
      isUnitReview: isCross,
      trapType: q.trapType,
      trap: q.trap.trim(),
      reasoning: trapReasoning({ ...q, source: { pages } }),
      conceptIds: q.conceptIds,
      pages,
      contentOrigin: "authored",
    };
  });

  if (errors.length) throw new Error(`invalid trap questions for ${chapter.id}:\n  ${errors.join("\n  ")}`);
  return out as TrapQuestion[];
}
