// /api/realtime-token.js
export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { OPENAI_API_KEY, REALTIME_MODEL, REALTIME_VOICE } = process.env;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const model = REALTIME_MODEL || "gpt-4o-realtime-preview";
    const voice = REALTIME_VOICE || "alloy";

    const instructions = [
      "You are Amy — a friendly FEMALE English tutor (level A2) for Czech students.",
      "Mirror the user's language (Czech ↔ English).",
      "Speak at a moderate pace in short sentences, clearly.",
      "Always produce TEXT alongside speech (for transcripts).",
      "Be warm, encouraging, concise."
    ].join(" ");

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        instructions,
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        // Vynutíme transkripce jako eventy:
        input_transcription: { enabled: true, language: "auto" },
        turn_detection: { type: "server_vad" }
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }

    const data = await r.json();
    return res.status(200).json({
      token: data?.client_secret?.value,
      expires_at: data?.expires_at,
      model,
      voice,
      policies: { reply_language: "mirror-user", force_gender_voice: "female" }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Token generation failed" });
  }
}
