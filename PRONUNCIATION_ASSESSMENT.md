# Pronunciation Assessment integration — deployed 2026-10-07

Only Fajn angličtina s Terezkou a Matýskem opts in. Other callers continue using
Whisper and the existing response shape, with no Azure calls.

Server configuration, exclusively in Vercel environment variables:

- `AZURE_SPEECH_KEY`: Speech resource key, never committed or sent to clients.
- `AZURE_SPEECH_REGION`: `northeurope` for the dedicated resource.
- `OPENAI_API_KEY`: keep existing Whisper key.

Prefer a dedicated Speech resource on F0. Do not choose a paid tier without the
owner's confirmation if F0 cannot be created. No prosody or paid add-ons requested.
Microsoft currently lists 5 free speech-to-text audio hours/month on F0; verify
the current limits before changing the resource SKU. Weak British results may
use two sequential assessments, consuming audio quota twice. Existing Whisper
and TTS usage remains separately billed through OpenAI.

## Contract

POST multipart: existing `audio`, `expectedText`, `language`, plus
`phoneticAssessment=true` and `audioWav` (mono PCM16 WAV, 16 kHz, max 15 seconds).
Whisper runs independently without reference-text prompting. Azure receives the
WAV and reference text. Requests run concurrently; optional diagnostics follow.

Additional response fields: `contentScore`, `pronunciationScore`,
`pronunciation` (status, locale, aggregate scores, words, phonemes, candidates,
issues, optional diagnostics) and `feedback` (level, passed, title, tip).
The existing `score` field is capped for weak phonemes, but is not the raw Azure
score; use `pronunciationScore` for raw scores. Child UI displays no percentages.

British English is authoritative, matching the course reference audio. US scores
never replace British scores or grant accent acceptance. Named phonemes and
spoken-phoneme candidates are supported by Azure for en-US. A weak GB word
can request secondary US consonant diagnostics. US vowel issues and optional
word-final R are excluded because they can conflict with British pronunciation.
For an isolated word, a Whisper disagreement can be reconciled only by exact
Azure recognized text AND a complete passing British result with every phoneme at least 80. Reference
text or high aggregates alone cannot override it. Preserve original Whisper
transcript and disagreement score for diagnostics. Do not diagnose a
Czech trill from a low R score: it supports R practice advice, not proof of a
trill. N-best substitution scores are model scores, not calibrated probabilities.
US word-final R in e.g. water is not a British requirement.

HTTP errors, missing configuration, timeout, invalid WAV and malformed provider
results fall back to Whisper. `feedback.level=content-only` honestly says phonetic
assessment was unavailable and awards no phonetic success. Azure no-match is a
retry, never converted into phonetic praise. Provider bodies and credentials are
not returned or logged.

## Validation completed

`node --test test/pronunciation.test.cjs` — synthetic responses and mocked network
requests. Tests cover all eight requested words, weak R/TH/G/vowels, flat/nested
responses, omissions, missing phonemes, fallback, PCM validation, content matching,
legacy clients and British primary/US diagnostics. These are NOT acoustic tests.

## Production activation and live smoke tests

1. Create/verify F0 Speech resource and add credentials in Vercel.
2. Deploy backend preview and verify actual response format and named diagnostics.
3. Test real correct and deliberately incorrect recordings of frog, red, rabbit,
   dog, three, think, this, water. Include Czech trill, final devoicing, TH→T/S/D/Z
   and Czech vowels. Include correct British water and legitimate accent variants.
4. Calibrate conservative provisional thresholds (great >=85 overall with all
   phonemes >=80; good >=75 overall with no phoneme <65) on real recordings.
5. Verify production Vercel and GitHub Pages, including mobile WAV decoding,
   recording UX and microphone permission/no-speech errors.

