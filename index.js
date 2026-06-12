require("dotenv").config();
const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { getBreakingNews } = require("./news");
const { getSquawkNews } = require("./squawk");

// When true, run every check once and exit (used by GitHub Actions / cron).
const RUN_ONCE = process.env.RUN_ONCE === "true";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ForexFactory free calendar feed (no API key needed).
const CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

// Which events we care about for gold (XAU/USD).
const WATCH_CURRENCIES = ["USD"];
const WATCH_IMPACTS = ["High", "Medium"];

// Warn this many minutes before the event fires.
const LEAD_MINUTES = 30;

// Remember which events we already alerted (persisted so run-once mode
// doesn't re-fire the same event on every invocation).
const ALERTED_FILE = path.join(__dirname, "alerted.json");

function loadAlerted() {
  try {
    return new Set(JSON.parse(fs.readFileSync(ALERTED_FILE, "utf8")));
  } catch {
    return new Set();
  }
}

function saveAlerted() {
  try {
    fs.writeFileSync(ALERTED_FILE, JSON.stringify([...alerted].slice(-500)));
  } catch (err) {
    console.error("Failed to save alerted.json:", err.message);
  }
}

const alerted = loadAlerted();

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  await axios.post(url, {
    chat_id: CHAT_ID,
    text: message,
    parse_mode: "HTML",
  });
}

async function fetchEvents() {
  const { data } = await axios.get(CALENDAR_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 20000,
  });
  return Array.isArray(data) ? data : [];
}

// Build a stable id so each event is only alerted once.
function eventId(ev) {
  return `${ev.country}|${ev.title}|${ev.date}`;
}

function formatCambodiaTime(isoDate) {
  return new Date(isoDate).toLocaleString("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildMessage(ev, minutesUntil) {
  const icon = ev.impact === "High" ? "🔴" : "🟠";
  return `
${icon} <b>${ev.impact.toUpperCase()} IMPACT ${ev.country} NEWS</b>

Event: ${ev.title}
Time: ${formatCambodiaTime(ev.date)} (Cambodia) — in ${minutesUntil} min
Forecast: ${ev.forecast || "n/a"} | Previous: ${ev.previous || "n/a"}
Impact: ${ev.impact}

Gold Warning:
Avoid trade 15 min before/after news.

ICT Plan:
Wait for liquidity sweep + CHOCH + FVG confirmation.
`;
}

async function checkNews() {
  try {
    const events = await fetchEvents();
    const now = Date.now();

    for (const ev of events) {
      if (!WATCH_CURRENCIES.includes(ev.country)) continue;
      if (!WATCH_IMPACTS.includes(ev.impact)) continue;

      const id = eventId(ev);
      if (alerted.has(id)) continue;

      const minutesUntil = Math.round((new Date(ev.date).getTime() - now) / 60000);

      // Only alert in the window just before the event.
      if (minutesUntil <= LEAD_MINUTES && minutesUntil >= 0) {
        await sendTelegram(buildMessage(ev, minutesUntil));
        alerted.add(id);
        saveAlerted();
        console.log(`Alert sent: ${ev.title} (in ${minutesUntil} min)`);
      }
    }
  } catch (err) {
    console.error("checkNews failed:", err.message);
  }
}

async function checkBreakingNews() {
  try {
    const messages = await getBreakingNews();
    for (const msg of messages) {
      await sendTelegram(msg);
      console.log("News alert sent");
    }
  } catch (err) {
    console.error("checkBreakingNews failed:", err.message);
  }
}

async function checkSquawk() {
  try {
    const messages = await getSquawkNews();
    for (const msg of messages) {
      await sendTelegram(msg);
      console.log("Squawk alert sent");
    }
  } catch (err) {
    console.error("checkSquawk failed:", err.message);
  }
}

async function runAllChecks() {
  await checkNews();
  await checkBreakingNews();
  await checkSquawk();
}

if (RUN_ONCE) {
  // GitHub Actions / external cron: run once, then exit.
  runAllChecks().then(() => {
    console.log("Run-once complete.");
    process.exit(0);
  });
} else {
  // Long-running host (VPS / home machine): self-schedule every 5 minutes.
  cron.schedule("*/5 * * * *", runAllChecks);
  runAllChecks();
}
