/*
 * Lebensmittelliste und Beispielgerichte für „Was esse ich heute?“
 *
 * Die Liste ist bewusst als einfache Daten-Datei gehalten: Neue Lebensmittel
 * einfach in die passende Kategorie schreiben. Die ID wird automatisch aus
 * dem Namen erzeugt (z. B. „Hähnchenbrust“ → „haehnchenbrust“).
 *
 * Läuft im Browser (globale Variablen) und in Node (für die Tests).
 */
(function (global) {
  'use strict';

  const KATEGORIEN = [
    'Fleisch',
    'Fisch',
    'Gemüse',
    'Obst',
    'Milchprodukte',
    'Getreide und Beilagen',
    'Hülsenfrüchte',
    'Gewürze und Kräuter',
    'Soßen und Sonstiges',
  ];

  const NACH_KATEGORIE = {
    'Fleisch': [
      'Hähnchenbrust', 'Hähnchenschenkel', 'Putenbrust', 'Hackfleisch gemischt',
      'Rinderhack', 'Rindersteak', 'Rindergulasch', 'Rinderrouladen',
      'Schweineschnitzel', 'Schweinefilet', 'Schweinebraten', 'Kassler',
      'Speck', 'Schinken', 'Salami', 'Bratwurst', 'Wiener Würstchen',
      'Leberkäse', 'Lammfleisch', 'Ente', 'Chorizo', 'Döner-Fleisch',
      'Rinderbraten', 'Kalbfleisch', 'Gyrosfleisch', 'Weißwurst', 'Fleischwurst', 'Maultaschen',
    ],
    'Fisch': [
      'Lachs', 'Räucherlachs', 'Thunfisch', 'Kabeljau', 'Seelachs', 'Forelle',
      'Hering', 'Matjes', 'Makrele', 'Rotbarsch', 'Scholle', 'Pangasius',
      'Garnelen', 'Tintenfisch', 'Muscheln', 'Fischstäbchen',
    ],
    'Gemüse': [
      'Tomaten', 'Kirschtomaten', 'Gurke', 'Paprika', 'Zucchini', 'Aubergine',
      'Karotten', 'Zwiebeln', 'Rote Zwiebeln', 'Frühlingszwiebeln', 'Knoblauch',
      'Lauch', 'Brokkoli', 'Blumenkohl', 'Rosenkohl', 'Weißkohl', 'Rotkohl',
      'Wirsing', 'Grünkohl', 'Sauerkraut', 'Spinat', 'Mangold', 'Kopfsalat',
      'Feldsalat', 'Rucola', 'Eisbergsalat', 'Champignons', 'Pfifferlinge',
      'Kürbis', 'Süßkartoffel', 'Rote Bete', 'Knollensellerie', 'Staudensellerie',
      'Fenchel', 'Kohlrabi', 'Spargel', 'Radieschen', 'Rettich', 'Pastinaken',
      'Mais', 'Erbsen', 'Grüne Bohnen', 'Chilischoten', 'Avocado', 'Oliven',
      'Gewürzgurken',
      'Pak Choi', 'Sojasprossen', 'Zuckerschoten', 'Römersalat',
    ],
    'Obst': [
      'Äpfel', 'Birnen', 'Bananen', 'Orangen', 'Zitronen', 'Limetten',
      'Erdbeeren', 'Himbeeren', 'Heidelbeeren', 'Kirschen', 'Pflaumen',
      'Weintrauben', 'Ananas', 'Mango', 'Pfirsiche', 'Aprikosen', 'Rhabarber',
      'Kiwi', 'Granatapfel', 'Rosinen',
    ],
    'Milchprodukte': [
      'Milch', 'Butter', 'Sahne', 'Schmand', 'Saure Sahne', 'Crème fraîche',
      'Joghurt', 'Quark', 'Frischkäse', 'Mozzarella', 'Feta', 'Gouda',
      'Emmentaler', 'Bergkäse', 'Parmesan', 'Camembert', 'Ziegenkäse',
      'Halloumi', 'Ricotta', 'Mascarpone', 'Eier',
      'Gorgonzola', 'Raclettekäse',
    ],
    'Getreide und Beilagen': [
      'Kartoffeln', 'Nudeln', 'Spaghetti', 'Penne', 'Lasagneplatten',
      'Tortellini', 'Spätzle', 'Gnocchi', 'Reis', 'Basmatireis', 'Risottoreis',
      'Reisnudeln', 'Couscous', 'Bulgur', 'Quinoa', 'Hirse', 'Polenta',
      'Haferflocken', 'Brot', 'Brötchen', 'Toastbrot', 'Fladenbrot', 'Tortillas',
      'Semmelknödel', 'Kartoffelknödel', 'Pommes frites', 'Kroketten',
      'Blätterteig', 'Pizzateig', 'Mehl',
      'Bandnudeln', 'Schupfnudeln', 'Mie-Nudeln', 'Cannelloni', 'Burgerbrötchen', 'Milchreis',
    ],
    'Hülsenfrüchte': [
      'Linsen', 'Rote Linsen', 'Kichererbsen', 'Kidneybohnen', 'Weiße Bohnen',
      'Schwarze Bohnen', 'Edamame', 'Tofu', 'Räuchertofu', 'Tempeh',
      'Sojaschnetzel', 'Schälerbsen',
    ],
    'Gewürze und Kräuter': [
      'Petersilie', 'Schnittlauch', 'Basilikum', 'Dill', 'Koriander', 'Minze',
      'Rosmarin', 'Thymian', 'Oregano', 'Majoran', 'Lorbeer', 'Pfeffer',
      'Paprikapulver', 'Currypulver', 'Kreuzkümmel', 'Kurkuma', 'Zimt',
      'Muskat', 'Ingwer', 'Chiliflocken', 'Kümmel', 'Knoblauchpulver', 'Salbei',
    ],
    'Soßen und Sonstiges': [
      'Passierte Tomaten', 'Tomatenmark', 'Pesto', 'Senf', 'Ketchup',
      'Mayonnaise', 'Sojasoße', 'Kokosmilch', 'Gemüsebrühe', 'Bratensoße',
      'Sauce Hollandaise', 'Ajvar', 'Hummus', 'Olivenöl', 'Essig', 'Honig',
      'Walnüsse', 'Mandeln', 'Haselnüsse', 'Erdnüsse', 'Pinienkerne', 'Sesam',
      'Sonnenblumenkerne',
      'Rotwein', 'Weißwein', 'Fischsoße', 'Erdnussbutter', 'Currypaste', 'Tahini', 'Zucker',
      'Fleischbrühe', 'Kapern', 'Apfelmus',
    ],
  };

  /** Erzeugt aus einem Namen eine stabile ID: „Crème fraîche“ → „creme-fraiche“ */
  function slug(name) {
    return String(name)
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const LEBENSMITTEL = [];
  for (const kategorie of KATEGORIEN) {
    for (const name of NACH_KATEGORIE[kategorie]) {
      LEBENSMITTEL.push({ id: slug(name), name, kategorie });
    }
  }

  /*
   * Beispielgerichte für den ersten Start. Sie tragen „beispiel: true“
   * und lassen sich in der App per Knopfdruck entfernen.
   */
  const BEISPIEL_GERICHTE = [
    {
      name: 'Spaghetti Bolognese',
      zutaten: ['spaghetti', 'rinderhack', 'passierte-tomaten', 'zwiebeln', 'knoblauch', 'karotten', 'parmesan'],
      zeit: 40, menge: '4 Portionen', kategorien: [],
      notizen: 'Soße darf ruhig länger köcheln – am nächsten Tag schmeckt sie noch besser.',
    },
    {
      name: 'Kichererbsen-Curry mit Reis',
      zutaten: ['kichererbsen', 'kokosmilch', 'currypulver', 'paprika', 'zucchini', 'zwiebeln', 'ingwer', 'basmatireis'],
      zeit: 35, menge: '3 Portionen', kategorien: ['vegetarisch', 'vegan'],
    },
    {
      name: 'Ofenkartoffeln mit Kräuterquark',
      zutaten: ['kartoffeln', 'quark', 'schnittlauch', 'petersilie', 'knoblauch'],
      zeit: 50, menge: '2 Portionen', kategorien: ['vegetarisch', 'Ofen'],
    },
    {
      name: 'Lachs mit Brokkoli und Reis',
      zutaten: ['lachs', 'brokkoli', 'reis', 'zitronen', 'butter'],
      zeit: 25, menge: '2 Portionen', kategorien: ['schnell'],
    },
    {
      name: 'Bauernfrühstück',
      zutaten: ['kartoffeln', 'eier', 'speck', 'zwiebeln', 'gewuerzgurken'],
      zeit: 20, menge: '2 Portionen', kategorien: ['schnell', 'Resteverwertung', 'Pfanne'],
      notizen: 'Ideal für Pellkartoffeln vom Vortag.',
    },
    {
      name: 'Linseneintopf mit Würstchen',
      zutaten: ['linsen', 'karotten', 'kartoffeln', 'lauch', 'wiener-wuerstchen', 'essig'],
      zeit: 45, menge: '4 Portionen', kategorien: ['Suppe & Eintopf'],
    },
    {
      name: 'Käsespätzle',
      zutaten: ['spaetzle', 'bergkaese', 'zwiebeln', 'butter'],
      zeit: 30, menge: '2 Portionen', kategorien: ['vegetarisch', 'Pfanne'],
    },
    {
      name: 'Hähnchen-Wraps',
      zutaten: ['tortillas', 'haehnchenbrust', 'paprika', 'mais', 'eisbergsalat', 'saure-sahne'],
      zeit: 25, menge: '2 Portionen', kategorien: ['schnell'],
    },
    {
      name: 'Griechischer Salat mit Fladenbrot',
      zutaten: ['gurke', 'tomaten', 'feta', 'oliven', 'rote-zwiebeln', 'fladenbrot'],
      zeit: 15, menge: '2 Portionen', kategorien: ['schnell', 'vegetarisch', 'Salat'],
    },
    {
      name: 'Gnocchi-Pfanne mit Spinat',
      zutaten: ['gnocchi', 'spinat', 'kirschtomaten', 'parmesan', 'knoblauch'],
      zeit: 20, menge: '2 Portionen', kategorien: ['schnell', 'vegetarisch', 'Pfanne'],
    },
  ];

  const exporte = { KATEGORIEN, LEBENSMITTEL, BEISPIEL_GERICHTE, slug };
  if (typeof module !== 'undefined' && module.exports) module.exports = exporte;
  else global.Lebensmittel = exporte;
})(typeof window !== 'undefined' ? window : globalThis);
