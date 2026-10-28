/*
 * Vorschlagslogik für „Was esse ich heute?“
 *
 * Diese Datei kennt keine Oberfläche: Sie bekommt Daten hinein und gibt
 * bewertete Gerichte zurück. Dadurch lässt sie sich mit Node testen
 * (siehe tests/vorschlag.test.js).
 *
 * So entsteht ein Vorschlag:
 *
 *   1. Harte Filter: Zeitlimit, vegetarisch, für heute ausgeschlossene Gerichte.
 *   2. Jedes übrige Gericht bekommt Punkte (Startwert 0):
 *        + Zutaten, die ich mag
 *        − Zutaten, die ich nicht mag (deutlich stärker)
 *        − kürzlich gegessen (Abzug wird mit jedem Tag kleiner)
 *        + oft bestätigt / − oft „Nicht heute“
 *        + oft geliked, + eigenes Gericht (statt Katalog)
 *        − gleiche Hauptzutat oder Kategorie wie an den Vortagen (Abwechslung)
 *        + Zutaten, die im Haus sind
 *   3. Aus den Punkten wird ein Gewicht: gewicht = e^(punkte / temperatur).
 *      Ein Gericht mit 4 Punkten mehr ist so etwa 2,7-mal wahrscheinlicher.
 *   4. Gewichteter Zufall wählt ein Gericht – meist eins der besten, aber
 *      nicht immer dasselbe.
 *
 * Alle Stellschrauben stehen gesammelt in KONFIG.
 */
