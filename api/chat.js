const fs = require("fs");
const path = require("path");

// --- helpers ---
function loadCatalog() {
  const p = path.join(process.cwd(), "assistants.catalog.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function loadPrompt(promptFile) {
  const p = path.join(process.cwd(), promptFile);
  return fs.readFileSync(p, "utf8");
}

// --- Vercel serverless: /api/chat ---
export default async function handler(req, res) {
  // CORS (muzes pozdeji zprisnit whitelistem)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // vstup z bubliny (tolerujeme ruzne nazvy)
    const {
      message,
      session_id,
      sessionId: sessionIdAlt,
      assistant,
      assistantId: assistantIdAlt
    } = req.body || {};

    if (!message) return res.status(400).json({ error: "Missing 'message'" });

    const sessionId = session_id || sessionIdAlt || null;
    const assistantId = assistant || assistantIdAlt;

    if (!assistantId) {
      return res.status(400).json({ code: "MISSING_ASSISTANT", message: "Chybi assistantId" });
    }

    // katalog + prompt
    const catalog = loadCatalog();
    const cfg = catalog[assistantId];
    if (!cfg) {
      return res.status(400).json({ code: "UNKNOWN_ASSISTANT", message: `Neznamy assistantId: ${assistantId}` });
    }

    const systemPrompt = loadPrompt(cfg.promptFile);
    const model = cfg.model || "gpt-4.1-mini";
    const temperature = cfg.temperature ?? 0.2;

    // volani OpenAI
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
      console.error("OpenAI error:", data);
      return res.status(502).json({ code: "OPENAI_ERROR", detail: data });
    }

    const reply = data?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({
      reply,
      session_id: sessionId,
      assistant: assistantId
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ code: "SERVER_ERROR", message: "Necekana chyba" });
  }
}
