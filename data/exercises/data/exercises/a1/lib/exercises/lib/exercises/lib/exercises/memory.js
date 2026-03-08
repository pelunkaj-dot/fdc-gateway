function normalizeUsedIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((id) => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);
}

function buildMemory(usedIds, addedId) {
  const normalized = normalizeUsedIds(usedIds);
  const next = [...normalized];

  if (addedId && !next.includes(addedId)) {
    next.push(addedId);
  }

  return {
    usedIds: next,
    addedId: addedId || null,
  };
}

module.exports = {
  normalizeUsedIds,
  buildMemory,
};
