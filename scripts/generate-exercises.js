const fs = require("fs");
const path = require("path");
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
- oznamovací věta má končit tečkou
- tázací věta má končit otazníkem
- correct_words obsahuje správná slova ve správném pořadí, bez koncové interpunkce
- extra_words obsahuje přesně 2 rušivá slova
- words musí obsahovat všechna correct_words a extra_words promíchaně, bez koncové interpunkce
- věty musí být krátké, přirozené a vhodné pro školní procvičování
- používej běžnou slovní zásobu odpovídající úrovni ${level}
- v rámci dávky střídej osoby, podměty, slovesa, předměty, místa, časová určení a slovní zásobu
- nezačínej stále stejnými podměty typu I, he, she
- pokud to gramatika dovoluje, střídej oznamovací a tázací věty
- neopakuj téměř stejné věty jen s jiným jménem nebo jedním slovem
- každá věta musí být didakticky užitečná pro procvičování
- nepoužívej zbytečně exotická, knižní nebo divná slova
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
  const outputFile = process.argv[5];

  if (!level || !topic) {
    console.error("Usage: node scripts/generate-exercises.js A1 present-simple 20 [output-file]");
    process.exit(1);
  }

  const items = await generateExercises(level, topic, count);
  const json = JSON.stringify(items, null, 2);

  if (outputFile) {
    const outputPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(outputPath, json, "utf8");
    console.log(`Saved ${items.length} items to ${outputPath}`);
    return;
  }

  console.log(json);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
