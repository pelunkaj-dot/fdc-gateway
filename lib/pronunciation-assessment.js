// Pure result interpretation. Thresholds must be calibrated on real child/adult recordings.
const finiteScore = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
const assessmentOf = value => value.PronunciationAssessment || value;
const ipa = p => String(p || '').replace(/ɡ/g, 'g').replace(/ɹ/g, 'r');
const vowels = new Set(['æ', 'ɛ', 'ɪ', 'i', 'iː', 'ɑ', 'ɑː', 'ɒ', 'ɔ', 'ɔː', 'ʊ', 'u', 'uː', 'ʌ', 'ə', 'ɜ', 'ɝ', 'ɚ', 'eɪ', 'aɪ', 'oʊ', 'aʊ', 'ɔɪ']);

function phonemeIssue(p, word) {
  if (p.accuracyScore === null || p.accuracyScore >= 75) return null;
  const expected = ipa(p.phoneme);
  const top = [...p.candidates].sort((a, b) => b.score - a.score)[0];
  const expectedCandidate = p.candidates.find(c => ipa(c.phoneme) === expected);
  // N-best scores are model scores, not calibrated probabilities.
  const substitution = p.accuracyScore < 70 && top && ipa(top.phoneme) !== expected &&
    top.score >= 80 && expectedCandidate && top.score - expectedCandidate.score >= 15;
  const heard = substitution ? ipa(top.phoneme) : null;
  let type = substitution ? 'phoneme-substitution' : 'phoneme-practice';
  let tip = null;
  if (expected === 'r') {
    type = 'r-practice';
    tip = `Ve slově „${word}“ zkus anglické R: jazyk se nedotýká patra a nerozkmitá se jako u českého R.`;
  } else if (expected === 'θ' || expected === 'ð') {
    if (heard && ['t', 's', 'd', 'z'].includes(heard)) type = 'th-substitution';
    tip = `Ve slově „${word}“ dej špičku jazyka lehce mezi zuby a nech kolem ní proudit vzduch.${expected === 'ð' ? ' Přidej hlas, aby krk jemně vibroval.' : ' Foukej bez hlasu.'}`;
  } else if (expected === 'g') {
    if (heard === 'k') type = 'voicing';
    tip = `Ve slově „${word}“ zkus G s hlasem: sáhni si na krk, měl by jemně vibrovat. U K nevibruje.`;
  } else if (vowels.has(expected)) {
    type = substitution ? 'vowel-substitution' : 'vowel-practice';
    tip = `Zaměř se na samohlásku ve slově „${word}“. Poslechni si vzor a napodob polohu úst i délku zvuku.`;
  }
  return { type, word, expected: p.phoneme, heard, accuracyScore: p.accuracyScore, tip };
}

function parseAzureResult(json, locale) {
  if (json.RecognitionStatus !== 'Success' && json.RecognitionStatus !== 0) {
    if (['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout', 'EndOfDictation'].includes(json.RecognitionStatus)) {
      return { status: 'no-match', locale, pronunciationScore: null, accuracyScore: null, words: [], issues: [] };
    }
    throw new Error('azure-invalid-result');
  }
  const best = json.NBest?.[0];
  if (!best) throw new Error('azure-missing-result');
  const a = assessmentOf(best);
  const pronunciationScore = finiteScore(a.PronScore);
  const accuracyScore = finiteScore(a.AccuracyScore);
  if (pronunciationScore === null || accuracyScore === null) throw new Error('azure-missing-scores');
  const words = (best.Words || []).map(w => {
    const wa = assessmentOf(w);
    return {
      word: w.Word, accuracyScore: finiteScore(wa.AccuracyScore), errorType: wa.ErrorType || 'None',
      phonemes: (w.Phonemes || []).map(p => {
        const pa = assessmentOf(p);
        return { phoneme: p.Phoneme || null, accuracyScore: finiteScore(pa.AccuracyScore),
          candidates: (pa.NBestPhonemes || []).map(c => ({ phoneme: c.Phoneme, score: finiteScore(c.Score) })).filter(c => c.phoneme && c.score !== null) };
      }),
    };
  });
  if (!words.length || words.some(w => w.accuracyScore === null)) throw new Error('azure-missing-words');
  const issues = words.flatMap(w => w.phonemes.map(p => phonemeIssue(p, w.word)).filter(Boolean));
  return { status: 'assessed', locale, pronunciationScore, accuracyScore,
    fluencyScore: finiteScore(a.FluencyScore), completenessScore: finiteScore(a.CompletenessScore), words, issues };
}

function childFeedback(content, phonetic) {
  const understood = content.score === 100;
  if (phonetic.status === 'unavailable') return {
    level: 'content-only', passed: false, title: understood ? 'Slyšela jsem správná slova.' : 'Poslechni si vzor znovu.',
    tip: 'Výslovnost se teď nepodařilo ověřit. Poslechni si vzor a zkus to ještě jednou.',
  };
  if (phonetic.status === 'no-match') return { level: 'retry', passed: false, title: 'Poslechni si vzor znovu.', tip: 'Tentokrát jsem hlas nerozpoznala dost jistě. Zkus mluvit blíž k mikrofonu.' };
  const wordScores = phonetic.words.map(w => w.accuracyScore);
  const phonemeScores = phonetic.words.flatMap(w => w.phonemes.map(p => p.accuracyScore)).filter(s => s !== null);
  const minWord = Math.min(...wordScores);
  const minPhoneme = phonemeScores.length ? Math.min(...phonemeScores) : null;
  const miscue = phonetic.words.some(w => ['Omission', 'Insertion', 'Mispronunciation'].includes(w.errorType));
  const consonantError = phonetic.issues.some(i => ['voicing', 'th-substitution'].includes(i.type) || (i.type === 'r-practice' && i.accuracyScore < 65));
  const great = understood && !miscue && !consonantError && phonetic.pronunciationScore >= 85 && phonetic.accuracyScore >= 85 && minWord >= 80 && minPhoneme !== null && minPhoneme >= 80;
  const good = understood && !miscue && !consonantError && phonetic.pronunciationScore >= 75 && phonetic.accuracyScore >= 75 && minWord >= 70 && minPhoneme !== null && minPhoneme >= 65;
  const confirmed = i => ['voicing', 'th-substitution', 'vowel-substitution'].includes(i.type) ? 0 : 1;
  const specific = [...phonetic.issues].sort((a, b) => confirmed(a) - confirmed(b) || a.accuracyScore - b.accuracyScore).find(i => i.tip);
  return { level: great ? 'great' : good ? 'good' : 'retry', passed: great || good,
    title: great ? 'Paráda!' : good ? 'Dobře, ale zkus ještě…' : 'Poslechni si vzor znovu.',
    tip: great ? 'Zní to moc dobře.' : specific?.tip || (!understood ? content.tip : null) || 'Poslechni si vzor a zopakuj ho pomalu a zřetelně.' };
}

module.exports = { finiteScore, parseAzureResult, childFeedback };
