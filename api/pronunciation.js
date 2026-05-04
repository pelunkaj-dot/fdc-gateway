/**
 * api/pronunciation.js  —  Vercel Serverless Function
 * ─────────────────────────────────────────────────────
 * Přijme audio nahrávku (audio/webm), přepíše ji přes OpenAI Whisper,
 * porovná s očekávaným textem a vrátí skóre + analýzu slov.
 *
 * ENV proměnné (nastav v Vercel Dashboard → Settings → Environment Variables):
 *   OPENAI_API_KEY   váš OpenAI API klíč
 *
 * Očekávaný request:  POST multipart/form-data
 *   audio        — Blob (audio/webm)
 *   expectedText — string (věta, kterou měl uživatel říct)
 *   language     — string (BCP-47, např. "en-GB" nebo "en-US")
 *
 * Response JSON:
 *   { score, transcript, words: [{word, ok, heard}], tip }
 */

const Busboy = require('busboy');

// Zakáže vestavěný bodyParser — budeme parsovat multipart sami
export const config = {
  api: { bodyParser: false },
};

// ── Pomocné funkce ──────────────────────────────────────────────────────────

/** Normalizace textu pro porovnání: lowercase, bez interpunkce */
const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-záčďéěíňóřšťúůýžäöüßàâæçéèêëîïôœùûüÿ'\s]/g, '')
    .trim();

/** Levenshteinova vzdálenost — pro fuzzy matching slov */
const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

/** Porovná slova — toleruje překlepy 1 znak u slov 5+ znaků */
const wordsMatch = (expected, heard) => {
  if (expected === heard) return true;
  if (expected.length >= 5 && levenshtein(expected, heard) <= 1) return true;
  return false;
};

/** Vygeneruje tip pro nejčastěji špatná slova */
const makeTip = (wrongWords) => {
  if (wrongWords.length === 0) return null;
  const samples = wrongWords.slice(0, 2).map((w) => `„${w.word}"`).join(' a ');
  return `Zaměř se na výslovnost: ${samples}. Zkus opakovat pomaleji po slabikách.`;
};

// ── Parsování multipart formy bez externích závislostí ──────────────────────

const parseForm = (req) =>
  new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
    const fields = {};
    const chunks = [];

    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (_name, stream) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {});
      stream.on('error', reject);
    });
    bb.on('finish', () => resolve({ fields, audioBuffer: Buffer.concat(chunks) }));
    bb.on('error', reject);

    req.pipe(bb);
  });

// ── Whisper transkripce ─────────────────────────────────────────────────────

const transcribeWithWhisper = async (audioBuffer, language) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY není nastaven v Vercel env vars');

  // Sestavíme multipart ručně — Node.js fetch FormData
  const boundary = `----WhistlerBoundary${Date.now()}`;
  const langCode = (language || 'en').split('-')[0]; // 'en-GB' → 'en'

  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1`,
    `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${langCode}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson`,
    // audio soubor
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`,
  ];

  const textPart = Buffer.from(bodyParts.join('\r\n') + '\r\n', 'utf8');
  // Pozn: první join odděluje části, ale file part musí být těsně před binarním blokem
  const preText = Buffer.from(
    bodyParts.slice(0, 3).map((p) => p + '\r\n').join('') +
      bodyParts[3] +
      '',
    'utf8'
  );
  // Sestavíme správně
  const pre = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="model"',
    '',
    'whisper-1',
    `--${boundary}`,
    'Content-Disposition: form-data; name="language"',
    '',
    langCode,
    `--${boundary}`,
    'Content-Disposition: form-data; name="response_format"',
    '',
    'json',
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="audio.webm"',
    'Content-Type: audio/webm',
    '',
    '',
  ].join('\r\n');

  const post = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(pre, 'utf8'),
    audioBuffer,
    Buffer.from(post, 'utf8'),
  ]);

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Whisper API selhalo (${resp.status}): ${errText}`);
  }

  const json = await resp.json();
  return (json.text || '').trim();
};

// ── Porovnání textu ─────────────────────────────────────────────────────────

const compareText = (expectedText, transcript) => {
  const expectedWords = normalize(expectedText).split(/\s+/).filter(Boolean);
  const heardWords    = normalize(transcript).split(/\s+/).filter(Boolean);

  // Pro každé očekávané slovo najdeme nejlepší shodu v přepisu
  const words = expectedWords.map((word) => {
    // Přesná shoda na dané pozici nebo kdekoliv v přepisu
    const exactMatch = heardWords.some((h) => wordsMatch(word, h));
    const heard = heardWords.find((h) => wordsMatch(word, h)) || heardWords.shift() || '';
    return { word, ok: exactMatch, heard: exactMatch ? word : heard };
  });

  const correct = words.filter((w) => w.ok).length;
  const score   = expectedWords.length > 0 ? Math.round((correct / expectedWords.length) * 100) : 0;
  const tip     = makeTip(words.filter((w) => !w.ok));

  return { score, transcript, words, tip };
};

// ── Handler ─────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS — povolí volání z fajndoucko.cz a GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda není povolena' });
  }

  try {
    const { fields, audioBuffer } = await parseForm(req);
    const expectedText = fields.expectedText || '';
    const language     = fields.language || 'en-GB';

    if (!audioBuffer || audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio soubor chybí nebo je prázdný' });
    }
    if (!expectedText) {
      return res.status(400).json({ error: 'expectedText chybí' });
    }

    const transcript = await transcribeWithWhisper(audioBuffer, language);
    const result     = compareText(expectedText, transcript);

    return res.status(200).json(result);

  } catch (err) {
    console.error('[pronunciation API]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
