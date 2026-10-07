const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Readable } = require('node:stream');
const { parseAzureResult, childFeedback } = require('../lib/pronunciation-assessment');

// Synthetic provider responses: these test interpretation, NOT acoustic detection.
const cases = {
  frog: ['f', 'r', 'ɑ', 'g'], red: ['r', 'ɛ', 'd'], rabbit: ['r', 'æ', 'b', 'ɪ', 't'],
  dog: ['d', 'ɑ', 'g'], three: ['θ', 'r', 'i'], think: ['θ', 'ɪ', 'ŋ', 'k'],
  this: ['ð', 'ɪ', 's'], water: ['w', 'ɔ', 't', 'ɚ'],
};
function fixture(word, change = {}, nested = true) {
  const assessment = value => nested ? { PronunciationAssessment: value } : value;
  return { RecognitionStatus: 'Success', NBest: [{
    ...assessment({ PronScore: 94, AccuracyScore: 94, FluencyScore: 95, CompletenessScore: 100 }),
    Words: [{ Word: word, ...assessment({ AccuracyScore: 94, ErrorType: 'None' }),
      Phonemes: cases[word].map((p, i) => ({ Phoneme: p,
        ...assessment({ AccuracyScore: i === change.index ? (change.score ?? 40) : 94,
          NBestPhonemes: i === change.index && change.heard ? [{ Phoneme: change.heard, Score: 95 }, { Phoneme: p, Score: 20 }] : [{ Phoneme: p, Score: 98 }] }),
      })),
    }],
  }] };
}
const content = { score: 100, words: [{ word: 'frog', ok: true }], tip: null };
for (const word of Object.keys(cases)) {
  test(`${word}: high-scoring complete result can receive praise`, () => {
    assert.equal(childFeedback(content, parseAzureResult(fixture(word), 'en-US')).level, 'great');
  });
  test(`${word}: one weak phoneme blocks praise even with correct Whisper text`, () => {
    assert.equal(childFeedback(content, parseAzureResult(fixture(word, { index: 1 }), 'en-US')).level, 'retry');
  });
}
test('Low R gives articulation practice without claiming a detected Czech trill', () => {
  const result = parseAzureResult(fixture('frog', { index: 1 }), 'en-US');
  assert.equal(result.issues[0].type, 'r-practice');
  assert.equal(result.issues[0].heard, null);
  assert.match(childFeedback(content, result).tip, /nerozkmitá/);
});
test('G→K candidate supports voicing advice', () => {
  assert.equal(parseAzureResult(fixture('dog', { index: 2, heard: 'k' }), 'en-US').issues[0].type, 'voicing');
});
for (const heard of ['t', 's', 'd', 'z']) test(`TH→${heard} supports a substitution label`, () => {
  assert.equal(parseAzureResult(fixture('think', { index: 0, heard }), 'en-US').issues[0].type, 'th-substitution');
});
test('Low vowel score produces vowel practice advice', () => {
  assert.equal(parseAzureResult(fixture('rabbit', { index: 1 }), 'en-US').issues[0].type, 'vowel-practice');
});
test('REST flat and SDK nested scores are both accepted', () => {
  assert.deepEqual(parseAzureResult(fixture('frog', {}, false), 'en-US'), parseAzureResult(fixture('frog'), 'en-US'));
});
test('Incorrect content, omitted words, missing phoneme data cannot get praise', () => {
  const result = parseAzureResult(fixture('frog'), 'en-US');
  assert.equal(childFeedback({ ...content, score: 0 }, result).passed, false);
  result.words[0].errorType = 'Omission';
  assert.equal(childFeedback(content, result).passed, false);
  result.words[0].errorType = 'None'; result.words[0].phonemes = [];
  assert.equal(childFeedback(content, result).passed, false);
});
test('Malformed scores throw; no-match is not provider failure or success', () => {
  const broken = fixture('frog'); delete broken.NBest[0].PronunciationAssessment.PronScore;
  assert.throws(() => parseAzureResult(broken, 'en-US'));
  const noMatch = parseAzureResult({ RecognitionStatus: 'NoMatch' }, 'en-US');
  assert.equal(childFeedback(content, noMatch).passed, false);
});
test('Fallback recognizes content without awarding phonetic praise', () => {
  const feedback = childFeedback(content, { status: 'unavailable' });
  assert.equal(feedback.level, 'content-only'); assert.equal(feedback.passed, false);
});

