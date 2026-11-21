import fs from "fs";
import path from "path";
import { convertTrapQuestions, type RawTrapQuestion, type TrapChapterInfo } from "../../src/lib/traps";
import type { ExamsIndex } from "../../src/types/catalog";

let pass = 0;
let fail = 0;
function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    pass++;
  } else {
    console.error(`❌ FAIL: ${name}`);
    fail++;
  }
}
function throws(fn: () => unknown, pattern: RegExp, name: string) {
  try {
    fn();
    assert(false, name);
  } catch (e) {
    assert(pattern.test(String((e as Error).message)), name);
  }
}

const chapter: TrapChapterInfo = {
  id: "chapter-3",
  number: 3,
  title: "تطبيقات الويب",
  lessons: [
    { id: "lesson-3-1", number: "3-1", title: "أ", pages: [50, 51], conceptIds: ["concept-3-1-01"] },
    { id: "lesson-3-2", number: "3-2", title: "ب", pages: [56, 57], conceptIds: ["concept-3-2-01"] },
  ],
};

const base: RawTrapQuestion = {
  id: "trap-3-1-01",
  lessonId: "lesson-3-1",
  trapType: "keyword",
  difficulty: "hard",
  question: "سؤال تجريبي؟",
  options: ["أ", "ب", "ج", "د"],
  correctAnswer: 2,
  correctAnswerText: "ج",
  trap: "فخ تجريبي",
  explanation: "شرح تجريبي",
  conceptIds: ["concept-3-1-01"],
  source: { pages: [51] },
};

// Valid lesson + cross-lesson items convert to practice questions
const [q, x] = convertTrapQuestions(
  [base, { ...base, id: "trap-3-x-01", lessonId: "chapter-3", trapType: "cross-lesson", conceptIds: ["concept-3-1-01", "concept-3-2-01"], source: { pages: [50, 57] } }],
  chapter
);
assert(q.answer === "ج" && q.lessonKey === "3-1" && q.difficulty === "hard" && !q.isUnitReview, "lesson item converts");
assert(q.explanation!.startsWith("🪤 الفخ:") && q.explanation!.includes("ص 51"), "explanation carries trap and pages");
assert(x.isUnitReview === true && x.lessonKey === "3-review" && x.lessonId === "chapter-3", "cross-lesson item is a unit-level question");
assert(q.lessonIds.join() === "lesson-3-1", "lesson item belongs to its lesson");
assert(x.lessonIds.join() === "lesson-3-1,lesson-3-2", "cross-lesson item belongs to every lesson whose concepts it uses");

// Invalid items are rejected
throws(() => convertTrapQuestions([{ ...base, correctAnswerText: "د" }], chapter), /correctAnswerText/, "rejects mismatched answer text");
throws(() => convertTrapQuestions([{ ...base, options: ["أ", "ب", "ج"] }], chapter), /4 distinct/, "rejects 3 options");
throws(() => convertTrapQuestions([{ ...base, options: ["أ", "أ", "ج", "د"] }], chapter), /4 distinct/, "rejects duplicate options");
throws(() => convertTrapQuestions([{ ...base, source: { pages: [56] } }], chapter), /source.pages/, "rejects pages outside the lesson");
throws(() => convertTrapQuestions([{ ...base, conceptIds: ["concept-3-2-01"] }], chapter), /conceptIds/, "rejects concepts of another lesson");
throws(() => convertTrapQuestions([{ ...base, trapType: "nope" as never }], chapter), /trapType/, "rejects unknown trap type");
throws(() => convertTrapQuestions([base, base], chapter), /duplicate/, "rejects duplicate ids");

// Generated data (after build:data): index counts match the files
const partDir = path.resolve("public", "data", "secondary-2", "programming-ai", "term-1");
const index = JSON.parse(fs.readFileSync(path.join(partDir, "exams-index.json"), "utf8")) as ExamsIndex;
assert(Array.isArray(index.traps), "exams-index has traps");
assert(index.totals.traps === index.traps.reduce((n, c) => n + c.count, 0), "traps total matches per-chapter counts");
for (const c of index.traps) {
  const list = JSON.parse(fs.readFileSync(path.join(partDir, "traps", `${c.chapterId}.json`), "utf8")) as unknown[];
  assert(list.length === c.count, `traps/${c.chapterId}.json has ${c.count} questions`);
  assert(Object.values(c.lessons).every((n) => n > 0 && n <= c.count), `${c.chapterId}: every lesson has trap questions`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
