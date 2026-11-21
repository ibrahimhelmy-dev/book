/**
 * Data build: book-sources/ (canonical) → public/data/ (generated, gitignored).
 *
 *   npm run build:data            # every part listed in book-sources/catalog.json
 *
 * For each AVAILABLE part it emits small, independently fetchable JSON files so that no page
 * or client bundle ever has to load a whole question bank:
 *
 *   public/data/catalog.json
 *   public/data/<grade>/<book>/<part>/
 *     manifest.json          TOC + stats + companion TOC + contentHash (light; used by every part page)
 *     lessons/<lessonId>.json        full lesson (server-rendered)
 *     assessments/<lessonId>.json    official booklet questions (companion "assessments")
 *     deep/<lessonKey>.json          authored deep questions ("1-1", "1-review")
 *     practice/<lessonKey>.json      deep questions converted to strict 4-option practice items
 *     traps/<chapterId>.json         «تركات الامتحان» (authored trap MCQs per chapter)
 *     exams-index.json               counts for the exams page
 *     glossary.json  acronyms.json  simulators.json  search-lessons.json
 *     storylines/<lessonId>.json
 *     english/<lessonId>.json        official English text, keyed by Arabic section id
 *     presentations/<lessonId>.json  lesson presentation deck (audited plan, or a mechanical draft)
 *
 * Canonical files are never modified. Writes are skipped when content is unchanged (OneDrive).
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { listParts, getSources, readCatalog } from "../sources-config.mjs";
import { enrichDeepQuestions } from "../../src/lib/practice";
import { convertTrapQuestions, type RawTrapQuestion, type TrapQuestion } from "../../src/lib/traps";
import type { Chapter, Lesson, GlossaryTerm, AcronymTerm, SimulatorMeta, BookStats } from "../../src/types";
import type {
  Catalog,
  CatalogPart,
  CompanionManifest,
  ExamsIndex,
  NavChapter,
  PartManifest,
  SearchLesson,
} from "../../src/types/catalog";
import type { OfficialLessonAssessments } from "../../src/types/assessments";
import type { DeepChallengingQuestion } from "../../src/types/deep-questions";
import type { LessonStoryline } from "../../src/types/storyline";
import type { EnglishLesson, EnglishLessonSource } from "../../src/types/english";
import type { PresentationDeck, PresentationPlan } from "../../src/types/presentation";
import { auditPresentationPlan, buildPresentationDeck, draftPresentationPlan } from "../../src/lib/presentation";

/** Bump when the output format changes so content hashes (and offline packs) invalidate. */
const DATA_FORMAT_VERSION = 1;
const OUT_ROOT = path.resolve("public", "data");

const written = new Set<string>();
let changedCount = 0;

function sleep(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait: synchronous retry for OneDrive file locks */
  }
}

function writeJson(rel: string, data: unknown) {
  const file = path.join(OUT_ROOT, ...rel.split("/"));
  const content = JSON.stringify(data);
  written.add(path.normalize(file));
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      fs.writeFileSync(file, content, "utf8");
      changedCount++;
      return;
    } catch (err) {
      if (attempt >= 5) throw err;
      sleep(80 * attempt);
    }
  }
}

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : fallback;
}

function hashTree(dir: string, hash: crypto.Hash) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) hashTree(full, hash);
    else if (ent.name.endsWith(".json")) {
      hash.update(ent.name);
      hash.update(fs.readFileSync(full));
    }
  }
}

function lessonKeyOf(lesson: { number: string }) {
  return lesson.number;
}