function loadHandler(fetch, env = {}) {
  const filename = require.resolve('../api/pronunciation.js');
  const source = fs.readFileSync(filename, 'utf8').replace('export const config', 'const config');
  const sandbox = { module: { exports: {} }, require: createRequire(filename), Buffer, Blob, FormData, AbortSignal,
    console: { warn() {}, error() {} }, process: { env: { OPENAI_API_KEY: 'test-placeholder', ...env } }, fetch };
  vm.runInNewContext(source, sandbox, { filename });
  return sandbox.module.exports;
}
function wav() {
  const b = Buffer.alloc(44 + 6400); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(6400, 40); return b;
}
async function request(handler, fields = {}, audioWav = wav()) {
  const f = new FormData(); f.append('audio', new Blob([Buffer.alloc(500)], { type: 'audio/webm' }), 'test.webm');
  for (const [key, value] of Object.entries({ expectedText: 'frog', language: 'en-US', ...fields })) f.append(key, value);
  if (fields.phoneticAssessment === 'true' && audioWav) f.append('audioWav', new Blob([audioWav], { type: 'audio/wav' }), 'test.wav');
  const native = new Request('https://test.invalid', { method: 'POST', body: f });
  const req = Readable.from([Buffer.from(await native.arrayBuffer())]); req.method = 'POST'; req.headers = Object.fromEntries(native.headers);
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res); return res;
}
const env = { AZURE_SPEECH_KEY: 'test-placeholder', AZURE_SPEECH_REGION: 'westeurope' };
function replyFixture(text){const result=fixture('frog');const best=result.NBest[0];best.Lexical=text.toLowerCase().replace(/[^a-z\s]/g,'');best.Words=text.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).filter(Boolean).map(word=>({Word:word,PronunciationAssessment:{AccuracyScore:94,ErrorType:'None'},Phonemes:[{Phoneme:'a',PronunciationAssessment:{AccuracyScore:94}}]}));return result;}
test('Dialogue transcribes once, chooses the spoken allowed alternative and grades that exact British reference',async()=>{
  let transcriptions=0,azure=0;
  const res=await request(loadHandler(async(url,options)=>{if(url.includes('openai')){transcriptions++;return Response.json({text:'Some water, please.'});}azure++;const params=JSON.parse(Buffer.from(options.headers['Pronunciation-Assessment'],'base64').toString());assert.equal(params.ReferenceText,'Some water, please.');assert.match(url,/en-GB/);return Response.json(replyFixture('Some water, please.'));},env),{expectedText:'Can I have some water, please?',language:'en-GB',phoneticAssessment:'true',responseGroup:'food:want-water'});
  assert.equal(res.code,200);assert.equal(res.body.feedback.passed,true);assert.equal(res.body.referenceText,'Some water, please.');assert.equal(res.body.transcript,'Some water, please.');assert.equal(transcriptions,1);assert.equal(azure,1);
});
test('Wrong meaning cannot pass a dialogue response group; unknown group does not call providers',async()=>{
  let calls=0;const handler=loadHandler(async url=>{calls++;return url.includes('openai')?Response.json({text:'Some milk, please.'}):Response.json(replyFixture('Some milk, please.'));},env);
  let res=await request(handler,{expectedText:'Can I have some water, please?',language:'en-GB',phoneticAssessment:'true',responseGroup:'food:want-water'});assert.equal(res.code,200);assert.equal(res.body.feedback.passed,false);
  const before=calls;res=await request(handler,{expectedText:'frog',language:'en-GB',phoneticAssessment:'true',responseGroup:'unknown'});assert.equal(res.code,400);assert.equal(calls,before);
});
test('Legacy caller retains the original shape and never calls Azure', async () => {
  let count = 0;
  const res = await request(loadHandler(async url => { assert.match(url, /api.openai.com/); count++; return Response.json({ text: 'frog' }); }, env));
  assert.equal(count, 1); assert.equal(res.code, 200); assert.equal(res.body.score, 100); assert.equal(res.body.pronunciation, undefined);
});
test('Opt-in sends PCM and encoded assessment config; low phoneme overrides Whisper 100', async () => {
  const res = await request(loadHandler(async (url, options) => {
    if (url.includes('openai')) return Response.json({ text: 'frog' });
    const params = JSON.parse(Buffer.from(options.headers['Pronunciation-Assessment'], 'base64').toString());
    assert.equal(params.Granularity, 'Phoneme'); assert.equal(params.ReferenceText, 'frog');
    assert.equal(params.EnableProsodyAssessment, undefined); assert.equal(params.NBestPhonemeCount, 5);
    assert.equal(options.body.toString('ascii', 0, 4), 'RIFF');
    return Response.json(fixture('frog', { index: 1 }));
  }, env), { phoneticAssessment: 'true' });
  assert.equal(res.code, 200); assert.equal(res.body.contentScore, 100); assert.equal(res.body.pronunciationScore, 94);
  assert.equal(res.body.feedback.level, 'retry'); assert.equal(res.body.score, 59);
});
for (const code of [401, 429, 500]) test(`Azure HTTP ${code} falls back to Whisper with no key leak`, async () => {
  const res = await request(loadHandler(async url => url.includes('openai') ? Response.json({ text: 'frog' }) : new Response('sensitive provider body', { status: code }), env), { phoneticAssessment: 'true' });
  assert.equal(res.code, 200); assert.equal(res.body.score, 100); assert.equal(res.body.feedback.level, 'content-only');
  assert.equal(JSON.stringify(res.body).includes('sensitive provider body'), false);
});
test('Unconfigured Azure and wrong PCM format safely fall back', async () => {
  const whisper = async url => { assert.match(url, /openai/); return Response.json({ text: 'frog' }); };
  let res = await request(loadHandler(whisper), { phoneticAssessment: 'true' });
  assert.equal(res.body.pronunciation.reason, 'azure-not-configured');
  res = await request(loadHandler(whisper, env), { phoneticAssessment: 'true' }, Buffer.alloc(100));
  assert.equal(res.body.pronunciation.reason, 'azure-audio-unavailable');
});
test('Missing repeated words do not receive a full content score in the new project', async () => {
  const res = await request(loadHandler(async () => Response.json({ text: 'red' })), { expectedText: 'red red', phoneticAssessment: 'true' });
  assert.equal(res.body.contentScore, 50);
});
test('Provider failure returns a generic child-safe error', async () => {
  const res = await request(loadHandler(async () => { throw new Error('secret-like-provider-error'); }));
  assert.equal(res.code, 503); assert.equal(JSON.stringify(res.body).includes('secret-like'), false);
});
test('British primary stays authoritative and good British speech makes no second Azure call', async () => {
  let azureCalls = 0;
  const res = await request(loadHandler(async url => {
    if (url.includes('openai')) return Response.json({ text: 'water' });
    azureCalls++; assert.match(url, /language=en-GB/); return Response.json(fixture('water'));
  }, env), { expectedText: 'water', language: 'en-GB', phoneticAssessment: 'true' });
  assert.equal(res.body.feedback.level, 'great'); assert.equal(res.body.pronunciation.locale, 'en-GB'); assert.equal(azureCalls, 1);
});
test('Weak British speech gets named US diagnostics without replacing British scores', async () => {
  const res = await request(loadHandler(async url => {
    if (url.includes('openai')) return Response.json({ text: 'dog' });
    if (url.includes('en-GB')) {
      const gb = fixture('dog', { index: 2 }); gb.NBest[0].PronunciationAssessment.PronScore = 82;
      gb.NBest[0].Words[0].Phonemes.forEach(p => { delete p.Phoneme; }); return Response.json(gb);
    }
    return Response.json(fixture('dog', { index: 2, heard: 'k' }));
  }, env), { expectedText: 'dog', language: 'en-GB', phoneticAssessment: 'true' });
  assert.equal(res.body.pronunciationScore, 82); assert.equal(res.body.pronunciation.locale, 'en-GB');
  assert.equal(res.body.pronunciation.issues[0].type, 'voicing'); assert.equal(res.body.feedback.passed, false);
});
test('Secondary diagnostic failure retains the successful primary assessment', async () => {
  const res = await request(loadHandler(async url => {
    if (url.includes('openai')) return Response.json({ text: 'red' });
    if (url.includes('en-GB')) return Response.json(fixture('red', { index: 0 }));
    throw new Error('timeout');
  }, env), { expectedText: 'red', language: 'en-GB', phoneticAssessment: 'true' });
  assert.equal(res.body.pronunciation.status, 'assessed'); assert.equal(res.body.pronunciation.diagnostics.status, 'unavailable');
});
test('Spoken three transcribed as 3 remains correct content', async () => {
  const res = await request(loadHandler(async url => url.includes('openai') ? Response.json({ text: '3.' }) : Response.json(fixture('three')), env), { expectedText: 'three', phoneticAssessment: 'true' });
  assert.equal(res.body.contentScore, 100);
});
test('Confirmed consonant substitution blocks acceptance despite strong aggregates', () => {
  const p = parseAzureResult(fixture('dog'), 'en-GB');
  p.issues = [{ type: 'voicing', word: 'dog', expected: 'g', heard: 'k', accuracyScore: 54, tip: 'Zkus G s hlasem.' }];
  assert.equal(childFeedback({ score: 100 }, p).passed, false);
});

