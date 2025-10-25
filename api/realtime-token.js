// /api/realtime-token.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { OPENAI_API_KEY, REALTIME_MODEL, REALTIME_VOICE } = process.env;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const model = REALTIME_MODEL || "gpt-4o-realtime-preview";
    const voice = REALTIME_VOICE || "alloy"; // ženský hlas si případně změníme v env

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        turn_detection: { type: "server_vad" },
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
      policies: {
        reply_language: "mirror-user",
        force_gender_voice: "female"
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Token generation failed" });
  }
}
