export default async function handler(req, res) {
  const { level = "A1" } = req.query;

  const exercises = {
    A1: {
      id: "a1-001",
      level: "A1",
      topic: "daily routine",
      grammar_focus: "present simple",
      instruction_cs: "Poskládej správně anglickou větu.",
      target_sentence: "I eat apples every day",
      correct_words: ["I", "eat", "apples", "every", "day"],
      extra_words: ["banana", "quickly"],
      words: ["I", "eat", "apples", "every", "day", "banana", "quickly"]
    },
    A2: {
      id: "a2-001",
      level: "A2",
      topic: "activities at home",
      grammar_focus: "present continuous",
      instruction_cs: "Poskládej správně anglickou větu.",
      target_sentence: "She is reading a book in the kitchen",
      correct_words: ["She", "is", "reading", "a", "book", "in", "the", "kitchen"],
      extra_words: ["yesterday", "blue"],
      words: ["She", "is", "reading", "a", "book", "in", "the", "kitchen", "yesterday", "blue"]
    }
  };

  const exercise = exercises[level] || exercises.A1;

  res.status(200).json(exercise);
}
