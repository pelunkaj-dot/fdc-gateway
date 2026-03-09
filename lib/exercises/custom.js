const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function buildExerciseFromSentence(sentenceCs, level, topic) {
  const prompt = `
Vytvoř cvičení na skládání anglické věty.

Parametry:
úroveň: ${level}
gramatika: ${topic}

Česká věta:
${sentenceCs}

Výstup vrať jako JSON v tomto formátu:

{
  "id": "custom-1",
  "translationCs": "...",
  "targetSentence": "...",
  "correctWords": [],
  "extraWords": []
}

Pravidla:
- nejprve zkontroluj českou větu a případně ji oprav do přirozené spisovné češtiny
- zachovej význam původní věty
- pokud věta obsahuje dopravní prostředek (autobus, vlak, tramvaj, metro, auto apod.), použij v češtině přirozené sloveso jako "jet" nebo "jezdit", ne "chodit"
- translationCs musí být přirozená česká věta, kterou by běžný rodilý mluvčí opravdu řekl
- targetSentence musí odpovídat úrovni ${level}
- targetSentence musí používat gramatiku ${topic}
- correctWords obsahuje správná slova ve správném pořadí
- extraWords obsahuje přesně 2 rušivá slova
- nevracej pole "words"
- vrať pouze pole: id, translationCs, targetSentence, correctWords, extraWords
- nepiš žádný komentář ani vysvětlení, vrať pouze JSON
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      { role: "user", content: prompt }
    ]
  });

  const text = completion.choices[0].message.content;

  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    id: parsed.id,
    translationCs: parsed.translationCs,
    targetSentence: parsed.targetSentence,
    correctWords: parsed.correctWords,
    extraWords: parsed.extraWords
  };
}

module.exports = {
  buildExerciseFromSentence
};