/** authored/trap-questions/chapter-N.json → validated TrapQuestion lists, in chapter order. */
function readTrapQuestions(trapDir: string, chapters: Chapter[]): [Chapter, TrapQuestion[]][] {
  if (!fs.existsSync(trapDir)) return [];
  const result: [Chapter, TrapQuestion[]][] = [];
  for (const chapter of chapters) {
    const file = path.join(trapDir, `${chapter.id}.json`);
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as RawTrapQuestion[];
    const info = {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      lessons: chapter.lessons.map((l) => ({
        id: l.id,
        number: l.number,
        title: l.title,
        pages: l.source?.pages ?? [],
        conceptIds: (l.keyConcepts ?? []).flatMap((c) => (c.id ? [c.id] : [])),
      })),
    };
    result.push([chapter, convertTrapQuestions(raw, info)]);
  }
  const unknown = fs.readdirSync(trapDir).filter((f) => !chapters.some((c) => f === `${c.id}.json`));
  if (unknown.length) throw new Error(`${trapDir}: files for unknown chapters: ${unknown.join(", ")}`);
  return result;
}

function readDeepQuestions(deepDir: string, chapters: Chapter[]): Record<string, DeepChallengingQuestion[]> {
  const byKey: Record<string, DeepChallengingQuestion[]> = {};
  if (!fs.existsSync(deepDir)) return byKey;
  const chapterDirs = fs
    .readdirSync(deepDir)
    .filter((d) => /^chapter-\d+$/.test(d) && fs.statSync(path.join(deepDir, d)).isDirectory())
    .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
  for (const dir of chapterDirs) {
    const files = fs.readdirSync(path.join(deepDir, dir)).sort();
    for (const f of files) {
      const lessonMatch = f.match(/^lesson-(\d+-\d+)\.json$/);
      const reviewMatch = f.match(/^unit-(\d+)-review\.json$/);
      const key = lessonMatch ? lessonMatch[1] : reviewMatch ? `${reviewMatch[1]}-review` : null;
      if (!key) continue;
      byKey[key] = JSON.parse(fs.readFileSync(path.join(deepDir, dir, f), "utf8"));
    }
  }
  // Normalise identifiers exactly like the previous runtime lookup did (no padding, no invented questions).
  const lessonIdByKey = new Map(chapters.flatMap((c) => c.lessons.map((l) => [l.number, l.id] as const)));
  for (const [key, list] of Object.entries(byKey)) {
    const lessonId = lessonIdByKey.get(key) ?? `chapter-${key.split("-")[0]}-review`;
    byKey[key] = list.map((q, idx) => ({
      ...q,
      index: q.index || idx + 1,
      lessonId: q.lessonId || lessonId,
      lessonNumber: q.lessonNumber || key,
    }));
  }
  return byKey;
}

function computeStats(chapters: Chapter[], glossary: GlossaryTerm[], acronyms: AcronymTerm[], simulators: SimulatorMeta[]): BookStats {
  return {
    totalChapters: chapters.length,
    totalLessons: chapters.reduce((n, ch) => n + ch.lessons.length, 0),
    totalSimulators: simulators.length,
    totalGlossaryTerms: glossary.length,
    totalAcronyms: acronyms.length,
    totalExamQuestions: chapters.reduce((n, ch) => n + ch.lessons.reduce((m, l) => m + (l.questions?.length || 0), 0), 0),
  };
}

function toNavChapters(chapters: Chapter[]): NavChapter[] {
  return chapters.map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    englishTitle: ch.englishTitle,
    description: ch.description,
    colorTheme: ch.colorTheme,
    icon: ch.icon,
    pageStart: ch.pageStart,
    pageEnd: ch.pageEnd,
    lessons: ch.lessons.map((l) => ({
      id: l.id,
      slug: l.slug,
      number: l.number,
      title: l.title,
      englishTitle: l.englishTitle,
      pageRange: l.pageRange,
      chapterId: ch.id,
    })),
  }));
}

/**
 * One deck per lesson: the reviewed plan in authored/presentations/<lessonId>.json when there is one,
 * otherwise a mechanical draft. Either way the plan must pass the fidelity audit or the build fails.
 */
