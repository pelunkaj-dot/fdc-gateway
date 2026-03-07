export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { level = "A1" } = req.query;

  const exercises = {
    A1: [
      {
        id: "a1-001",
        level: "A1",
        topic: "daily routine",
        grammar_focus: "present simple",
        instruction_cs: "Poskládej správně anglickou větu.",
        translation_cs: "Chodím do školy každý den.",
        target_sentence: "I go to school every day",
        correct_words: ["I", "go", "to", "school", "every", "day"],
        extra_words: ["banana", "quickly"],
        words: ["I", "go", "to", "school", "every", "day", "banana", "quickly"]
      },
      {
        id: "a1-002",
        level: "A1",
        topic: "free time",
        grammar_focus: "present simple",
        instruction_cs: "Poskládej správně anglickou větu.",
        translation_cs: "V neděli hrají fotbal.",
        target_sentence: "They play football on Sunday",
        correct_words: ["They", "play", "football", "on", "Sunday"],
        extra_words: ["blue", "slowly"],
        words: ["They", "play", "football", "on", "Sunday", "blue", "slowly"]
      },
      {
        id: "a1-003",
        level: "A1",
        topic: "work",
        grammar_focus: "present simple",
        instruction_cs: "Poskládej správně anglickou větu.",
        translation_cs: "Pracuje v kanceláři.",
        target_sentence: "He works in an office",
        correct_words: ["He", "works", "in", "an", "office"],
        extra_words: ["yesterday", "green"],
        words: ["He", "works", "in", "an", "office", "yesterday", "green"]
      }
    ],
    A2: [
      {
        id: "a2-001",
        level: "A2",
        topic: "reading",
        grammar_focus: "present continuous",
        instruction_cs: "Poskládej správně anglickou větu.",
        translation_cs: "Ona právě čte knihu.",
        target_sentence: "She is reading a book",
        correct_words: ["She", "is", "reading", "a", "book"],
        extra_words: ["yesterday", "blue"],
        words: ["She", "is", "reading", "a", "book", "yesterday", "blue"]
      },
      {
        id: "a2-002",
        level: "A2",
        topic: "home",
        grammar_focus: "present continuous",
        instruction_cs: "Poskládej správně anglickou větu.",
        translation_cs: "Dnes večer vaříme večeři.",
        target_sentence: "We are cooking dinner tonight",
        correct_words: ["We", "are", "cooking", "dinner", "tonight"],
        extra_words: ["never", "small"],
        words: ["We", "are", "cooking", "dinner", "tonight", "never", "small"]
      },
      {
        id: "a2-003",
        level: "A2",
        topic: "media",
        grammar_focus: "present continuous",
        instruction_cs: "Poskládej správně anglickou větu.",
        translation_cs: "Teď se dívám na televizi.",
        target_sentence: "I am watching TV now",
        correct_words: ["I", "am", "watching", "TV", "now"],
        extra_words: ["tomorrow", "happy"],
        words: ["I", "am", "watching", "TV", "now", "tomorrow", "happy"]
      }
    ]
  };

  const pool = exercises[level] || exercises.A1;
  const randomIndex = Math.floor(Math.random() * pool.length);
  const exercise = pool[randomIndex];

  res.status(200).json(exercise);
}
