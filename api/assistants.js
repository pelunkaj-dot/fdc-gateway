// /api/assistants.js — vypíše klíče asistentů, které gateway používá
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const file = path.join(process.cwd(), "assistants.catalog.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const slugs = Array.isArray(raw) ? raw.map(a => a.slug) : Object.keys(raw);
    res.status(200).json({ slugs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
