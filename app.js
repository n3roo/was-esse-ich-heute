/*
 * Was esse ich heute? – Oberfläche
 *
 * Aufbau:
 *   Speicher   – lädt/speichert den Zustand in IndexedDB (Fallback localStorage)
 *   Zustand    – ein einziges Objekt „z“, wird als Ganzes gespeichert/exportiert
 *   Ansichten  – Funktionen, die HTML erzeugen (heute, gerichte, formular, …)
 *   Aktionen   – Klicks laufen über data-aktion="…" und die Tabelle AKTIONEN
 *
 * Die eigentliche Vorschlagslogik steckt in vorschlag.js.
 */
(function () {
  'use strict';

  const { KATEGORIEN, LEBENSMITTEL, BEISPIEL_GERICHTE, slug } = window.Lebensmittel;
  const V = window.Vorschlag;
  const KATALOG = window.Katalog.GERICHTE_KATALOG;

  const VERSION = 1;
  const SPEICHER_SCHLUESSEL = 'was-esse-ich-heute';
  const MIN_GERICHTE = 5; // darunter erscheint ein Hinweis, mehr Gerichte einzutragen
  const GERICHT_KATEGORIEN = ['schnell', 'aufwendig', 'vegetarisch', 'vegan', 'Resteverwertung', 'Ofen', 'Pfanne', 'Suppe & Eintopf', 'Salat'];
  const ZEIT_OPTIONEN = [[0, 'Zeit egal'], [15, 'bis 15 Min.'], [30, 'bis 30 Min.'], [45, 'bis 45 Min.'], [60, 'bis 1 Std.']];
  const SONSTIGES = 'Soßen und Sonstiges';

  // ---------- kleine Helfer ----------

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const isoAus = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const datumAus = (iso) => { const [j, m, t] = iso.split('-').map(Number); return new Date(j, m - 1, t); };
  const isoPlus = (iso, tage) => { const d = datumAus(iso); d.setDate(d.getDate() + tage); return isoAus(d); };
  const isoHeute = () => isoAus(new Date());
  const fmtLang = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtKurz = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const fmtTagMonat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
  const vergleich = new Intl.Collator('de').compare;
  // Suchtext vereinheitlichen: „Hähnchen“, „haehnchen“ und „HAEHNCHEN“ finden dasselbe
  const such = (s) => slug(s || '');

  function fmtZeit(min) {
    if (!min) return '';
    if (min < 60) return `${min} Min.`;
    const h = Math.floor(min / 60); const m = min % 60;
    return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
  }

  function wannText(iso) {
    const t = V.tageZwischen(iso, isoHeute());
    if (t === 0) return 'heute';
    if (t === 1) return 'gestern';
    if (t < 0) return fmtKurz.format(datumAus(iso));
    return `vor ${t} Tagen`;
  }

  const ICON = {
    nein: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    egal: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
    haken: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    anders: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5M19 4v4h-4"/></svg>',
    mag: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  };

  // ---------- Speicher ----------

  const Speicher = {
    db: null,
    async oeffnen() {
      if (!('indexedDB' in window)) return;
      this.db = await new Promise((ok, fehler) => {
        const r = indexedDB.open(SPEICHER_SCHLUESSEL, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('daten');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      }).catch(() => null);
    },
    anfrage(modus, aufruf) {
      return new Promise((ok, fehler) => {
        const r = aufruf(this.db.transaction('daten', modus).objectStore('daten'));
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      });
    },
    async laden() {
      if (this.db) {
        try { return await this.anfrage('readonly', (s) => s.get('zustand')); } catch (e) { /* weiter mit Fallback */ }
      }
      try { return JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)); } catch (e) { return null; }
    },
    async speichern(daten) {
      if (this.db) {
        try { await this.anfrage('readwrite', (s) => s.put(daten, 'zustand')); return; } catch (e) { /* Fallback */ }
      }
      try { localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten)); } catch (e) {
        meldung('Speichern fehlgeschlagen – ist der Speicher voll?');
      }
    },
  };

  let speicherTimer = null;
  function speichern() {
    clearTimeout(speicherTimer);
    speicherTimer = setTimeout(() => Speicher.speichern(z), 200);
  }
  function sofortSpeichern() {
    clearTimeout(speicherTimer);
    return Speicher.speichern(z);
  }

  // ---------- Zustand ----------

  function leeresGericht() {
    return { id: '', name: '', zutaten: [], menge: '', zeit: 0, kategorien: [], notizen: '', link: '', foto: '', beispiel: false };
  }

  function neuerHeuteZustand() {
    return { datum: isoHeute(), ausgeschlossen: [], gezeigt: [], vorschlagId: null };
  }

  function neuerZustand() {
    return {
      version: VERSION,
      bewertungen: {},          // lebensmittelId → 'mag' | 'nicht' | 'egal' (fehlt = noch nicht bewertet)
      eigeneLebensmittel: [],   // { id, name, kategorie }
      gerichte: BEISPIEL_GERICHTE.map((g) => ({ ...leeresGericht(), ...g, id: neueId(), beispiel: true })),
      verlauf: [],              // { id, datum, gerichtId | null, titel }
      rueckmeldungen: {},       // gerichtId → { nichtHeute }
      likes: {},                // gerichtId → ['JJJJ-MM-TT', …] (Tage, an denen es gemerkt wurde)
      katalogAus: [],           // Katalog-Gerichte, die nicht mehr vorgeschlagen werden
      einstellungen: { katalog: true },
      heute: neuerHeuteZustand(),
      filter: { maxZeit: 0, vegetarisch: false, imHaus: [] },
      einrichtung: { begruesst: false, abgeschlossen: false },
      erstellt: new Date().toISOString(),
    };
  }

  /** Füllt fehlende Felder auf (ältere Backups, Importe). */
  function normalisieren(d) {
    const basis = neuerZustand();
    const n = { ...basis, ...d, version: VERSION };
    n.bewertungen = d.bewertungen && typeof d.bewertungen === 'object' ? d.bewertungen : {};
    n.eigeneLebensmittel = Array.isArray(d.eigeneLebensmittel) ? d.eigeneLebensmittel : [];
    n.gerichte = Array.isArray(d.gerichte) ? d.gerichte.map((g) => ({ ...leeresGericht(), ...g, id: g.id || neueId() })) : [];
    n.verlauf = Array.isArray(d.verlauf) ? d.verlauf.filter((e) => e && e.datum) : [];
    n.rueckmeldungen = d.rueckmeldungen || {};
    n.likes = d.likes && typeof d.likes === 'object' ? d.likes : {};
    n.katalogAus = Array.isArray(d.katalogAus) ? d.katalogAus : [];
    n.einstellungen = { ...basis.einstellungen, ...(d.einstellungen || {}) };
    n.heute = { ...neuerHeuteZustand(), ...(d.heute || {}) };
    n.filter = { ...basis.filter, ...(d.filter || {}) };
    n.einrichtung = { ...basis.einrichtung, ...(d.einrichtung || {}) };
    return n;
  }

  let z = null;

  // Flüchtiger Oberflächen-Zustand (wird nicht gespeichert)
  const ui = {
    route: '',
    gerichteSuche: '',
    gerichteFilter: '',
    einrSuche: '',
    einrKategorie: '',
    einrNurOffen: false,
    verlaufModus: 'kalender',
    formular: null,
    formularNeu: {},  // id → Name für frei eingegebene, noch nicht gespeicherte Zutaten
    editor: null,
    imHausSuche: '',
    karteNeu: false, // nächste Karte mit „Nachrutschen“-Animation zeigen
    likesModus: 'heute',
    runde: null,     // laufende Entscheidungsrunde (siehe rundeStarten)
    gerichteQuelle: 'meine', // 'meine' | 'katalog'
    installieren: null,
  };

  function alleLebensmittel() {
    return [...LEBENSMITTEL, ...z.eigeneLebensmittel];
  }
  function lmIndex() {
    return V.lebensmittelIndex(alleLebensmittel());
  }
  function lmName(id, index = lmIndex()) {
    return (index.get(id) || { name: ui.formularNeu[id] || id }).name;
  }
  function gerichtVon(id) {
    return z.gerichte.find((g) => g.id === id) || KATALOG.find((g) => g.id === id);
  }
  /** Alle Gerichte, die vorgeschlagen werden dürfen: eigene plus (optional) Katalog. */
  function vorschlagsGerichte() {
    if (!z.einstellungen.katalog) return z.gerichte;
    return [...z.gerichte, ...KATALOG.filter((g) => !z.katalogAus.includes(g.id))];
  }
  function heuteGeliked() {
    const heute = isoHeute();
    return Object.keys(z.likes).filter((id) => z.likes[id].includes(heute));
  }
  function liken(id) {
    const heute = isoHeute();
    const tage = z.likes[id] || [];
    if (!tage.includes(heute)) z.likes[id] = [...tage, heute];
    speichern();
  }
  function eintragAm(datum) {
    return z.verlauf.find((e) => e.datum === datum);
  }
  function einrichtungsStand() {
    const alle = alleLebensmittel();
    const bewertet = alle.filter((l) => z.bewertungen[l.id]).length;
    const mag = alle.filter((l) => z.bewertungen[l.id] === 'mag').length;
    const nicht = alle.filter((l) => z.bewertungen[l.id] === 'nicht').length;
    return { gesamt: alle.length, bewertet, mag, nicht, prozent: Math.round((bewertet / alle.length) * 100) };
  }

  function heuteAktualisieren() {
    if (z.heute.datum !== isoHeute()) { z.heute = neuerHeuteZustand(); speichern(); }
  }

  /** Trägt für einen Tag ein Essen ein (ein Eintrag pro Tag = das Abendessen). */
  function setzeEintrag(datum, { gerichtId = null, titel = '' }) {
    const g = gerichtId ? gerichtVon(gerichtId) : null;
    z.verlauf = z.verlauf.filter((e) => e.datum !== datum);
    z.verlauf.push({ id: neueId(), datum, gerichtId, titel: g ? g.name : titel.trim() });
    z.verlauf.sort((a, b) => (a.datum < b.datum ? 1 : -1));
    speichern();
  }

  function loescheEintrag(datum) {
    z.verlauf = z.verlauf.filter((e) => e.datum !== datum);
    speichern();
  }

  // ---------- Darstellung von Gerichten ----------

  /** Ein passendes Emoji als Platzhalter, wenn kein Foto da ist. */
  function emojiFuer(g) {
    const name = (g.name || '').toLowerCase();
    const zt = g.zutaten || [];
    const index = lmIndex();
    const hat = (re) => zt.some((id) => re.test(id));
    const kat = (k) => zt.some((id) => (index.get(id) || {}).kategorie === k);
    const tag = (t) => (g.kategorien || []).includes(t);
    if (/pizza|flammkuchen/.test(name)) return '🍕';
    if (/curry/.test(name)) return '🍛';
    if (/burger/.test(name)) return '🍔';
    if (/suppe|eintopf/.test(name) || tag('Suppe & Eintopf')) return '🍲';
    if (/salat/.test(name) || tag('Salat')) return '🥗';
    if (hat(/spaghetti|penne|nudel|lasagne|tortellini|spaetzle|gnocchi/)) return '🍝';
    if (hat(/tortilla/)) return '🌯';
    if (hat(/garnelen/)) return '🦐';
    if (kat('Fisch')) return '🐟';
    if (hat(/haehnchen|pute|ente/)) return '🍗';
    if (hat(/eier/)) return '🍳';
    if (hat(/wurst|wuerstchen/)) return '🌭';
    if (kat('Fleisch')) return '🥩';
    if (hat(/reis|risotto/)) return '🍚';
    if (hat(/kartoffel|pommes|kroketten/)) return '🥔';
    if (hat(/brot|broetchen/)) return '🥪';
    if (kat('Hülsenfrüchte')) return '🫘';
    if (kat('Gemüse')) return '🥦';
    return '🍽️';
  }

  function farbtonFuer(text) {
    let h = 0;
    for (const c of text || '') h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }

  function bildHtml(g) {
    if (g.foto) return `<div class="bild"><img src="${esc(g.foto)}" alt="" loading="lazy"></div>`;
    const h = farbtonFuer(g.name);
    return `<div class="bild" style="background: linear-gradient(135deg, hsl(${h} 45% 65% / .35), hsl(${(h + 50) % 360} 45% 55% / .3)), var(--flaeche-2)"><span class="emoji" aria-hidden="true">${emojiFuer(g)}</span></div>`;
  }

  function zutatenChips(ids, imHaus) {
    const index = lmIndex();
    const vorhanden = new Set(imHaus ? imHaus.vorhanden : []);
    return ids.map((id) => {
      const w = z.bewertungen[id];
      const klasse = w === 'mag' ? 'mag' : w === 'nicht' ? 'nicht' : '';
      const zeichen = vorhanden.has(id) ? '✓ ' : '';
      const titel = w === 'mag' ? 'magst du' : w === 'nicht' ? 'magst du nicht' : '';
      return `<li class="zutat ${klasse}" ${titel ? `title="${titel}"` : ''}>${zeichen}${esc(lmName(id, index))}</li>`;
    }).join('');
  }

  // ---------- Router ----------

  function aktuelleRoute() {
    const teile = (location.hash.slice(1) || '/').split('/').filter(Boolean);
    return { name: teile[0] || 'heute', param: teile[1] };
  }

  function render() {
    const { name, param } = aktuelleRoute();
    const routeText = `${name}/${param || ''}`;
    const neueAnsicht = routeText !== ui.route;
    if (neueAnsicht && name !== 'gericht') { ui.formular = null; ui.formularNeu = {}; }
    ui.route = routeText;

    const ansichten = {
      heute: ansichtHeute,
      gerichte: ansichtGerichte,
      gericht: () => ansichtFormular(param),
      likes: ansichtLikes,
      runde: ansichtRunde,
      verlauf: ansichtVerlauf,
      einstellungen: ansichtEinstellungen,
      einrichtung: ansichtEinrichtung,
    };
    const ansicht = ansichten[name] || ansichtHeute;
    const main = $('#ansicht');
    main.innerHTML = ansicht();

    const tab = { heute: 'heute', likes: 'likes', runde: 'likes', gerichte: 'gerichte', gericht: 'gerichte', verlauf: 'verlauf', einstellungen: 'einstellungen', einrichtung: 'einstellungen' }[name] || 'heute';
    document.querySelectorAll('.tabs a').forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (neueAnsicht) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  }

  // ---------- Ansicht: Heute ----------

  function kandidaten() {
    return V.bewerteGerichte({
      gerichte: vorschlagsGerichte(),
      lebensmittel: alleLebensmittel(),
      bewertungen: z.bewertungen,
      verlauf: z.verlauf,
      rueckmeldungen: z.rueckmeldungen,
      likes: z.likes,
      heute: z.heute.datum,
      filter: z.filter,
      ausgeschlossen: [...z.heute.ausgeschlossen, ...heuteGeliked()],
    });
  }

  /**
   * Liefert den aktuellen Vorschlag. Er bleibt über Neuladen hinweg stabil,
   * bis „Anderer Vorschlag“, „Nicht heute“ oder ein Filter ihn ändert.
   */
  function aktuellerVorschlag(neu = false) {
    const liste = kandidaten();
    if (!liste.length) return { liste, eintrag: null };
    let eintrag = !neu && liste.find((e) => e.gericht.id === z.heute.vorschlagId);
    if (!eintrag) {
      // Bei „Anderer Vorschlag“ zuerst Gerichte nehmen, die heute noch nicht gezeigt wurden.
      let pool = liste.filter((e) => !z.heute.gezeigt.includes(e.gericht.id));
      if (!pool.length) {
        z.heute.gezeigt = [];
        pool = liste.filter((e) => e.gericht.id !== z.heute.vorschlagId);
        if (!pool.length) pool = liste;
      }
      eintrag = V.waehleGewichtet(pool);
      z.heute.vorschlagId = eintrag.gericht.id;
      z.heute.gezeigt.push(eintrag.gericht.id);
      speichern();
    }
    return { liste, eintrag };
  }

  function filterAktiv() {
    return z.filter.maxZeit || z.filter.vegetarisch || z.filter.imHaus.length;
  }

  const fmtWochentag = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });

  /**
   * Eine Vorschlagskarte auf dem Stapel. rechts/links nennen die Aktion
   * (Schlüssel in AKTIONEN), die beim Wischen in die Richtung ausgelöst wird.
   */
  function karteHtml(g, { kapitel, rechts, links, stempelJa, stempelNein, tiefe = 1 }) {
    const index = lmIndex();
    const zutatenzeile = g.zutaten.slice(0, 6).map((id) => {
      const w = z.bewertungen[id];
      return `<span class="${w === 'mag' ? 'mag' : w === 'nicht' ? 'nicht' : ''}">${esc(lmName(id, index))}${w === 'mag' ? ' ♥' : ''}</span>`;
    }).join(' · ') + (g.zutaten.length > 6 ? ' …' : '');
    const neu = ui.karteNeu;
    ui.karteNeu = false;
    return `
      <div class="stapel">
        ${tiefe > 2 ? '<div class="stapel-hinten h2"></div>' : ''}
        ${tiefe > 1 ? '<div class="stapel-hinten h1"></div>' : ''}
        <article class="spielkarte ${neu ? 'neu' : 'einblenden'}" id="spielkarte" data-rechts="${rechts}" data-links="${links}" aria-label="${esc(g.name)}">
          <div class="rahmen">
            <div class="bild">${g.foto ? `<img src="${esc(g.foto)}" alt="">` : `<span class="emoji" aria-hidden="true">${emojiFuer(g)}</span>`}</div>
            <div class="text">
              <div class="kapitel">${kapitel}</div>
              <h1>${esc(g.name)}</h1>
              <div class="zutatenzeile">${zutatenzeile}</div>
            </div>
          </div>
          <div class="stempel ja" aria-hidden="true">${stempelJa}</div>
          <div class="stempel nein" aria-hidden="true">${stempelNein}</div>
        </article>
      </div>`;
  }

  function rezeptLink(g) {
    if (g.link) return `<a href="${esc(g.link)}" target="_blank" rel="noopener">Rezept öffnen ↗</a>`;
    if (g.katalog) return `<a href="https://www.chefkoch.de/rs/s0/${encodeURIComponent(g.name)}/Rezepte.html" target="_blank" rel="noopener">Rezepte dazu suchen ↗</a>`;
    return '';
  }

  function ansichtHeute() {
    heuteAktualisieren();
    const stand = einrichtungsStand();
    const eintrag = eintragAm(z.heute.datum);
    const anzahlLikes = heuteGeliked().length;
    let html = `
      <header class="kopf mitte">
        <div class="kapitel">${esc(fmtWochentag.format(new Date()))} · Abendkarte</div>
        <h1>${eintrag ? 'Heute Abend' : 'Heute im Angebot'}</h1>
      </header>`;

    if (!z.einrichtung.abgeschlossen) {
      html += `
        <div class="hinweis"><span class="emoji">🥕</span><div>
          <p><b>Was magst du?</b> Bewerte ein paar Lebensmittel, dann passen die Vorschläge besser. (${stand.prozent} % erledigt)</p>
          <a class="knopf klein primaer" href="#/einrichtung">${stand.bewertet ? 'Weitermachen' : 'Los geht’s'}</a>
        </div></div>`;
    }

    if (eintrag) {
      const g = eintrag.gerichtId && gerichtVon(eintrag.gerichtId);
      return html + `
        <section class="eingetragen einblenden"><div class="rahmen">
          <div class="emoji">${g ? emojiFuer(g) : '🍽️'}</div>
          <div class="kapitel">Heute Abend gibt es</div>
          <h1>${esc(eintrag.titel)}</h1>
          <p class="kursiv">Bon appétit</p>
          <div class="knopfreihe">
            ${g && (g.link || g.katalog) ? rezeptLink(g).replace('<a ', '<a class="knopf rahmen" ') : ''}
            <button class="knopf still" data-aktion="heute-aendern">Doch etwas anderes</button>
          </div>
        </div></section>`;
    }

    html += filterleisteHtml();
    if (anzahlLikes) {
      html += `<a class="likes-zaehler" href="#/likes">♥ ${anzahlLikes} heute gemerkt · jetzt entscheiden ›</a>`;
    }

    const gerichte = vorschlagsGerichte();
    if (gerichte.length === 0) {
      return html + `
        <div class="leer karte"><span class="emoji">🍳</span>
          <h2>Noch keine Gerichte</h2>
          <p>Trag ein paar Gerichte ein, die du gerne kochst, oder schalte unter „Mehr“ den Katalog ein.</p>
          <a class="knopf primaer" href="#/gericht/neu">Erstes Gericht eintragen</a>
        </div>`;
    }

    if (gerichte.length < MIN_GERICHTE) {
      html += `
        <div class="hinweis"><span class="emoji">📝</span><div>
          <p>Du hast erst ${gerichte.length} ${gerichte.length === 1 ? 'Gericht' : 'Gerichte'}. Mit ein paar mehr wird es abwechslungsreicher.</p>
          <a class="knopf klein rahmen" href="#/gericht/neu">Gericht eintragen</a>
        </div></div>`;
    }

    const { liste, eintrag: vorschlag } = aktuellerVorschlag();
    if (!vorschlag) {
      if (anzahlLikes && !filterAktiv()) {
        return html + `
          <div class="leer karte"><span class="emoji">♥</span>
            <h2>Das war die ganze Karte</h2>
            <p>Du hast heute ${anzahlLikes} ${anzahlLikes === 1 ? 'Gericht' : 'Gerichte'} gemerkt. Zeit zu entscheiden.</p>
            <a class="knopf primaer" href="#/likes">Zu deinen Likes</a>
            ${z.heute.ausgeschlossen.length ? '<p><button class="knopf still" data-aktion="ablehnungen-weg">Abgelehnte nochmal zeigen</button></p>' : ''}
          </div>`;
      }
      const nurAusgeschlossen = !filterAktiv() && z.heute.ausgeschlossen.length;
      return html + `
        <div class="leer karte"><span class="emoji">🤷</span>
          <h2>Nichts Passendes gefunden</h2>
          <p>${nurAusgeschlossen ? 'Du hast heute schon alle Gerichte abgelehnt.' : 'Mit diesen Filtern passt gerade kein Gericht.'}</p>
          ${nurAusgeschlossen
            ? '<button class="knopf primaer" data-aktion="ablehnungen-weg">Alle wieder zulassen</button>'
            : '<button class="knopf primaer" data-aktion="filter-weg">Filter zurücksetzen</button>'}
        </div>`;
    }

    const g = vorschlag.gericht;
    const index = lmIndex();
    // „Nr. 07“ wie auf einer Speisekarte: Position in der alphabetischen Gesamtliste
    const nr = [...gerichte].sort((a, b) => vergleich(a.name, b.name)).findIndex((x) => x.id === g.id) + 1;
    const kapitel = [`Nr. ${String(nr).padStart(2, '0')}`, g.zeit ? fmtZeit(g.zeit) : '', g.katalog ? 'Katalog' : 'Deine Karte']
      .filter(Boolean).map(esc).join(' · ');
    const gruende = vorschlag.gruende.length
      ? vorschlag.gruende.map((r) => `<li><span>${esc(r.text)}</span><span class="${r.punkte > 0 ? 'plus' : 'minus'}">${r.punkte > 0 ? '+' : '−'}${Math.abs(r.punkte)}</span></li>`).join('')
      : '<li><span>Keine Besonderheiten – neutrale Wahl</span><span>0</span></li>';
    const imHausText = vorschlag.imHaus
      ? `<p class="klein leise">${vorschlag.imHaus.fehlend.length ? `Fehlt noch: ${esc(vorschlag.imHaus.fehlend.map((id) => lmName(id, index)).join(', '))}` : 'Alles im Haus ✓'}</p>`
      : '';

    return html + karteHtml(g, {
      kapitel, rechts: 'like', links: 'nicht-heute', stempelJa: '♥ Gemerkt', stempelNein: 'Heute nicht', tiefe: liste.length,
    }) + `
      <div class="rund-knoepfe">
        <button class="rund nein" data-aktion="karte-nicht" aria-label="Nicht heute" title="Nicht heute">${ICON.nein}</button>
        <button class="rund anders" data-aktion="karte-anders" aria-label="Überspringen" title="Überspringen">${ICON.anders}</button>
        <button class="rund ja" data-aktion="karte-like" aria-label="Merken" title="Merken">${ICON.mag}</button>
      </div>
      <p class="rund-hinweis"><span>← nicht heute</span> · <span>überspringen</span> · <span>merken →</span></p>
      <p class="text-knopf"><button class="knopf klein rahmen" data-aktion="karte-essen">✓ Direkt nehmen: Das esse ich</button></p>
      <div class="details-vorschlag">
        ${imHausText}
        ${g.notizen ? `<p class="klein leise kursiv">${esc(g.notizen)}</p>` : ''}
        ${rezeptLink(g) ? `<p class="klein">${rezeptLink(g)}</p>` : ''}
        <details class="warum">
          <summary>Warum dieser Vorschlag?</summary>
          <ul>${gruende}
            <li><b>Punkte gesamt</b><b>${vorschlag.punkte}</b></li>
          </ul>
          <p class="leise">Chance unter ${liste.length} passenden Gerichten: ${Math.round(vorschlag.wahrscheinlichkeit * 100)} %</p>
        </details>
      </div>`;
  }

  // ---------- Ansicht: Likes ----------

  const LIKE_MODI = [['heute', 'Heute'], ['kuerzlich', 'Kürzlich'], ['alle', 'Alle']];
  const KUERZLICH_TAGE = 14;

  /** Gemerkte Gerichte je Zeitraum, das zuletzt gemerkte zuerst. */
  function likeListe(modus) {
    const heute = isoHeute();
    return Object.entries(z.likes)
      .map(([id, tage]) => ({ gericht: gerichtVon(id), tage: [...tage].sort() }))
      .filter((e) => e.gericht && e.tage.length)
      .filter((e) => {
        if (modus === 'heute') return e.tage.includes(heute);
        if (modus === 'kuerzlich') return e.tage.some((t) => { const d = V.tageZwischen(t, heute); return d >= 0 && d < KUERZLICH_TAGE; });
        return true;
      })
      .map((e) => ({ ...e, zuletzt: e.tage[e.tage.length - 1] }))
      .sort((a, b) => (a.zuletzt < b.zuletzt ? 1 : a.zuletzt > b.zuletzt ? -1 : b.tage.length - a.tage.length));
  }

  function ansichtLikes() {
    const modus = ui.likesModus;
    const liste = likeListe(modus);
    const titel = { heute: 'heute', kuerzlich: `in den letzten ${KUERZLICH_TAGE} Tagen`, alle: 'insgesamt' }[modus];
    let inhalt;
    if (!liste.length) {
      inhalt = `
        <div class="leer"><span class="emoji">♡</span>
          <h2>${modus === 'heute' ? 'Heute noch nichts gemerkt' : 'Noch keine Likes'}</h2>
          <p>Wische auf „Heute“ eine Karte nach rechts, um sie dir zu merken. Du kannst so viele merken, wie du willst.</p>
          <a class="knopf primaer" href="#/">Zur Abendkarte</a>
        </div>`;
    } else {
      inhalt = `
        ${liste.length > 1 ? `<button class="knopf primaer breit" data-aktion="runde-start">Durchswipen und entscheiden (${liste.length})</button>` : ''}
        <ul class="speisekarte likes-liste">${liste.map((e) => `
          <li><div class="zeile">
            <a class="text" href="#/gericht/${esc(e.gericht.id)}">
              <h3>${esc(e.gericht.name)}</h3>
              <div class="meta"><span>♥ ${e.tage.length}×</span><span>zuletzt ${wannText(e.zuletzt)}</span>${e.gericht.zeit ? `<span>${e.gericht.zeit}′</span>` : ''}</div>
            </a>
            <button class="knopf klein primaer" data-aktion="like-essen" data-id="${esc(e.gericht.id)}">Essen</button>
            <button class="rund klein-rund" data-aktion="like-weg" data-id="${esc(e.gericht.id)}" aria-label="${esc(e.gericht.name)} entfernen" title="Entfernen">${ICON.nein}</button>
          </div></li>`).join('')}
        </ul>`;
    }
    return `
      <header class="kopf mitte">
        <div class="kapitel">Deine Auswahl</div>
        <h1>Likes</h1>
      </header>
      <div class="segment" role="group" aria-label="Zeitraum">
        ${LIKE_MODI.map(([m, t]) => `<button aria-pressed="${modus === m}" data-aktion="likes-modus" data-wert="${m}">${t} (${likeListe(m).length})</button>`).join('')}
      </div>
      ${liste.length ? `<p class="leise klein" style="text-align:center;margin-top:-4px">${liste.length} ${liste.length === 1 ? 'Gericht' : 'Gerichte'} gemerkt ${titel}</p>` : ''}
      ${inhalt}`;
  }

  // ---------- Ansicht: Entscheidungsrunde ----------
  // Durch die gemerkten Gerichte wischen: rechts bleibt im Rennen, links fliegt raus.
  // Nach jeder Runde geht es mit den übrigen weiter, bis eins übrig ist.

  function rundeStarten(modus) {
    const ids = likeListe(modus).map((e) => e.gericht.id);
    ui.runde = { modus, alle: ids, stapel: [...ids], behalten: [], nr: 1, groesse: ids.length, gewinner: null };
    ui.karteNeu = true;
  }

  function rundeWeiter(behalten) {
    const r = ui.runde;
    const id = r.stapel.shift();
    if (behalten) r.behalten.push(id);
    if (!r.stapel.length) {
      if (r.behalten.length === 1) {
        r.gewinner = r.behalten[0];
      } else if (r.behalten.length === 0) {
        r.stapel = [...r.alle]; r.nr = 1; r.groesse = r.stapel.length;
        meldung('Alle raus – wir fangen nochmal von vorn an.');
      } else {
        const gleich = r.behalten.length === r.groesse;
        r.stapel = r.behalten; r.behalten = []; r.nr++; r.groesse = r.stapel.length;
        meldung(gleich ? `Alle behalten – sei diesmal etwas strenger 😉` : `Runde ${r.nr}: noch ${r.stapel.length} im Rennen`);
      }
    }
    render();
  }

  function ansichtRunde() {
    const r = ui.runde;
    if (!r || !r.alle.length) { location.replace('#/likes'); return ansichtLikes(); }
    if (r.gewinner) {
      const g = gerichtVon(r.gewinner);
      return `
        <header class="kopf mitte"><div class="kapitel">Entschieden</div><h1>Deine Wahl</h1></header>
        <section class="eingetragen einblenden"><div class="rahmen">
          <div class="emoji">${emojiFuer(g)}</div>
          <div class="kapitel">Heute Abend</div>
          <h1>${esc(g.name)}</h1>
          <p class="kursiv">${g.zeit ? fmtZeit(g.zeit) : 'Bon appétit'}</p>
          <div class="knopfreihe">
            <button class="knopf primaer" style="background:var(--messing-hell);color:var(--karte-tief)" data-aktion="runde-essen">Das esse ich</button>
            <button class="knopf still" data-aktion="runde-start" data-modus="${r.modus}">Nochmal</button>
          </div>
        </div></section>
        <p style="text-align:center"><a href="#/likes">‹ Zurück zu den Likes</a></p>`;
    }
    const g = gerichtVon(r.stapel[0]);
    const position = r.groesse - r.stapel.length + 1;
    return `
      <header class="kopf mitte">
        <div class="kapitel">Runde ${r.nr} · ${position} von ${r.groesse}</div>
        <h1>Was darf’s sein?</h1>
      </header>
      ${karteHtml(g, {
        kapitel: [g.zeit ? fmtZeit(g.zeit) : '', `♥ ${(z.likes[g.id] || []).length}×`].filter(Boolean).join(' · '),
        rechts: 'runde-ja', links: 'runde-nein', stempelJa: 'Bleibt', stempelNein: 'Raus', tiefe: r.stapel.length,
      })}
      <div class="rund-knoepfe">
        <button class="rund nein" data-aktion="runde-nein-knopf" aria-label="Raus" title="Raus">${ICON.nein}</button>
        <button class="rund anders" data-aktion="runde-essen" aria-label="Das esse ich" title="Das esse ich">${ICON.haken}</button>
        <button class="rund ja" data-aktion="runde-ja-knopf" aria-label="Bleibt im Rennen" title="Bleibt im Rennen">${ICON.mag}</button>
      </div>
      <p class="rund-hinweis"><span>← raus</span> · <span>✓ sofort nehmen</span> · <span>bleibt →</span></p>
      <p class="leise klein" style="text-align:center">${r.behalten.length ? `${r.behalten.length} im Rennen` : ''}</p>
      <p style="text-align:center"><a href="#/likes">Abbrechen</a></p>`;
  }

  /** Lässt die Karte zur Seite fliegen und führt danach die Aktion aus. */
  function karteWeg(richtung, aktion) {
    const karte = $('#spielkarte');
    if (!karte || matchMedia('(prefers-reduced-motion: reduce)').matches) { aktion(); return; }
    const ziel = {
      rechts: 'translate(130%, -20px) rotate(18deg)',
      links: 'translate(-130%, -20px) rotate(-18deg)',
      oben: 'translate(0, -60px) scale(0.92)',
    }[richtung];
    karte.classList.remove('zieht');
    karte.style.transform = ziel;
    karte.style.opacity = '0';
    ui.karteNeu = true;
    setTimeout(aktion, 220);
  }

  // Karte wischen: Die Karte sagt selbst (data-rechts / data-links), was passiert.
  function karteWischenEinrichten() {
    const SCHWELLE = 100;
    let zug = null;
    const stempel = (karte, dx) => {
      karte.querySelector('.stempel.ja').style.opacity = Math.max(0, Math.min(1, dx / 90));
      karte.querySelector('.stempel.nein').style.opacity = Math.max(0, Math.min(1, -dx / 90));
    };
    document.addEventListener('pointerdown', (e) => {
      const karte = e.target.closest('#spielkarte');
      if (!karte || e.target.closest('a, button') || e.button > 0) return;
      zug = { karte, x: e.clientX, y: e.clientY, dx: 0, aktiv: false, pid: e.pointerId };
    });
    document.addEventListener('pointermove', (e) => {
      if (!zug || e.pointerId !== zug.pid) return;
      const dx = e.clientX - zug.x;
      const dy = e.clientY - zug.y;
      if (!zug.aktiv) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { zug = null; return; }
        if (Math.abs(dx) < 8) return;
        zug.aktiv = true;
        zug.karte.classList.add('zieht');
        try { zug.karte.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      }
      zug.dx = dx;
      zug.karte.style.transform = `translate(${dx}px, ${dy * 0.15}px) rotate(${dx / 18 - 1}deg)`;
      stempel(zug.karte, dx);
    });
    const ende = (e) => {
      if (!zug || e.pointerId !== zug.pid) return;
      const { karte, dx, aktiv } = zug;
      zug = null;
      if (!aktiv) return;
      if (dx > SCHWELLE) { karteWeg('rechts', AKTIONEN[karte.dataset.rechts]); return; }
      if (dx < -SCHWELLE) { karteWeg('links', AKTIONEN[karte.dataset.links]); return; }
      karte.classList.remove('zieht');
      karte.style.transform = '';
      stempel(karte, 0);
    };
    document.addEventListener('pointerup', ende);
    document.addEventListener('pointercancel', ende);
  }

  function filterleisteHtml() {
    const f = z.filter;
    const optionen = ZEIT_OPTIONEN.map(([wert, text]) => `<option value="${wert}" ${f.maxZeit === wert ? 'selected' : ''}>${text}</option>`).join('');
    return `
      <div class="chips filterleiste" role="group" aria-label="Filter">
        <label class="chip ${f.maxZeit ? 'aktiv' : ''}"><span aria-hidden="true">⏱</span>
          <select data-eingabe="max-zeit" aria-label="Zubereitungszeit">${optionen}</select></label>
        <button class="chip" aria-pressed="${f.vegetarisch}" data-aktion="filter-veg">🌱 Vegetarisch</button>
        <button class="chip ${f.imHaus.length ? 'aktiv' : ''}" data-aktion="im-haus">🧺 Im Haus${f.imHaus.length ? ` (${f.imHaus.length})` : ''}</button>
        ${filterAktiv() ? '<button class="chip" data-aktion="filter-weg">✕ Zurücksetzen</button>' : ''}
      </div>`;
  }

  function vorschlagNeu() {
    z.heute.vorschlagId = null;
    z.heute.gezeigt = [];
    speichern();
  }

  // „Was habe ich im Haus?“ – Auswahl im Blatt
  function imHausBlatt() {
    blattOeffnen(`
      <div class="blatt-kopf"><h2 id="blatt-titel">Was hast du im Haus?</h2>
        <button class="knopf klein primaer" data-aktion="blatt-zu">Fertig</button></div>
      <p class="leise klein">Wähle aus, was da ist – Gerichte mit diesen Zutaten rücken nach vorne.</p>
      <div class="suche"><input type="search" placeholder="Zutat suchen …" data-eingabe="im-haus-suche" value="${esc(ui.imHausSuche)}" aria-label="Zutat suchen"></div>
      <div id="im-haus-inhalt">${imHausInhalt()}</div>`, () => { vorschlagNeu(); render(); });
  }

  function imHausInhalt() {
    const index = lmIndex();
    const gewaehlt = new Set(z.filter.imHaus);
    const q = such(ui.imHausSuche);
    let ids;
    if (q) {
      ids = alleLebensmittel().filter((l) => such(l.name).includes(q))
        .sort((a, b) => such(b.name).startsWith(q) - such(a.name).startsWith(q))
        .map((l) => l.id);
    } else {
      // Ohne Suche: Zutaten aus meinen Gerichten, die häufigsten zuerst
      const zaehler = new Map();
      vorschlagsGerichte().forEach((g) => g.zutaten.forEach((id) => zaehler.set(id, (zaehler.get(id) || 0) + 1)));
      ids = [...zaehler.keys()].sort((a, b) => zaehler.get(b) - zaehler.get(a) || vergleich(lmName(a, index), lmName(b, index)));
    }
    const knopf = (id) => `<button class="chip" aria-pressed="${gewaehlt.has(id)}" data-aktion="im-haus-umschalten" data-id="${esc(id)}">${esc(lmName(id, index))}</button>`;
    return `
      ${gewaehlt.size ? `<div class="feld-titel">Ausgewählt</div><div class="auswahl">${[...gewaehlt].map(knopf).join('')}</div>
        <p><button class="knopf klein still" data-aktion="im-haus-leeren">Alle entfernen</button></p>` : ''}
      <div class="feld-titel">${q ? 'Treffer' : 'Zutaten aus deinen Gerichten'}</div>
      <div class="scroll"><div class="auswahl">${ids.filter((id) => !gewaehlt.has(id)).slice(0, 80).map(knopf).join('') || '<span class="leise klein">Nichts gefunden.</span>'}</div></div>`;
  }

  // ---------- Ansicht: Gerichte ----------

  function ansichtGerichte() {
    const katalog = ui.gerichteQuelle === 'katalog';
    const beispiele = katalog ? 0 : z.gerichte.filter((g) => g.beispiel).length;
    const kategorien = ['', ...GERICHT_KATEGORIEN];
    const anzahl = katalog ? KATALOG.length : z.gerichte.length;
    return `
      <header class="kopf"><div>
        <div class="datum">${anzahl} ${anzahl === 1 ? 'Gericht' : 'Gerichte'}</div>
        <h1>${katalog ? 'Katalog' : 'Meine Karte'}</h1>
      </div></header>
      <div class="segment" role="group" aria-label="Quelle">
        <button aria-pressed="${!katalog}" data-aktion="gerichte-quelle" data-wert="meine">Meine (${z.gerichte.length})</button>
        <button aria-pressed="${katalog}" data-aktion="gerichte-quelle" data-wert="katalog">Katalog (${KATALOG.length})</button>
      </div>
      ${katalog ? `<p class="leise klein" style="margin-top:-6px">${z.einstellungen.katalog
        ? 'Diese Gerichte kommen zusätzlich zu deinen eigenen in die Vorschläge. Ausblenden oder als eigenes übernehmen kannst du sie in der Detailansicht.'
        : 'Der Katalog ist unter „Mehr“ ausgeschaltet und wird nicht vorgeschlagen.'}</p>` : ''}
      ${beispiele ? `
        <div class="hinweis"><span class="emoji">💡</span><div>
          <p>${beispiele} Beispielgerichte zeigen dir, wie die App funktioniert. Wenn du deine eigenen eingetragen hast, kannst du sie entfernen.</p>
          <button class="knopf klein rahmen" data-aktion="beispiele-weg">Beispiele löschen</button>
        </div></div>` : ''}
      <div class="suche"><input type="search" placeholder="Gericht oder Zutat suchen …" value="${esc(ui.gerichteSuche)}" data-eingabe="gerichte-suche" aria-label="Gerichte durchsuchen"></div>
      <div class="chips" role="group" aria-label="Kategorie">
        ${kategorien.map((k) => `<button class="chip" aria-pressed="${ui.gerichteFilter === k}" data-aktion="gerichte-filter" data-wert="${esc(k)}">${k ? esc(k) : 'Alle'}</button>`).join('')}
      </div>
      <div id="gerichte-liste">${gerichteListe()}</div>
      <a class="knopf primaer schwebeknopf" href="#/gericht/neu">＋ Neues Gericht</a>`;
  }

  function gerichteListe() {
    const index = lmIndex();
    const q = such(ui.gerichteSuche);
    const zuletzt = new Map();
    for (const e of z.verlauf) if (e.gerichtId && (!zuletzt.has(e.gerichtId) || e.datum > zuletzt.get(e.gerichtId))) zuletzt.set(e.gerichtId, e.datum);

    const quelle = ui.gerichteQuelle === 'katalog' ? KATALOG : z.gerichte;
    const liste = quelle
      .filter((g) => {
        if (ui.gerichteFilter === 'vegetarisch') {
          if (!(g.kategorien.includes('vegetarisch') || V.istVegetarisch(g, index))) return false;
        } else if (ui.gerichteFilter && !g.kategorien.includes(ui.gerichteFilter)) return false;
        if (!q) return true;
        return such(g.name).includes(q) || g.zutaten.some((id) => such(lmName(id, index)).includes(q));
      })
      .sort((a, b) => vergleich(a.name, b.name));

    if (!liste.length) {
      return quelle.length
        ? '<div class="leer"><span class="emoji">🔍</span><p>Kein Gericht passt zu deiner Suche.</p></div>'
        : '<div class="leer"><span class="emoji">🍳</span><h2>Noch leer hier</h2><p>Leg dein erstes Gericht an.</p></div>';
    }
    // Wie eine Speisekarte: Name, Zutaten kursiv, Zeit rechts
    return '<ul class="speisekarte">' + liste.map((g) => {
      const nicht = g.zutaten.filter((id) => z.bewertungen[id] === 'nicht').length;
      const marken = [
        zuletzt.has(g.id) ? `<span>zuletzt ${wannText(zuletzt.get(g.id))}</span>` : '',
        g.beispiel ? '<span class="marke">Beispiel</span>' : '',
        (z.likes[g.id] || []).length ? `<span>♥ ${z.likes[g.id].length}×</span>` : '',
        g.katalog && z.katalogAus.includes(g.id) ? '<span class="marke">ausgeblendet</span>' : '',
        nicht ? `<span class="marke warnung">${nicht}× magst du nicht</span>` : '',
      ].join('');
      return `
        <li><a href="#/gericht/${esc(g.id)}">
          ${g.foto ? `<div class="mini"><img src="${esc(g.foto)}" alt="" loading="lazy"></div>` : ''}
          <div class="text">
            <h3>${esc(g.name)}</h3>
            <div class="zutatenzeile">${esc(g.zutaten.map((id) => lmName(id, index)).join(', ')) || 'ohne Zutaten'}</div>
            ${marken.trim() ? `<div class="meta">${marken}</div>` : ''}
          </div>
          <span class="zeit">${g.zeit ? `${g.zeit}′` : ''}</span>
        </a></li>`;
    }).join('') + '</ul>';
  }

  // ---------- Ansicht: Gericht anlegen / bearbeiten ----------

  function ansichtKatalogGericht(id) {
    const g = KATALOG.find((x) => x.id === id);
    if (!g) return '<div class="leer"><span class="emoji">🤔</span><h2>Gericht nicht gefunden</h2><p><a href="#/gerichte">Zurück zur Liste</a></p></div>';
    const aus = z.katalogAus.includes(g.id);
    const gemerkt = (z.likes[g.id] || []).includes(isoHeute());
    return `
      <a class="zurueck" href="#/gerichte">‹ Katalog</a>
      <header class="kopf"><div>
        <div class="datum">Aus dem Katalog${g.zeit ? ' · ' + fmtZeit(g.zeit) : ''}</div>
        <h1>${esc(g.name)}</h1>
      </div></header>
      <section class="karte">
        <div class="feld-titel">Zutaten</div>
        <ul class="zutaten">${zutatenChips(g.zutaten)}</ul>
        ${g.kategorien.length ? `<p class="meta" style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 0">${g.kategorien.map((k) => `<span class="marke">${esc(k)}</span>`).join('')}</p>` : ''}
        <p class="klein">${rezeptLink(g)}</p>
        <div class="knopfreihe">
          <button class="knopf ${gemerkt ? 'rahmen' : 'primaer'}" data-aktion="katalog-like" data-id="${esc(g.id)}">${gemerkt ? '♥ Heute gemerkt' : '♡ Merken'}</button>
          <button class="knopf rahmen" data-aktion="gericht-heute" data-id="${esc(g.id)}">Heute essen</button>
        </div>
        <div class="knopfreihe" style="margin-top:10px">
          <button class="knopf" data-aktion="katalog-kopie" data-id="${esc(g.id)}">Als eigenes übernehmen</button>
          <button class="knopf still" data-aktion="katalog-aus" data-id="${esc(g.id)}">${aus ? 'Wieder vorschlagen' : 'Nicht vorschlagen'}</button>
        </div>
      </section>`;
  }

  function ansichtFormular(param) {
    if (param && param.startsWith('k-')) return ansichtKatalogGericht(param);
    const neu = param === 'neu';
    if (!ui.formular || ui.formular.id !== (neu ? '' : param)) {
      const vorhanden = neu ? null : gerichtVon(param);
      if (!neu && !vorhanden) {
        return '<div class="leer"><span class="emoji">🤔</span><h2>Gericht nicht gefunden</h2><p><a href="#/gerichte">Zurück zur Liste</a></p></div>';
      }
      ui.formular = vorhanden ? JSON.parse(JSON.stringify(vorhanden)) : leeresGericht();
      ui.formularNeu = {};
    }
    const f = ui.formular;
    return `
      <a class="zurueck" href="#/gerichte">‹ Gerichte</a>
      <header class="kopf"><h1>${neu ? 'Neues Gericht' : 'Gericht bearbeiten'}</h1></header>
      <form id="gericht-form" class="karte" novalidate>
        <label class="feld"><span>Name *</span>
          <input type="text" data-feld="name" value="${esc(f.name)}" placeholder="z. B. Ofengemüse mit Feta" required autocomplete="off"></label>

        <div class="feld">
          <span class="feld-titel">Zutaten</span>
          <ul class="zutaten" id="zutaten-gewaehlt" style="margin-bottom:8px">${formularZutatenHtml()}</ul>
          <div class="zutat-eingabe">
            <input type="text" id="zutat-eingabe" placeholder="Zutat suchen oder neu eingeben …" autocomplete="off" data-eingabe="zutat-suche" aria-label="Zutat hinzufügen">
            <ul class="vorschlaege" id="zutat-vorschlaege" hidden></ul>
          </div>
        </div>

        <div class="zeile2">
          <label class="feld"><span>Zubereitungszeit (Min.)</span>
            <input type="number" inputmode="numeric" min="0" step="5" data-feld="zeit" value="${f.zeit || ''}" placeholder="30"></label>
          <label class="feld"><span>Menge</span>
            <input type="text" data-feld="menge" value="${esc(f.menge)}" placeholder="2 Portionen"></label>
        </div>

        <div class="feld"><span class="feld-titel">Kategorie</span>
          <div class="auswahl">${GERICHT_KATEGORIEN.map((k) => `<button type="button" class="chip" aria-pressed="${f.kategorien.includes(k)}" data-aktion="form-kategorie" data-wert="${esc(k)}">${esc(k)}</button>`).join('')}</div>
        </div>

        <div class="feld"><span class="feld-titel">Foto</span>
          <div class="foto-feld" id="foto-feld">${fotoFeldHtml()}</div>
          <input type="file" id="foto-datei" accept="image/*" hidden data-eingabe="foto">
        </div>

        <label class="feld"><span>Rezept-Link</span>
          <input type="url" data-feld="link" value="${esc(f.link)}" placeholder="https://…" inputmode="url"></label>
        <label class="feld"><span>Notizen</span>
          <textarea data-feld="notizen" placeholder="Tipps, Varianten, Beilagen …">${esc(f.notizen)}</textarea></label>

        <button type="submit" class="knopf primaer breit">Speichern</button>
        ${neu ? '' : `
          <div class="knopfreihe" style="margin-top:10px">
            <button type="button" class="knopf rahmen" data-aktion="form-heute">Heute essen</button>
            <button type="button" class="knopf gefahr" data-aktion="form-loeschen">Löschen</button>
          </div>`}
      </form>`;
  }

  function formularZutatenHtml() {
    const index = lmIndex();
    if (!ui.formular.zutaten.length) return '<li class="leise klein">Noch keine Zutaten.</li>';
    return ui.formular.zutaten.map((id) => {
      const w = z.bewertungen[id];
      return `<li class="zutat ${w === 'mag' ? 'mag' : w === 'nicht' ? 'nicht' : ''}">${esc(lmName(id, index))}
        <button type="button" class="weg" data-aktion="zutat-weg" data-id="${esc(id)}" aria-label="${esc(lmName(id, index))} entfernen">×</button></li>`;
    }).join('');
  }

  function fotoFeldHtml() {
    const f = ui.formular;
    return `${bildHtml({ ...f, name: f.name || 'Neu' })}
      <div class="knopfreihe" style="flex-direction:column;flex:1">
        <button type="button" class="knopf klein rahmen" data-aktion="foto-waehlen">${f.foto ? 'Anderes Foto' : 'Foto wählen'}</button>
        ${f.foto ? '<button type="button" class="knopf klein still" data-aktion="foto-weg">Foto entfernen</button>' : ''}
      </div>`;
  }

  function zutatTreffer(text) {
    const q = such(text);
    if (!q) return [];
    const gewaehlt = new Set(ui.formular.zutaten);
    const alle = alleLebensmittel().filter((l) => !gewaehlt.has(l.id));
    const beginnt = alle.filter((l) => such(l.name).startsWith(q));
    const enthaelt = alle.filter((l) => !such(l.name).startsWith(q) && such(l.name).includes(q));
    return [...beginnt, ...enthaelt].slice(0, 8);
  }

  function zutatVorschlaegeZeigen() {
    const eingabe = $('#zutat-eingabe');
    const box = $('#zutat-vorschlaege');
    if (!eingabe || !box) return;
    const text = eingabe.value.trim();
    if (!text) { box.hidden = true; box.innerHTML = ''; return; }
    const treffer = zutatTreffer(text);
    const exakt = alleLebensmittel().some((l) => l.name.toLowerCase() === text.toLowerCase());
    box.innerHTML = treffer.map((l, i) => `<li><button type="button" class="${i === 0 ? 'markiert' : ''}" data-aktion="zutat-waehlen" data-id="${esc(l.id)}"><span>${esc(l.name)}</span><small class="leise">${esc(l.kategorie)}</small></button></li>`).join('')
      + (exakt ? '' : `<li><button type="button" class="${treffer.length ? '' : 'markiert'}" data-aktion="zutat-neu" data-name="${esc(text)}"><span>„${esc(text)}“ neu hinzufügen</span><small class="leise">＋</small></button></li>`);
    box.hidden = false;
  }

  function zutatHinzufuegen(id) {
    if (!ui.formular.zutaten.includes(id)) ui.formular.zutaten.push(id);
    const eingabe = $('#zutat-eingabe');
    eingabe.value = '';
    zutatVorschlaegeZeigen();
    $('#zutaten-gewaehlt').innerHTML = formularZutatenHtml();
    eingabe.focus();
  }

  /** Freie Eingabe: vorhandenes Lebensmittel nutzen oder ein neues vormerken. */
  function zutatAusText(text) {
    const name = text.trim().replace(/\s+/g, ' ');
    if (!name) return null;
    const vorhanden = alleLebensmittel().find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (vorhanden) return vorhanden.id;
    const id = 'eigen-' + slug(name);
    ui.formularNeu[id] = name.charAt(0).toUpperCase() + name.slice(1);
    return id;
  }

  function formularSpeichern() {
    const f = ui.formular;
    f.name = f.name.trim();
    if (!f.name) {
      meldung('Bitte gib dem Gericht einen Namen.');
      $('[data-feld="name"]').focus();
      return;
    }
    // Zutat, die noch im Eingabefeld steht, mitnehmen
    const rest = $('#zutat-eingabe').value;
    if (rest.trim()) { const id = zutatAusText(rest); if (id && !f.zutaten.includes(id)) f.zutaten.push(id); }

    // Neue Zutaten automatisch in die Lebensmittelliste aufnehmen
    const index = lmIndex();
    for (const id of f.zutaten) {
      if (!index.has(id) && ui.formularNeu[id]) {
        z.eigeneLebensmittel.push({ id, name: ui.formularNeu[id], kategorie: SONSTIGES });
      }
    }
    f.zeit = Number(f.zeit) || 0;
    f.link = f.link.trim();
    if (f.link && !/^https?:\/\//i.test(f.link)) f.link = 'https://' + f.link;
    f.beispiel = false; // wer ein Beispiel bearbeitet, übernimmt es als eigenes Gericht

    if (f.id) {
      z.gerichte = z.gerichte.map((g) => (g.id === f.id ? { ...f } : g));
      z.verlauf.forEach((e) => { if (e.gerichtId === f.id) e.titel = f.name; });
    } else {
      f.id = neueId();
      z.gerichte.push({ ...f });
    }
    speichern();

    const unbewertet = f.zutaten.filter((id) => !z.bewertungen[id]);
    ui.formular = null;
    ui.formularNeu = {};
    location.hash = '#/gerichte';
    meldung(`„${f.name}“ gespeichert`);
    if (unbewertet.length) {
      bewertungsBlatt(unbewertet, 'Neue Zutaten bewerten', 'Diese Zutaten hast du noch nicht bewertet. Wie findest du sie?');
    }
  }

  async function fotoVerkleinern(datei, max = 900) {
    const url = URL.createObjectURL(datei);
    try {
      const bild = await new Promise((ok, fehler) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = fehler;
        i.src = url;
      });
      const faktor = Math.min(1, max / Math.max(bild.naturalWidth, bild.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(bild.naturalWidth * faktor);
      c.height = Math.round(bild.naturalHeight * faktor);
      c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- Lebensmittel bewerten (Einrichtung & Blatt) ----------

  function lmZeile(l) {
    const w = z.bewertungen[l.id] || '';
    const knopf = (wert, klasse, label) =>
      `<button type="button" class="${klasse}" data-aktion="bewerten" data-id="${esc(l.id)}" data-wert="${wert}" aria-pressed="${w === wert}" aria-label="${esc(l.name)}: ${label}" title="${label}">${ICON[klasse === 'ja' ? 'mag' : klasse]}</button>`;
    return `
      <li class="lm" data-id="${esc(l.id)}" data-wert="${w}">
        <div class="lm-innen">
          <div class="lm-name">${esc(l.name)}${l.id.startsWith('eigen-') ? '<small>eigenes</small>' : ''}</div>
          <div class="dreier" role="group" aria-label="Bewertung für ${esc(l.name)}">
            ${knopf('nicht', 'nein', 'mag ich nicht')}${knopf('egal', 'egal', 'egal')}${knopf('mag', 'ja', 'mag ich')}
          </div>
        </div>
      </li>`;
  }

  function bewerte(id, wert) {
    z.bewertungen[id] = wert;
    speichern();
    document.querySelectorAll(`.lm[data-id="${CSS.escape(id)}"]`).forEach((li) => {
      li.dataset.wert = wert;
      li.querySelectorAll('[data-aktion="bewerten"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wert === wert)));
    });
    einrichtungsZahlenAktualisieren();
    if (ui.formular) $('#zutaten-gewaehlt') && ($('#zutaten-gewaehlt').innerHTML = formularZutatenHtml());
  }

  function bewertungsBlatt(ids, titel, text) {
    const index = lmIndex();
    const eintraege = ids.map((id) => index.get(id) || { id, name: id });
    blattOeffnen(`
      <div class="blatt-kopf"><h2 id="blatt-titel">${esc(titel)}</h2></div>
      <p class="leise klein">${esc(text)} Wische nach rechts für „mag ich“, nach links für „mag ich nicht“.</p>
      <div class="scroll"><ul class="lm-liste">${eintraege.map(lmZeile).join('')}</ul></div>
      <div class="einrichtung-fuss"><button class="knopf primaer breit" data-aktion="blatt-zu">Fertig</button></div>`);
  }

  function ansichtEinrichtung() {
    const ersterStart = !z.einrichtung.begruesst;
    return `
      <div class="einrichtung-kopf">
        ${ersterStart ? '' : '<a class="zurueck" href="#/einstellungen">‹ Mehr</a>'}
        <h1>Was magst du?</h1>
        <div class="zahlen" id="einr-zahlen">${einrichtungsZahlenHtml()}</div>
        <div class="fortschritt" style="margin-bottom:12px"><div id="einr-balken" style="width:${einrichtungsStand().prozent}%"></div></div>
        <div class="suche" style="margin-bottom:8px"><input type="search" placeholder="Lebensmittel suchen …" value="${esc(ui.einrSuche)}" data-eingabe="einr-suche" aria-label="Lebensmittel suchen"></div>
        <div class="chips" role="group" aria-label="Kategorie">
          <button class="chip" aria-pressed="${ui.einrNurOffen}" data-aktion="einr-offen">Nur offene</button>
          ${['', ...KATEGORIEN].map((k) => `<button class="chip" aria-pressed="${ui.einrKategorie === k}" data-aktion="einr-kategorie" data-wert="${esc(k)}">${k ? esc(k) : 'Alle'}</button>`).join('')}
        </div>
      </div>
      ${ersterStart ? `
        <div class="hinweis" style="margin-top:14px"><span class="emoji">👋</span><div>
          <p><b>Willkommen!</b> Sag mir kurz, was dir schmeckt. Wische ein Lebensmittel nach <b>rechts</b> für „mag ich“, nach <b>links</b> für „mag ich nicht“ – oder tippe auf die Knöpfe.</p>
          <p class="klein">Alles, was du nicht bewertest, gilt als „egal“. Du kannst jederzeit aufhören und später weitermachen.</p>
        </div></div>` : ''}
      <div id="einr-liste">${einrichtungsListe()}</div>
      <div class="einrichtung-fuss">
        <button class="knopf rahmen breit" data-aktion="eigenes-lm">＋ Eigenes Lebensmittel hinzufügen</button>
        <button class="knopf primaer breit" data-aktion="einr-fertig">Fertig – der Rest ist mir egal</button>
        <button class="knopf still breit" data-aktion="einr-spaeter">Später weitermachen</button>
      </div>`;
  }

  function einrichtungsZahlenHtml() {
    const s = einrichtungsStand();
    return `<span>${s.bewertet} von ${s.gesamt} bewertet</span><span>${s.mag} ♥ · ${s.nicht} ✕</span>`;
  }

  function einrichtungsZahlenAktualisieren() {
    const zahlen = $('#einr-zahlen');
    if (zahlen) zahlen.innerHTML = einrichtungsZahlenHtml();
    const balken = $('#einr-balken');
    if (balken) balken.style.width = einrichtungsStand().prozent + '%';
  }

  function einrichtungsListe() {
    const q = such(ui.einrSuche);
    const passend = alleLebensmittel().filter((l) =>
      (!ui.einrKategorie || l.kategorie === ui.einrKategorie)
      && (!q || such(l.name).includes(q))
      && (!ui.einrNurOffen || !z.bewertungen[l.id]));
    if (!passend.length) {
      return `<div class="leer"><span class="emoji">${ui.einrNurOffen ? '🎉' : '🔍'}</span>
        <p>${ui.einrNurOffen ? 'Hier ist alles bewertet.' : 'Nichts gefunden.'}</p>
        ${q ? `<button class="knopf rahmen" data-aktion="eigenes-lm" data-name="${esc(ui.einrSuche.trim())}">„${esc(ui.einrSuche.trim())}“ hinzufügen</button>` : ''}</div>`;
    }
    return KATEGORIEN.map((k) => {
      const inK = passend.filter((l) => l.kategorie === k);
      if (!inK.length) return '';
      return `<h2 class="kategorie-titel">${esc(k)}</h2><ul class="lm-liste">${inK.map(lmZeile).join('')}</ul>`;
    }).join('');
  }

  function eigenesLebensmittelBlatt(vorgabe = '') {
    blattOeffnen(`
      <div class="blatt-kopf"><h2 id="blatt-titel">Eigenes Lebensmittel</h2></div>
      <form id="lm-form">
        <label class="feld"><span>Name</span><input type="text" name="name" value="${esc(vorgabe)}" required autocomplete="off" placeholder="z. B. Pak Choi"></label>
        <label class="feld"><span>Kategorie</span><select class="eingabe" name="kategorie">
          ${KATEGORIEN.map((k) => `<option ${k === SONSTIGES ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
        <div class="knopfreihe">
          <button type="button" class="knopf still" data-aktion="blatt-zu">Abbrechen</button>
          <button type="submit" class="knopf primaer">Hinzufügen</button>
        </div>
      </form>`);
    setTimeout(() => $('#lm-form input').focus(), 50);
  }

  // Wischen: rechts = mag ich, links = mag ich nicht
  let wisch = null;
  const WISCH_SCHWELLE = 70;
  function wischenEinrichten() {
    document.addEventListener('pointerdown', (e) => {
      const innen = e.target.closest('.lm-innen');
      if (!innen || e.target.closest('button') || e.button > 0) return;
      wisch = { innen, li: innen.parentElement, x: e.clientX, y: e.clientY, dx: 0, aktiv: false, pid: e.pointerId };
    });
    document.addEventListener('pointermove', (e) => {
      if (!wisch || e.pointerId !== wisch.pid) return;
      const dx = e.clientX - wisch.x;
      const dy = e.clientY - wisch.y;
      if (!wisch.aktiv) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { wisch = null; return; }
        if (Math.abs(dx) < 10) return;
        wisch.aktiv = true;
        wisch.li.classList.add('zieht');
        try { wisch.innen.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      }
      wisch.dx = dx;
      wisch.innen.style.transform = `translateX(${dx}px)`;
      wisch.li.classList.toggle('zieht-rechts', dx > 0);
      wisch.li.classList.toggle('zieht-links', dx < 0);
    });
    const ende = (e) => {
      if (!wisch || e.pointerId !== wisch.pid) return;
      const { li, innen, dx, aktiv } = wisch;
      wisch = null;
      if (!aktiv) return;
      li.classList.remove('zieht');
      innen.style.transform = '';
      setTimeout(() => li.classList.remove('zieht-rechts', 'zieht-links'), 200);
      if (dx > WISCH_SCHWELLE) bewerte(li.dataset.id, 'mag');
      else if (dx < -WISCH_SCHWELLE) bewerte(li.dataset.id, 'nicht');
      if (navigator.vibrate && Math.abs(dx) > WISCH_SCHWELLE) navigator.vibrate(8);
    };
    document.addEventListener('pointerup', ende);
    document.addEventListener('pointercancel', ende);
  }

  // ---------- Ansicht: Verlauf ----------

  function ansichtVerlauf() {
    const modi = [['kalender', 'Kalender'], ['liste', 'Liste'], ['statistik', 'Statistik']];
    const inhalt = { kalender: verlaufKalender, liste: verlaufListe, statistik: verlaufStatistik }[ui.verlaufModus]();
    return `
      <header class="kopf"><div>
        <div class="datum">${z.verlauf.length} ${z.verlauf.length === 1 ? 'Eintrag' : 'Einträge'}</div>
        <h1>Verlauf</h1></div>
        <button class="knopf klein rahmen" data-aktion="eintrag-neu">＋ Eintrag</button>
      </header>
      <div class="segment" role="group" aria-label="Ansicht">
        ${modi.map(([m, t]) => `<button aria-pressed="${ui.verlaufModus === m}" data-aktion="verlauf-modus" data-wert="${m}">${t}</button>`).join('')}
      </div>
      ${inhalt}`;
  }

  function verlaufEmoji(e) {
    const g = e.gerichtId && gerichtVon(e.gerichtId);
    return g ? emojiFuer(g) : '🍽️';
  }

  function verlaufKalender() {
    const heute = isoHeute();
    const wochentag = (datumAus(heute).getDay() + 6) % 7; // 0 = Montag
    const start = isoPlus(heute, -wochentag - 35);        // 6 Wochen
    const nachDatum = new Map(z.verlauf.map((e) => [e.datum, e]));
    let zellen = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t) => `<div class="wt">${t}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const iso = isoPlus(start, i);
      const d = datumAus(iso);
      const e = nachDatum.get(iso);
      const zukunft = iso > heute;
      const nr = d.getDate() === 1 || i === 0 ? fmtTagMonat.format(d) : d.getDate();
      const klassen = ['tag', iso === heute ? 'heute' : '', zukunft ? 'zukunft' : '', e ? '' : 'leer-tag'].join(' ');
      zellen += `<button class="${klassen}" ${zukunft ? 'disabled' : `data-aktion="eintrag-bearbeiten" data-datum="${iso}"`}
        aria-label="${esc(fmtLang.format(d))}${e ? ': ' + esc(e.titel) : ''}">
        <span class="nr">${nr}</span>${e ? `<span class="em">${verlaufEmoji(e)}</span><span class="nm">${esc(e.titel)}</span>` : ''}</button>`;
    }
    return `<div class="kalender">${zellen}</div>
      <p class="leise klein" style="text-align:center">Tippe auf einen Tag, um nachträglich etwas einzutragen.</p>`;
  }

  function verlaufListe() {
    if (!z.verlauf.length) return verlaufLeer();
    const heute = isoHeute();
    const montag = (iso) => isoPlus(iso, -((datumAus(iso).getDay() + 6) % 7));
    const dieseWoche = montag(heute);
    let html = '';
    let letzteWoche = '';
    for (const e of [...z.verlauf].sort((a, b) => (a.datum < b.datum ? 1 : -1))) {
      const w = montag(e.datum);
      if (w !== letzteWoche) {
        const abstand = V.tageZwischen(w, dieseWoche) / 7;
        const titel = abstand === 0 ? 'Diese Woche' : abstand === 1 ? 'Letzte Woche' : `Woche ab ${fmtTagMonat.format(datumAus(w))}`;
        html += `${letzteWoche ? '</ul>' : ''}<div class="woche">${titel}</div><ul class="verlauf-liste">`;
        letzteWoche = w;
      }
      html += `<li><span class="em">${verlaufEmoji(e)}</span><div><div class="titel">${esc(e.titel)}</div><div class="wann">${esc(fmtKurz.format(datumAus(e.datum)))}${e.gerichtId && !gerichtVon(e.gerichtId) ? ' · Gericht gelöscht' : !e.gerichtId ? ' · einmalig' : ''}</div></div>
        <button class="knopf klein still" data-aktion="eintrag-bearbeiten" data-datum="${e.datum}">Ändern</button></li>`;
    }
    return html + '</ul>';
  }

  function verlaufLeer() {
    return `<div class="leer"><span class="emoji">📅</span><h2>Noch nichts eingetragen</h2>
      <p>Wenn du bei einem Vorschlag „Das esse ich“ tippst, landet er hier. Vergangene Tage kannst du nachtragen.</p>
      <button class="knopf primaer" data-aktion="eintrag-neu">Eintrag nachtragen</button></div>`;
  }

  function verlaufStatistik() {
    if (!z.verlauf.length) return verlaufLeer();
    const index = lmIndex();
    const heute = isoHeute();
    const letzte30 = z.verlauf.filter((e) => { const t = V.tageZwischen(e.datum, heute); return t >= 0 && t < 30; });
    const verschiedene = new Set(letzte30.map((e) => e.gerichtId || 'frei:' + e.titel.toLowerCase())).size;

    const gerichtZaehler = new Map();
    const zutatZaehler = new Map();
    for (const e of z.verlauf) {
      const schluessel = e.titel;
      gerichtZaehler.set(schluessel, (gerichtZaehler.get(schluessel) || 0) + 1);
      const g = e.gerichtId && gerichtVon(e.gerichtId);
      if (g) g.zutaten.forEach((id) => zutatZaehler.set(id, (zutatZaehler.get(id) || 0) + 1));
    }
    const balken = (paare) => {
      const max = paare.length ? paare[0][1] : 1;
      return `<ul class="balken">${paare.map(([name, n]) => `<li><span>${esc(name)}</span><span class="leise">${n}×</span><div class="b"><div style="width:${(n / max) * 100}%"></div></div></li>`).join('')}</ul>`;
    };
    const topGerichte = [...gerichtZaehler].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topZutaten = [...zutatZaehler].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => [lmName(id, index), n]);

    return `
      <div class="kennzahlen">
        <div class="kennzahl"><b>${letzte30.length}</b><span>Abende eingetragen (30 Tage)</span></div>
        <div class="kennzahl"><b>${verschiedene}</b><span>verschiedene Gerichte (30 Tage)</span></div>
        <div class="kennzahl"><b>${z.verlauf.length}</b><span>Einträge insgesamt</span></div>
      </div>
      <section class="abschnitt karte"><h2 style="margin-bottom:12px">Häufigste Gerichte</h2>${balken(topGerichte)}</section>
      <section class="abschnitt karte"><h2 style="margin-bottom:12px">Häufigste Zutaten</h2>
        ${topZutaten.length ? balken(topZutaten) : '<p class="leise">Noch keine Zutaten – einmalige Einträge zählen hier nicht mit.</p>'}</section>`;
  }

  function eintragEditor(datum) {
    const e = eintragAm(datum);
    ui.editor = {
      datum,
      modus: e && !e.gerichtId ? 'frei' : 'gericht',
      gerichtId: e ? e.gerichtId : null,
      titel: e && !e.gerichtId ? e.titel : '',
      suche: '',
      vorhanden: !!e,
    };
    blattOeffnen(`<div id="editor">${editorHtml()}</div>`);
  }

  function editorHtml() {
    const ed = ui.editor;
    const q = such(ed.suche);
    const gerichte = [...z.gerichte, ...KATALOG].sort((a, b) => vergleich(a.name, b.name)).filter((g) => !q || such(g.name).includes(q));
    return `
      <div class="blatt-kopf"><h2 id="blatt-titel">${ed.vorhanden ? 'Eintrag ändern' : 'Eintrag nachtragen'}</h2></div>
      <label class="feld"><span>Tag</span><input type="date" value="${ed.datum}" max="${isoHeute()}" data-eingabe="editor-datum"></label>
      <div class="segment" role="group" aria-label="Art des Eintrags">
        <button aria-pressed="${ed.modus === 'gericht'}" data-aktion="editor-modus" data-wert="gericht">Meine Gerichte</button>
        <button aria-pressed="${ed.modus === 'frei'}" data-aktion="editor-modus" data-wert="frei">Einmaliger Eintrag</button>
      </div>
      ${ed.modus === 'gericht' ? `
        <div class="suche"><input type="search" placeholder="Gericht suchen …" value="${esc(ed.suche)}" data-eingabe="editor-suche" aria-label="Gericht suchen"></div>
        <div class="scroll" id="editor-gerichte" style="max-height:34dvh"><div class="auswahl">
          ${gerichte.map((g) => `<button class="chip" aria-pressed="${ed.gerichtId === g.id}" data-aktion="editor-gericht" data-id="${esc(g.id)}">${emojiFuer(g)} ${esc(g.name)}</button>`).join('') || '<span class="leise klein">Kein Gericht gefunden.</span>'}
        </div></div>` : `
        <label class="feld"><span>Was gab es?</span><input type="text" value="${esc(ed.titel)}" data-eingabe="editor-titel" placeholder="z. B. Pizza beim Italiener" autocomplete="off"></label>`}
      <div class="knopfreihe" style="margin-top:16px">
        ${ed.vorhanden ? '<button class="knopf gefahr" data-aktion="editor-loeschen">Löschen</button>' : '<button class="knopf still" data-aktion="blatt-zu">Abbrechen</button>'}
        <button class="knopf primaer" data-aktion="editor-speichern">Speichern</button>
      </div>`;
  }

  // ---------- Ansicht: Einstellungen ----------

  function ansichtEinstellungen() {
    const s = einrichtungsStand();
    const beispiele = z.gerichte.filter((g) => g.beispiel).length;
    const istIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const installiert = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `
      <header class="kopf"><h1>Mehr</h1></header>
      <section class="abschnitt"><h2>Vorlieben</h2>
        <ul class="menue">
          <li><a href="#/einrichtung"><span>Lebensmittel bewerten</span><small>${s.bewertet}/${s.gesamt} · ${s.mag} ♥ · ${s.nicht} ✕ ›</small></a></li>
          <li><button data-aktion="eigenes-lm"><span>Eigenes Lebensmittel hinzufügen</span><small>›</small></button></li>
          <li><button data-aktion="katalog-umschalten" aria-pressed="${z.einstellungen.katalog}"><span>Katalog-Gerichte vorschlagen<br><small>${KATALOG.length} Gerichte, ausgeblendet: ${z.katalogAus.length}</small></span><small>${z.einstellungen.katalog ? 'An' : 'Aus'}</small></button></li>
        </ul>
      </section>
      <section class="abschnitt"><h2>Daten &amp; Backup</h2>
        <ul class="menue">
          <li><button data-aktion="export"><span>Backup exportieren</span><small>JSON-Datei</small></button></li>
          <li><label><span>Backup importieren</span><small>ersetzt alle Daten</small>
            <input type="file" accept="application/json,.json" hidden data-eingabe="import"></label></li>
          ${beispiele ? `<li><button data-aktion="beispiele-weg"><span>Beispielgerichte löschen</span><small>${beispiele}</small></button></li>` : ''}
          <li><button class="gefahr" data-aktion="alles-loeschen"><span>Alle Daten löschen</span></button></li>
        </ul>
        <p class="leise klein" style="margin:10px 4px">Alles bleibt nur auf diesem Gerät gespeichert – es gibt keinen Server und kein Konto. Exportiere ab und zu ein Backup, z. B. bevor du den Browser-Speicher leerst oder das Handy wechselst.</p>
      </section>
      <section class="abschnitt"><h2>App</h2>
        <ul class="menue">
          ${installiert ? '<li><span style="display:block;padding:16px">✓ Als App installiert</span></li>'
            : ui.installieren ? '<li><button data-aktion="installieren"><span>Auf dem Startbildschirm installieren</span><small>›</small></button></li>'
            : `<li><span style="display:block;padding:16px" class="klein">${istIos ? 'Zum Installieren: Teilen-Symbol antippen → „Zum Home-Bildschirm“.' : 'Zum Installieren im Browser-Menü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.'}</span></li>`}
        </ul>
        <p class="leise klein" style="margin:10px 4px">Was esse ich heute? · Version ${VERSION} · funktioniert auch offline</p>
      </section>`;
  }

  function exportieren() {
    const daten = { app: 'was-esse-ich-heute', version: VERSION, exportiert: new Date().toISOString(), daten: z };
    const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `was-esse-ich-heute-backup-${isoHeute()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    meldung('Backup wurde gespeichert');
  }

  async function importieren(datei) {
    try {
      const inhalt = JSON.parse(await datei.text());
      const daten = inhalt && inhalt.daten ? inhalt.daten : inhalt;
      if (!daten || !Array.isArray(daten.gerichte) || typeof daten.bewertungen !== 'object') {
        throw new Error('kein gültiges Backup');
      }
      const wann = inhalt.exportiert ? ` vom ${new Date(inhalt.exportiert).toLocaleDateString('de-DE')}` : '';
      const ok = confirm(`Backup${wann} laden?\n\n${daten.gerichte.length} Gerichte, ${(daten.verlauf || []).length} Verlaufseinträge.\nDeine aktuellen Daten werden dabei ersetzt.`);
      if (!ok) return;
      z = normalisieren(daten);
      z.einrichtung.begruesst = true;
      await sofortSpeichern();
      render();
      meldung('Backup wurde geladen');
    } catch (e) {
      meldung('Diese Datei ist kein gültiges Backup.');
    }
  }

  // ---------- Blatt (Dialog) & Meldungen ----------

  const blatt = $('#blatt');
  let blattBeimSchliessen = null;

  function blattOeffnen(html, beimSchliessen = null) {
    blatt.innerHTML = `<div class="blatt-innen"><div class="blatt-griff"></div>${html}</div>`;
    blattBeimSchliessen = beimSchliessen;
    if (!blatt.open) blatt.showModal();
  }

  // Alle Wege zum Schließen laufen hier durch – synchron, damit ein direkt
  // danach geöffnetes Blatt nicht vom (asynchronen) close-Ereignis gestört wird.
  function blattSchliessen() {
    if (!blatt.open) return;
    const f = blattBeimSchliessen;
    blattBeimSchliessen = null;
    blatt.close();
    if (f) f();
  }

  // Escape-Taste
  blatt.addEventListener('cancel', (e) => { e.preventDefault(); blattSchliessen(); });
  // Tippen neben das Blatt schließt es
  blatt.addEventListener('click', (e) => { if (e.target === blatt) blattSchliessen(); });

  let meldungTimer = null;
  function meldung(text, rueckgaengig) {
    const el = $('#meldung');
    el.innerHTML = `<span>${esc(text)}</span>${rueckgaengig ? '<button type="button">Rückgängig</button>' : ''}`;
    if (rueckgaengig) {
      el.querySelector('button').onclick = () => { rueckgaengig(); el.classList.remove('sichtbar'); };
    }
    el.classList.add('sichtbar');
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(() => el.classList.remove('sichtbar'), rueckgaengig ? 5000 : 2800);
  }

  // ---------- Aktionen ----------

  const AKTIONEN = {
    // Heute
    essen() {
      const id = z.heute.vorschlagId;
      const g = gerichtVon(id);
      if (!g) return;
      setzeEintrag(z.heute.datum, { gerichtId: id });
      render();
      meldung(`Guten Appetit! Ist eingetragen.`, () => { loescheEintrag(z.heute.datum); render(); });
    },
    anderer() {
      aktuellerVorschlag(true);
      render();
    },
    'nicht-heute'() {
      const id = z.heute.vorschlagId;
      if (!id) return;
      const vorher = { ...(z.rueckmeldungen[id] || { nichtHeute: 0 }) };
      z.rueckmeldungen[id] = { ...vorher, nichtHeute: (vorher.nichtHeute || 0) + 1 };
      z.heute.ausgeschlossen.push(id);
      z.heute.vorschlagId = null;
      speichern();
      render();
      meldung('Okay, heute nicht.', () => {
        z.rueckmeldungen[id] = vorher;
        z.heute.ausgeschlossen = z.heute.ausgeschlossen.filter((x) => x !== id);
        z.heute.vorschlagId = id;
        speichern();
        render();
      });
    },
    like() {
      const id = z.heute.vorschlagId;
      if (!id) return;
      const vorher = z.likes[id] ? [...z.likes[id]] : null;
      liken(id);
      z.heute.vorschlagId = null;
      render();
      meldung(`♥ Gemerkt – ${heuteGeliked().length} heute`, () => {
        if (vorher) z.likes[id] = vorher; else delete z.likes[id];
        z.heute.vorschlagId = id;
        speichern();
        render();
      });
    },
    'karte-like'() { karteWeg('rechts', AKTIONEN.like); },
    'karte-essen'() { karteWeg('oben', AKTIONEN.essen); },
    'karte-nicht'() { karteWeg('links', AKTIONEN['nicht-heute']); },
    'karte-anders'() { karteWeg('oben', AKTIONEN.anderer); },
    'heute-aendern'() {
      loescheEintrag(z.heute.datum);
      render();
    },
    'ablehnungen-weg'() {
      z.heute.ausgeschlossen = [];
      vorschlagNeu();
      render();
    },
    'filter-veg'() {
      z.filter.vegetarisch = !z.filter.vegetarisch;
      vorschlagNeu();
      render();
    },
    'filter-weg'() {
      z.filter = { maxZeit: 0, vegetarisch: false, imHaus: [] };
      vorschlagNeu();
      render();
    },
    'im-haus'() {
      ui.imHausSuche = '';
      imHausBlatt();
    },
    'im-haus-umschalten'(el) {
      const id = el.dataset.id;
      z.filter.imHaus = z.filter.imHaus.includes(id) ? z.filter.imHaus.filter((x) => x !== id) : [...z.filter.imHaus, id];
      speichern();
      $('#im-haus-inhalt').innerHTML = imHausInhalt();
    },
    'im-haus-leeren'() {
      z.filter.imHaus = [];
      speichern();
      $('#im-haus-inhalt').innerHTML = imHausInhalt();
    },

    // Gerichte
    // Likes & Entscheidungsrunde
    'likes-modus'(el) {
      ui.likesModus = el.dataset.wert;
      render();
    },
    'like-essen'(el) {
      const g = gerichtVon(el.dataset.id);
      setzeEintrag(isoHeute(), { gerichtId: g.id });
      location.hash = '#/';
      meldung(`Guten Appetit! ${g.name} ist eingetragen.`);
    },
    'like-weg'(el) {
      const id = el.dataset.id;
      const vorher = [...(z.likes[id] || [])];
      // In „Heute“ nur den heutigen Like entfernen, sonst alle
      const rest = ui.likesModus === 'heute' ? vorher.filter((t) => t !== isoHeute()) : [];
      if (rest.length) z.likes[id] = rest; else delete z.likes[id];
      speichern();
      render();
      meldung('Like entfernt', () => { z.likes[id] = vorher; speichern(); render(); });
    },
    'runde-start'(el) {
      rundeStarten(el.dataset.modus || ui.likesModus);
      if (location.hash === '#/runde') render(); else location.hash = '#/runde';
    },
    'runde-ja'() { rundeWeiter(true); },
    'runde-nein'() { rundeWeiter(false); },
    'runde-ja-knopf'() { karteWeg('rechts', AKTIONEN['runde-ja']); },
    'runde-nein-knopf'() { karteWeg('links', AKTIONEN['runde-nein']); },
    'runde-essen'() {
      const r = ui.runde;
      const id = r.gewinner || r.stapel[0];
      setzeEintrag(isoHeute(), { gerichtId: id });
      ui.runde = null;
      location.hash = '#/';
      meldung(`Guten Appetit! ${gerichtVon(id).name} ist eingetragen.`);
    },

    // Katalog
    'gerichte-quelle'(el) {
      ui.gerichteQuelle = el.dataset.wert;
      ui.gerichteFilter = '';
      render();
    },
    'katalog-like'(el) {
      const id = el.dataset.id;
      if ((z.likes[id] || []).includes(isoHeute())) {
        z.likes[id] = z.likes[id].filter((t) => t !== isoHeute());
        if (!z.likes[id].length) delete z.likes[id];
        speichern();
      } else {
        liken(id);
        meldung('♥ Gemerkt');
      }
      render();
    },
    'gericht-heute'(el) {
      const g = gerichtVon(el.dataset.id);
      setzeEintrag(isoHeute(), { gerichtId: g.id });
      location.hash = '#/';
      meldung(`${g.name} ist für heute eingetragen`);
    },
    'katalog-kopie'(el) {
      const g = gerichtVon(el.dataset.id);
      ui.formular = { ...leeresGericht(), ...JSON.parse(JSON.stringify(g)), id: '', katalog: false, link: '' };
      delete ui.formular.katalog;
      ui.formularNeu = {};
      location.hash = '#/gericht/neu';
      meldung('Passe das Gericht an und speichere es.');
    },
    'katalog-aus'(el) {
      const id = el.dataset.id;
      z.katalogAus = z.katalogAus.includes(id) ? z.katalogAus.filter((x) => x !== id) : [...z.katalogAus, id];
      if (z.heute.vorschlagId === id) z.heute.vorschlagId = null;
      speichern();
      render();
      meldung(z.katalogAus.includes(id) ? 'Wird nicht mehr vorgeschlagen' : 'Wird wieder vorgeschlagen');
    },
    'katalog-umschalten'() {
      z.einstellungen.katalog = !z.einstellungen.katalog;
      vorschlagNeu();
      render();
      meldung(z.einstellungen.katalog ? 'Katalog-Gerichte werden vorgeschlagen' : 'Nur noch eigene Gerichte');
    },

    'gerichte-filter'(el) {
      ui.gerichteFilter = el.dataset.wert;
      render();
    },
    'beispiele-weg'() {
      const vorher = z.gerichte;
      z.gerichte = z.gerichte.filter((g) => !g.beispiel);
      vorschlagNeu();
      render();
      meldung('Beispielgerichte gelöscht', () => { z.gerichte = vorher; vorschlagNeu(); render(); });
    },
    'form-kategorie'(el) {
      const k = el.dataset.wert;
      const liste = ui.formular.kategorien;
      ui.formular.kategorien = liste.includes(k) ? liste.filter((x) => x !== k) : [...liste, k];
      el.setAttribute('aria-pressed', String(ui.formular.kategorien.includes(k)));
    },
    'zutat-waehlen'(el) { zutatHinzufuegen(el.dataset.id); },
    'zutat-neu'(el) { const id = zutatAusText(el.dataset.name); if (id) zutatHinzufuegen(id); },
    'zutat-weg'(el) {
      ui.formular.zutaten = ui.formular.zutaten.filter((id) => id !== el.dataset.id);
      $('#zutaten-gewaehlt').innerHTML = formularZutatenHtml();
    },
    'foto-waehlen'() { $('#foto-datei').click(); },
    'foto-weg'() {
      ui.formular.foto = '';
      $('#foto-feld').innerHTML = fotoFeldHtml();
    },
    'form-heute'() {
      const f = ui.formular;
      setzeEintrag(isoHeute(), { gerichtId: f.id });
      meldung(`${f.name} ist für heute eingetragen`);
      location.hash = '#/';
    },
    'form-loeschen'() {
      const f = ui.formular;
      if (!confirm(`„${f.name}“ wirklich löschen?`)) return;
      const vorher = z.gerichte;
      z.gerichte = z.gerichte.filter((g) => g.id !== f.id);
      if (z.heute.vorschlagId === f.id) z.heute.vorschlagId = null;
      speichern();
      ui.formular = null;
      location.hash = '#/gerichte';
      meldung('Gericht gelöscht', () => { z.gerichte = vorher; speichern(); render(); });
    },

    // Bewertungen
    bewerten(el) { bewerte(el.dataset.id, el.dataset.wert); },
    'einr-kategorie'(el) {
      ui.einrKategorie = el.dataset.wert;
      el.parentElement.querySelectorAll('[data-aktion="einr-kategorie"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      $('#einr-liste').innerHTML = einrichtungsListe();
    },
    'einr-offen'(el) {
      ui.einrNurOffen = !ui.einrNurOffen;
      el.setAttribute('aria-pressed', String(ui.einrNurOffen));
      $('#einr-liste').innerHTML = einrichtungsListe();
    },
    'einr-fertig'() {
      z.einrichtung = { begruesst: true, abgeschlossen: true };
      speichern();
      location.hash = '#/';
      meldung('Danke! Deine Vorlieben sind gespeichert.');
    },
    'einr-spaeter'() {
      z.einrichtung.begruesst = true;
      speichern();
      location.hash = '#/';
      meldung('Du kannst jederzeit weitermachen.');
    },
    'eigenes-lm'(el) { eigenesLebensmittelBlatt(el.dataset.name || ''); },

    // Verlauf
    'verlauf-modus'(el) {
      ui.verlaufModus = el.dataset.wert;
      render();
    },
    'eintrag-neu'() {
      // Vorauswahl: der jüngste Tag ohne Eintrag (höchstens 30 Tage zurück)
      let tag = isoHeute();
      for (let i = 0; i < 30 && eintragAm(tag); i++) tag = isoPlus(tag, -1);
      eintragEditor(eintragAm(tag) ? isoHeute() : tag);
    },
    'eintrag-bearbeiten'(el) { eintragEditor(el.dataset.datum); },
    'editor-modus'(el) {
      ui.editor.modus = el.dataset.wert;
      $('#editor').innerHTML = editorHtml();
    },
    'editor-gericht'(el) {
      ui.editor.gerichtId = el.dataset.id;
      $('#editor-gerichte').querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    },
    'editor-speichern'() {
      const ed = ui.editor;
      if (!ed.datum || ed.datum > isoHeute()) { meldung('Bitte wähle einen Tag bis heute.'); return; }
      if (ed.modus === 'gericht' && !ed.gerichtId) { meldung('Bitte wähle ein Gericht aus.'); return; }
      if (ed.modus === 'frei' && !ed.titel.trim()) { meldung('Bitte trag ein, was es gab.'); return; }
      if (ed.modus === 'gericht') setzeEintrag(ed.datum, { gerichtId: ed.gerichtId });
      else setzeEintrag(ed.datum, { titel: ed.titel });
      blattSchliessen();
      render();
      meldung('Eintrag gespeichert');
    },
    'editor-loeschen'() {
      const datum = ui.editor.datum;
      const vorher = eintragAm(datum);
      loescheEintrag(datum);
      blattSchliessen();
      render();
      meldung('Eintrag gelöscht', () => { z.verlauf.push(vorher); speichern(); render(); });
    },

    // Einstellungen
    export() { exportieren(); },
    async installieren() {
      if (!ui.installieren) return;
      ui.installieren.prompt();
      await ui.installieren.userChoice;
      ui.installieren = null;
      render();
    },
    async 'alles-loeschen'() {
      if (!confirm('Wirklich alle Daten löschen? Gerichte, Bewertungen und Verlauf gehen verloren. Das lässt sich nicht rückgängig machen.')) return;
      z = neuerZustand();
      await sofortSpeichern();
      location.hash = '#/einrichtung';
      render();
      meldung('Alle Daten wurden gelöscht');
    },

    'blatt-zu'() { blattSchliessen(); },
  };

  // ---------- Ereignisse (zentral, per Delegation) ----------

  function ereignisseEinrichten() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-aktion]');
      if (!el || el.disabled) return;
      const aktion = AKTIONEN[el.dataset.aktion];
      if (!aktion) return;
      e.preventDefault();
      aktion(el, e);
    });

    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.feld && ui.formular) { ui.formular[el.dataset.feld] = el.value; return; }
      switch (el.dataset.eingabe) {
        case 'gerichte-suche': ui.gerichteSuche = el.value; $('#gerichte-liste').innerHTML = gerichteListe(); break;
        case 'einr-suche': ui.einrSuche = el.value; $('#einr-liste').innerHTML = einrichtungsListe(); break;
        case 'zutat-suche': zutatVorschlaegeZeigen(); break;
        case 'im-haus-suche': ui.imHausSuche = el.value; $('#im-haus-inhalt').innerHTML = imHausInhalt(); break;
        case 'editor-suche': {
          ui.editor.suche = el.value;
          const neu = document.createElement('div');
          neu.innerHTML = editorHtml();
          $('#editor-gerichte').replaceWith(neu.querySelector('#editor-gerichte'));
          break;
        }
        case 'editor-titel': ui.editor.titel = el.value; break;
        case 'editor-datum': ui.editor.datum = el.value; break;
        default:
      }
    });

    document.addEventListener('change', async (e) => {
      const el = e.target;
      switch (el.dataset.eingabe) {
        case 'max-zeit':
          z.filter.maxZeit = Number(el.value);
          vorschlagNeu();
          render();
          break;
        case 'foto':
          if (el.files[0]) {
            try {
              ui.formular.foto = await fotoVerkleinern(el.files[0]);
              $('#foto-feld').innerHTML = fotoFeldHtml();
            } catch (err) { meldung('Das Foto konnte nicht gelesen werden.'); }
          }
          el.value = '';
          break;
        case 'import':
          if (el.files[0]) await importieren(el.files[0]);
          el.value = '';
          break;
        default:
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'zutat-eingabe' && (e.key === 'Enter' || e.key === ',')) {
        e.preventDefault();
        const markiert = $('#zutat-vorschlaege .markiert');
        if (markiert) markiert.click();
        else if (e.target.value.trim()) { const id = zutatAusText(e.target.value); if (id) zutatHinzufuegen(id); }
      }
      if (e.target.id === 'zutat-eingabe' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const knoepfe = [...document.querySelectorAll('#zutat-vorschlaege button')];
        if (!knoepfe.length) return;
        e.preventDefault();
        const i = knoepfe.findIndex((b) => b.classList.contains('markiert'));
        const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + knoepfe.length) % knoepfe.length;
        knoepfe.forEach((b, j) => b.classList.toggle('markiert', j === n));
      }
    });

    document.addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.id === 'gericht-form') formularSpeichern();
      if (e.target.id === 'lm-form') {
        const daten = new FormData(e.target);
        const name = String(daten.get('name') || '').trim().replace(/\s+/g, ' ');
        if (!name) return;
        if (alleLebensmittel().some((l) => l.name.toLowerCase() === name.toLowerCase())) {
          meldung(`„${name}“ gibt es schon in der Liste.`);
          return;
        }
        const id = 'eigen-' + slug(name);
        z.eigeneLebensmittel.push({ id, name: name.charAt(0).toUpperCase() + name.slice(1), kategorie: String(daten.get('kategorie')) });
        speichern();
        blattSchliessen();
        meldung(`„${name}“ hinzugefügt`);
        if (aktuelleRoute().name === 'einrichtung') { ui.einrSuche = name; render(); } else render();
      }
    });

    // Klick außerhalb der Zutaten-Vorschläge schließt sie
    document.addEventListener('pointerdown', (e) => {
      const box = $('#zutat-vorschlaege');
      if (box && !box.hidden && !e.target.closest('.zutat-eingabe')) box.hidden = true;
    });

    window.addEventListener('hashchange', render);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sofortSpeichern();
      else if (z.heute.datum !== isoHeute() && aktuelleRoute().name === 'heute') render();
    });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      ui.installieren = e;
      if (aktuelleRoute().name === 'einstellungen') render();
    });
  }

  // ---------- Start ----------

  async function start() {
    await Speicher.oeffnen();
    const geladen = await Speicher.laden();
    z = geladen ? normalisieren(geladen) : neuerZustand();
    if (!geladen) await sofortSpeichern();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    ereignisseEinrichten();
    wischenEinrichten();
    karteWischenEinrichten();

    // Beim allerersten Start direkt zur Einrichtung
    if (!z.einrichtung.begruesst && !location.hash) location.replace('#/einrichtung');
    render();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  start();
})();
