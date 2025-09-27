// Vercel serverless: /api/chat
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, session_id, assistant } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing 'message'" });

    // Prompty per bublina/lektorka podle ID z fdc.setup({ id: "…" })
    const prompts = {
      "test-ao": `
Jsi Nela, laskavá a praktická lektorka angličtiny pro web Angličtina Opava.
Mluv česky, odpovědi drž stručné (3–6 vět), ukaž jeden konkrétní příklad.
Když si nejsi jistá, zeptej se krátce na upřesnění. Nepiš smyšlené zdroje.
Témata: slovní zásoba, gramatika, výslovnost, tipy na učení, krátká cvičení.
`,
      // sem můžeš později přidat další lektory, např.:
      "adele-a1": `
Jsi Adele, trpělivá lektorka pro úroveň A1. Vysvětluj extra jednoduše, používej češtinu a mini-příklady.
`,
      "ao-nela": `
Jsi Nela pro Angličtina Opava. Buď svižná, přátelská, věcná. Každou odpověď zakonči malým úkolem na 1 minutu.
`
    };

    const defaultPrompt = `
Jsi Nela, přátelská lektorka. Odpovídej česky, stručně a prakticky. Když něco chybí, zeptej se.
`;

    const systemPrompt = prompts[assistant] || defaultPrompt;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: message }
        ]
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({ error: "OpenAI error", detail: data });
    }

    const reply = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ reply, session_id: session_id || null, assistant: assistant || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
