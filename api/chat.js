// api/chat.js — verze: katalog + .md prompty, tolerantni vstup, CommonJS

const fs = require("fs");
const path = require("path");

// ---------- Pomocné funkce ----------
function loadCatalog() {
  const p = path.join(process.cwd(), "assistants.catalog.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadPrompt(promptFile) {
  const p = path.join(process.cwd(), promptFile);
  return fs.readFileSync(p, "utf8");
}

// ---------- Serverless handler (/api/chat) ----------
module.exports = async function handler(req, res) {
  // CORS (po rozběhnutí si to zúžíme whitelistem domén)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // --------- Robustní parsování těla ---------
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // Podporujeme ruzne nazvy poli z frontendu
    const msgFromArray = Array.isArray(body.messages)
      ? (body.messages[body.messages.length - 1]?.content || body.messages[0]?.content)
      : null;

    const message =
      body.message ??          // preferovane pole
      body.text ??             // alternativa
      msgFromArray ??          // z messages[]
      null;

    const assistantId =
      body.assistant ??        // starsi klíč
      body.assistantId ??      // novější klíč
      body.id ??               // některé bubliny posílají 'id'
      null;

    const sessionId =
      body.session_id ?? body.sessionId ?? null;

    if (!message) {
      return res.status(400).json({
        code: "MISSING_MESSAGE",
        message: "Chybi 'message' (nebo 'text' / 'messages').",
        receivedKeys: Object.keys(body)
      });
    }
    if (!assistantId) {
      return res.status(400).json({
        code: "MISSING_ASSISTANT",
        message: "Chybi 'assistantId' (nebo 'assistant' / 'id').",
        receivedKeys: Object.keys(body)
      });
    }

    // --------- Katalog + načtení promptu ---------
    const catalog = loadCatalog();
    const cfg = catalog[assistantId];
    if (!cfg) {
      return res.status(400).json({
        code: "UNKNOWN_ASSISTANT",
        message: `Neznamy assistantId: ${assistantId}`
      });
    }

    const systemPrompt = loadPrompt(cfg.promptFile);
    const model = cfg.model || "gpt-4.1-mini";
    const temperature = cfg.temperature ?? 0.2;

    // --------- Volání OpenAI ---------
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      // užitečný výstup pro logy
      console.error("OPENAI_ERROR", { status: resp.status, data });
      return res.status(502).json({ code: "OPENAI_ERROR", status: resp.status, detail: data });
    }

    const reply = data?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({
      reply,
      session_id: sessionId,
      assistant: assistantId,
      model
    });
  } catch (err) {
    console.error("SERVER_ERROR", err);
    return res.status(500).json({ code: "SERVER_ERROR", message: "Necekana chyba" });
  }
};
