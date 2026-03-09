const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateExercises(level, topic, count) {
  const prompt = `
Vygeneruj dávku cvičení na skládání anglických vět.

Parametry:
- úroveň: ${level}
- gramatika: ${topic}
- počet vět: ${count}

Vrať pouze JSON pole.
Každá položka musí mít přesně tento formát:

{
  "id": "${level.toLowerCase()}-${topic}-001",
  "level": "${level}",
  "topic": "${topic}",
  "grammar_focus": "${topic}",
  "instruction_cs": "Poskládej správně anglickou větu.",
  "translation_cs": "...",
  "target_sentence": "...",
  "correct_words": [],
  "extra_words": [],
  "words": []
}

Pravidla:
- translation_cs musí být přirozená spisovná čeština
- target_sentence musí odpovídat úrovni ${level}
- target_sentence musí odpovídat gramatice ${topic}
- correct_words obsahuje správná slova ve správném pořadí
- extra_words obsahuje přesně 2 rušivá slova
- words musí obsahovat všechna correct_words a extra_words promíchaně
- každá věta musí být jiná a užitečná pro procvičování
- nepoužívej zbytečně exotická nebo knižní slovíčka
- výstup musí být validní JSON
- nepiš žádné vysvětlení, jen JSON pole
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.4,
    messages: [{ role: "user", content: prompt }]
  });

  const text = completion.choices[0].message.content;

  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}

async function main() {
  const level = process.argv[2];
  const topic = process.argv[3];
  const count = Number(process.argv[4] || 20);

  if (!level || !topic) {
    console.error("Usage: node scripts/generate-exercises.js A1 present-simple 20");
    process.exit(1);
  }

  const items = await generateExercises(level, topic, count);
  console.log(JSON.stringify(items, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