function buildPresentationDecks(key: string, dir: string, lessonsById: Map<string, Lesson>): PresentationDeck[] {
  const planFiles = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f: string) => f.endsWith(".json")) : [];
  for (const f of planFiles) {
    if (!lessonsById.has(f.replace(/\.json$/, ""))) throw new Error(`${key}: presentation plan ${f} is for an unknown lesson`);
  }
  const errors: string[] = [];
  const decks: PresentationDeck[] = [];
  for (const lesson of lessonsById.values()) {
    const file = path.join(dir, `${lesson.id}.json`);
    const reviewed = fs.existsSync(file);
    const plan = reviewed ? readJson<PresentationPlan>(file, null as never) : draftPresentationPlan(lesson);
    const problems = auditPresentationPlan(lesson, plan);
    if (problems.length) {
      const where = reviewed ? path.relative(process.cwd(), file) : "mechanical draft";
      errors.push(`${lesson.id} (${where}):\n    ${problems.join("\n    ")}`);
      continue;
    }
    decks.push(buildPresentationDeck(lesson, plan, reviewed));
  }
  if (errors.length) throw new Error(`${key}: invalid presentation plans\n  ${errors.join("\n  ")}`);
  return decks;
}

/**
 * «فكر كمهندس» model answers are not printed in the book, so they live in authored/engineer-answers.json
 * and are attached to each lesson's engineerChallenge here (the UI marks them as 💡 توضيح إضافي).
 * Every answer must point at an existing lesson and at step numbers that exist in its challenge.
 */
function mergeEngineerAnswers(key: string, file: string, lessonsById: Map<string, Lesson>) {
  if (!fs.existsSync(file)) return;
  const data = readJson<{ answers: { lessonId: string; steps: { number: number; answer: string }[]; decision?: string }[] }>(
    file,
    { answers: [] },
  );
  const errors: string[] = [];
  for (const entry of data.answers) {
    const challenge = lessonsById.get(entry.lessonId)?.engineerChallenge;
    if (!challenge) {
      errors.push(`${entry.lessonId}: no such lesson or it has no engineerChallenge`);
      continue;
    }
    const known = new Set(challenge.steps.map((s) => s.number));
    const bad = entry.steps.filter((s) => !known.has(s.number) || !s.answer?.trim());
    if (bad.length) errors.push(`${entry.lessonId}: invalid or empty answer for step(s) ${bad.map((s) => s.number).join(", ")}`);
    challenge.modelAnswer = { contentOrigin: "authored", steps: entry.steps, ...(entry.decision ? { decision: entry.decision } : {}) };
  }
  if (errors.length) throw new Error(`${key}: invalid ${path.relative(process.cwd(), file)}\n  ${errors.join("\n  ")}`);
}

/**
 * «⭐ تأمل ذاتي» / «⚡ تحدّ نفسك» model answers are not printed in the book either; they live in
 * authored/challenge-answers.json and are attached to lesson.challengeYourself.modelAnswers.
 * An answer may only exist for a question the lesson actually has.
 */
function mergeChallengeAnswers(key: string, file: string, lessonsById: Map<string, Lesson>) {
  if (!fs.existsSync(file)) return;
  const data = readJson<{ answers: { lessonId: string; reflect?: string; challenge?: string }[] }>(file, { answers: [] });
  const errors: string[] = [];
  for (const entry of data.answers) {
    const cy = lessonsById.get(entry.lessonId)?.challengeYourself;
    if (!cy) {
      errors.push(`${entry.lessonId}: no such lesson or it has no challengeYourself`);
      continue;
    }
    for (const field of ["reflect", "challenge"] as const) {
      if (entry[field] !== undefined && (!cy[field] || !entry[field]?.trim())) {
        errors.push(`${entry.lessonId}: ${field} answer is empty or the lesson has no ${field} question`);
      }
    }
    cy.modelAnswers = {
      contentOrigin: "authored",
      ...(entry.reflect ? { reflect: entry.reflect } : {}),
      ...(entry.challenge ? { challenge: entry.challenge } : {}),
    };
  }
  if (errors.length) throw new Error(`${key}: invalid ${path.relative(process.cwd(), file)}\n  ${errors.join("\n  ")}`);
}

interface PartBuildResult {
  stats?: BookStats;
}

