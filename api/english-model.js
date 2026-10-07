import { englishModelTexts } from '../lib/english-model-texts.js';

const voice = 'en-GB-SoniaNeural';
const cache = new Map();
const pending = new Map();
const escapeXml = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

async function modelAudio(text) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9-]+$/.test(region)) throw new Error('model-unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'FajnAnglictina' },
      body: `<speak version="1.0" xml:lang="en-GB"><voice name="${voice}"><prosody rate="-12%">${escapeXml(text)}</prosody></voice></speak>`
    });
    if (!response.ok) throw new Error('model-unavailable');
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 100) throw new Error('model-unavailable');
    cache.set(text, audio);
    return audio;
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'X-Speech-Locale, X-Speech-Voice');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  const text = (req.method === 'POST' ? req.body : req.query)?.text;
  if (typeof text !== 'string' || !englishModelTexts.has(text)) return res.status(400).json({error:'Unknown course phrase'});
  try {
    let audio = cache.get(text);
    if (!audio) {
      if (!pending.has(text)) pending.set(text, modelAudio(text).finally(() => pending.delete(text)));
      audio = await pending.get(text);
    }
    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800');
    res.setHeader('X-Speech-Locale','en-GB');
    res.setHeader('X-Speech-Voice',voice);
    return res.status(200).send(audio);
  } catch { return res.status(503).json({error:'British model temporarily unavailable'}); }
}
