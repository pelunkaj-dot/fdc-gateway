export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { level = "A1", topic = "" } = req.query;

  const exercises = {
    A1: {
  "present-simple": [
    {
      id: "a1-ps-001",
      level: "A1",
      topic: "present-simple",
      grammar_focus: "present simple",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Chodím do školy každý den.",
      target_sentence: "I go to school every day",
      correct_words: ["I", "go", "to", "school", "every", "day"],
      extra_words: ["banana", "quickly"],
      words: ["I", "go", "to", "school", "every", "day", "banana", "quickly"]
    },
    {
      id: "a1-ps-002",
      level: "A1",
      topic: "present-simple",
      grammar_focus: "present simple",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "V neděli hrají fotbal.",
      target_sentence: "They play football on Sunday",
      correct_words: ["They", "play", "football", "on", "Sunday"],
      extra_words: ["blue", "slowly"],
      words: ["They", "play", "football", "on", "Sunday", "blue", "slowly"]
    },
    {
      id: "a1-ps-003",
      level: "A1",
      topic: "present-simple",
      grammar_focus: "present simple",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Pracuje v kanceláři.",
      target_sentence: "He works in an office",
      correct_words: ["He", "works", "in", "an", "office"],
      extra_words: ["yesterday", "green"],
      words: ["He", "works", "in", "an", "office", "yesterday", "green"]
    }
  ],

  "present-continuous": [
    {
      id: "a1-pc-001",
      level: "A1",
      topic: "present-continuous",
      grammar_focus: "present continuous",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Ona právě čte knihu.",
      target_sentence: "She is reading a book",
      correct_words: ["She", "is", "reading", "a", "book"],
      extra_words: ["yesterday", "blue"],
      words: ["She", "is", "reading", "a", "book", "yesterday", "blue"]
    },
    {
      id: "a1-pc-002",
      level: "A1",
      topic: "present-continuous",
      grammar_focus: "present continuous",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Dnes večer vaříme večeři.",
      target_sentence: "We are cooking dinner tonight",
      correct_words: ["We", "are", "cooking", "dinner", "tonight"],
      extra_words: ["never", "small"],
      words: ["We", "are", "cooking", "dinner", "tonight", "never", "small"]
    },
    {
      id: "a1-pc-003",
      level: "A1",
      topic: "present-continuous",
      grammar_focus: "present continuous",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Teď se dívám na televizi.",
      target_sentence: "I am watching TV now",
      correct_words: ["I", "am", "watching", "TV", "now"],
      extra_words: ["tomorrow", "happy"],
      words: ["I", "am", "watching", "TV", "now", "tomorrow", "happy"]
    }
  ],

  "there-is-are": [
    {
      id: "a1-tia-001",
      level: "A1",
      topic: "there-is-are",
      grammar_focus: "there is / there are",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Na stole je kniha.",
      target_sentence: "There is a book on the table",
      correct_words: ["There", "is", "a", "book", "on", "the", "table"],
      extra_words: ["quickly", "blue"],
      words: ["There", "is", "a", "book", "on", "the", "table", "quickly", "blue"]
    },
    {
      id: "a1-tia-002",
      level: "A1",
      topic: "there-is-are",
      grammar_focus: "there is / there are",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "V místnosti jsou dvě židle.",
      target_sentence: "There are two chairs in the room",
      correct_words: ["There", "are", "two", "chairs", "in", "the", "room"],
      extra_words: ["yesterday", "small"],
      words: ["There", "are", "two", "chairs", "in", "the", "room", "yesterday", "small"]
    }
  ],

  "past-simple": [
    {
      id: "a1-past-001",
      level: "A1",
      topic: "past-simple",
      grammar_focus: "past simple",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Včera jsem šel do školy.",
      target_sentence: "I went to school yesterday",
      correct_words: ["I", "went", "to", "school", "yesterday"],
      extra_words: ["tomorrow", "green"],
      words: ["I", "went", "to", "school", "yesterday", "tomorrow", "green"]
    },
    {
      id: "a1-past-002",
      level: "A1",
      topic: "past-simple",
      grammar_focus: "past simple",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "Včera večer se dívala na film.",
      target_sentence: "She watched a movie last night",
      correct_words: ["She", "watched", "a", "movie", "last", "night"],
      extra_words: ["now", "banana"],
      words: ["She", "watched", "a", "movie", "last", "night", "now", "banana"]
    },
    {
      id: "a1-past-003",
      level: "A1",
      topic: "past-simple",
      grammar_focus: "past simple",
      instruction_cs: "Poskládej správně anglickou větu.",
      translation_cs: "V sobotu jsme vařili večeři.",
      target_sentence: "We cooked dinner on Saturday",
      correct_words: ["We", "cooked", "dinner", "on", "Saturday"],
      extra_words: ["today", "slowly"],
      words: ["We", "cooked", "dinner", "on", "Saturday", "today", "slowly"]
    }
  ]
},
    A2: {
      "present-continuous": [
        {
          id: "a2-pc-001",
          level: "A2",
          topic: "present-continuous",
          grammar_focus: "present continuous",
          instruction_cs: "Poskládej správně anglickou větu.",
          translation_cs: "Ona právě čte knihu.",
          target_sentence: "She is reading a book",
          correct_words: ["She", "is", "reading", "a", "book"],
          extra_words: ["yesterday", "blue"],
          words: ["She", "is", "reading", "a", "book", "yesterday", "blue"]
        },
        {
          id: "a2-pc-002",
          level: "A2",
          topic: "present-continuous",
          grammar_focus: "present continuous",
          instruction_cs: "Poskládej správně anglickou větu.",
          translation_cs: "Dnes večer vaříme večeři.",
          target_sentence: "We are cooking dinner tonight",
          correct_words: ["We", "are", "cooking", "dinner", "tonight"],
          extra_words: ["never", "small"],
          words: ["We", "are", "cooking", "dinner", "tonight", "never", "small"]
        },
        {
          id: "a2-pc-003",
          level: "A2",
          topic: "present-continuous",
          grammar_focus: "present continuous",
          instruction_cs: "Poskládej správně anglickou větu.",
          translation_cs: "Teď se dívám na televizi.",
          target_sentence: "I am watching TV now",
          correct_words: ["I", "am", "watching", "TV", "now"],
          extra_words: ["tomorrow", "happy"],
          words: ["I", "am", "watching", "TV", "now", "tomorrow", "happy"]
        }
      ],
      "present-perfect": [
        {
          id: "a2-pp-001",
          level: "A2",
          topic: "present-perfect",
          grammar_focus: "present perfect",
          instruction_cs: "Poskládej správně anglickou větu.",
          translation_cs: "Nikdy jsem nebyl v Londýně.",
          target_sentence: "I have never been to London",
          correct_words: ["I", "have", "never", "been", "to", "London"],
          extra_words: ["yesterday", "green"],
          words: ["I", "have", "never", "been", "to", "London", "yesterday", "green"]
        },
        {
          id: "a2-pp-002",
          level: "A2",
          topic: "present-perfect",
          grammar_focus: "present perfect",
          instruction_cs: "Poskládej správně anglickou větu.",
          translation_cs: "Už dokončila domácí úkol.",
          target_sentence: "She has already finished her homework",
          correct_words: ["She", "has", "already", "finished", "her", "homework"],
          extra_words: ["tomorrow", "blue"],
          words: ["She", "has", "already", "finished", "her", "homework", "tomorrow", "blue"]
        },
        {
          id: "a2-pp-003",
          level: "A2",
          topic: "present-perfect",
          grammar_focus: "present perfect",
          instruction_cs: "Poskládej správně anglickou větu.",
          translation_cs: "Žijeme tady už dva roky.",
          target_sentence: "We have lived here for two years",
          correct_words: ["We", "have", "lived", "here", "for", "two", "years"],
          extra_words: ["last", "small"],
          words: ["We", "have", "lived", "here", "for", "two", "years", "last", "small"]
        }
      ]
    }
  };

  const levelBucket = exercises[level] || exercises.A1;
  const topicBucket = levelBucket[topic];

  if (topicBucket && topicBucket.length > 0) {
    const randomIndex = Math.floor(Math.random() * topicBucket.length);
    return res.status(200).json(topicBucket[randomIndex]);
  }

  const fallbackTopics = Object.keys(levelBucket);
  const firstTopic = fallbackTopics[0];
  const fallbackPool = levelBucket[firstTopic];

  if (fallbackPool && fallbackPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * fallbackPool.length);
    return res.status(200).json(fallbackPool[randomIndex]);
  }

  return res.status(404).json({ error: "No exercise found" });
}
