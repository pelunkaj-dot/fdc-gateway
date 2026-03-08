function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function pickExercise(items, usedIds = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No exercise items available.');
  }

  const usedSet = new Set(
    Array.isArray(usedIds) ? usedIds.filter((id) => typeof id === 'string') : []
  );

  let pool = items.filter((item) => !usedSet.has(item.id));
  let recycled = false;

  if (pool.length === 0) {
    pool = items;
    recycled = true;
  }

  const picked = randomItem(pool);

  return {
    picked,
    recycled,
    totalInTopic: items.length,
    remainingInTopic: Math.max(pool.length - 1, 0),
  };
}

module.exports = {
  pickExercise,
};
