const { getTopicData } = require("../lib/exercises/repository");
const { pickRandom } = require("../lib/exercises/picker");
const { normalizeUsedIds, appendUsedId } = require("../lib/exercises/memory");
const { buildExerciseFromSentence } = require("../lib/exercises/custom");

function shuffleArray(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

module.exports = async function handler(req, res) {
  try {
    const level = (req.query.level || "").trim().toUpperCase();
    const topic = (req.query.topic || "").trim();
    const sentenceCs = (req.query.sentenceCs || "").trim();

    if (!level || !topic) {
      if (!sentenceCs) {
        return res.status(400).json({
          error: "Missing level or topic",
        });
      }
    }

    if (sentenceCs) {
      const customExercise = await buildExerciseFromSentence(sentenceCs, level, topic);
      const words = shuffleArray([
        ...customExercise.correctWords,
        ...customExercise.extraWords
      ]);

      return res.status(200).json({
        exercise: {
          ...customExercise,
          words
        },
        usedIds: [],
        recycled: false,
        sourceType: "custom",
        requestedTopic: topic,
        resolvedTopic: topic
      });
    }

    const usedIds = normalizeUsedIds(
      req.query.usedIds ? req.query.usedIds.split(",") : []
    );

    const items = getTopicData(level, topic);

    const available = items.filter((item) => !usedIds.includes(item.id));
    const pool = available.length > 0 ? available : items;

    const picked = pickRandom(pool);
    const nextUsedIds = appendUsedId(usedIds, picked.id);

    return res.status(200).json({
      exercise: picked,
      usedIds: nextUsedIds,
      recycled: available.length === 0,
      sourceType: "preset",
      requestedTopic: topic,
      resolvedTopic: topic
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
};
