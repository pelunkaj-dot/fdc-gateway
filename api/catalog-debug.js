// /api/catalog-debug.js — řekne, odkud se bere katalog a co v něm je
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const fromEnv = process.env.CATALOG_URL || "";
    let source = "", url = "", slugs = [];

    if (fromEnv) {
      source = "url";
      url = fromEnv;
      const r = await fetch(fromEnv, { cache: "no-store" });
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data?.assistants || []);
      slugs = Array.isArray(list) ? list.map(x => x.slug || x.id || x.key || x.name).filter(Boolean) : [];
    } else {
      source = "local";
      const file = path.join(process.cwd(), "assistants.catalog.json");
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const list = Array.isArray(raw) ? raw : (raw?.assistants || []);
      slugs = Array.isArray(list) ? list.map(x => x.slug || x.id || x.key || x.name).filter(Boolean) : [];
    }

    res.status(200).json({ source, url, slugs });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