test('Strong US assessment never replaces the British pronunciation grade', async () => {
  const res = await request(loadHandler(async url => {
    if (url.includes('openai')) return Response.json({ text: 'dog' });
    const p = fixture('dog');
    if (url.includes('en-GB')) {
      p.NBest[0].PronunciationAssessment.AccuracyScore = 68;
      p.NBest[0].PronunciationAssessment.PronScore = 80.8;
      p.NBest[0].Words[0].PronunciationAssessment.AccuracyScore = 68;
      p.NBest[0].Words[0].Phonemes[1].PronunciationAssessment.AccuracyScore = 79;
    }
    return Response.json(p);
  }, env), { expectedText: 'dog', language: 'en-GB', phoneticAssessment: 'true' });
  assert.equal(res.body.feedback.passed, false);
  assert.equal(res.body.pronunciation.locale, 'en-GB');
  assert.equal(res.body.pronunciationScore, 80.8);
  assert.equal(res.body.pronunciation.accentAlternative, undefined);
});

test('Exact Azure recognition plus strong phonemes can resolve isolated Whisper disagreement', async () => {
  const res = await request(loadHandler(async url => {
    if (url.includes('openai')) return Response.json({ text: 'read' });
    const p = fixture('red'); p.NBest[0].Lexical = 'red'; return Response.json(p);
  }, env), { expectedText: 'red', language: 'en-GB', phoneticAssessment: 'true' });
  assert.equal(res.body.feedback.passed, true);
  assert.equal(res.body.contentScore, 100);
  assert.equal(res.body.whisperContentScore, 0);
  assert.equal(res.body.contentSource, 'azure-phonetic-confirmed');
  assert.equal(res.body.transcript, 'read');
});

