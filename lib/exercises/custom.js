import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function createCustomExercise(sentenceCs, level, topic) {

  const prompt = `
Vytvoř cvičení na skládání anglické věty.

Parametry:
úroveň: ${level}
gramatika: ${topic}

Česká věta:
${sentenceCs}

Výstup vrať jako JSON v tomto formátu:

{
  "translation_cs": "...",
  "target_sentence": "...",
  "correct_words": [],
  "extra_words": [],
  "words": []
}

Pravidla:
- target_sentence musí odpovídat úrovni ${level}
- gramatika musí být ${topic}
- correct_words obsahuje správná slova
- extra_words obsahuje 2 rušivá slova
- words je correct_words + extra_words zamíchané
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

  return JSON.parse(text);
}