(function (global) {
  'use strict';

  const KONFIG = {
    // Vorlieben (pro Zutat)
    punkteMagIch: 3,
    punkteMagIchNicht: -8,
    // Ab so vielen unbeliebten Zutaten gibt es zusätzlich einen sehr großen Abzug,
    // damit das Gericht praktisch nie vorgeschlagen wird.
    unbeliebtGrenze: 2,
    punkteVieleUnbeliebte: -30,

    // Wiederholungs-Abstand: Heute gegessen = voller Abzug, danach erholt sich
    // die Punktzahl über „erholungTage“ hinweg (quadratisch, also erst langsam,
    // dann schneller).
    wiederholungMaxAbzug: 20,
    wiederholungErholungTage: 14,

    // Rückmeldungen
    bonusProBestaetigung: 0.5, // pro Eintrag im Verlauf
    bonusMax: 3,
    malusProNichtHeute: 0.75, // pro „Nicht heute“
    malusMax: 4,
    bonusProLike: 0.5,      // pro Tag, an dem das Gericht geliked wurde
    bonusLikeMax: 2.5,
    // Selbst eingetragene Gerichte kennen und mögen wir – sie bekommen einen
    // kleinen Vorsprung vor den Gerichten aus dem Katalog.
    bonusEigenesGericht: 2,

    // Abwechslung: Wie viele Tage in Folge (ab gestern) gab es die gleiche
    // Hauptzutat / Kategorie? Abzug = faktor × serie², also
    // 1 Tag → klein, 2 Tage in Folge → deutlich.
    abwechslungHauptzutatFaktor: 5,
    abwechslungKategorieFaktor: 2,
    abwechslungMaxTage: 3,
    // Diese Kategorien sagen nichts über den Geschmack aus und zählen nicht
    // für die Abwechslung.
    kategorienOhneAbwechslung: ['schnell', 'aufwendig', 'vegetarisch', 'vegan'],
    // Zutaten aus diesen Lebensmittel-Kategorien prägen ein Gericht
    // („Hauptzutat“), z. B. Nudeln, Reis, Hähnchen, Linsen.
    hauptzutatKategorien: ['Fleisch', 'Fisch', 'Getreide und Beilagen', 'Hülsenfrüchte'],

    // „Was habe ich im Haus?“: Bonus × Anteil der vorhandenen Zutaten
    imHausBonusMax: 15,

    // Zufall: kleinere Temperatur = öfter das beste Gericht,
    // größere Temperatur = mehr Überraschung.
    temperatur: 4,

    // Lebensmittel-Kategorien, die ein Gericht nicht-vegetarisch machen
    fleischKategorien: ['Fleisch', 'Fisch'],
  };

  // ---------- Hilfsfunktionen ----------

  /** „2026-10-28“ → Tageszahl seit 1970 (zeitzonenunabhängig) */
  function tagesnummer(iso) {
    const [j, m, t] = iso.split('-').map(Number);
    return Math.round(Date.UTC(j, m - 1, t) / 86400000);
  }

  function tageZwischen(vonIso, bisIso) {
    return tagesnummer(bisIso) - tagesnummer(vonIso);
  }

  function lebensmittelIndex(lebensmittel) {
    const index = new Map();
    for (const l of lebensmittel || []) index.set(l.id, l);
    return index;
  }

  /** Prägende Zutaten eines Gerichts (siehe KONFIG.hauptzutatKategorien). */
  function hauptzutaten(zutaten, index, konfig = KONFIG) {
    const liste = (zutaten || []).filter((id) => {
      const l = index.get(id);
      return l && konfig.hauptzutatKategorien.includes(l.kategorie);
    });
    // Ohne prägende Zutat zählt die erste Zutat als Hauptzutat.
    if (liste.length === 0 && zutaten && zutaten.length) return [zutaten[0]];
    return liste;
  }

  function istVegetarisch(gericht, index, konfig = KONFIG) {
    return !(gericht.zutaten || []).some((id) => {
      const l = index.get(id);
      return l && konfig.fleischKategorien.includes(l.kategorie);
    });
  }

  function abwechslungsKategorien(gericht, konfig = KONFIG) {
    return (gericht.kategorien || []).filter((k) => !konfig.kategorienOhneAbwechslung.includes(k));
  }

  /**
   * Zählt, an wie vielen Tagen in Folge (ab gestern rückwärts) ein Merkmal
   * vorkam. tageMerkmale: Array, Index 0 = gestern, 1 = vorgestern, …
   */
  function serie(tageMerkmale, merkmal) {
    let n = 0;
    for (const merkmale of tageMerkmale) {
      if (merkmale && merkmale.has(merkmal)) n++;
      else break;
    }
    return n;
  }

  // ---------- Bewertung ----------

  /**
   * Bewertet alle Gerichte.
   *
   * @param {object} daten
   *   gerichte:       [{ id, name, zutaten: [lebensmittelId], zeit, kategorien }]
   *   lebensmittel:   [{ id, name, kategorie }]
   *   bewertungen:    { lebensmittelId: 'mag' | 'nicht' | 'egal' }
   *   verlauf:        [{ datum: 'JJJJ-MM-TT', gerichtId?, zutaten? }]
   *   rueckmeldungen: { gerichtId: { nichtHeute: Zahl } }
   *   likes:          { gerichtId: ['JJJJ-MM-TT', …] } – Tage, an denen es geliked wurde
   *   heute:          'JJJJ-MM-TT'
   *   filter:         { maxZeit?: Zahl, vegetarisch?: bool, imHaus?: [lebensmittelId] }
   *   ausgeschlossen: [gerichtId] – z. B. heute schon mit „Nicht heute“ abgelehnt
   * @returns sortierte Liste [{ gericht, punkte, gewicht, wahrscheinlichkeit, gruende, imHaus }]
   */
  function bewerteGerichte(daten, konfig = KONFIG) {
    const {
      gerichte = [], lebensmittel = [], bewertungen = {}, verlauf = [],
      rueckmeldungen = {}, likes = {}, heute, filter = {}, ausgeschlossen = [],
    } = daten;
    const index = lebensmittelIndex(lebensmittel);
    const gerichtNachId = new Map(gerichte.map((g) => [g.id, g]));
    const imHaus = new Set(filter.imHaus || []);

    // Verlauf aufbereiten: letztes Essdatum und Anzahl pro Gericht,
    // Merkmale (Hauptzutaten/Kategorien) für die letzten Tage.
    const zuletzt = new Map();
    const anzahl = new Map();
    const tageHaupt = Array.from({ length: konfig.abwechslungMaxTage }, () => null);
    const tageKat = Array.from({ length: konfig.abwechslungMaxTage }, () => null);

    for (const eintrag of verlauf) {
      const abstand = tageZwischen(eintrag.datum, heute);
      if (abstand < 0) continue; // Zukunft ignorieren
      const g = eintrag.gerichtId ? gerichtNachId.get(eintrag.gerichtId) : null;
      if (g) {
        if (!zuletzt.has(g.id) || abstand < zuletzt.get(g.id)) zuletzt.set(g.id, abstand);
        anzahl.set(g.id, (anzahl.get(g.id) || 0) + 1);
      }
      if (abstand >= 1 && abstand <= konfig.abwechslungMaxTage) {
        const i = abstand - 1;
        const zutaten = g ? g.zutaten : eintrag.zutaten || [];
        tageHaupt[i] = tageHaupt[i] || new Set();
        tageKat[i] = tageKat[i] || new Set();
        hauptzutaten(zutaten, index, konfig).forEach((z) => tageHaupt[i].add(z));
        if (g) abwechslungsKategorien(g, konfig).forEach((k) => tageKat[i].add(k));
      }
    }

    const ergebnis = [];
    for (const gericht of gerichte) {
      // 1. Harte Filter
      if (ausgeschlossen.includes(gericht.id)) continue;
      if (filter.maxZeit && !(gericht.zeit > 0 && gericht.zeit <= filter.maxZeit)) continue;
      if (filter.vegetarisch && !istVegetarisch(gericht, index, konfig)) continue;

      // 2. Punkte sammeln – jede Regel trägt einen nachvollziehbaren Grund ein.
      const gruende = [];
      const plus = (punkte, text) => { if (punkte) gruende.push({ punkte, text }); };
      const zutaten = gericht.zutaten || [];
      const name = (id) => (index.get(id) || { name: id }).name;

      const mag = zutaten.filter((id) => bewertungen[id] === 'mag');
      const nicht = zutaten.filter((id) => bewertungen[id] === 'nicht');
      plus(mag.length * konfig.punkteMagIch, `Magst du: ${mag.map(name).join(', ')}`);
      plus(nicht.length * konfig.punkteMagIchNicht, `Magst du nicht: ${nicht.map(name).join(', ')}`);
      if (nicht.length >= konfig.unbeliebtGrenze) {
        plus(konfig.punkteVieleUnbeliebte, 'Mehrere unbeliebte Zutaten');
      }

      if (zuletzt.has(gericht.id)) {
        const tage = zuletzt.get(gericht.id);
        if (tage < konfig.wiederholungErholungTage) {
          const rest = 1 - tage / konfig.wiederholungErholungTage;
          const text = tage === 0 ? 'Heute schon gegessen'
            : tage === 1 ? 'Gestern gegessen' : `Vor ${tage} Tagen gegessen`;
          plus(-round(konfig.wiederholungMaxAbzug * rest * rest), text);
        }
      }

      const bestaetigt = anzahl.get(gericht.id) || 0;
      plus(round(Math.min(bestaetigt * konfig.bonusProBestaetigung, konfig.bonusMax)),
        `Schon ${bestaetigt}× gegessen`);
      const nichtHeute = (rueckmeldungen[gericht.id] || {}).nichtHeute || 0;
      plus(-round(Math.min(nichtHeute * konfig.malusProNichtHeute, konfig.malusMax)),
        `${nichtHeute}× „Nicht heute“`);
      const geliked = (likes[gericht.id] || []).length;
      plus(round(Math.min(geliked * konfig.bonusProLike, konfig.bonusLikeMax)), `${geliked}× geliked`);
      if (!gericht.katalog) plus(konfig.bonusEigenesGericht, 'Eigenes Gericht');

      // Abwechslung: schlimmste Serie über alle Hauptzutaten / Kategorien
      let haupt = { serie: 0 }; let kat = { serie: 0 };
      for (const z of hauptzutaten(zutaten, index, konfig)) {
        const s = serie(tageHaupt, z);
        if (s > haupt.serie) haupt = { serie: s, merkmal: name(z) };
      }
      for (const k of abwechslungsKategorien(gericht, konfig)) {
        const s = serie(tageKat, k);
        if (s > kat.serie) kat = { serie: s, merkmal: k };
      }
      const tageText = (s) => (s === 1 ? 'gestern' : `die letzten ${s} Tage`);
      plus(-konfig.abwechslungHauptzutatFaktor * haupt.serie ** 2,
        `${haupt.merkmal} gab es schon ${tageText(haupt.serie)}`);
      plus(-konfig.abwechslungKategorieFaktor * kat.serie ** 2,
        `„${kat.merkmal}“ gab es schon ${tageText(kat.serie)}`);

      let imHausInfo = null;
      if (imHaus.size && zutaten.length) {
        const vorhanden = zutaten.filter((id) => imHaus.has(id));
        imHausInfo = { vorhanden, fehlend: zutaten.filter((id) => !imHaus.has(id)) };
        plus(round(konfig.imHausBonusMax * (vorhanden.length / zutaten.length)),
          `${vorhanden.length} von ${zutaten.length} Zutaten im Haus`);
      }

      const punkte = round(gruende.reduce((s, g) => s + g.punkte, 0));
      ergebnis.push({ gericht, punkte, gruende, imHaus: imHausInfo });
    }

    // 3. Punkte → Gewichte (Softmax). Das Maximum abziehen verhindert Überläufe.
    const max = Math.max(...ergebnis.map((e) => e.punkte));
    let summe = 0;
    for (const e of ergebnis) {
      e.gewicht = Math.exp((e.punkte - max) / konfig.temperatur);
      summe += e.gewicht;
    }
    for (const e of ergebnis) e.wahrscheinlichkeit = e.gewicht / summe;

    return ergebnis.sort((a, b) => b.punkte - a.punkte);
  }

  /** 4. Gewichteter Zufall. „zufall“ ist austauschbar (für Tests). */
  function waehleGewichtet(liste, zufall = Math.random) {
    if (!liste.length) return null;
    const summe = liste.reduce((s, e) => s + e.gewicht, 0);
    let r = zufall() * summe;
    for (const e of liste) {
      r -= e.gewicht;
      if (r < 0) return e;
    }
    return liste[liste.length - 1];
  }

  /** Bequemer Einstieg: bewerten und ein Gericht auswählen. */
  function schlageVor(daten, zufall = Math.random, konfig = KONFIG) {
    const kandidaten = bewerteGerichte(daten, konfig);
    return { vorschlag: waehleGewichtet(kandidaten, zufall), kandidaten };
  }

  function round(x) {
    return Math.round(x * 10) / 10;
  }

  const exporte = {
    KONFIG, bewerteGerichte, waehleGewichtet, schlageVor,
    hauptzutaten, istVegetarisch, tageZwischen, lebensmittelIndex,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = exporte;
  else global.Vorschlag = exporte;
})(typeof window !== 'undefined' ? window : globalThis);