function buildPart(entry: { key: string; grade: any; book: any; part: any }): PartBuildResult {
  const sources = getSources(entry.key);
  const { key } = entry;

  if (entry.part.status !== "available") {
    console.log(`  ⏭️  ${key}: ${entry.part.status} (no pages generated)`);
    return {};
  }
  if (!fs.existsSync(sources.canonicalBookFile)) {
    throw new Error(`${key} is "available" but ${sources.canonicalBookFile} is missing`);
  }

  const book = readJson<{ meta?: Record<string, any>; chapters: Chapter[] }>(sources.canonicalBookFile, { chapters: [] });
  const chapters = book.chapters;
  const glossary = readJson<GlossaryTerm[]>(sources.canonicalGlossaryFile, []);
  const acronyms = readJson<AcronymTerm[]>(sources.canonicalAcronymsFile, []);
  const simulators = readJson<SimulatorMeta[]>(sources.simulatorsFile, []);
  const deepByKey = readDeepQuestions(sources.deepQuestionsDir, chapters);
  const lessonsById = new Map<string, Lesson>(chapters.flatMap((c) => c.lessons.map((l) => [l.id, l] as const)));
  mergeEngineerAnswers(key, sources.engineerAnswersFile, lessonsById);
  mergeChallengeAnswers(key, sources.challengeAnswersFile, lessonsById);

  const decks = buildPresentationDecks(key, sources.presentationsDir, lessonsById);

  const hash = crypto.createHash("sha256");
  hash.update(`format:${DATA_FORMAT_VERSION}|part:${JSON.stringify(entry.part)}`);
  hashTree(sources.canonical, hash);
  // Draft decks are generated by code rather than read from a canonical file, so hash the decks too.
  hash.update(JSON.stringify(decks));
  const contentHash = hash.digest("hex").slice(0, 16);

  // Lessons
  for (const lesson of lessonsById.values()) writeJson(`${key}/lessons/${lesson.id}.json`, lesson);
  for (const deck of decks) writeJson(`${key}/presentations/${deck.lessonId}.json`, deck);

  // Deep + practice questions
  const practice = enrichDeepQuestions(deepByKey, chapters);
  const deepQuestionCounts: Record<string, number> = {};
  for (const [lessonKey, list] of Object.entries(deepByKey)) {
    deepQuestionCounts[lessonKey] = list.length;
    writeJson(`${key}/deep/${lessonKey}.json`, list);
    writeJson(`${key}/practice/${lessonKey}.json`, practice.filter((q) => q.lessonKey === lessonKey));
  }

  // Companions (official assessments booklet)
  const companions: CompanionManifest[] = [];
  const officialIndex: ExamsIndex["official"] = [];
  for (const c of sources.companions) {
    const lessons: CompanionManifest["lessons"] = [];
    if (c.status === "available" && fs.existsSync(c.dataDir)) {
      const files = fs.readdirSync(c.dataDir).filter((f: string) => /^lesson-\d+-\d+\.json$/.test(f)).sort();
      for (const f of files) {
        const data = readJson<OfficialLessonAssessments>(path.join(c.dataDir, f), null as never);
        const lesson = lessonsById.get(data.lessonId);
        if (!lesson) throw new Error(`${key}: companion ${c.slug} references unknown lesson ${data.lessonId}`);
        writeJson(`${key}/${c.slug}/${data.lessonId}.json`, data);
        lessons.push({
          lessonId: data.lessonId,
          lessonNumber: data.lessonNumber,
          chapterId: lesson.chapterId,
          slug: lesson.slug,
          title: data.lessonTitle,
          bookletPages: data.bookletPages,
          textbookPages: data.textbookPages,
          totalQuestions: data.questions.length,
          mcqCount: data.questions.filter((q) => q.type === "mcq").length,
          essayCount: data.questions.filter((q) => q.type === "essay").length,
        });
        if (c.kind === "assessments") {
          officialIndex.push({
            lessonId: data.lessonId,
            lessonNumber: data.lessonNumber,
            chapterId: lesson.chapterId,
            count: data.questions.length,
            mcqCount: data.questions.filter((q) => q.type === "mcq").length,
            essayCount: data.questions.filter((q) => q.type === "essay").length,
          });
        }
      }
    }
    companions.push({
      slug: c.slug,
      kind: c.kind,
      title: c.title,
      status: c.status === "available" && lessons.length > 0 ? "available" : "coming-soon",
      lessons,
      totalQuestions: lessons.reduce((n, l) => n + l.totalQuestions, 0),
    });
  }

  // Exams index
  const practiceIndex: ExamsIndex["practice"] = Object.keys(deepByKey).map((lessonKey) => {
    const items = practice.filter((q) => q.lessonKey === lessonKey);
    const first = items[0];
    const isUnitReview = lessonKey.includes("review");
    const chapterNumber = Number(lessonKey.split("-")[0]);
    const chapter = chapters.find((c) => c.number === chapterNumber);
    return {
      lessonKey,
      lessonId: first?.lessonId ?? (isUnitReview ? `chapter-${chapterNumber}-review` : `lesson-${lessonKey}`),
      chapterId: chapter?.id ?? `chapter-${chapterNumber}`,
      chapterNumber,
      title: first?.lessonTitle ?? lessonKey,
      isUnitReview,
      count: items.length,
      difficulty: {
        easy: items.filter((q) => q.difficulty === "easy").length,
        medium: items.filter((q) => q.difficulty === "medium").length,
        hard: items.filter((q) => q.difficulty === "hard").length,
      },
    };
  });
  // «تركات الامتحان» (authored trap questions, one file per chapter)
  const trapsIndex: ExamsIndex["traps"] = [];
  for (const [chapter, list] of readTrapQuestions(sources.trapQuestionsDir, chapters)) {
    writeJson(`${key}/traps/${chapter.id}.json`, list);
    trapsIndex.push({
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      count: list.length,
      lessons: Object.fromEntries(chapter.lessons.map((l) => [l.id, list.filter((q) => q.lessonIds.includes(l.id)).length])),
    });
  }

  const examsIndex: ExamsIndex = {
    practice: practiceIndex,
    official: officialIndex,
    traps: trapsIndex,
    totals: {
      practice: practiceIndex.reduce((n, l) => n + l.count, 0),
      official: officialIndex.reduce((n, l) => n + l.count, 0),
      traps: trapsIndex.reduce((n, c) => n + c.count, 0),
    },
  };
  writeJson(`${key}/exams-index.json`, examsIndex);

  // Glossary, acronyms, simulators
  writeJson(`${key}/glossary.json`, glossary);
  writeJson(`${key}/acronyms.json`, acronyms);
  writeJson(`${key}/simulators.json`, simulators);

  // Storylines
  const storylineLessonIds: string[] = [];
  if (fs.existsSync(sources.storylinesDir)) {
    for (const f of fs.readdirSync(sources.storylinesDir).filter((x: string) => x.endsWith(".json")).sort()) {
      for (const story of readJson<LessonStoryline[]>(path.join(sources.storylinesDir, f), [])) {
        if (!lessonsById.has(story.lessonId)) throw new Error(`${key}: storyline for unknown lesson ${story.lessonId}`);
        writeJson(`${key}/storylines/${story.lessonId}.json`, story);
        storylineLessonIds.push(story.lessonId);
      }
    }
  }

  // Official English text, paired with the Arabic sections by heading number ("1. …")
  const englishLessonIds: string[] = [];
  if (fs.existsSync(sources.englishLessonsDir)) {
    for (const f of fs.readdirSync(sources.englishLessonsDir).filter((x: string) => x.endsWith(".json")).sort()) {
      const en = readJson<EnglishLessonSource>(path.join(sources.englishLessonsDir, f), null as never);
      const lesson = lessonsById.get(en.lessonId);
      if (!lesson) throw new Error(`${key}: English text for unknown lesson ${en.lessonId}`);
      const sections: EnglishLesson["sections"] = {};
      for (const sec of en.sections) {
        const target = lesson.sections.find(
          (s) => s.origin !== "explanation" && Number((s.title.match(/^(\d+)\.\s/) || [])[1]) === sec.number
        );
        if (target) sections[target.id] = sec;
      }
      writeJson(`${key}/english/${en.lessonId}.json`, {
        lessonId: en.lessonId,
        title: en.title,
        learningObjectives: en.learningObjectives,
        guidingQuestion: en.guidingQuestion,
        sections,
      } satisfies EnglishLesson);
      englishLessonIds.push(en.lessonId);
    }
  }

  // Lesson search records (glossary/acronyms are searched from their own files)
  const searchLessons: SearchLesson[] = chapters.flatMap((ch) =>
    ch.lessons.map((l) => ({
      id: l.id,
      number: l.number,
      title: l.title,
      englishTitle: l.englishTitle,
      chapterId: ch.id,
      chapterTitle: ch.title,
      slug: l.slug,
      coreIdea: l.coreIdea,
      concepts: l.keyConcepts.flatMap((k) => [k.termAr, k.termEn || ""]).filter(Boolean),
    }))
  );
  writeJson(`${key}/search-lessons.json`, searchLessons);

  const stats = computeStats(chapters, glossary, acronyms, simulators);
  const manifest: PartManifest = {
    key,
    ref: { gradeId: entry.grade.id, bookSlug: entry.book.slug, partId: entry.part.id },
    contentHash,
    gradeTitle: entry.grade.title,
    bookTitle: entry.book.title,
    bookEnglishTitle: entry.book.englishTitle,
    partTitle: entry.part.title,
    partShortTitle: entry.part.shortTitle,
    academicYear: entry.part.edition?.academicYear ?? book.meta?.academicYear,
    totalPages: book.meta?.totalPages,
    assetsBase: entry.part.assetsBase,
    stats,
    chapters: toNavChapters(chapters),
    companions,
    deepQuestionCounts,
    storylineLessonIds,
    englishLessonIds,
  };
  writeJson(`${key}/manifest.json`, manifest);

  console.log(
    `  ✅ ${key}: ${stats.totalLessons} lessons, ${practice.length} practice / ${examsIndex.totals.official} official questions, ` +
      `${storylineLessonIds.length} storylines, ${decks.filter((d) => d.reviewed).length}/${decks.length} reviewed presentations (hash ${contentHash})`
  );
  return { stats };
}

