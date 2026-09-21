/* palette.js — die Farben des Demonstrators, an EINER Stelle.
 *
 * WARUM ES DIESE DATEI GIBT
 * Der Demonstrator lief bis zum 19.08.2026 nur auf dunklem Grund. Fuer die
 * Projektion im Hoersaal ist das unbrauchbar: ein Beamer wirft Licht, kein
 * Dunkel. Also gibt es zwei Fassungen — und damit sie nicht auseinander
 * laufen, stehen beide hier und nirgends sonst. Vorher lagen 185 feste
 * Farbwerte verstreut in style.css, zeichnen.js, kacheln.js, bahn.js und
 * raum3d.js.
 *
 * DER GRUNDSATZ, DER BEIDE FASSUNGEN VERBINDET (Regel C-1)
 * Farbe sagt das BAUTEIL, Helligkeit sagt den WERT. Der Wert laeuft immer
 * von "wenig Abstand zum Grund" nach "viel Abstand zum Grund":
 *
 *     auf dunklem Grund:  kleiner Wert = dunkel, grosser Wert = hell
 *     auf hellem Grund:   kleiner Wert = blass,  grosser Wert = dunkel
 *
 * Das ist KEINE Umkehrung des Grundsatzes, sondern seine Anwendung. Wer die
 * helle Fassung mit den Zahlen der dunklen einfaerbt, dreht jede Aussage um,
 * ohne dass ein Pruefer anschlaegt — deshalb steht es hier so ausfuehrlich.
 *
 * DIE AUSWAHLFARBE
 * In der dunklen Fassung ist die Auswahl gelb (#ffc000, 11,5:1 auf dem
 * dunklen Grund). Auf Weiss hat dasselbe Gelb 1,64:1 und ist unlesbar.
 * Entscheidung des Anwenders vom 19.08.2026: in der hellen Fassung tritt
 * Bernstein #b45309 an seine Stelle (5,02:1). Der Gedanke von Regel C-1
 * bleibt damit erhalten — die Auswahl ist die einzige WARME Farbe, alle
 * Bauteilfamilien sind kalt. Nur der Farbwert haengt jetzt an der Fassung.
 *
 * WIE DIE HELLEN FARBEN ENTSTANDEN SIND
 * Nicht gewaehlt, sondern gesucht. Die Farbtoene der Familien aus Regel C-1a
 * wurden festgehalten, Helligkeit und Buntheit so bestimmt, dass der
 * KLEINSTE Abstand zwischen zwei Bauteilfamilien moeglichst gross wird —
 * denn dieser kleinste Abstand entscheidet, ob im Bild zwei Bauteile
 * verwechselt werden. Ergebnis, gemessen als Delta E im CIE-Lab-Raum:
 *
 *     helle Fassung    dE 21,2   (Messwert gegen Aufmerksamkeit)
 *     dunkle Fassung   dE 11,3   (Query gegen Feedforward)
 *
 * Die dunkle Fassung ist in diesem Punkt also schon heute schwach; sie
 * wurde bewusst NICHT mitgeaendert, weil dafuer keine Abnahme vorliegt.
 * Vermerkt als offener Punkt in REGELN.md.
 *
 * DAS BLASSE ENDE
 * Die unterste Stufe liegt bei 1,37:1 gegen Weiss, nicht bei 1,13:1.
 * Angehoben auf Wunsch des Anwenders (20.08.2026): ein Beamer verliert
 * genau dieses Ende zuerst, weil Streulicht im Hoersaal die hellen Toene
 * anhebt. Aus fuenf Abstufungen wuerden sonst drei.
 */
