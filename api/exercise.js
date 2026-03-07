export default async function handler(req, res) {

  // testovací věta
  const exercise = {
    id: "test-001",
    level: "A1",
    target_sentence: "I eat apples every day",
    words: ["I", "eat", "apples", "every", "day", "banana", "quickly"]
  };

  res.status(200).json(exercise);

}
