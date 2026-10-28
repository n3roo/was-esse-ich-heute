/*
 * Gerichte-Katalog: rund 150 gängige Gerichte, die in Deutschland gern
 * gekocht werden – deutsche Klassiker, Italien, Asien, Mexiko, Orient,
 * Vegetarisches und Schnelles.
 *
 * Format pro Zeile:  'Name | Minuten | Kategorien | Zutaten-IDs'
 *   Kategorien: kommagetrennt (schnell, aufwendig, vegan, Ofen, Pfanne,
 *               Suppe & Eintopf, Salat, Resteverwertung)
 *   Zutaten:    IDs aus lebensmittel.js, mit Leerzeichen getrennt
 * „vegetarisch“ wird automatisch ergänzt, wenn kein Fleisch/Fisch dabei ist.
 *
 * Neue Gerichte einfach als Zeile ergänzen. Der Test prüft, dass alle
 * Zutaten in der Lebensmittelliste existieren.
 */
(function (global) {
  'use strict';

  const ZEILEN = [
    // ---------- Deutsche Klassiker ----------
    'Schnitzel mit Pommes | 30 | schnell, Pfanne | schweineschnitzel eier mehl pommes-frites zitronen',
    'Jägerschnitzel mit Spätzle | 40 | Pfanne | schweineschnitzel champignons sahne zwiebeln spaetzle',
    'Paprikaschnitzel mit Reis | 35 | Pfanne | schweineschnitzel paprika zwiebeln tomatenmark reis',
    'Rinderrouladen mit Rotkohl und Klößen | 150 | aufwendig | rinderrouladen speck gewuerzgurken senf zwiebeln rotkohl kartoffelknoedel',
    'Sauerbraten mit Klößen | 180 | aufwendig | rinderbraten essig rosinen zwiebeln kartoffelknoedel rotkohl',
    'Schweinebraten mit Knödeln und Krautsalat | 150 | aufwendig, Ofen | schweinebraten zwiebeln kuemmel bratensosse semmelknoedel weisskohl',
    'Königsberger Klopse | 60 | | hackfleisch-gemischt kapern sahne zitronen kartoffeln',
    'Frikadellen mit Kartoffelsalat | 45 | | hackfleisch-gemischt broetchen eier zwiebeln kartoffeln gewuerzgurken mayonnaise',
    'Hackbraten mit Kartoffelpüree | 75 | Ofen | hackfleisch-gemischt eier zwiebeln kartoffeln milch butter',
    'Kartoffelpuffer mit Apfelmus | 35 | Pfanne | kartoffeln eier zwiebeln apfelmus',
    'Bratkartoffeln mit Spiegelei | 25 | schnell, Pfanne, Resteverwertung | kartoffeln speck zwiebeln eier',
    'Kassler mit Sauerkraut und Püree | 40 | | kassler sauerkraut kartoffeln milch butter',
    'Currywurst mit Pommes | 20 | schnell | bratwurst ketchup currypulver pommes-frites',
    'Leberkäse mit Spiegelei und Bratkartoffeln | 25 | schnell, Pfanne | leberkaese eier kartoffeln zwiebeln',
    'Weißwürste mit Brezn und süßem Senf | 15 | schnell | weisswurst broetchen senf',
    'Gulasch mit Bandnudeln | 120 | aufwendig | rindergulasch zwiebeln paprikapulver tomatenmark paprika bandnudeln',
    'Gulaschsuppe | 90 | Suppe & Eintopf | rindergulasch kartoffeln paprika zwiebeln paprikapulver',
    'Erbsensuppe mit Würstchen | 60 | Suppe & Eintopf | schaelerbsen kartoffeln karotten wiener-wuerstchen speck',
    'Kartoffelsuppe mit Würstchen | 45 | Suppe & Eintopf | kartoffeln karotten lauch knollensellerie wiener-wuerstchen majoran',
    'Hühnersuppe mit Nudeln | 60 | Suppe & Eintopf | haehnchenschenkel karotten knollensellerie lauch nudeln petersilie',
    'Grünkohl mit Kassler und Bratkartoffeln | 90 | aufwendig | gruenkohl kassler bratwurst kartoffeln zwiebeln senf',
    'Maultaschen in Brühe | 20 | schnell, Suppe & Eintopf | maultaschen fleischbruehe schnittlauch',
    'Geschmälzte Maultaschen | 20 | schnell, Pfanne | maultaschen zwiebeln eier butter',
    'Schupfnudeln mit Sauerkraut | 25 | schnell, Pfanne | schupfnudeln sauerkraut speck zwiebeln',
    'Flammkuchen | 30 | Ofen | pizzateig creme-fraiche speck zwiebeln',
    'Zwiebelkuchen | 90 | Ofen, aufwendig | mehl zwiebeln speck schmand eier kuemmel',
    'Pfannkuchen mit Apfelmus | 25 | schnell, Pfanne | mehl eier milch apfelmus',
    'Kaiserschmarrn | 30 | Pfanne | mehl eier milch rosinen butter zucker apfelmus',
    'Milchreis mit Kirschen | 35 | | milchreis milch zimt kirschen zucker',
    'Himmel und Erde | 40 | | kartoffeln aepfel zwiebeln speck bratwurst',
    'Senfeier mit Kartoffeln | 30 | schnell | eier senf sahne kartoffeln',
    'Grüne Soße mit Eiern und Kartoffeln | 30 | schnell | eier kartoffeln schmand joghurt petersilie schnittlauch dill',
    'Spargel mit Hollandaise und Schinken | 40 | | spargel sauce-hollandaise schinken kartoffeln',
    'Matjes mit Pellkartoffeln | 25 | schnell | matjes kartoffeln saure-sahne aepfel zwiebeln',
    'Fischstäbchen mit Kartoffelpüree | 25 | schnell | fischstaebchen kartoffeln milch butter erbsen',
    'Backfisch mit Kartoffelsalat | 40 | | seelachs mehl eier kartoffeln essig zwiebeln',
    'Forelle Müllerin mit Petersilienkartoffeln | 35 | | forelle butter mehl zitronen kartoffeln petersilie',
    'Strammer Max | 10 | schnell | brot schinken eier butter',
    'Toast Hawaii | 20 | schnell, Ofen | toastbrot schinken ananas gouda',
    'Kohlrouladen | 90 | aufwendig | weisskohl hackfleisch-gemischt zwiebeln reis tomatenmark',
    'Gefüllte Paprika mit Reis | 60 | Ofen | paprika hackfleisch-gemischt reis zwiebeln passierte-tomaten',
    'Rahmspinat mit Spiegelei und Kartoffeln | 25 | schnell | spinat sahne eier kartoffeln knoblauch',
    'Kohlrabi in Rahmsoße mit Kartoffeln | 35 | | kohlrabi sahne kartoffeln muskat',
    'Blumenkohl mit Käsesoße | 35 | | blumenkohl milch butter mehl gouda kartoffeln',
    'Rosenkohl-Auflauf | 50 | Ofen | rosenkohl kartoffeln sahne gouda speck',
    'Kartoffelgratin | 60 | Ofen | kartoffeln sahne knoblauch emmentaler muskat',
    'Wurstsalat mit Brot | 15 | schnell, Salat | fleischwurst gewuerzgurken zwiebeln essig brot',
    'Kartoffelsalat mit Würstchen | 40 | | kartoffeln gewuerzgurken mayonnaise zwiebeln wiener-wuerstchen',
    'Ente mit Rotkohl und Klößen | 150 | aufwendig, Ofen | ente rotkohl kartoffelknoedel aepfel',
    'Schweinefilet im Speckmantel mit Bohnen | 40 | | schweinefilet speck gruene-bohnen kartoffeln',
    'Steak mit Kräuterbutter und Ofenkartoffeln | 40 | | rindersteak butter petersilie knoblauch kartoffeln',
    'Putengeschnetzeltes mit Reis | 30 | | putenbrust champignons sahne zwiebeln reis',
    'Zürcher Geschnetzeltes mit Rösti | 40 | | kalbfleisch champignons sahne weisswein kartoffeln',
    'Pilzpfanne mit Semmelknödeln | 30 | Pfanne | champignons pfifferlinge sahne zwiebeln semmelknoedel petersilie',
    'Arme Ritter | 15 | schnell, Resteverwertung | toastbrot eier milch zimt zucker',
    'Abendbrot mit Käse und Aufschnitt | 10 | schnell | brot butter gouda salami gurke tomaten',
    'Raclette-Kartoffeln | 30 | Ofen | kartoffeln raclettekaese schinken gewuerzgurken',

    // ---------- Italien ----------
    'Spaghetti Carbonara | 20 | schnell | spaghetti speck eier parmesan pfeffer',
    'Spaghetti aglio e olio | 15 | schnell, vegan | spaghetti knoblauch olivenoel chilischoten petersilie',
    'Lasagne | 90 | Ofen, aufwendig | lasagneplatten rinderhack passierte-tomaten zwiebeln milch butter mehl parmesan',
    'Gemüselasagne | 80 | Ofen | lasagneplatten zucchini aubergine paprika passierte-tomaten mozzarella ricotta',
    'Penne all’arrabbiata | 20 | schnell, vegan | penne passierte-tomaten knoblauch chilischoten olivenoel',
    'Pasta mit Pesto Genovese | 15 | schnell | nudeln pesto parmesan pinienkerne',
    'Spaghetti mit Tomatensoße | 20 | schnell | spaghetti passierte-tomaten zwiebeln knoblauch basilikum parmesan',
    'Tortellini in Sahnesoße mit Schinken | 20 | schnell | tortellini sahne schinken erbsen parmesan',
    'Lachs-Spinat-Pasta | 25 | schnell | bandnudeln lachs spinat sahne knoblauch',
    'Pasta mit Thunfisch-Tomatensoße | 20 | schnell | penne thunfisch passierte-tomaten zwiebeln kapern',
    'Pilzrisotto | 40 | | risottoreis champignons zwiebeln parmesan weisswein gemuesebruehe butter',
    'Spargelrisotto | 40 | | risottoreis spargel parmesan weisswein gemuesebruehe',
    'Kürbisrisotto | 45 | | risottoreis kuerbis parmesan gemuesebruehe zwiebeln thymian',
    'Pizza Margherita | 30 | Ofen | pizzateig passierte-tomaten mozzarella basilikum',
    'Pizza Salami | 30 | Ofen | pizzateig passierte-tomaten mozzarella salami',
    'Gemüsepizza | 35 | Ofen | pizzateig passierte-tomaten mozzarella paprika champignons zucchini',
    'Gnocchi in Gorgonzolasoße | 20 | schnell | gnocchi gorgonzola sahne walnuesse',
    'Ofen-Gnocchi mit Tomaten und Mozzarella | 30 | Ofen | gnocchi kirschtomaten mozzarella basilikum',
    'Saltimbocca mit Rosmarinkartoffeln | 35 | | kalbfleisch schinken salbei weisswein kartoffeln rosmarin',
    'Minestrone | 50 | Suppe & Eintopf, vegan | karotten knollensellerie zucchini weisse-bohnen nudeln passierte-tomaten lauch',
    'Caprese mit Ciabatta | 10 | schnell, Salat | tomaten mozzarella basilikum olivenoel brot',
    'Melanzane alla parmigiana | 75 | Ofen | aubergine passierte-tomaten mozzarella parmesan basilikum',
    'Spaghetti mit Muscheln | 30 | | spaghetti muscheln knoblauch weisswein petersilie',
    'Polenta mit Pilzragout | 40 | | polenta champignons pfifferlinge sahne zwiebeln parmesan',
    'Ofenfeta mit Nudeln | 35 | Ofen | feta kirschtomaten knoblauch olivenoel nudeln basilikum',
    'Spinat-Ricotta-Cannelloni | 60 | Ofen | cannelloni spinat ricotta passierte-tomaten mozzarella',
    'Bandnudeln mit Pfifferlingen | 25 | schnell | bandnudeln pfifferlinge sahne zwiebeln petersilie parmesan',

    // ---------- Asien & Indien ----------
    'Gebratener Reis mit Ei | 20 | schnell, Pfanne, Resteverwertung | reis eier erbsen karotten fruehlingszwiebeln sojasosse',
    'Gebratene Nudeln mit Hähnchen | 25 | schnell, Pfanne | mie-nudeln haehnchenbrust paprika karotten sojasosse fruehlingszwiebeln',
    'Pad Thai mit Garnelen | 30 | Pfanne | reisnudeln garnelen eier sojasprossen erdnuesse limetten fischsosse',
    'Thai-Curry mit Hähnchen | 30 | | haehnchenbrust kokosmilch currypaste paprika zuckerschoten basmatireis',
    'Rotes Gemüsecurry mit Tofu | 30 | vegan | tofu kokosmilch currypaste brokkoli paprika basmatireis',
    'Hähnchen süß-sauer | 35 | Pfanne | haehnchenbrust ananas paprika zwiebeln essig ketchup reis',
    'Teriyaki-Lachs mit Reis | 25 | schnell | lachs sojasosse honig ingwer reis brokkoli',
    'Butter Chicken | 45 | | haehnchenbrust tomatenmark sahne butter ingwer knoblauch basmatireis',
    'Chicken Tikka Masala | 50 | | haehnchenbrust joghurt passierte-tomaten sahne ingwer currypulver basmatireis',
    'Dal mit Reis | 35 | vegan | rote-linsen kokosmilch kurkuma kreuzkuemmel tomaten basmatireis',
    'Kichererbsen-Spinat-Curry | 30 | vegan | kichererbsen spinat kokosmilch tomaten currypulver basmatireis',
    'Ramen mit Ei | 40 | Suppe & Eintopf | mie-nudeln eier pak-choi fruehlingszwiebeln sojasosse fleischbruehe',
    'Sushi-Bowl mit Lachs | 25 | schnell | lachs reis avocado gurke sojasosse sesam',
    'Bibimbap | 45 | | reis rinderhack spinat karotten sojasprossen eier sesam',
    'Sommerrollen mit Erdnusssoße | 35 | vegan | reisnudeln kopfsalat karotten gurke minze erdnussbutter',
    'Gebratener Tofu mit Pak Choi | 25 | schnell, vegan, Pfanne | tofu pak-choi sojasosse ingwer knoblauch reis',
    'Erdnuss-Hähnchen mit Reis | 30 | | haehnchenbrust erdnussbutter kokosmilch sojasosse limetten reis',
    'Mapo Tofu | 25 | | tofu rinderhack chiliflocken sojasosse knoblauch reis',
    'Süßkartoffel-Curry | 35 | vegan | suesskartoffel kokosmilch rote-linsen spinat currypaste reis',
    'Tofu-Gemüse-Pfanne mit Reis | 25 | schnell, vegan, Pfanne | raeuchertofu brokkoli karotten paprika sojasosse reis',
    'Rindfleisch mit Brokkoli | 25 | schnell, Pfanne | rindersteak brokkoli sojasosse knoblauch ingwer reis',
    'Hähnchen-Gemüse-Pfanne | 25 | schnell, Pfanne | haehnchenbrust zucchini paprika zwiebeln reis',

    // ---------- Mexiko & USA ----------
    'Chili con Carne | 60 | Suppe & Eintopf | rinderhack kidneybohnen mais passierte-tomaten zwiebeln paprika chilischoten',
    'Chili sin Carne | 50 | vegan, Suppe & Eintopf | kidneybohnen schwarze-bohnen mais paprika passierte-tomaten zwiebeln suesskartoffel',
    'Burritos mit Bohnen und Reis | 30 | | tortillas schwarze-bohnen reis mais gouda saure-sahne',
    'Tacos mit Hackfleisch | 25 | schnell | tortillas rinderhack tomaten eisbergsalat gouda saure-sahne',
    'Quesadillas | 20 | schnell, Pfanne | tortillas gouda paprika mais kidneybohnen',
    'Fajitas mit Hähnchen | 30 | Pfanne | tortillas haehnchenbrust paprika zwiebeln saure-sahne avocado',
    'Enchiladas mit Hähnchen | 50 | Ofen | tortillas haehnchenbrust passierte-tomaten kidneybohnen gouda',
    'Burger mit Pommes | 35 | | burgerbroetchen rinderhack tomaten eisbergsalat gouda zwiebeln pommes-frites',
    'Hot Dogs | 15 | schnell | broetchen wiener-wuerstchen senf ketchup zwiebeln gewuerzgurken',
    'Mac and Cheese | 30 | Ofen | nudeln gouda milch butter mehl',
    'Ofenhähnchen mit Kartoffeln | 60 | Ofen | haehnchenschenkel kartoffeln paprikapulver rosmarin knoblauch',
    'Caesar Salad mit Hähnchen | 25 | Salat | roemersalat haehnchenbrust parmesan brot eier',
    'Hähnchenbrust mit Ofengemüse | 40 | Ofen | haehnchenbrust suesskartoffel paprika rote-zwiebeln rosmarin',

    // ---------- Mittelmeer & Orient ----------
    'Gyros mit Tsatsiki und Reis | 30 | | gyrosfleisch joghurt gurke knoblauch reis zwiebeln',
    'Döner-Teller | 25 | schnell | doener-fleisch fladenbrot tomaten rotkohl joghurt zwiebeln',
    'Falafel mit Hummus | 40 | vegan | kichererbsen petersilie koriander kreuzkuemmel fladenbrot hummus tomaten',
    'Shakshuka | 25 | schnell, Pfanne | eier passierte-tomaten paprika zwiebeln kreuzkuemmel fladenbrot',
    'Couscous-Salat mit Feta | 20 | schnell, Salat | couscous gurke tomaten feta minze zitronen',
    'Bulgur-Pfanne mit Gemüse | 25 | schnell, Pfanne, vegan | bulgur zucchini paprika tomatenmark zwiebeln',
    'Moussaka | 90 | Ofen, aufwendig | aubergine hackfleisch-gemischt kartoffeln passierte-tomaten milch butter mehl zimt',
    'Halloumi mit Ofengemüse | 40 | Ofen | halloumi zucchini paprika rote-zwiebeln kirschtomaten olivenoel',
    'Lahmacun | 40 | Ofen | pizzateig rinderhack tomatenmark paprika zwiebeln petersilie zitronen',
    'Ratatouille | 60 | vegan | aubergine zucchini paprika tomaten zwiebeln knoblauch thymian',
    'Paella | 60 | aufwendig | risottoreis garnelen haehnchenschenkel paprika erbsen chorizo kurkuma',
    'Tortilla de patatas | 40 | Pfanne | kartoffeln eier zwiebeln olivenoel',
    'Gazpacho mit Brot | 20 | schnell, vegan, Suppe & Eintopf | tomaten gurke paprika knoblauch olivenoel brot',
    'Lammkoteletts mit Bohnen | 30 | | lammfleisch gruene-bohnen knoblauch rosmarin kartoffeln',
    'Börek mit Spinat und Feta | 50 | Ofen | blaetterteig spinat feta eier zwiebeln',
    'Hähnchen-Souvlaki mit Pita | 35 | | haehnchenbrust fladenbrot joghurt gurke tomaten zitronen oregano',

    // ---------- Frankreich & Fisch ----------
    'Quiche Lorraine | 70 | Ofen | mehl butter eier sahne speck emmentaler',
    'Gemüsequiche mit Ziegenkäse | 70 | Ofen | mehl butter eier sahne brokkoli lauch ziegenkaese',
    'Croque Monsieur | 15 | schnell, Ofen | toastbrot schinken emmentaler milch butter',
    'Coq au Vin | 90 | aufwendig | haehnchenschenkel rotwein champignons speck zwiebeln karotten',
    'Französische Zwiebelsuppe | 50 | Suppe & Eintopf | zwiebeln fleischbruehe weisswein brot emmentaler',
    'Ofenlachs mit Gemüse | 30 | Ofen | lachs brokkoli kirschtomaten zitronen kartoffeln dill',
    'Fischfilet mit Senfsoße | 30 | | seelachs senf sahne kartoffeln dill',
    'Garnelen in Knoblauchöl mit Brot | 15 | schnell, Pfanne | garnelen knoblauch olivenoel chilischoten brot petersilie',
    'Thunfischsalat | 10 | schnell, Salat | thunfisch kopfsalat tomaten gurke eier mais',
    'Fischsuppe | 45 | Suppe & Eintopf | kabeljau garnelen fenchel tomaten weisswein knoblauch',

    // ---------- Vegetarisch, Suppen & Salate ----------
    'Buddha Bowl | 25 | vegan | quinoa kichererbsen suesskartoffel avocado spinat tahini',
    'Gefüllte Zucchini mit Feta und Reis | 50 | Ofen | zucchini feta reis tomaten zwiebeln',
    'Spinatknödel mit Parmesan | 40 | | broetchen spinat eier milch parmesan butter',
    'Linsen-Bolognese | 40 | vegan | rote-linsen spaghetti passierte-tomaten karotten knollensellerie zwiebeln',
    'Kartoffel-Lauch-Suppe | 35 | Suppe & Eintopf | kartoffeln lauch sahne gemuesebruehe',
    'Tomatensuppe mit Käsetoast | 30 | Suppe & Eintopf | tomaten passierte-tomaten sahne basilikum toastbrot gouda',
    'Kürbissuppe | 40 | Suppe & Eintopf, vegan | kuerbis kokosmilch ingwer zwiebeln gemuesebruehe',
    'Brokkoli-Cremesuppe | 30 | Suppe & Eintopf | brokkoli sahne kartoffeln gemuesebruehe',
    'Ofengemüse mit Kräuterquark | 45 | Ofen | kartoffeln karotten paprika zucchini rote-zwiebeln quark schnittlauch',
    'Gemüse-Frittata | 25 | schnell, Pfanne, Resteverwertung | eier paprika zucchini zwiebeln feta',
    'Feldsalat mit Ziegenkäse und Walnüssen | 15 | schnell, Salat | feldsalat ziegenkaese walnuesse honig birnen',
    'Rote-Bete-Salat mit Feta | 15 | schnell, Salat | rote-bete feta walnuesse rucola',
    'Nudelsalat | 25 | Salat | nudeln erbsen mais mayonnaise gewuerzgurken schinken',
    'Zucchinipuffer mit Joghurt-Dip | 30 | Pfanne | zucchini eier mehl feta joghurt knoblauch',
    'Spinat-Lasagne | 70 | Ofen | lasagneplatten spinat ricotta mozzarella passierte-tomaten',
    'Gemüsesuppe mit Grießklößchen | 45 | Suppe & Eintopf | karotten lauch knollensellerie erbsen gemuesebruehe eier',
    'Kartoffel-Spinat-Curry | 35 | vegan | kartoffeln spinat kokosmilch currypulver tomaten zwiebeln',
    'Linsensalat mit Feta | 30 | Salat | linsen feta paprika rote-zwiebeln petersilie essig',
    'Kichererbsen-Pfanne mit Spinat | 20 | schnell, Pfanne, vegan | kichererbsen spinat tomaten knoblauch kreuzkuemmel fladenbrot',
    'Champignon-Rahmgeschnetzeltes mit Nudeln | 25 | schnell | champignons sahne zwiebeln bandnudeln petersilie',
  ];

  const L = typeof module !== 'undefined' && module.exports ? require('./lebensmittel.js') : global.Lebensmittel;
  const kategorieVon = new Map(L.LEBENSMITTEL.map((l) => [l.id, l.kategorie]));

  const GERICHTE_KATALOG = ZEILEN.map((zeile) => {
    const [name, zeit, kategorien, zutaten] = zeile.split('|').map((s) => s.trim());
    const z = zutaten.split(/\s+/).filter(Boolean);
    const kat = kategorien.split(',').map((s) => s.trim()).filter(Boolean);
    const fleisch = z.some((id) => ['Fleisch', 'Fisch'].includes(kategorieVon.get(id)));
    if (!fleisch && !kat.includes('vegetarisch')) kat.push('vegetarisch');
    return {
      id: 'k-' + L.slug(name),
      name,
      zeit: Number(zeit) || 0,
      kategorien: kat,
      zutaten: z,
      menge: '', notizen: '', link: '', foto: '',
      katalog: true,
    };
  });

  const exporte = { GERICHTE_KATALOG };
  if (typeof module !== 'undefined' && module.exports) module.exports = exporte;
  else global.Katalog = exporte;
})(typeof window !== 'undefined' ? window : globalThis);
