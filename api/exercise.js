export default async function handler(req, res) {
  const { level = "A1" } = req.query;

  const exercises = {
    A1: {
      id: "a1-001",
      level: "A1",
      target_sentence: "I eat apples every day",
      words: ["I", "eat", "apples", "every", "day", "banana", "quickly"]
    },
    A2: {
      id: "a2-001",
      level: "A2",
      target_sentence: "She is reading a book in the kitchen",
      words: ["She", "is", "reading", "a", "book", "in", "the", "kitchen", "yesterday", "blue"]
    }
  };

  const exercise = exercises[level] || exercises.A1;

  res.status(200).json(exercise);
}
