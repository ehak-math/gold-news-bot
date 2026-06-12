// Shared gold-relevance filter used by both news sources (news.js + squawk.js).

// A headline must mention one of these to count as gold-relevant.
const KEYWORDS = [
  // Gold itself + USD / monetary-policy drivers
  "gold", "xau", "bullion", "fed", "fomc", "powell", "rate", "inflation",
  "cpi", "ppi", "pce", "dollar", "dxy", "treasury", "yield",
  // Safe-haven / risk drivers
  "safe haven", "recession", "war", "geopolitical", "iran", "israel",
  "russia", "ukraine", "tariff", "sanction", "opec", "oil",
  // Major US economic data
  "nfp", "non-farm", "nonfarm", "unemployment", "payroll",
  "gdp", "retail sales", "pmi", "ism",
];

// Subset treated as High impact for gold; everything else matched is Medium.
const HIGH_IMPACT = [
  "fed", "fomc", "powell", "rate", "cpi", "ppi", "pce", "inflation",
  "nfp", "non-farm", "nonfarm", "payroll", "gold", "xau", "dxy", "dollar",
  "treasury", "yield", "war", "iran", "israel", "tariff", "sanction",
];

// Non-financial phrases that must never count as relevant, even though they
// contain a keyword (e.g. "gold medal" contains the whole word "gold").
const EXCLUDE = ["gold medal", "gold medalist", "olympic", "world cup"];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word match with an optional trailing plural "s". This makes "gold"
// match "gold"/"golds" but not "golden"/"Goldman", and "rate" match
// "rate"/"rates" but not "accurate"/"corporate".
function compile(words) {
  return words.map((w) => new RegExp(`\\b${escapeRegex(w)}s?\\b`, "i"));
}

const KEYWORD_RES = compile(KEYWORDS);
const HIGH_RES = compile(HIGH_IMPACT);

function isExcluded(text) {
  const lower = text.toLowerCase();
  return EXCLUDE.some((p) => lower.includes(p));
}

function isRelevant(text = "") {
  if (isExcluded(text)) return false;
  return KEYWORD_RES.some((re) => re.test(text));
}

function impactOf(text = "") {
  return HIGH_RES.some((re) => re.test(text)) ? "High" : "Medium";
}

module.exports = { isRelevant, impactOf, KEYWORDS, HIGH_IMPACT };
