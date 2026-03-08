const { getTopicData } = require('../lib/exercises/repository');
const { pickExercise } = require('../lib/exercises/picker');
const { normalizeUsedIds, buildMemory } = require('../lib/exercises/memory');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const body = req.body || {};
    const level = typeof body.level === 'string' ? body.level.trim().toUpperCase() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const usedIds = normalizeUsedIds(body.usedIds);

    if (!level || !topic) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: level, topic',
      });
    }

    const topicData = getTopicData(level, topic);
    const pickedResult = pickExercise(topicData.items, usedIds);
    const item = pickedResult.picked;

    const exercise = {
      id: item.id,
      sourceType: 'preset',
      level: topicData.level,
      topic: topicData.topic,
      instructionCs: topicData.instructionCs,
      translationCs: item.translationCs,
      targetSentence: item.targetSentence,
      correctWords: item.correctWords,
      extraWords: item.extraWords,
      words: [...item.correctWords, ...item.extraWords].sort(() => Math.random() - 0.5),
    };

    return res.status(200).json({
      ok: true,
      exercise,
      memory: buildMemory(usedIds, item.id),
      meta: {
        level: topicData.level,
        topic: topicData.topic,
        totalInTopic: pickedResult.totalInTopic,
        remainingInTopic: pickedResult.remainingInTopic,
        recycled: pickedResult.recycled,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error',
    });
  }
};
