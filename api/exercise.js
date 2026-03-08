const { getTopicData } = require("../lib/exercises/repository");
const { pickRandom } = require("../lib/exercises/picker");
const { normalizeUsedIds, appendUsedId } = require("../lib/exercises/memory");

module.exports = async function handler(req, res) {
  try {
    const level = (req.query.level || "").trim().toUpperCase();
    const topic = (req.query.topic || "").trim();

    if (!level || !topic) {
      return res.status(400).json({
        error: "Missing level or topic",
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
      recycled: available.length === 0
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
};
