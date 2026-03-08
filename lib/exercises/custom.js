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
- targetSentence musí odpovídat úrovni ${level}
- gramatika musí být ${topic}
- translationCs musí být přirozená česká věta
- correctWords obsahuje správná slova v pořadí
- extraWords obsahuje přesně 2 rušivá slova
- žádný komentář, pouze JSON
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

return JSON.parse(cleaned);
}

module.exports = {
  buildExerciseFromSentence
};
