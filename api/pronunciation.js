/**
 * api/pronunciation.js  —  Vercel Serverless Function
 * ─────────────────────────────────────────────────────
 * Přijme audio nahrávku (audio/webm), přepíše ji přes OpenAI Whisper,
 * porovná s očekávaným textem a volitelně hodnotí hlásky přes Azure.
 * Opt-in: phoneticAssessment=true + audioWav (mono PCM16 WAV 16 kHz).
 *
 * ENV proměnné (nastav v Vercel Dashboard → Settings → Environment Variables):
 *   OPENAI_API_KEY   stávající klíč
 *   AZURE_SPEECH_KEY a AZURE_SPEECH_REGION pouze v serverovém prostředí
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
const { parseAzureResult, childFeedback } = require('../lib/pronunciation-assessment');

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
  const samples = wrongWords.slice(0, 2).map((w) => `„${w.word}“`).join(' a ');
  return `Poslechni si vzor pro ${samples} a zopakuj ho jako celek.`;
};

// ── Parsování multipart formy bez externích závislostí ──────────────────────

const parseForm = (req) =>
  new Promise((resolve, reject) => {
    let bb;
    try { bb = Busboy({ headers: req.headers, limits: { files: 2, fileSize: 2 * 1024 * 1024, fields: 4, fieldSize: 2000, parts: 6 } }); }
    catch { reject(new Error('invalid-form')); return; }
    const fields = {};
    const files = {};
    let invalid = false;
    bb.on('field', (name, val, info) => { if (info.valueTruncated) invalid = true; fields[name] = val; });
    bb.on('file', (name, stream, info) => {
      const chunks = [];
      if (files[name]) invalid = true;
      files[name] = { mimeType: info.mimeType };
      stream.on('limit', () => { invalid = true; });
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => { files[name].buffer = Buffer.concat(chunks); });
      stream.on('error', reject);
    });
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) bb.on(event, () => { invalid = true; });
    bb.on('finish', () => invalid ? reject(new Error('invalid-form')) : resolve({ fields, audioBuffer: files.audio?.buffer, mimeType: files.audio?.mimeType, wavBuffer: files.audioWav?.buffer }));
    bb.on('error', reject);
    req.on('aborted', () => reject(new Error('invalid-form')));
    req.pipe(bb);
  });

// Validate PCM WAV instead of trusting a MIME label. Maximum 15 seconds.
function isAssessmentWav(b) {
  if (!b || b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return false;
  if (b.readUInt32LE(4) + 8 !== b.length) return false;
  let fmt = false, bytes = 0;
  for (let i = 12; i + 8 <= b.length;) {
    const kind = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4);
    if (i + 8 + n > b.length) return false;
    if (kind === 'fmt ') {
      if (n < 16) return false;
      fmt = b.readUInt16LE(i + 8) === 1 && b.readUInt16LE(i + 10) === 1 && b.readUInt32LE(i + 12) === 16000 && b.readUInt32LE(i + 16) === 32000 && b.readUInt16LE(i + 20) === 2 && b.readUInt16LE(i + 22) === 16;
    }
    if (kind === 'data') bytes += n;
    i += 8 + n + (n % 2);
  }
  return fmt && bytes >= 3200 && bytes <= 15 * 32000 && bytes % 2 === 0;
}

async function assessWithAzure(wavBuffer, expectedText, language) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9-]+$/.test(region)) throw new Error('azure-not-configured');
  if (!isAssessmentWav(wavBuffer)) throw new Error('azure-audio-unavailable');
  const locale = language === 'en-US' ? 'en-US' : 'en-GB';
  const params = { ReferenceText: expectedText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: true, PhonemeAlphabet: 'IPA', NBestPhonemeCount: 5 };
  const response = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Pronunciation-Assessment': Buffer.from(JSON.stringify(params)).toString('base64'), 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json' },
    body: wavBuffer,
  });
  if (!response.ok) throw new Error(`azure-http-${response.status}`);
  return parseAzureResult(await response.json(), locale);
}

async function assessEnglishSpeech(wavBuffer, expectedText, language) {
  const primary = await assessWithAzure(wavBuffer, expectedText, language);
  // Keep a coherent assessment from one accepted English accent.
  // Never combine the best individual phonemes from different assessments.
  if (primary.status === 'assessed' && primary.locale === 'en-GB') {
    const weakWords = primary.words.filter(w => w.accuracyScore < 80 || w.phonemes.some(p => p.accuracyScore !== null && p.accuracyScore < 75));
    if (weakWords.length) {
      try {
        const diagnostic = await assessWithAzure(wavBuffer, expectedText, 'en-US');
        if (diagnostic.status === 'assessed' &&
            !childFeedback({ score: 100 }, primary).passed && childFeedback({ score: 100 }, diagnostic).passed) {
          return { ...diagnostic, diagnostics: { locale: primary.locale, words: primary.words, status: primary.status }, accentAlternative: true };
        }
        primary.diagnostics = { locale: 'en-US', words: diagnostic.words, status: diagnostic.status };
        primary.issues = diagnostic.issues.filter(issue => weakWords.some(w => w.word.toLowerCase() === issue.word.toLowerCase()))
          // A final US R in e.g. water is not required in British pronunciation.
          .filter(issue => !(issue.type === 'r-practice' && /r$/i.test(issue.word) && !/^r/i.test(issue.word)))
          .map(issue => ({ ...issue, diagnosticLocale: 'en-US' }));
      } catch { primary.diagnostics = { locale: 'en-US', status: 'unavailable', words: [] }; }
    }
  }
  return primary;
}

// ── Whisper transkripce ─────────────────────────────────────────────────────

const transcribeWithWhisper = async (audioBuffer, language, mimeType = 'audio/webm') => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY není nastaven v Vercel env vars');

  const type = ['audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'].includes(mimeType) ? mimeType : 'audio/webm';
  const extension = { 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/webm': 'webm' }[type];
  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('language', (language || 'en').split('-')[0]);
  form.append('response_format', 'json');
  form.append('file', new Blob([audioBuffer], { type }), `audio.${extension}`);
  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', signal: AbortSignal.timeout(18000),
    headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: form,
  });

  if (!resp.ok) {
    throw new Error(`whisper-http-${resp.status}`);
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

// For the new project, do not reuse one heard word for repeated expected words.
function compareTextInOrder(expectedText, transcript) {
  // Whisper may write a spoken number as a digit (e.g. three -> 3).
  const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const clean = text => normalize(text.replace(/[’‘]/g, "'").replace(/\b(?:[0-9]|1[0-9]|20)\b/g, n => numberWords[Number(n)]));
  const expected = clean(expectedText).split(/\s+/).filter(Boolean);
  const heard = clean(transcript).split(/\s+/).filter(Boolean);
  const words = expected.map((word, index) => ({ word, heard: heard[index] || '', ok: wordsMatch(word, heard[index] || '') }));
  const correct = words.filter(w => w.ok).length;
  return { score: Math.round(100 * correct / Math.max(expected.length, heard.length, 1)), transcript, words, tip: makeTip(words.filter(w => !w.ok)) };
}

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
    const { fields, audioBuffer, mimeType, wavBuffer } = await parseForm(req);
    const expectedText = fields.expectedText || '';
    const language     = fields.language || 'en-GB';

    if (!audioBuffer || audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio soubor chybí nebo je prázdný' });
    }
    if (!expectedText.trim() || expectedText.length > 500) {
      return res.status(400).json({ error: 'expectedText chybí' });
    }

    const requested = fields.phoneticAssessment === 'true' && /^en(?:-GB|-US)?$/.test(language);
    // Whisper receives no reference prompt. Content recognition remains independent.
    // Non-opted-in clients keep their existing response and do not call Azure.
    const azurePromise = requested ? assessEnglishSpeech(wavBuffer, expectedText, language).catch(err => {
      // Log only a bounded error category, never keys, provider bodies or child audio/text.
      const reason = /^azure-(?:http-\d{3}|not-configured|audio-unavailable|invalid-result|missing-result|missing-scores|missing-words)$/.test(err.message) ? err.message : 'azure-unavailable';
      console.warn('[pronunciation]', reason);
      return { status: 'unavailable', reason, pronunciationScore: null, words: [], issues: [] };
    }) : null;
    const [transcript, pronunciation] = await Promise.all([transcribeWithWhisper(audioBuffer, language, mimeType), azurePromise]);
    const result = requested ? compareTextInOrder(expectedText, transcript) : compareText(expectedText, transcript);
    if (requested) {
      // Short isolated words are difficult for Whisper. Reconcile only when
      // Azure also recognizes the exact word AND all phonetic gates earn great.
      // Reference text alone, or a high aggregate alone, cannot override content.
      result.contentSource = 'whisper';
      const azureContent = compareTextInOrder(expectedText, pronunciation.recognizedText || '');
      if (result.score < 100 && normalize(expectedText).split(' ').length === 1 &&
          normalize(expectedText) === normalize(pronunciation.recognizedText || '') &&
          childFeedback(azureContent, pronunciation).level === 'great') {
        result.whisperContentScore = result.score;
        result.score = azureContent.score;
        result.words = azureContent.words;
        result.tip = null;
        result.contentSource = 'azure-phonetic-confirmed';
      }
      result.contentScore = result.score;
      result.pronunciation = pronunciation;
      result.pronunciationScore = pronunciation.pronunciationScore;
      result.feedback = childFeedback(result, pronunciation);
      // Keep a familiar score field for compatibility, while child UI uses feedback.
      if (pronunciation.status === 'assessed') {
        result.score = Math.min(result.contentScore, Math.round(pronunciation.pronunciationScore), result.feedback.level === 'great' ? 100 : result.feedback.level === 'good' ? 79 : 59);
      } else if (pronunciation.status === 'no-match') result.score = 0;
      result.tip = result.feedback.tip;
    }

    return res.status(200).json(result);

  } catch (err) {
    const invalid = err.message === 'invalid-form';
    console.error('[pronunciation API]', invalid ? 'invalid-form' : 'assessment-failed');
    return res.status(invalid ? 400 : 503).json({ error: invalid ? 'Nahrávku se nepodařilo načíst.' : 'Hlas se teď nepodařilo zkontrolovat. Zkus to znovu.' });
  }
};

export const config = { api: { bodyParser: false }, maxDuration: 30 };
