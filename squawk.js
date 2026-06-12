const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { isRelevant, impactOf } = require("./filter");

// FinancialJuice is one of the sources ForexFactory aggregates in "Hot Stories".
// Free squawk-style RSS, no key required.
const FEED_URL = "https://www.financialjuice.com/feed.ashx?xy=rss";

const SEEN_FILE = path.join(__dirname, "seen-squawk.json");
const MAX_SEEN = 500;
const MAX_PER_RUN = 5;

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

function saveSeen() {
  try {
    fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen].slice(-MAX_SEEN)));
  } catch (err) {
    console.error("Failed to save seen-squawk.json:", err.message);
  }
}

function decodeEntities(text = "") {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]).trim() : "";
}

// Minimal RSS parse — squawk feeds are flat <item> lists.
function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
    title: tag(m[1], "title").replace(/^FinancialJuice:\s*/, ""),
    link: tag(m[1], "link"),
    pubDate: tag(m[1], "pubDate"),
  }));
}

function escapeHtml(text = "") {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatCambodiaTime(pubDate) {
  const d = new Date(pubDate);
  if (isNaN(d)) return pubDate;
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildMessage(item) {
  const impact = impactOf(item.title);
  const icon = impact === "High" ? "🔴" : "🟠";
  return [
    `${icon} <b>${impact.toUpperCase()} IMPACT — SQUAWK</b>`,
    "",
    `<b>${escapeHtml(item.title)}</b>`,
    "",
    `🕒 ${formatCambodiaTime(item.pubDate)} (Cambodia)`,
    `📊 Impact: ${impact} (gold)`,
    "",
    `🔗 ${item.link}`,
  ].join("\n");
}

async function getSquawkNews() {
  const { data } = await axios.get(FEED_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 20000,
  });

  const messages = [];
  for (const item of parseItems(data)) {
    const id = item.link || item.title;
    if (!id || seen.has(id)) continue;
    if (!isRelevant(item.title)) continue;

    seen.add(id);
    if (!primed) continue;

    messages.push(buildMessage(item));
    if (messages.length >= MAX_PER_RUN) break;
  }

  primed = true;
  saveSeen();
  return messages;
}

module.exports = { getSquawkNews };
