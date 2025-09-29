// /api/self-test.js — diagnostika, proč /api/chat padá
import fs from "fs";
import path from "path";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

async function loadCatalog() {
  if (process.env.CATALOG_URL) {
    const r = await fetch(process.env.CATALOG_URL, { cache: "no-store" });
    const data = await r.json();
    return { source: "url", data };
  }
  const file = path.join(process.cwd(), "assistants.catalog.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return { source: "local", data: raw };
}

function listFromCatalog(cat) {
  return Array.isArray(cat) ? cat : (cat?.assistants || []);
}

function findAssistant(list, key) {
  const keyLc = String(key || "").toLowerCase();
  return list.find(x => {
    const keys = [x.id, x.slug, x.key, x.name].filter(Boolean).map(s => String(s).toLowerCase());
    return keys.includes(keyLc);
  });
}

export default async function handler(req, res) {
  try {
    const want = (req.query.assistant || "amy").toString();

    const { source, data } = await loadCatalog();
    const list = listFromCatalog(data);
    const slugs = Array.isArray(list) ? list.map(x => x.slug || x.id || x.key || x.name).filter(Boolean) : [];

    const a = findAssistant(list, want);

    const info = {
      catalogSource: source,
      haveAssistant: !!a,
      assistantKeyTried: want,
      available: slugs,
      env: {
        hasOPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "",
        CATALOG_URL: process.env.CATALOG_URL || "",
        OPENAI_MODEL: process.env.OPENAI_MODEL || ""
      },
      model: a?.model || DEFAULT_MODEL,
      temperature: typeof a?.temperature === "number" ? a.temperature : 0.4,
      prompt: {
        uses: a?.system ? "system" : (a?.promptUrl ? "promptUrl" : (a?.promptPath ? "promptPath" : "none")),
        systemLen: a?.system ? String(a.system).length : 0,
        promptUrl: a?.promptUrl || "",
        promptPath: a?.promptPath || ""
      }
    };

    // Když je promptUrl, ověříme dostupnost
    if (a?.promptUrl) {
      try {
        const r = await fetch(a.promptUrl, { cache: "no-store" });
        info.prompt.fetchStatus = r.status;
        info.prompt.fetchOk = r.ok;
      } catch (e) {
        info.prompt.fetchOk = false;
        info.prompt.fetchError = String(e.message || e);
      }
    }

    return res.status(200).json(info);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
