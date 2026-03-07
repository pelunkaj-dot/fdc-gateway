export default async function handler(req, res) {
  const catalog = {
    app: "FajnCvicebna",
    language: "en-cs",
    levels: [
      {
        id: "A1",
        title: "A1",
        description_cs: "Začátečníci – jednoduché věty a základní slovosled."
      },
      {
        id: "A2",
        title: "A2",
        description_cs: "Mírně pokročilí – delší věty a běžné časy."
      }
    ],
    topics: [
      {
        id: "daily-routine",
        title_cs: "Denní režim",
        levels: ["A1"]
      },
      {
        id: "home-activities",
        title_cs: "Činnosti doma",
        levels: ["A2"]
      }
    ],
    grammar_focus: [
      {
        id: "present-simple",
        title_cs: "Přítomný čas prostý",
        levels: ["A1"]
      },
      {
        id: "present-continuous",
        title_cs: "Přítomný čas průběhový",
        levels: ["A2"]
      }
    ]
  };

  res.status(200).json(catalog);
}
