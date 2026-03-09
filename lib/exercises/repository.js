const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(process.cwd(), "data", "exercises", "index.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getTopicData(level, topic) {
  const index = readJson(INDEX_PATH);

  if (!index[level]) {
    return null;
  }

  const relative = index[level][topic];

  if (!relative) {
    return null;
  }

  const filePath = path.join(process.cwd(), "data", "exercises", relative);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const data = readJson(filePath);

  return data.items;
}

module.exports = {
  getTopicData,
};
