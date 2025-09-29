import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Range');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { text, voice = 'alloy', format = 'mp3' } = (req.method === 'POST' ? req.body : req.query) as any;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing "text" string.' });
    }

    // OpenAI TTS (v1/audio/speech)
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts', // levné a rychlé TTS
        voice,
        input: text,
        format
      })
    });

    if (!r.ok) {
      const msg = await r.text().catch(()=> 'TTS failed');
      return res.status(500).json({ error: msg });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.status(200).send(buf);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}
