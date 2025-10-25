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

    const url = "https://api.openai.com/v1/realtime/sessions";
    const commonHeaders = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      // TAHLE HLAVIČKA JE DŮLEŽITÁ PRO REALTIME
      "OpenAI-Beta": "realtime=v1",
    };

    // 1) pokus s transkripcí zapnutou
    const bodyWithTranscription = {
      model,
      voice,
      instructions,
      modalities: ["text", "audio"],
      input_audio_format: "pcm16",
      input_transcription: { enabled: true, language: "auto" },
      turn_detection: { type: "server_vad" }
    };

    let r = await fetch(url, { method: "POST", headers: commonHeaders, body: JSON.stringify(bodyWithTranscription) });

    // 2) fallback: když to OpenAI odmítne kvůli parametrům, zkusíme minimalistickou variantu
    if (!r.ok) {
      const err1 = await r.text();
      const bodyMinimal = {
        model,
        voice,
        instructions,
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        turn_detection: { type: "server_vad" }
      };
      const r2 = await fetch(url, { method: "POST", headers: commonHeaders, body: JSON.stringify(bodyMinimal) });
      if (!r2.ok) {
        const err2 = await r2.text();
        return res.status(502).json({ error: "OpenAI session create failed", details: [err1, err2] });
      }
      r = r2;
    }

    const data = await r.json();
    const token = data?.client_secret?.value;
    if (!token) {
      return res.status(502).json({ error: "No client_secret in OpenAI response", raw: data });
    }

    return res.status(200).json({
      token,
      expires_at: data?.expires_at,
      model,
      voice,
      policies: { reply_language: "mirror-user", force_gender_voice: "female" }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Token generation failed", detail: String(e?.message || e) });
  }
}
