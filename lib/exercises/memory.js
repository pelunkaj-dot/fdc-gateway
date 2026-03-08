function normalizeUsedIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((id) => typeof id === "string" && id.trim() !== "");
}

function appendUsedId(usedIds, newId) {
  const normalized = normalizeUsedIds(usedIds);

  if (!newId || normalized.includes(newId)) {
    return normalized;
  }

  return [...normalized, newId];
}

module.exports = {
  normalizeUsedIds,
  appendUsedId,
};