test('Reference agreement cannot override a wrong word with a weak vowel', async () => {
  const res = await request(loadHandler(async url => {
    if (url.includes('openai')) return Response.json({ text: 'reed' });
    const p = fixture('red', { index: 1, heard: 'i' }); p.NBest[0].Lexical = 'red'; return Response.json(p);
  }, env), { expectedText: 'red', phoneticAssessment: 'true' });
  assert.equal(res.body.feedback.passed, false);
  assert.equal(res.body.contentScore, 0);
  assert.match(res.body.feedback.tip, /nerozpoznala dost jistě/);
  assert.doesNotMatch(res.body.feedback.tip, /slabik/);
});

test('High scores without exact recognition cannot override Whisper disagreement', async () => {
  const res = await request(loadHandler(async url => url.includes('openai') ? Response.json({ text: 'read' }) : Response.json(fixture('red')), env), { expectedText: 'red', phoneticAssessment: 'true' });
  assert.equal(res.body.feedback.passed, false);
});

// Recorded UK dictionary reference, not an American accent acceptance fixture.
test('British dad with clear phonemes and low aggregate earns partial success', () => {
  const p = { status: 'assessed', locale: 'en-GB', pronunciationScore: 80.8, accuracyScore: 68,
    words: [{ word: 'dad', accuracyScore: 68, errorType: 'None', phonemes: [100,85,96].map(accuracyScore => ({ accuracyScore })) }], issues: [] };
  assert.equal(childFeedback({ score: 100 }, p).level, 'good');
  p.words[0].phonemes[1].accuracyScore = 64;
  assert.equal(childFeedback({ score: 100 }, p).passed, false);
});
test('American grades do not receive the British clear-sounds adjustment', () => {
  const p = parseAzureResult(fixture('dog'), 'en-US');
  p.accuracyScore = 68; p.words[0].accuracyScore = 68;
  assert.equal(childFeedback({ score: 100 }, p).passed, false);
});

