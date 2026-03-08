async function buildExerciseFromSentence(sentenceCs) {
  if (!sentenceCs || typeof sentenceCs !== "string") {
    throw new Error("Missing sentenceCs");
  }

  // zatím jen jednoduchý návrat
  // později tady bude AI generování
  return {
    id: "custom-1",
    translationCs: sentenceCs,
    targetSentence: "",
    correctWords: [],
    extraWords: []
  };
}

module.exports = {
  buildExerciseFromSentence
};
