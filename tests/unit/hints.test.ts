import { buildBookHint, formatBookHint, questionHint, termVariants, mentionsTerm } from "../../src/lib/hints";

function runHintTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING QUESTION HINT TESTS");
  console.log("=================================================");

  let passCount = 0;
  let failCount = 0;
  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failCount++;
    }
  }

  const api = { termAr: "واجهة برمجة التطبيقات (API)", termEn: "Application Programming Interface" };
  const dataLayer = { termAr: "طبقة البيانات" };
  const json = { termAr: "JSON" };

  // Variants: Arabic name without the parenthetical, and the parenthetical itself
  const v = termVariants(api.termAr, api.termEn);
  assert(v.includes("api"), "termVariants includes the parenthetical acronym");
  assert(mentionsTerm("تعيد API البيانات", v), "mentionsTerm matches the acronym");
  assert(mentionsTerm("عبر واجهة برمجة التطبيقات", v), "mentionsTerm matches the Arabic name with «ال» differences");
  assert(!mentionsTerm("طبقة العرض", termVariants(dataLayer.termAr)), "mentionsTerm does not match another term");
  assert(!mentionsTerm("JSONP", termVariants(json.termAr)), "mentionsTerm matches whole words only");

  // A concept named in the answer but not in the stem is dropped
  const h1 = buildBookHint({
    concepts: [dataLayer, json],
    pages: [58, 51, 58],
    stem: "بأي صيغة قد تعيد API البيانات؟ ____",
    answers: ["JSON"],
  });
  assert(!!h1 && h1.terms.join("|") === "طبقة البيانات", "Leaking concept (JSON) is dropped, the other kept");
  assert(!!h1 && h1.pages.join(",") === "51,58", "Pages are de-duplicated and sorted");

  // Named in the stem too: not a leak, kept
  const h2 = buildBookHint({ concepts: [json], pages: [58], stem: "ما الذي يميز JSON؟", answers: ["JSON نص منظم"] });
  assert(!!h2 && h2.terms.length === 1, "A concept already in the stem is kept");

  // Every concept leaks → pages only
  const h3 = buildBookHint({ concepts: [json], pages: [58], stem: "أكمل: ____", answers: ["JSON"] });
  assert(!!h3 && h3.terms.length === 0 && formatBookHint(h3) === "راجع ص 58", "Only pages when every concept leaks");

  // Nothing at all → null
  assert(buildBookHint({ concepts: [], pages: [], stem: "س", answers: [] }) === null, "No concepts and no pages → null");

  // Formatting
  assert(
    formatBookHint({ terms: ["طبقة البيانات", "JSON"], pages: [51, 58] }) === "فكّر في: طبقة البيانات · JSON — راجع ص 51، 58",
    "formatBookHint joins terms and pages"
  );

  // Authored hint wins over the book hint
  const authored = questionHint({ hint: " اسأل نفسك: من يطلب؟ ", bookHint: { terms: ["x"], pages: [1] } });
  assert(authored?.kind === "authored" && authored.text === "اسأل نفسك: من يطلب؟", "Authored hint takes precedence");
  assert(questionHint({ bookHint: { terms: [], pages: [] } }) === null, "Empty book hint → no hint");
  assert(questionHint({}) === null, "No hint fields → no hint");

  console.log(`\n📊 Hint tests: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

runHintTests();
