const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Finnhub general market news (free key: https://finnhub.io/register).
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const NEWS_URL = "https://finnhub.io/api/v1/news?category=general";

// Where we remember already-sent headline ids across restarts.
const SEEN_FILE = path.join(__dirname, "seen.json");
const MAX_SEEN = 500;

// Only forward headlines that matter for gold (XAU/USD).
const KEYWORDS = [
  // Gold itself + USD / monetary-policy drivers
  "gold", "xau", "bullion", "fed", "fomc", "powell", "rate", "inflation",
  "cpi", "ppi", "pce", "dollar", "dxy", "treasury", "yield",
  // Safe-haven / risk drivers
  "safe haven", "recession", "war", "geopolit", "iran", "israel", "russia",
  "ukraine", "tariff", "sanction", "opec", "oil",
  // Major US economic data
  "nfp", "non-farm", "nonfarm", "unemployment", "payroll",
  "gdp", "retail sales", "pmi", "ism",
];

// Don't flood the chat in a single cycle.
const MAX_PER_RUN = 5;

// Load remembered ids from disk. If the file exists we treat the bot as
// already primed, so new headlines after a restart are sent immediately.
function loadSeen() {
  try {
    const ids = JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"));
    return { set: new Set(ids), primed: true };
  } catch {
    return { set: new Set(), primed: false };
  }
}

const loaded = loadSeen();
const seen = loaded.set;
let primed = loaded.primed;

// Persist the most recent ids (capped so the file never grows unbounded).
function saveSeen() {
  const ids = [...seen].slice(-MAX_SEEN);
  try {
    fs.writeFileSync(SEEN_FILE, JSON.stringify(ids));
  } catch (err) {
    console.error("Failed to save seen.json:", err.message);
  }
}

function isRelevant(headline) {
  const text = headline.toLowerCase();
  return KEYWORDS.some((k) => text.includes(k));
}

function formatCambodiaTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Escape characters that would break Telegram HTML parse_mode.
function escapeHtml(text = "") {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shorten(text = "", max = 220) {
  const clean = text.trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

function buildMessage(item) {
  const title = escapeHtml(item.headline);
  const summary = item.summary ? escapeHtml(shorten(item.summary)) : "";
  const lines = [
    "📰 <b>BREAKING MARKET NEWS</b>",
    "",
    `<b>${title}</b>`,
    "",
    `🕒 ${formatCambodiaTime(item.datetime)} (Cambodia)`,
    `📡 Source: ${escapeHtml(item.source)}`,
  ];
  if (summary) lines.push("", summary);
  lines.push("", `🔗 ${item.url}`);
  return lines.join("\n");
}

// Returns formatted messages for new, relevant headlines.
async function getBreakingNews() {
  if (!FINNHUB_KEY) {
    console.warn("FINNHUB_API_KEY not set — skipping news check.");
    return [];
  }

  const { data } = await axios.get(`${NEWS_URL}&token=${FINNHUB_KEY}`, {
    timeout: 20000,
  });

  const messages = [];
  for (const item of data) {
    if (seen.has(item.id)) continue;
    if (!isRelevant(`${item.headline} ${item.summary}`)) continue;

    seen.add(item.id);
    // On first run, just remember the backlog — don't dump it to the chat.
    if (!primed) continue;

    messages.push(buildMessage(item));
    if (messages.length >= MAX_PER_RUN) break;
  }

  primed = true;
  saveSeen();
  return messages;
}

module.exports = { getBreakingNews };
