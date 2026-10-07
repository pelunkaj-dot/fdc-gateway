# Pronunciation Assessment integration — prepared, activation pending

Only Fajn angličtina s Terezkou a Matýskem opts in. Other callers continue using
Whisper and the existing response shape, with no Azure calls.

Server configuration, exclusively in Vercel environment variables:

- `AZURE_SPEECH_KEY`: Speech resource key, never committed or sent to clients.
- `AZURE_SPEECH_REGION`: region identifier, e.g. `westeurope`.
- `OPENAI_API_KEY`: keep existing Whisper key.

Prefer a dedicated Speech resource on F0. Do not choose a paid tier without the
owner's confirmation if F0 cannot be created. No prosody or paid add-ons requested.
Microsoft currently lists 5 free speech-to-text audio hours/month on F0; verify
the actual resource SKU and usage before activation. Weak British results may
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

British English stays authoritative. Named phonemes and spoken-phoneme candidates
are supported by Azure for en-US. A weak GB word can request secondary US
phoneme diagnostics; those never replace primary GB scores. Do not diagnose a
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

## Required before calling this finished

1. Create/verify F0 Speech resource and add credentials in Vercel.
2. Deploy backend preview and verify actual response format and named diagnostics.
3. Test real correct and deliberately incorrect recordings of frog, red, rabbit,
   dog, three, think, this, water. Include Czech trill, final devoicing, TH→T/S/D/Z
   and Czech vowels. Include correct British water and legitimate accent variants.
4. Calibrate conservative provisional thresholds (great >=85 overall with all
   phonemes >=80; good >=75 overall with no phoneme <65) on real recordings.
5. Verify production Vercel and GitHub Pages, including mobile WAV decoding,
   recording UX and microphone permission/no-speech errors.

Activation and live acoustic validation are currently blocked by Azure/Vercel
sign-in. No production deployment is claimed.

Sources:
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
https://azure.microsoft.com/en-us/pricing/details/speech/
