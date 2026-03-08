function pickRandom(items) {
  if (!items || items.length === 0) {
    throw new Error("No exercises available");
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

module.exports = {
  pickRandom,
};
