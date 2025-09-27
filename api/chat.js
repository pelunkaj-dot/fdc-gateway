// Vercel serverless: /api/chat
export default async function handler(req, res) {
  // CORS (bez cookies → můžeme povolit *)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, session_id, assistant } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing 'message'" });

    const systemPrompt =
      assistant
        ? `You are ${assistant}, a helpful, friendly tutor. Keep answers concise and practical.`
        : `You are Nela, a helpful, friendly tutor. Keep answers concise and practical.`;

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
          { role: "system", content: systemPrompt },
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
    return res.status(200).json({ reply, session_id: session_id || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