var PALETTE = (function () {
  "use strict";

  // ── Die Marke. Gilt in beiden Fassungen unveraendert (Regel C-2). ───────
  var MARKE = {
    cyan: "#01aeed",
    teal: "#1482ac",
    blau: "#045273",
    tief: "#0a6189",
    tiefHover: "#0c76a8"
  };

  // ── Die Bauteilfamilien. Fuenf Stufen, aufsteigend nach Wert. ──────────
  // Stufe 0 = kleinster Wert (tritt zurueck), Stufe 4 = groesster Wert.
  var FAMILIEN_DUNKEL = {
    wert:        ["#0d3b5e", "#0a6189", "#0e9ba8", "#01aeed", "#7a6ff0"],
    query:       ["#1e1b4b", "#312e81", "#4f46e5", "#818cf8", "#c7d2fe"],
    key:         ["#0a3330", "#134e4a", "#0d9488", "#2dd4bf", "#99f6e4"],
    value:       ["#082f49", "#0a6189", "#01aeed", "#5cc8f5", "#bae6fd"],
    feedforward: ["#2e1065", "#4c1d95", "#7c3aed", "#a78bfa", "#ddd6fe"],
    attention:   ["#0f2a4a", "#1d4ed8", "#3b82f6", "#93c5fd", "#dbeafe"],
    strom:       ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1"],
    auswahl:     ["#332600", "#665000", "#997300", "#cc9a00", "#ffc000"]
  };

  var FAMILIEN_HELL = {
    wert:        ["#ccdef7", "#a0c1e8", "#679acd", "#005585", "#033e63"],
    query:       ["#dad8ff", "#b5b7ff", "#808cfa", "#5469d6", "#1a3583"],
    key:         ["#c1e4de", "#8ec9c0", "#4ea499", "#007369", "#00453e"],
    value:       ["#c4e2ec", "#92c6d8", "#50a0b8", "#007289", "#004253"],
    feedforward: ["#e5d7f6", "#cbb5e7", "#a58acc", "#614988", "#443262"],
    attention:   ["#d1dcff", "#a7bdf8", "#6e95e2", "#4172be", "#053b72"],
    strom:       ["#dadde1", "#babec6", "#9096a0", "#595f68", "#373c42"],
    auswahl:     ["#ffd1b2", "#feab79", "#e17b39", "#b45309", "#6b2500"]
  };

  /** Wie das Bauteil im Text heisst — damit Legende und Erklaerung denselben
   *  Namen benutzen wie das Bild. */
  var FAMILIENNAME = {
    wert: "Messwert", query: "Query (Frage)", key: "Key (Schlüssel)",
    value: "Value (Wert)", feedforward: "Feedforward",
    attention: "Aufmerksamkeit", strom: "Residualstrom",
    auswahl: "Auswahl"
  };

  // ── Die Oberflaechenfarben. Namen sind die der CSS-Variablen. ──────────
  //
  // Die `*-rgb`-Werte sind Zahlentripel ohne Klammern. Damit kann die CSS
  // eine Farbe mit beliebiger Deckkraft bilden — `rgb(var(--marke-rgb) / .12)`
  // — ohne dass fuer jede Deckkraft eine eigene Variable noetig waere. Vorher
  // standen dort 32 verschiedene feste rgba-Werte.
  var TOKEN_DUNKEL = {
    "--bg": "#0d1117",
    "--bg-card": "#161b22",
    "--bg-elev": "#1c232d",
    "--rand": "#283039",
    "--text": "#e6edf3",
    "--text-muted": "#8b949e",
    "--text-schwach": "#78838f",
    "--text-id": "#a9b4bf",
    // Schrift auf den Markenflaechen (--primary-deep). Regel C-2: weisse
    // Schrift nie auf --cyan, sondern auf --primary-deep.
    //
    // Fuer Schrift auf einer eingefaerbten WERTFLAECHE gibt es hier bewusst
    // keinen Wert: dort haengt die Entscheidung am Wert der Flaeche und
    // kippt mit der Fassung. Das rechnet PALETTE.schriftAuf(t).
    "--auf-marke": "#ffffff",
    "--auf-cyan": "#04202c",
    "--schatten": "0 2px 20px -12px #000",
    "--glow": "0 0 34px -12px rgb(1 174 237 / 0.5)",
    "--gruen": "#55a730",
    "--magenta": "#c81164",
    "--wahl": "#ffc000",
    "--marke-rgb": "1 174 237",
    "--wahl-rgb": "255 192 0",
    "--gruen-rgb": "85 167 48",
    "--magenta-rgb": "200 17 100",
    "--rand-rgb": "40 48 57",
    "--karte-rgb": "22 27 34",
    "--elev-rgb": "28 35 45",
    "--grund-rgb": "13 17 23",
    "--muted-rgb": "139 148 158",
    // Der abgesetzte Grund im grossen Bild (Feld der Aufmerksamkeit).
    "--feld": "#111a24",
    "--knopf": "#4d5966",
    // DIE SCHRIFT IN DEN DIAGRAMMEN. Sie steht auf Flaechen, die von blass
    // bis satt reichen, also kann keine Farbe darauf durchgehend lesbar
    // sein. Loesung seit dem 13.08.2026: EINE Schriftfarbe mit einer
    // Kontur in der Gegenfarbe, `paint-order: stroke fill`. In der hellen
    // Fassung kehren sich beide um — dunkle Schrift, helle Kontur.
    "--diagrammtext": "#ffffff",
    "--diagrammtext-kontur": "rgb(6 9 13 / .85)",
    // Die Ziffern der Rechenschritte, farbig durchlaufend.
    "--schritt-2": "#4b2a8a",
    "--schritt-3": "#a51a6b",
    "--schritt-4": "#ef6c2a"
  };

  var TOKEN_HELL = {
    "--bg": "#ffffff",
    "--bg-card": "#f6f8fa",
    "--bg-elev": "#eef1f5",
    "--rand": "#d0d7de",
    "--text": "#1c2128",
    "--text-muted": "#57606a",
    "--text-schwach": "#6e7781",
    "--text-id": "#57606a",
    "--auf-marke": "#ffffff",
    "--auf-cyan": "#04202c",
    "--schatten": "0 2px 18px -12px rgb(27 31 36 / .45)",
    "--glow": "0 0 30px -14px rgb(1 174 237 / 0.45)",
    // #55a730 hat auf Weiss 3,02:1 und traegt keine Schrift; #2f7d32 hat
    // 4,63:1. Dieselbe Farbfamilie, nur hoersaaltauglich.
    "--gruen": "#2f7d32",
    "--magenta": "#c81164",
    "--wahl": "#b45309",
    "--marke-rgb": "1 174 237",
    "--wahl-rgb": "180 83 9",
    "--gruen-rgb": "47 125 50",
    "--magenta-rgb": "200 17 100",
    "--rand-rgb": "208 215 222",
    "--karte-rgb": "246 248 250",
    "--elev-rgb": "238 241 245",
    "--grund-rgb": "255 255 255",
    "--muted-rgb": "87 96 106",
    "--feld": "#eef3f9",
    "--knopf": "#8b95a1",
    // Umgekehrt zur dunklen Fassung: dunkle Schrift, helle Kontur.
    "--diagrammtext": "#10161d",
    "--diagrammtext-kontur": "rgb(255 255 255 / .92)",
    // Dieselben Farbtoene, auf Weiss tragfaehig gemacht:
    // #4b2a8a → 4,6:1 wird zu #5b21b6 (8,0:1), #a51a6b → #a11250 (7,2:1),
    // #ef6c2a hatte 3,07:1 und traegt keine weisse Ziffer — #b45309 hat 5,02:1.
    "--schritt-2": "#5b21b6",
    "--schritt-3": "#a11250",
    "--schritt-4": "#b45309"
  };

  // Die Marke steht in beiden Saetzen gleich — einmal eingetragen statt
  // zweimal abgetippt.
  [TOKEN_DUNKEL, TOKEN_HELL].forEach(function (t) {
    t["--cyan"] = MARKE.cyan;
    t["--teal"] = MARKE.teal;
    t["--blau"] = MARKE.blau;
    t["--primary-deep"] = MARKE.tief;
    t["--primary-deep-hover"] = MARKE.tiefHover;
    t["--grad-accent"] = "linear-gradient(90deg, " + MARKE.cyan + " 0%, " +
      MARKE.teal + " 100%)";
  });

  // DIE MARKE ALS SCHRIFT — ein eigener Wert, und zwar aus Notwendigkeit.
  //
  // #01aeed hat auf dem dunklen Grund 7,46:1 und ist dort eine gute
  // Schriftfarbe. Auf Weiss hat DASSELBE Cyan 2,54:1 und ist unlesbar. Als
  // Flaeche, Rand oder Reglerfarbe bleibt es trotzdem richtig — dort traegt
  // es keine Schrift.
  //
  // Deshalb zwei Werte: --cyan fuer Flaechen und Raender, --marke-text fuer
  // alles, was gelesen werden muss. In der dunklen Fassung sind beide
  // gleich; nur in der hellen laufen sie auseinander.
  TOKEN_DUNKEL["--marke-text"] = MARKE.cyan;   // 7,46:1 auf #0d1117
  TOKEN_HELL["--marke-text"] = MARKE.tief;     // 6,81:1 auf #ffffff

  // DIE SCHRIFT AUF EINER BAUTEILFARBE. Sie kippt mit der Fassung, weil die
  // Erkennungsfarben es tun: auf dunklem Grund sind sie HELL (#2dd4bf und
  // ihresgleichen) und tragen dunkle Schrift, auf hellem sind sie DUNKEL
  // (#007369) und tragen helle. Ein fester Wert waere in einer der beiden
  // Fassungen zwangslaeufig falsch.
  TOKEN_DUNKEL["--auf-fam"] = "#04202c";
  TOKEN_HELL["--auf-fam"] = "#ffffff";

  // ── Die ERKENNUNGSFARBE eines Bauteils ─────────────────────────────────
  //
  // Nicht zu verwechseln mit dem Verlauf darueber. Der Verlauf traegt den
  // WERT; die Erkennungsfarbe traegt das BAUTEIL und steht dort, wo kein
  // Wert im Spiel ist: in der Ueberschrift einer Station, im Punkt der
  // Stationsleiste, im Rand einer Kachel, in den Baendern des grossen
  // Bildes.
  //
  // Sie ist NICHT einfach eine Stufe des Verlaufs. Beim ersten Umbau hatte
  // ich sie aus Stufe 4 abgeleitet — damit wurde in der dunklen Fassung aus
  // Value #22d3ee ploetzlich #5cc8f5 und aus Aufmerksamkeit #2f81f7 ein
  // #93c5fd. Beides waeren stille Aenderungen an einer Fassung, fuer die
  // keine Abnahme vorliegt. Deshalb stehen die dunklen Werte hier
  // unveraendert so, wie sie seit dem 12.08.2026 gelten.
  var ERKENNUNG_DUNKEL = {
    res: "#94a3b8", q: "#818cf8", k: "#2dd4bf",
    v: "#22d3ee", att: "#2f81f7", ff: "#a78bfa"
  };
  // In der hellen Fassung sind es die tragenden Stufen der hellen
  // Verlaeufe — sie sind auf weissem Grund gemessen worden.
  var ERKENNUNG_HELL = {
    res: "#595f68", q: "#5469d6", k: "#007369",
    v: "#007289", att: "#4172be", ff: "#614988"
  };

  // Welche Familie zu welchem Kurzzeichen gehoert.
  var KURZ = { res: "strom", q: "query", k: "key", v: "value",
               att: "attention", ff: "feedforward" };

  function famTokenSetzen(ziel, familien, erkennung) {
    Object.keys(KURZ).forEach(function (kurz) {
      var stufen = familien[KURZ[kurz]];
      ziel["--fam-" + kurz] = erkennung[kurz];
      ziel["--fam-" + kurz + "-blass"] = stufen[1];
      // Als Zahlentripel, damit die CSS daraus eine Farbe mit beliebiger
      // Deckkraft bilden kann: rgb(var(--fam-att-rgb) / .55).
      ziel["--fam-" + kurz + "-rgb"] = zerlegen(erkennung[kurz]).join(" ");
    });
  }
  famTokenSetzen(TOKEN_DUNKEL, FAMILIEN_DUNKEL, ERKENNUNG_DUNKEL);
  famTokenSetzen(TOKEN_HELL, FAMILIEN_HELL, ERKENNUNG_HELL);

  // ── Skalen und Sonderfarben der Zeichner ───────────────────────────────
  //
  // HITZE ist die Skala der Aufmerksamkeitsfelder. Sie laeuft nicht nur ueber
  // die Helligkeit, sondern auch ueber den FARBTON — eine einfarbige Skala
  // laesst sich mit dem Auge schlecht in Stufen zerlegen. Die Reihenfolge
  // der Toene bleibt in beiden Fassungen dieselbe (blau → violett → magenta
  // → warm); nur die Helligkeit laeuft umgekehrt.
  //
  // ZWEISEITIG ist die Skala fuer Groessen mit Vorzeichen. Ihre Mitte ist
  // die Null und muss deshalb dort liegen, wo NICHTS zu sehen ist: auf
  // dunklem Grund im Dunkel, auf hellem Grund im Weiss. Sie steht als
  // ERSTES ELEMENT in `zweiMinus` UND `zweiPlus` — und muss in beiden
  // dieselbe sein, sonst haette die Null zwei Farben und die Skala einen
  // Sprung mitten hindurch. Beide Pole sind kalt (Teal negativ, Indigo
  // positiv) — Regel C-1, damit die Auswahl die einzige warme Farbe bleibt.
  var ZEICHNER_DUNKEL = {
    hitze:     ["#111823", "#123a63", "#4b2a8a", "#a51a6b", "#ef6c2a", "#ffc61a"],
    zweiMinus: ["#12161c", "#134e4a", "#0d9488", "#2dd4bf"],
    zweiPlus:  ["#12161c", "#312e81", "#4f46e5", "#818cf8"],
    leer:      "rgba(38,46,56,0.5)",
    maskiert:  "rgba(20,24,30,0.5)",
    gitterleer: "rgba(40,48,57,0.35)",
    gesperrt:  "rgba(255,255,255,0.05)",
    raus:      "rgba(90,100,112,0.5)",
    knoten:    "#5b7cfa",
    markiert:  "#fff3cd",
    // Das Feedforward hat ZWEI Straenge, die nebeneinander stehen und
    // auseinanderzuhalten sein muessen: `gate` sagt, OB ein Neuron
    // durchkommt, `up` sagt, WAS es beitragen wuerde.
    gate:      "#d946ef",
    up:        "#34d399",
    // Der Bedeutungsraum in 3D. Er zeichnet auf eine eigene Leinwand mit
    // eigenem Hintergrund, also braucht er auch seinen eigenen Grund und
    // sein eigenes Gitter — die CSS-Variablen erreichen ihn nicht.
    raum: {
      grund: "#0d1117", gitter: "#283039", gitter2: "#1c232d",
      satz: "#01aeed", nachbar: "#55a730", hintergrund: "#39434f",
      satzText: "#8ad8f5", nachbarText: "#9bd47c", hintergrundText: "#8b949e"
    }
  };

  var ZEICHNER_HELL = {
    hitze:     ["#f4f7fb", "#a9c6e6", "#9a86cf", "#c2508c", "#a8481f", "#5e2b00"],
    zweiMinus: ["#f2f5f8", "#8ec9c0", "#2f9c8d", "#00584f"],
    zweiPlus:  ["#f2f5f8", "#b5b7ff", "#6b74e8", "#2b2d78"],
    leer:      "rgba(226,231,237,0.55)",
    maskiert:  "rgba(233,237,242,0.75)",
    gitterleer: "rgba(208,215,222,0.40)",
    gesperrt:  "rgba(27,31,36,0.05)",
    raus:      "rgba(140,150,162,0.45)",
    knoten:    "#3b52c4",
    markiert:  "#7c2d12",
    // #d946ef hat auf Weiss 3,2:1 und #34d399 nur 1,8:1 — beide zu blass.
    // Dieselben Farbtoene, tragfaehig gemacht: 6,4:1 und 4,9:1.
    gate:      "#a21caf",
    up:        "#047857",
    raum: {
      grund: "#ffffff", gitter: "#c7cfd8", gitter2: "#e3e8ee",
      satz: "#0a6189", nachbar: "#2f7d32", hintergrund: "#9aa3ae",
      satzText: "#0a4f70", nachbarText: "#245f27", hintergrundText: "#57606a"
    }
  };

  var FASSUNGEN = {
    hell:   { token: TOKEN_HELL,   familien: FAMILIEN_HELL,
              zeichner: ZEICHNER_HELL,   erkennung: ERKENNUNG_HELL,
              hell: true },
    dunkel: { token: TOKEN_DUNKEL, familien: FAMILIEN_DUNKEL,
              zeichner: ZEICHNER_DUNKEL, erkennung: ERKENNUNG_DUNKEL,
              hell: false }
  };

  var SPEICHER = "demonstrator.fassung";
  var aktuell = "hell";              // Standard: der Hoersaal (20.08.2026)
  var horcher = [];
  var _skala = {};

  function gespeichert() {
    try {
      var w = window.localStorage.getItem(SPEICHER);
      return FASSUNGEN[w] ? w : null;
    } catch (e) { return null; }     // privater Modus, Datei-Aufruf o. ae.
  }

  function schreiben(name) {
    var t = FASSUNGEN[name].token;
    var wurzel = document.documentElement;
    Object.keys(t).forEach(function (k) {
      wurzel.style.setProperty(k, t[k]);
    });
    // Damit die CSS auch ohne Variablen unterscheiden kann (z. B. wo eine
    // ganze Regel nur in einer Fassung gilt).
    wurzel.setAttribute("data-fassung", name);
    // Der Browser faerbt Scrollbalken und Formularelemente danach.
    wurzel.style.colorScheme = (name === "hell" ? "light" : "dark");
  }

  function setzen(name, still) {
    if (!FASSUNGEN[name] || name === aktuell) { return; }
    aktuell = name;
    _skala = {};                     // die Verlaeufe gehoeren zur Fassung
    schreiben(name);
    try { window.localStorage.setItem(SPEICHER, name); } catch (e) { /* egal */ }
    if (!still) {
      horcher.forEach(function (fn) {
        // Ein Horcher, der stolpert, darf die uebrigen nicht mitreissen —
        // sonst bleibt die halbe Seite in der alten Fassung stehen.
        try { fn(name); } catch (e) { console.error("Fassungswechsel:", e); }
      });
    }
  }

  // Beim Laden sofort setzen, noch bevor der Koerper gezeichnet wird —
  // sonst blitzt die falsche Fassung kurz auf.
  aktuell = gespeichert() || "hell";
  schreiben(aktuell);

  /** Der Verlauf einer Familie als Funktion: 0 = kleinster Wert, 1 = groesster.
   *  Braucht d3; ohne d3 wird stufenweise gemischt (der 3D-Raum laedt frueher). */
  function familie(name) {
    var fam = FASSUNGEN[aktuell].familien;
    var n = fam[name] ? name : "wert";
    if (!_skala[n]) {
      if (typeof d3 !== "undefined" && d3.interpolateRgbBasis) {
        _skala[n] = d3.interpolateRgbBasis(fam[n]);
      } else {
        _skala[n] = einfach(fam[n]);
      }
    }
    return function (t) {
      return _skala[n](Math.max(0, Math.min(1, t)));
    };
  }

  /** Ersatzmischung ohne d3 — lineare Mischung zwischen den Stufen. */
  function einfach(stufen) {
    var zahlen = stufen.map(zerlegen);
    return function (t) {
      var x = t * (zahlen.length - 1);
      var i = Math.min(Math.floor(x), zahlen.length - 2);
      var f = x - i, a = zahlen[i], b = zahlen[i + 1];
      return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," +
        Math.round(a[1] + (b[1] - a[1]) * f) + "," +
        Math.round(a[2] + (b[2] - a[2]) * f) + ")";
    };
  }

  function zerlegen(hex) {
    var h = hex.replace("#", "");
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16),
            parseInt(h.substr(4, 2), 16)];
  }

  /** Mischt einen Stufensatz zu einer Funktion 0..1 — mit d3, wenn da. */
  function misch(stufen) {
    if (typeof d3 !== "undefined" && d3.interpolateRgbBasis) {
      var f = d3.interpolateRgbBasis(stufen);
      return function (t) { return f(Math.max(0, Math.min(1, t))); };
    }
    return einfach(stufen);
  }

  return {
    /** Name der laufenden Fassung. */
    name: function () { return aktuell; },
    istHell: function () { return FASSUNGEN[aktuell].hell; },
    /** Umschalten. `still` unterdrueckt die Benachrichtigung. */
    setzen: setzen,
    wechseln: function () { setzen(aktuell === "hell" ? "dunkel" : "hell"); },
    /** Wird nach jedem Wechsel gerufen — hier zeichnen sich die Bilder neu. */
    beiWechsel: function (fn) { horcher.push(fn); },
    familie: familie,
    /** Die fuenf Stufen einer Familie — fuer Farbleisten und Legenden. */
    stufen: function (name) {
      var fam = FASSUNGEN[aktuell].familien;
      return (fam[name] || fam.wert).slice();
    },
    name_von: function (fam) { return FAMILIENNAME[fam] || fam; },
    familienNamen: function () { return Object.keys(FAMILIEN_HELL); },
    /** Ein einzelner Oberflaechenwert, wenn ein Zeichner ihn braucht. */
    token: function (n) {
      return FASSUNGEN[aktuell].token[n] || "";
    },
    /** Farbe mit Deckkraft aus einem `*-rgb`-Wert, fuer die Zeichner. */
    mit: function (rgbToken, deckkraft) {
      var t = FASSUNGEN[aktuell].token[rgbToken];
      return t ? "rgb(" + t + " / " + deckkraft + ")" : "";
    },
    /** Eine Sonderfarbe der Zeichner (leer, maskiert, knoten, …). */
    zeichner: function (n) { return FASSUNGEN[aktuell].zeichner[n]; },
    /** Dieselbe Farbe als Zahl 0xRRGGBB — three.js will es so. */
    zahl: function (hex) { return parseInt(String(hex).replace("#", ""), 16); },
    /** Die Erkennungsfarbe eines Bauteils als "#rrggbb" — Kurzzeichen
     *  res · q · k · v · att · ff. Traegt das BAUTEIL, nicht den Wert. */
    erkennung: function (kurz) {
      return FASSUNGEN[aktuell].erkennung[kurz] ||
             FASSUNGEN[aktuell].erkennung.res;
    },
    /** EINE BAUTEILFARBE, DIE MIT DEM WERT GEGEN DEN GRUND VERBLASST.
     *
     *  `a` laeuft von 0 (nicht zu sehen) bis 1 (volle Bauteilfarbe).
     *
     *  Das grosse Bild rechnete das bis zum 20.08.2026 selbst, und zwar als
     *  Multiplikation: `c * a`. Das blendet gegen SCHWARZ — auf dunklem
     *  Grund genau richtig, auf weissem genau falsch: ein kleiner Wert
     *  waere dort das AUFFAELLIGSTE im Bild. Auf hellem Grund muss dieselbe
     *  Rechnung gegen Weiss laufen. Deshalb steht sie hier und nicht im
     *  Zeichner.
     */
    gegenGrund: function (hexOderTripel, a) {
      var c = typeof hexOderTripel === "string"
        ? zerlegen(hexOderTripel) : hexOderTripel;
      a = Math.max(0, Math.min(1, a));
      var r, g, b;
      if (FASSUNGEN[aktuell].hell) {
        r = 255 - (255 - c[0]) * a;
        g = 255 - (255 - c[1]) * a;
        b = 255 - (255 - c[2]) * a;
      } else {
        r = c[0] * a; g = c[1] * a; b = c[2] * a;
      }
      return "rgb(" + Math.round(r) + "," + Math.round(g) + "," +
        Math.round(b) + ")";
    },
    /** Die Skala der Aufmerksamkeitsfelder als Funktion 0..1. */
    hitze: function () {
      if (!_skala.__hitze) {
        _skala.__hitze = misch(FASSUNGEN[aktuell].zeichner.hitze);
      }
      return _skala.__hitze;
    },
    /** Die zweiseitige Skala: -1 … 0 … +1. */
    zweiseitig: function () {
      var z = FASSUNGEN[aktuell].zeichner;
      if (!_skala.__zwei) {
        _skala.__zwei = { minus: misch(z.zweiMinus), plus: misch(z.zweiPlus) };
      }
      var s = _skala.__zwei;
      return function (w) {
        var a = Math.min(1, Math.abs(w));
        return w < 0 ? s.minus(a) : s.plus(a);
      };
    },
    /** DIE SCHRIFT AUF EINER EINGEFAERBTEN ZELLE.
     *
     *  `t` ist der Wert der Zelle zwischen 0 und 1. Welche Schriftfarbe
     *  darauf lesbar ist, haengt an der Fassung — und zwar GENAU
     *  UMGEKEHRT: auf dunklem Grund ist eine Zelle mit grossem Wert HELL
     *  und braucht dunkle Schrift; auf hellem Grund ist dieselbe Zelle
     *  DUNKEL und braucht helle. Wer das an der Zeichenstelle fest
     *  verdrahtet, bekommt in der anderen Fassung schwarze Schrift auf
     *  schwarzem Grund, ohne dass ein Pruefer es zwangslaeufig meldet.
     */
    schriftAuf: function (t, schwelle) {
      var stark = t > (schwelle === undefined ? 0.55 : schwelle);
      if (FASSUNGEN[aktuell].hell) {
        return stark ? "#ffffff" : "#10161d";
      }
      return stark ? "#1a1206" : "#e6edf3";
    }
  };
})();
