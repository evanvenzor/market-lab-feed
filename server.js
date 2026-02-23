// server.js
// Market Lab Feed — always-online research prompt generator
// ✅ No trading, no execution, no keys
// Serves deterministic, rotating hypotheses as Markdown at /latest.md
//
// Run locally:
//   node server.js
//   http://127.0.0.1:10000/latest.md
//
// Deploy (Render):
//   npm start (ensure package.json points to: node server.js)

"use strict";

const express = require("express");
const crypto = require("crypto");

const app = express();

// Render provides PORT; local default 10000
const PORT = Number(process.env.PORT || 10000);

// Optional: make prompts stable across deploys by setting PROMPT_SALT in env
// (not a secret; just a knob to change the “universe” of prompts)
const PROMPT_SALT = String(process.env.PROMPT_SALT || "market-lab-feed");

// How often prompts rotate (minutes). Deterministic within each window.
const ROTATE_MINUTES = Math.max(5, Number(process.env.ROTATE_MINUTES || 60));

// ---------- Deterministic RNG helpers ----------
function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str) {
  // Take first 8 hex chars => 32-bit seed
  const h = sha256Hex(str).slice(0, 8);
  return parseInt(h, 16) >>> 0;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickMany(rng, arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function utcWindowKey(date, rotateMinutes) {
  // Bucket UTC time into rotateMinutes windows so output is stable inside window
  const ms = date.getTime();
  const windowMs = rotateMinutes * 60 * 1000;
  const bucket = Math.floor(ms / windowMs);
  return String(bucket);
}

// ---------- Prompt “ingredients” ----------
const ASSETS = [
  "BTC", "ETH", "SOL", "BNB", "ARB", "OP", "BASE-ECOSYSTEM (proxy: COIN, AERO, etc.)",
  "TOTAL3 (alt market cap ex BTC/ETH)", "DXY (US Dollar Index)", "US10Y (10Y yield)",
];

const REGIMES = [
  "risk-on melt-up", "risk-off unwind", "range compression", "trend continuation",
  "mean-reverting chop", "volatility expansion", "liquidity drought", "liquidity surge",
];

const MARKET_MICROSTRUCTURE = [
  "orderbook imbalance / liquidity voids",
  "funding-rate reflexivity and basis trades",
  "open interest (OI) clustering near key levels",
  "liquidation cascades and stop-run mechanics",
  "perp vs spot divergence (premium/discount)",
  "options skew, gamma exposure, and dealer hedging",
];

const SIGNALS = [
  "HTF (high time frame) structure breaks + retests",
  "multi-timeframe confluence with VWAP (Volume-Weighted Average Price) bands",
  "volume profile (POC/VAH/VAL) interactions",
  "realized vs implied volatility spread",
  "funding flips + OI rising/falling",
  "relative strength vs BTC dominance",
  "on-chain proxy: exchange inflow/outflow trend",
];

const RISK_CONTROLS = [
  "define invalidation first; entry is optional",
  "cap downside with time stops + price stops",
  "use volatility-scaled position sizing (research-only)",
  "avoid signal stacking that shares the same failure mode",
  "stress test with regime flips (risk-on ↔ risk-off)",
  "simulate slippage + fees even in paper logic",
];

const HYPOTHESIS_TEMPLATES = [
  ({ asset, regime, micro, signal, control }) =>
    `**Hypothesis:** In a **${regime}** regime for **${asset}**, the edge comes from **${micro}**. If **${signal}** aligns, a structured entry after confirmation may outperform naive breakout/mean-reversion.\n\n**Research task:** Define *two* competing models (trend vs mean-revert) and specify which observable falsifies each.\n\n**Risk design:** ${control}.`,

  ({ asset, regime, micro, signal, control }) =>
    `**Hypothesis:** When **${asset}** shifts into **${regime}**, a “false move” pattern emerges due to **${micro}**. Treat **${signal}** as the trigger, but only after a clear invalidation level is set.\n\n**Research task:** Identify 3 historical analog windows and measure outcome distribution (win rate, payoff, max adverse excursion).\n\n**Risk design:** ${control}.`,

  ({ asset, regime, micro, signal, control }) =>
    `**Hypothesis:** During **${regime}** conditions, **${asset}** becomes sensitive to **${micro}**. A composite filter using **${signal}** may isolate higher-quality setups.\n\n**Research task:** Build a simple scoring rubric (0–10) and test whether score correlates with forward returns.\n\n**Risk design:** ${control}.`,
];

const THEORY_NUGGETS = [
  "Reflexivity: flows can create the fundamentals they later justify.",
  "Market efficiency is local and temporary; edges are regime-bound.",
  "Volatility clustering: calm predicts calm until it doesn’t.",
  "Liquidity is a hidden variable; price is often the symptom.",
  "Most strategies fail from correlation of failures, not bad entries.",
];

function generatePromptBundle(now = new Date()) {
  const windowKey = utcWindowKey(now, ROTATE_MINUTES);
  const seedStr = `${PROMPT_SALT}|${windowKey}`;
  const rng = mulberry32(seedFromString(seedStr));

  const asset = pick(rng, ASSETS);
  const regime = pick(rng, REGIMES);
  const micro = pick(rng, MARKET_MICROSTRUCTURE);
  const signal = pick(rng, SIGNALS);
  const control = pick(rng, RISK_CONTROLS);

  const template = pick(rng, HYPOTHESIS_TEMPLATES);
  const nugget = pick(rng, THEORY_NUGGETS);

  const supportingAngles = pickMany(rng, [
    "Define the failure mode (what would make you embarrassed to keep believing this).",
    "Separate signal from story: what’s measurable vs what’s narrative.",
    "Check robustness across different volatility buckets.",
    "Add a ‘do nothing’ baseline to avoid confusing noise with edge.",
    "Track whether edge decays after becoming obvious (crowding).",
    "Beware look-ahead bias and survivorship bias in backtests.",
  ], 3);

  const title = `Market Lab Feed — Research Prompt (${now.toISOString().replace("T", " ").slice(0, 16)} UTC)`;
  const body = template({ asset, regime, micro, signal, control });

  return {
    title,
    seed: sha256Hex(seedStr).slice(0, 16),
    rotateMinutes: ROTATE_MINUTES,
    asset,
    regime,
    markdown: [
      `# ${title}`,
      ``,
      `**Deterministic seed:** \`${sha256Hex(seedStr).slice(0, 16)}\``,
      `**Rotates every:** ${ROTATE_MINUTES} minutes`,
      ``,
      body,
      ``,
      `---`,
      `## Supporting angles`,
      supportingAngles.map((a) => `- ${a}`).join("\n"),
      ``,
      `---`,
      `## Theory nugget`,
      `> ${nugget}`,
      ``,
      `---`,
      `## Guardrails`,
      `- No trading, no execution, no wallet keys.`,
      `- Research-only: design hypotheses, tests, and falsification criteria.`,
      ``,
    ].join("\n"),
  };
}

// ---------- Routes ----------
app.get("/", (req, res) => {
  res.type("text/plain").send(
    `Market Lab Feed running.\n\nEndpoints:\n- /latest.md (markdown prompt)\n- /latest.json (structured)\n- /healthz\n`
  );
});

app.get("/healthz", (req, res) => {
  res.json({ ok: true, service: "market-lab-feed", time: new Date().toISOString() });
});

app.get("/latest.md", (req, res) => {
  const bundle = generatePromptBundle(new Date());
  res.set("Cache-Control", "no-store");
  res.type("text/markdown").send(bundle.markdown);
});

app.get("/latest.json", (req, res) => {
  const bundle = generatePromptBundle(new Date());
  res.set("Cache-Control", "no-store");
  res.json(bundle);
});

// 404 fallback
app.use((req, res) => {
  res.status(404).type("text/plain").send("Not found. Try /latest.md");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Market Lab Feed listening on port ${PORT}`);
});