function removeStaleFiles(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.normalize(path.join(dir, ent.name));
    if (ent.isDirectory()) {
      removeStaleFiles(full);
      if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    } else if (!written.has(full)) {
      fs.rmSync(full);
      changedCount++;
    }
  }
}

function main() {
  console.log("🏗️  Building per-part data from book-sources/ → public/data/");
  const rawCatalog = readCatalog();
  const results = new Map<string, PartBuildResult>();
  for (const entry of listParts()) results.set(entry.key, buildPart(entry));

  const catalog: Catalog = {
    version: 1,
    grades: [...rawCatalog.grades]
      .sort((a: any, b: any) => a.order - b.order)
      .map((g: any) => ({
        id: g.id,
        title: g.title,
        stage: g.stage,
        order: g.order,
        books: g.books.map((b: any) => ({
          slug: b.slug,
          title: b.title,
          englishTitle: b.englishTitle,
          icon: b.icon,
          colorTheme: b.colorTheme,
          description: b.description,
          accreditation: b.accreditation,
          parts: [...b.parts]
            .sort((x: any, y: any) => x.order - y.order)
            .map<CatalogPart>((p: any) => {
              const key = `${g.id}/${b.slug}/${p.id}`;
              return {
                id: p.id,
                key,
                title: p.title,
                shortTitle: p.shortTitle,
                order: p.order,
                status: p.status,
                academicYear: p.edition?.academicYear,
                stats: results.get(key)?.stats,
                companions: (p.companions || []).map((c: any) => ({
                  slug: c.slug,
                  kind: c.kind,
                  title: c.title,
                  status: p.status === "available" ? c.status : "coming-soon",
                })),
              };
            }),
        })),
      })),
  };
  writeJson("catalog.json", catalog);

  removeStaleFiles(OUT_ROOT);
  console.log(`✨ Data build finished (${written.size} files, ${changedCount} changed).`);
}

main();
