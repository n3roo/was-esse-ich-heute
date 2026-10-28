// Tests für die Vorschlagslogik. Ausführen mit: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { LEBENSMITTEL, BEISPIEL_GERICHTE, KATEGORIEN, slug } = require('../lebensmittel.js');
const V = require('../vorschlag.js');

const HEUTE = '2026-10-28';

/** Reproduzierbarer Zufall (mulberry32) */
function zufall(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vorTagen(n) {
  const d = new Date(Date.UTC(2026, 9, 28 - n));
  return d.toISOString().slice(0, 10);
}

const G = {
  bolo: { id: 'bolo', name: 'Bolognese', zutaten: ['spaghetti', 'rinderhack', 'tomaten'], zeit: 40, kategorien: [] },
  pesto: { id: 'pesto', name: 'Nudeln mit Pesto', zutaten: ['penne', 'pesto', 'parmesan'], zeit: 15, kategorien: ['schnell', 'vegetarisch'] },
  penne: { id: 'penne', name: 'Penne Arrabiata', zutaten: ['penne', 'tomaten', 'chilischoten'], zeit: 20, kategorien: ['schnell'] },
  curry: { id: 'curry', name: 'Linsencurry', zutaten: ['rote-linsen', 'kokosmilch', 'reis'], zeit: 30, kategorien: ['vegetarisch'] },
  fisch: { id: 'fisch', name: 'Fisch mit Rosenkohl', zutaten: ['kabeljau', 'rosenkohl', 'kartoffeln'], zeit: 35, kategorien: [] },
  leber: { id: 'leber', name: 'Rosenkohl-Rote-Bete-Auflauf', zutaten: ['rosenkohl', 'rote-bete', 'kartoffeln'], zeit: 60, kategorien: ['Ofen'] },
};

function daten(extra = {}) {
  return { gerichte: Object.values(G), lebensmittel: LEBENSMITTEL, heute: HEUTE, ...extra };
}

function punkte(liste, id) {
  return liste.find((e) => e.gericht.id === id).punkte;
}

test('Lebensmittelliste: mindestens 150 Einträge, eindeutige IDs, alle Kategorien belegt', () => {
  assert.ok(LEBENSMITTEL.length >= 150, `nur ${LEBENSMITTEL.length}`);
  assert.equal(new Set(LEBENSMITTEL.map((l) => l.id)).size, LEBENSMITTEL.length);
  for (const k of KATEGORIEN) assert.ok(LEBENSMITTEL.some((l) => l.kategorie === k), k);
  assert.equal(slug('Crème fraîche'), 'creme-fraiche');
  assert.equal(slug('Hähnchenbrust'), 'haehnchenbrust');
});

test('Beispielgerichte verwenden nur Zutaten aus der Liste', () => {
  const ids = new Set(LEBENSMITTEL.map((l) => l.id));
  for (const g of BEISPIEL_GERICHTE) {
    for (const z of g.zutaten) assert.ok(ids.has(z), `${g.name}: ${z} fehlt`);
  }
});

test('Beliebte Zutaten geben Plus-, unbeliebte deutliche Minuspunkte', () => {
  const liste = V.bewerteGerichte(daten({ bewertungen: { rinderhack: 'mag', kabeljau: 'nicht' } }));
  assert.equal(punkte(liste, 'bolo'), V.KONFIG.punkteMagIch);
  assert.equal(punkte(liste, 'fisch'), V.KONFIG.punkteMagIchNicht);
  assert.equal(punkte(liste, 'curry'), 0);
  assert.equal(liste[0].gericht.id, 'bolo');
});

test('Gerichte mit mehreren unbeliebten Zutaten kommen praktisch nicht vor', () => {
  const d = daten({ bewertungen: { rosenkohl: 'nicht', 'rote-bete': 'nicht' } });
  const liste = V.bewerteGerichte(d);
  assert.ok(liste.find((e) => e.gericht.id === 'leber').wahrscheinlichkeit < 0.001);
  const r = zufall(1);
  let treffer = 0;
  for (let i = 0; i < 2000; i++) if (V.schlageVor(d, r).vorschlag.gericht.id === 'leber') treffer++;
  assert.ok(treffer <= 2, `${treffer} Treffer`);
});

test('Kürzlich gegessene Gerichte werden abgewertet und erholen sich mit der Zeit', () => {
  const werte = [0, 1, 3, 7, 13, 14, 30].map((tage) => {
    const liste = V.bewerteGerichte(daten({ verlauf: [{ datum: vorTagen(tage), gerichtId: 'curry' }] }));
    // Nur den Abzug für den Wiederholungs-Abstand betrachten
    const grund = liste.find((e) => e.gericht.id === 'curry').gruende.find((g) => /^(Heute schon|Gestern|Vor \d+ Tagen) gegessen$/.test(g.text));
    return grund ? grund.punkte : 0;
  });
  assert.equal(werte[0], -V.KONFIG.wiederholungMaxAbzug);
  for (let i = 1; i < werte.length; i++) assert.ok(werte[i] >= werte[i - 1], `nicht monoton: ${werte}`);
  assert.equal(werte[5], 0);
  assert.ok(werte[1] < -15, 'gestern gegessen soll stark abgewertet sein');
});

test('Oft bestätigt gibt Bonus, oft „Nicht heute“ gibt Malus – beides gedeckelt', () => {
  const verlauf = Array.from({ length: 20 }, (_, i) => ({ datum: vorTagen(30 + i), gerichtId: 'pesto' }));
  const liste = V.bewerteGerichte(daten({ verlauf, rueckmeldungen: { fisch: { nichtHeute: 50 } } }));
  assert.equal(punkte(liste, 'pesto'), V.KONFIG.bonusMax);
  assert.equal(punkte(liste, 'fisch'), -V.KONFIG.malusMax);
});

test('Abwechslung: nicht dreimal Nudeln in Folge', () => {
  const verlauf = [
    { datum: vorTagen(1), gerichtId: 'bolo' }, // gestern Spaghetti… zählt als andere Nudel-ID
    { datum: vorTagen(1), zutaten: ['penne'] },  // …und ein einmaliger Eintrag mit Penne
    { datum: vorTagen(2), gerichtId: 'pesto' },  // vorgestern Penne
  ];
  const liste = V.bewerteGerichte(daten({ verlauf }));
  const penne = liste.find((e) => e.gericht.id === 'penne');
  // Penne gab es gestern und vorgestern → Serie 2 → Abzug 5 × 2²
  assert.equal(penne.punkte, -V.KONFIG.abwechslungHauptzutatFaktor * 4);
  assert.ok(penne.gruende.some((g) => g.text.includes('die letzten 2 Tage')));
  assert.equal(punkte(liste, 'curry'), 0);
});

test('Abwechslung: Serie bricht an einem Tag ohne die Zutat ab', () => {
  const verlauf = [
    { datum: vorTagen(1), gerichtId: 'curry' },
    { datum: vorTagen(2), gerichtId: 'pesto' },
  ];
  const liste = V.bewerteGerichte(daten({ verlauf }));
  assert.equal(punkte(liste, 'penne'), 0);
});

test('Filter: Zeit und vegetarisch', () => {
  const schnell = V.bewerteGerichte(daten({ filter: { maxZeit: 30 } })).map((e) => e.gericht.id).sort();
  assert.deepEqual(schnell, ['curry', 'penne', 'pesto']);
  const veg = V.bewerteGerichte(daten({ filter: { vegetarisch: true } })).map((e) => e.gericht.id).sort();
  assert.deepEqual(veg, ['curry', 'leber', 'penne', 'pesto']);
});

test('„Was habe ich im Haus?“ reiht Gerichte nach vorhandenen Zutaten', () => {
  const liste = V.bewerteGerichte(daten({ filter: { imHaus: ['penne', 'tomaten', 'chilischoten', 'reis'] } }));
  assert.equal(liste[0].gericht.id, 'penne');
  assert.deepEqual(liste[0].imHaus.fehlend, []);
  assert.ok(punkte(liste, 'curry') > punkte(liste, 'fisch'));
});

test('Ausgeschlossene Gerichte („Nicht heute“) erscheinen nicht', () => {
  const liste = V.bewerteGerichte(daten({ ausgeschlossen: ['bolo', 'curry'] }));
  assert.ok(!liste.some((e) => ['bolo', 'curry'].includes(e.gericht.id)));
});

test('Gewichteter Zufall: meist das beste Gericht, aber nicht immer', () => {
  const d = daten({ bewertungen: { rinderhack: 'mag', spaghetti: 'mag' } });
  const r = zufall(42);
  const zaehler = {};
  for (let i = 0; i < 1000; i++) {
    const id = V.schlageVor(d, r).vorschlag.gericht.id;
    zaehler[id] = (zaehler[id] || 0) + 1;
  }
  assert.ok(zaehler.bolo > 300, JSON.stringify(zaehler));
  assert.ok(Object.keys(zaehler).length >= 4, JSON.stringify(zaehler));
});

test('Keine Gerichte → kein Vorschlag', () => {
  assert.equal(V.schlageVor({ gerichte: [], lebensmittel: LEBENSMITTEL, heute: HEUTE }).vorschlag, null);
});

test('tageZwischen ist unabhängig von Sommer-/Winterzeit', () => {
  assert.equal(V.tageZwischen('2026-10-24', '2026-10-26'), 2);
  assert.equal(V.tageZwischen('2026-03-28', '2026-03-30'), 2);
});
