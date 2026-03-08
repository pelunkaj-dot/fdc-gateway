const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(process.cwd(), 'data', 'exercises', 'index.json');

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function getIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`Exercises index not found: ${INDEX_PATH}`);
  }

  return readJsonFile(INDEX_PATH);
}

function resolveTopicFile(level, topic) {
  const index = getIndex();

  if (!index[level]) {
    throw new Error(`Level "${level}" not found in exercises index.`);
  }

  if (!index[level][topic]) {
    throw new Error(`Topic "${topic}" not found for level "${level}".`);
  }

  return path.join(process.cwd(), 'data', 'exercises', index[level][topic]);
}

function getTopicData(level, topic) {
  const filePath = resolveTopicFile(level, topic);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Exercises file not found: ${filePath}`);
  }

  const data = readJsonFile(filePath);

  if (!data || !Array.isArray(data.items)) {
    throw new Error(`Invalid exercise file format: ${filePath}`);
  }

  return data;
}

module.exports = {
  getTopicData,
};