test('British three with strong phonemes earns partial success despite aggregate mispronunciation', () => {
  const p = { status: 'assessed', locale: 'en-GB', pronunciationScore: 11.8, accuracyScore: 59,
    words: [{ word: 'three', accuracyScore: 59, errorType: 'Mispronunciation', phonemes: [87.2,89,82].map(accuracyScore => ({ accuracyScore })) }], issues: [], diagnostics: { status: 'assessed' } };
  assert.equal(childFeedback({ score: 100 }, p).level, 'good');
  p.issues = [{ type: 'th-substitution', accuracyScore: 19, tip: 'Zkus TH.' }];
  assert.equal(childFeedback({ score: 100 }, p).passed, false);
  p.issues = []; p.diagnostics.status = 'unavailable';
  assert.equal(childFeedback({ score: 100 }, p).passed, false);
  p.diagnostics.status = 'assessed'; p.words[0].errorType = 'Omission';
  assert.equal(childFeedback({ score: 100 }, p).passed, false);
});

test('Clear accepted British sounds get praise without an unsupported retry instruction', () => {
  const p = { status: 'assessed', locale: 'en-GB', pronunciationScore: 80.8, accuracyScore: 68,
    words: [{ word: 'blue', accuracyScore: 68, errorType: 'None', phonemes: [95,90,94].map(accuracyScore => ({ accuracyScore })) }], issues: [] };
  const f = childFeedback({ score: 100 }, p);
  assert.equal(f.level, 'good'); assert.equal(f.passed, true); assert.equal(f.needsPractice, false);
  assert.equal(f.title, 'Dobře, povedlo se!'); assert.match(f.tip, /Můžeš pokračovat/);
  assert.doesNotMatch(f.title + f.tip, /zkus ještě|zopakuj|znovu/);
  p.accuracyScore = 78; p.words[0].accuracyScore = 78; p.words[0].phonemes[1].accuracyScore = 70;
  const weak = childFeedback({ score: 100 }, p);
  assert.equal(weak.needsPractice, true); assert.match(weak.title, /zkus ještě/);
});

function sentenceFixture(change = {}) {
  const p = fixture('dog'); p.NBest[0].Lexical = 'my bag is blue';
  p.NBest[0].Words = ['my','bag','is','blue'].map(word => {
    const w = fixture('dog', word === 'bag' ? change : {}).NBest[0].Words[0]; w.Word = word; return w;
  }); return p;
}
test('Exact British sentence recognition and strong phonemes resolve Whisper back/bag disagreement', async () => {
  const res = await request(loadHandler(async url => url.includes('openai') ? Response.json({text:'my back is blue'}) : Response.json(sentenceFixture()), env), {expectedText:'My bag is blue.',language:'en-GB',phoneticAssessment:'true'});
  assert.equal(res.body.contentScore,100); assert.equal(res.body.feedback.passed,true);
  assert.equal(res.body.contentSource,'azure-phonetic-confirmed');
  assert.equal(res.body.transcript,'my back is blue');
});
test('Sentence agreement never overrides a confirmed G/K phoneme error', async () => {
  const res = await request(loadHandler(async url => url.includes('openai') ? Response.json({text:'my back is blue'}) : Response.json(sentenceFixture({index:2,heard:'k'})), env), {expectedText:'My bag is blue.',language:'en-GB',phoneticAssessment:'true'});
  assert.equal(res.body.feedback.passed,false); assert.equal(res.body.contentSource,'whisper');
});
test('Every expected sentence word must have its own assessment before reconciliation', async () => {
  const p = sentenceFixture(); p.NBest[0].Words.splice(2,1);
  const res = await request(loadHandler(async url => url.includes('openai') ? Response.json({text:'my bag blue'}) : Response.json(p), env), {expectedText:'My bag is blue.',language:'en-GB',phoneticAssessment:'true'});
  assert.equal(res.body.feedback.passed,false); assert.equal(res.body.contentSource,'whisper');
  assert.match(res.body.feedback.title,/Hlásky se povedly/);
  assert.match(res.body.feedback.tip,/Rozpoznáním celé věty/);
});
