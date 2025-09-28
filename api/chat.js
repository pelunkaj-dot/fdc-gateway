// /api/chat.js — Vercel Serverless Function (Node.js)
// Verze s podporou historie: přijímá body.history = [{role:'user'|'assistant', content:string}, ...]
// Katalog z CATALOG_URL (RAW GitHub) nebo fallback ../assistants.catalog.json
// Prompty: a.system | a.promptUrl | (REPO_RAW_BASE + a.promptPath)
// CORS řízeno přes ALLOWED_ORIGINS (comma-separated)

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// ---------- CORS ----------
function setCors(res, origin) {
  const allowList = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (allowList.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowList.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ---------- catalog ----------
let catalogCache = null;
async function loadCatalog() {
  if (catalogCache) return catalogCache;

  if (process.env.CATALOG_URL) {
    const r = await fetch(process.env.CATALOG_URL, { cache: "no-store" });
    if (!r.ok) throw new Error(`CATALOG_FETCH_FAILED:${r.status}`);
    catalogCache = await r.json();
    return catalogCache;
  }

  try {
    // chat.js je v /api/, katalog v kořeni repa
    catalogCache = require("../assistants.catalog.json");
    return catalogCache;
  } catch {
    throw new Error("CATALOG_NOT_FOUND");
  }
}

// ---------- prompt ----------
async function loadPromptForAssistant(a) {
  if (a.system && typeof a.system === "string" && a.system.trim()) {
    return a.system;
  }
  if (a.promptUrl) {
    const r = await fetch(a.promptUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`PROMPT_FETCH_FAILED:${r.status}`);
    return await r.text();
  }
  if (a.promptPath) {
    const base = process.env.REPO_RAW_BASE;
    if (!base) throw new Error("MISSING_REPO_RAW_BASE");
    const url = base.replace(/\/$/, "") + "/" + String(a.promptPath).replace(/^\//, "");
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`PROMPT_FETCH_FAILED:${r.status}`);
    return await r.text();
  }
  return "";
}

// ---------- OpenAI ----------
async function openaiChat({ messages, model, temperature = 0.4 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("MISSING_OPENAI_API_KEY");

  const body = { model: model || DEFAULT_MODEL, messages, temperature, stream: false };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    const err = new Error(`OPENAI_ERROR:${r.status}`);
    err.details = t;
    throw err;
  }
  const data = await r.json();
  const reply = data?.choices?.[0]?.message?.content ?? "";
  return { reply, data };
}

// ---------- history sanitization ----------
function sanitizeHistory(h) {
  if (!Array.isArray(h)) return [];
  const clean = h
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12); // posledních pár zpráv
  return clean.map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
}

// ---------- handler ----------
module.exports = async (req, res) => {
  try {
    setCors(res, req.headers?.origin);

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    // tělo
    const body =
      typeof req.body === "object" && req.body !== null
        ? req.body
        : await new Promise(resolve => {
            let raw = "";
            req.on("data", c => (raw += c));
            req.on("end", () => {
              try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); }
            });
          });

    const assistantKey = (
      body.assistant || body.assistantId || body.slug || body.id || ""
    ).toString().trim();
    const userMsg = (body.message || body.content || body.prompt || "").toString();

    if (!assistantKey || !userMsg) {
      return res.status(400).json({ error: "MISSING_FIELDS", need: { assistant: true, message: true } });
    }

    const catalog = await loadCatalog();
    const list = Array.isArray(catalog) ? catalog : (catalog?.assistants || []);
    const keyLc = assistantKey.toLowerCase();

    const a = list.find(x => {
      const keys = [x.id, x.slug, x.key, x.name].filter(Boolean).map(s => String(s).toLowerCase());
      return keys.includes(keyLc);
    });

    if (!a) {
      return res.status(400).json({
        error: "ASSISTANT_NOT_FOUND",
        assistantKey,
        known: list.map(x => x.slug || x.id || x.key || x.name),
      });
    }

    const system = await loadPromptForAssistant(a);
    const history = sanitizeHistory(body.history);

    const messages = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: userMsg },
    ];

    const temperature = typeof a.temperature === "number" ? a.temperature : 0.4;
    const model = a.model || DEFAULT_MODEL;

    const { reply, data } = await openaiChat({ messages, model, temperature });

    return res.status(200).json({
      ok: true,
      assistant: a.slug || a.id || a.key || a.name || assistantKey,
      model,
      reply,
      usage: data?.usage || null,
    });
  } catch (e) {
    console.error("/api/chat error", e);
    const dbg = (process.env.TEMP_DEBUG === "1") ? String(e?.details || e?.message || e) : "SERVER_ERROR";
    const code =
      String(e?.message || "").startsWith("CATALOG_") ||
      String(e?.message || "").startsWith("PROMPT_") ||
      String(e?.message || "").startsWith("MISSING_")
        ? 400
        : 500;
    return res.status(code).json({ error: dbg });
  }
};