Activated dedicated `fajn-anglictina-speech`, resource group
`rg-fajn-anglictina-speech`, North Europe, Free F0. Vercel has the key as a
Secret for Production and Preview and the region as Config. No paid SKU or
add-ons selected. Backend production commit `85b060c`; frontend `4dd13b3`.
GitHub Pages build completed successfully; deployed lesson UI and new shared
script loaded without application JavaScript errors.

47 backend and 8 frontend unit/integration tests passed. Live requests used
synthetic OpenAI TTS samples, converted with ffmpeg to mono PCM16/16 kHz.
These are service smoke tests, not validation on real children:

Historical smoke results with British authoritative scores:

| Audio input | Expected | Azure PronScore | Outcome |
| --- | --- | ---: | --- |
| frog | frog | 100 | Great |
| red | red | 100 | Great |
| rabbit | rabbit | 100 | Great |
| dog | dog | 80.8 | Retry; British score penalized US vowel |
| three | three | 79.6 | Retry; British score lower than US diagnostic |
| think | think | 100 | Great |
| this | this | 92.8 | Great |
| water | water | 100 | Great |
| dock | dog | 82 | Rejected; diagnostic G -> K, voicing advice |
| tree | three | 80.2 | Rejected; diagnostic TH -> T, articulation advice |
| sink | think | 81.4 | Rejected; diagnostic TH -> S and weak vowel |
| dis | this | 0 | Rejected; no useful substitution diagnosis |
| diss | this | — | Rejected; diagnostic TH -> D |
| zis | this | — | Rejected; diagnostic TH -> Z and weak vowel |
| reed | red | — | Rejected; diagnostic vowel ɛ -> i |
| robbit | rabbit | — | Rejected; no specific phoneme diagnosis |

Whisper transcribed three as `3.`; number normalization now preserves correct
content recognition. Confirmed consonant substitutions and very weak R
practice block acceptance even if aggregate scores are high. Empty British
phoneme labels/candidates are omitted; scores remain available, named IPA
and candidates appear in successful US diagnostics.

Live invalid/missing Azure WAV returned Whisper content recognition, status
`unavailable`, feedback `content-only`, passed false. Legacy request still
returned its original response shape. Mocked HTTP 401/429/500 and timeouts
also verify provider-error fallback.

Still unverified: detection of actual Czech trilled R, Czech vowel quality,
all TH substitutions in human speech, real child calibration, and recording
on physical mobile devices. US TTS is not a positive acceptance criterion for this British course.
Calibrate British thresholds using actual British recordings, not US grades. Do not describe these smoke tests
as proof that all typical Czech errors are reliably detected. The recording
UX was preserved in code (countdown, beep, speak cue, silence stop, assessing).
The numbered checklist above remains the human/mobile acceptance checklist.

Sources:
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
https://azure.microsoft.com/en-us/pricing/details/speech/

## Feedback correction

Single words are repeated as a whole, never automatically split into syllables.
Uncertain recognition is described as uncertainty, not proof of bad pronunciation.
The child UI names the known D/A/D sequence for dad and exposes no percentages.

## British reference regression (Cambridge UK audio)

- dad: GB word accuracy 68, phonemes 100/85/96. Former aggregate gate rejected it.
- dog: GB accuracy 94, phonemes 100/96/100. Whisper heard Joke; exact Azure
  recognition plus strong GB phonemes resolves the isolated-word conflict.
- three: GB accuracy 59, phonemes 87.2/89/82, aggregate Mispronunciation and
  PronScore 11.8. This is an aggregate/phoneme contradiction in a UK reference.

Partial success now uses GB phonemes >=80, word/accuracy >=55, no omissions,
no confirmed consonant substitution and no failed requested diagnostic. It
can override aggregate Mispronunciation, never missing/inserted words. Great
thresholds remain unchanged. No US score contributes to this acceptance rule.
References: https://dictionary.cambridge.org/pronunciation/english/dad
https://dictionary.cambridge.org/pronunciation/english/dog
https://dictionary.cambridge.org/pronunciation/english/three
