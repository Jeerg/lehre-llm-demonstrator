/* Gemeinsame D3-Bausteine des Demonstrators.
 *
 * Jeder Baustein wird EINMAL gebaut und liefert eine Funktion zum
 * Aktualisieren. Das ist der ganze Unterschied zwischen einer Anzeige und
 * einer Anschauung: wenn die Elemente bestehen bleiben und nur ihre Werte
 * wandern, sieht man, WAS sich geaendert hat. Wird stattdessen alles neu
 * gezeichnet, sieht man nur, DASS sich etwas geaendert hat.
 *
 * Deshalb behalten alle Bausteine ihre Daten ueber einen Schluessel (D3
 * "join by key") und ueberblenden Farbe, Groesse und Lage.
 */

var ZEICHNEN = (function () {
  "use strict";

  var DAUER = 620;

  /** Farbskala fuer Gewichte zwischen 0 und 1.
   *
   *  Sechs Stuetzpunkte statt eines einzigen Blautons: dunkel, Tiefblau,
   *  Violett, Magenta, Orange, Gelb. Eine einfarbige Skala unterscheidet
   *  nur ueber die Helligkeit und laesst sich mit dem Auge schlecht in
   *  Stufen zerlegen; ueber Farbton UND Helligkeit sieht man Abstufungen,
   *  die vorher untergingen. Die Farben stammen aus der Hauspalette
   *  (--blau, --magenta, --gelb).
   */
  // Die Stuetzpunkte stehen in palette.js — in der hellen Fassung laeuft
  // dieselbe Tonfolge mit umgekehrter Helligkeit.
  function hitze(w) {
    if (!(w > 0)) { return PALETTE.zeichner("leer"); }
    // leichte Wurzelkennlinie: kleine Anteile bleiben sichtbar, ohne dass
    // die obere Haelfte der Skala zusammenfaellt
    return PALETTE.hitze()(Math.pow(Math.min(1, w), 0.62));
  }

  /** Farbe eines Balkens nach seinem Wert — und die Farbe der Auswahl.
   *
   *  Ein Balkenfeld in einem einzigen Blauton laesst den Blick nirgends
   *  haengen; man muss jede Zahl einzeln lesen. Mit einer Kennlinie sieht
   *  man die Rangfolge schon an der Farbe.
   *
   *  Die Kennlinie bleibt aber bewusst KALT (Tiefblau → Cyan → Hellcyan).
   *  Eine erste Fassung lief bis Magenta — daneben war das gelbe
   *  Auswahlstueck nicht mehr eindeutig, weil zwei warme, helle Farben um
   *  denselben Blick konkurrierten. Warm ist jetzt ausschliesslich die
   *  Auswahl. Dieselbe Trennung gilt in allen Anschauungen:
   *  KALT = gemessener Wert, WARM+GELB = „das habe ich gewaehlt“.
   */
  // Die Balkenkennlinie IST die Familie "wert" — sie stand hier frueher ein
  // zweites Mal und musste bei jeder Aenderung doppelt gepflegt werden.
  function balkenfarbe(t) {
    return PALETTE.familie("wert")(t);
  }

  /** Die Auswahlfarbe der laufenden Fassung: gelb auf dunklem Grund,
   *  Bernstein auf hellem. Als Funktion, nicht als Wert — ein Wert waere
   *  beim Umschalten eingefroren. */
  function auswahlfarbe() { return PALETTE.token("--wahl"); }

  // =======================================================================
  // Bauteilfamilien — Regel C-1 (User-Lock 12.08.2026)
  //
  //   Die FARBE sagt, welches Bauteil des Modells man ansieht.
  //   Die HELLIGKEIT sagt, wie gross der Messwert ist.
  //   GELB sagt „das habe ich gewaehlt“ — und sonst nichts.
  //
  // Deshalb sind ALLE Familien kalt. Das Vorbild (Transformer Explainer)
  // faerbt Key rot; das waere hier ein Rueckschritt, weil zwei warme Farben
  // um denselben Blick konkurrierten und die Auswahl ihre Eindeutigkeit
  // verloere — genau der Punkt, der in Runde 10 und 11 beanstandet wurde.
  //
  // Jede Familie laeuft in derselben RICHTUNG: vom kleinsten Wert, der kaum
  // vom Grund absteht, zum groessten, der am weitesten davon absteht. Auf
  // dunklem Grund heisst das dunkel → hell, auf hellem hell → dunkel. Zwei
  // Bilder mit gegenlaeufigen Skalen liest niemand richtig — INNERHALB
  // einer Fassung laufen deshalb alle gleich.
  //
  // `wert` ist die Familie fuer Bilder OHNE Bauteilbezug (eine Groesse, ein
  // Bauteil) und ist mit der Grundskala der Balken identisch.
  //
  // DIE FARBWERTE STEHEN SEIT DEM 20.08.2026 IN palette.js, weil es sie
  // zweimal gibt — einmal je Fassung. Hier stand frueher der dunkle Satz;
  // wer ihn hier aendert, aendert nur eine der beiden Fassungen.
  // =======================================================================

  /** Die Farbfunktion einer Familie: 0 = kleinster Wert, 1 = groesster. */
  function familie(name) {
    return PALETTE.familie(name);
  }

  /** Ein Legendeneintrag je Bauteil — Form, wie `rahmen` sie erwartet.
   *  Ohne diesen Eintrag waere die Bauteilfarbe eine Geheimsprache. */
  function familienlegende(namen) {
    return namen.map(function (n) {
      return [PALETTE.name_von(n), familie(n)(0.72)];
    });
  }

  function sichtbar(s) {
    return String(s).replace(/ /g, "·").replace(/\n/g, "↵").replace(/\t/g, "→");
  }

  // =======================================================================
  // Rahmen fuer jedes Diagramm: Aussage, Achsentitel, Legende
  //
  // Ein Diagramm ohne Achsenbeschriftung und ohne Legende zwingt den
  // Betrachter, die Bedeutung im Fliesstext daneben zu suchen — und er tut
  // es nicht. Deshalb bekommt JEDES Diagramm hier denselben Rahmen:
  //
  //   AUSSAGE   was man sieht, in einem Satz, gross ueber dem Bild
  //   y-Titel   was nach oben aufgetragen ist
  //   x-Titel   was nach rechts aufgetragen ist
  //   LEGENDE   was Linie, Balken oder Farbe bedeuten
  // =======================================================================

  // =======================================================================
  // Die zweiseitige Skala — fuer Groessen MIT VORZEICHEN
  //
  // Sie sagt nicht "wenig bis viel", sondern "auffaellig negativ —
  // unauffaellig — auffaellig positiv". Gebraucht wird sie ueberall dort,
  // wo die Null eine Bedeutung hat: im Dimensionsfeld (auffaellig klein /
  // gross) und in den Vorstufen der Aufmerksamkeit (Punktprodukt und
  // skalierte Werte laufen von rund -61 bis +81).
  //
  // BEIDE POLE SIND KALT — Regel C-1. Die fruehere Fassung lief
  // blau → dunkel → GELB; damit stand Gelb an einer Stelle fuer "grosser
  // Wert" und ueberall sonst fuer "das habe ich gewaehlt". Genau diese
  // Doppelbedeutung war in Runde 10/11 beanstandet worden, nur eben nicht
  // an dieser Skala. Jetzt: Teal (negativ) → dunkel → Indigo (positiv),
  // und #ffc000 gehoert wieder allein der Auswahl.
  //
  // Beide Seiten laufen ueber dieselben Zwischenstufen wie die
  // Bauteilfamilien (dunkel → satt → hell), nicht geradlinig aus dem
  // Mittel-Dunkel heraus: geradlinig blieben beide Richtungen bei kleinem
  // Betrag fast gleich dunkelblau und waeren nicht auseinanderzuhalten.
  //
  // Symmetrisch bleibt es trotzdem: beide Seiten starten in DEMSELBEN
  // Dunkel und werden gleich schnell hell. Unterschiedlich helle Pole
  // liessen eine Richtung staerker wirken als die andere und zeigten damit
  // eine Schieflage, die in den Zahlen nicht steckt.
  // =======================================================================

  // Die Stuetzpunkte stehen in palette.js. Die MITTE ist dort, wo nichts zu
  // sehen ist — auf dunklem Grund das Dunkel, auf hellem das Weiss.

  // Das Dimensionsfeld faerbt bis zu 59.392 Bildpunkte einzeln. Jede Farbe
  // dort ueber d3 zu parsen waere spuerbar; deshalb einmal 2 x 257 Stufen
  // vorrechnen und danach nur noch nachschlagen.
  var _zweiTabelle = null;

  function _zweiAufbauen() {
    var minus = [], plus = [], i, c;
    var f = PALETTE.zweiseitig();
    for (i = 0; i <= 256; i++) {
      c = d3.rgb(f(-i / 256));
      minus.push([Math.round(c.r), Math.round(c.g), Math.round(c.b)]);
      c = d3.rgb(f(i / 256));
      plus.push([Math.round(c.r), Math.round(c.g), Math.round(c.b)]);
    }
    _zweiTabelle = { minus: minus, plus: plus };
  }

  /** Die zweiseitige Farbe als [r, g, b].
   *  w laeuft von -1 (Teal) ueber 0 (dunkel) bis +1 (Indigo). */
  function zweiseitigRGB(w) {
    if (!_zweiTabelle) { _zweiAufbauen(); }
    var a = Math.min(1, Math.abs(w));
    var i = Math.round(a * 256);
    return w < 0 ? _zweiTabelle.minus[i] : _zweiTabelle.plus[i];
  }

  function zweiseitig(w) {
    var c = zweiseitigRGB(w);
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  }

  /** Farbbalken mit Beschriftung — die Legende fuer alle Hitzefelder.
   *
   *  opts.skala: "hitze" (Voreinstellung, dunkel → gelb), "zweiseitig"
   *  (Teal → dunkel → Indigo, fuer Groessen mit Vorzeichen), "balken" oder
   *  der Name einer Bauteilfamilie. Eine Legende, die eine andere Skala
   *  zeigt als das Bild darueber, ist schlimmer als keine. */
  function farbleiste(wurzel, opts) {
    opts = opts || {};
    var e = d3.select(wurzel).append("div").attr("class", "farbleiste");
    var b = e.append("div").attr("class", "leiste");
    var stufen = [];
    var i;
    if (opts.skala === "zweiseitig") {
      for (i = 0; i <= 20; i++) { stufen.push(zweiseitig(-1 + 2 * i / 20)); }
    } else if (opts.skala === "zweiseitig-plus") {
      // Nur der positive Ast. Gebraucht, wenn im Bild UEBERHAUPT KEIN
      // negativer Wert vorkommt: eine symmetrische Skala verschenkte dann
      // ihre halbe Laenge, das Bild waere fast einfarbig — und die Leiste
      // verspraeche einen negativen Bereich, den es nicht gibt.
      for (i = 0; i <= 20; i++) { stufen.push(zweiseitig(i / 20)); }
    } else if (opts.skala === "zweiseitig-minus") {
      for (i = 0; i <= 20; i++) { stufen.push(zweiseitig(-1 + i / 20)); }
    } else if (opts.skala === "balken") {
      for (i = 0; i <= 20; i++) { stufen.push(balkenfarbe(i / 20)); }
    } else if (PALETTE.familienNamen().indexOf(opts.skala) >= 0) {
      // Eine Bauteilfamilie: die Leiste zeigt GENAU die Farben, mit denen
      // das Bild darueber gezeichnet ist — sonst legt sie eine andere
      // Skala nahe als das Bild.
      var f = familie(opts.skala);
      for (i = 0; i <= 20; i++) { stufen.push(f(i / 20)); }
    } else {
      for (i = 0; i <= 20; i++) { stufen.push(hitze(i / 20)); }
    }
    b.style("background", "linear-gradient(90deg," + stufen.join(",") + ")");
    var z = e.append("div").attr("class", "zeile");
    z.append("span").text(opts.links || "wenig");
    z.append("span").attr("class", "mitte").text(opts.mitte || "");
    z.append("span").text(opts.rechts || "viel");
    if (opts.was) { e.append("div").attr("class", "was").text(opts.was); }
    return e.node();
  }

  /** Der Rahmen um ein Diagramm: Bezug und Aussage oben, Legende unten.
   *
   *  Der BEZUG ist die Zeile ganz oben: worauf rechnet dieses Bild
   *  gerade? Ohne sie steht auf einer langen Seite ein Diagramm unter dem
   *  anderen, und niemand kann sehen, ob das untere noch denselben Satz
   *  meint wie das Satzfeld oben — oder einen alten Stand zeigt. Sie wird
   *  bei JEDER Neuberechnung aus den Daten gesetzt, die das Bild gerade
   *  zeichnet; damit ist sie zugleich der Beweis, dass das Bild aktuell
   *  ist.
   */
  function rahmen(wurzel, opts) {
    opts = opts || {};
    var huelle = d3.select(wurzel).append("div").attr("class", "diagramm");
    var bezug = huelle.append("div").attr("class", "bezug");
    if (opts.bezug) { bezug.html(opts.bezug); }
    var aussage = huelle.append("div").attr("class", "aussage");
    if (opts.aussage) { aussage.html(opts.aussage); }
    var inhalt = huelle.append("div").attr("class", "bild");
    var fuss = huelle.append("div").attr("class", "diagramm-fuss");
    if (opts.legende) {
      var l = fuss.append("div").attr("class", "legende");
      opts.legende.forEach(function (p) {
        var s = l.append("span");
        if (p[1]) {
          s.append("span").attr("class", "marke")
            .style("background", p[1])
            .style("border-radius", p[2] === "linie" ? "1px" : "3px")
            .style("height", p[2] === "linie" ? "3px" : "13px");
        }
        s.append("span").html(p[0]);
      });
    }
    return {
      wurzel: inhalt.node(),
      fuss: fuss.node(),
      setzeAussage: function (t) { aussage.html(t); },
      setzeBezug: function (t) { bezug.html(t); }
    };
  }
  function pz(x, n) {
    return (x * 100).toFixed(n === undefined ? 1 : n).replace(".", ",") + " %";
  }

  // =======================================================================
  // Hitzefeld mit Beschriftung — die Attention-Matrix
  // =======================================================================

  function hitzefeld(wurzel, opts) {
    opts = opts || {};
    // Platz fuer die Achsentitel: ohne sie weiss niemand, dass die Zeile der
    // Fragende und die Spalte der Befragte ist — und die Spalten tragen hier
    // ueberhaupt keine eigene Beschriftung.
    var links = opts.links === undefined ? (opts.yTitel ? 190 : 168) : opts.links;
    var oben = opts.oben === undefined ? (opts.xTitel ? 38 : 16) : opts.oben;

    var svg = d3.select(wurzel).append("svg").attr("class", "d3-feld")
      .attr("width", "100%");
    var gZellen = svg.append("g");
    var gZeilen = svg.append("g").attr("class", "beschriftung");
    var achse = svg.append("g").attr("class", "achse");
    var xT = opts.xTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.xTitel) : null;
    var yT = opts.yTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.yTitel) : null;
    // Zwei Markierungen: die ganze ZEILE der gewaehlten Stelle (dort steht,
    // was dieses Wort mitnimmt) und darin die einzelne Zelle.
    var zeilenRahmen = svg.append("rect").attr("class", "auswahl zeile")
      .attr("fill", "none").attr("stroke", auswahlfarbe()).attr("stroke-width", 1.5)
      .attr("rx", 3).style("opacity", 0);
    var rahmen = svg.append("rect").attr("class", "auswahl")
      .attr("fill", "none").attr("stroke", auswahlfarbe()).attr("stroke-width", 2)
      .style("opacity", 0);

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var T = d.labels.length;
      var z = Math.max(9, Math.min(opts.max || 34, Math.floor((opts.breite || 660) / Math.max(1, T))));
      var b = links + T * z + 14, h = oben + T * z + 14;
      svg.attr("viewBox", "0 0 " + b + " " + h).attr("height", h)
         .style("max-width", b + "px");
      if (xT) { xT.attr("x", links + T * z / 2).attr("y", 14); }
      if (yT) {
        yT.attr("transform", "translate(13," + (oben + T * z / 2) + ") rotate(-90)");
      }

      // Die Farbskala ist waehlbar, weil nicht jede Matrix von 0 bis 1
      // laeuft: die Vorstufen der Aufmerksamkeit haben ein VORZEICHEN
      // (Punktprodukt rund -61 bis +81) und brauchen die zweiseitige Skala.
      // Ohne diesen Schalter muesste dafuer ein zweites Hitzefeld nachgebaut
      // werden — und die beiden liefen auseinander.
      var farbe = d.farbe || opts.farbe || hitze;

      var zellen = [];
      for (var i = 0; i < T; i++) {
        for (var j = 0; j < T; j++) {
          var w = d.matrix[i][j];
          // `null` heisst: hier steht KEIN Wert (der Blick ist gesperrt).
          // Eine 0 waere eine Falschaussage, deshalb liefert der Server
          // null — und eine null darf nie eingefaerbt werden.
          zellen.push({ id: i + ":" + j, i: i, j: j, w: w,
                        sichtbar: w !== null && w !== undefined &&
                                  (j <= i || d.ohneMaske) });
        }
      }

      var s = gZellen.selectAll("rect").data(zellen, function (c) { return c.id; });
      s.exit().remove();
      var neu = s.enter().append("rect")
        .attr("x", function (c) { return links + c.j * z; })
        .attr("y", function (c) { return oben + c.i * z; })
        .attr("width", Math.max(1, z - 1)).attr("height", Math.max(1, z - 1))
        .attr("fill", PALETTE.zeichner("maskiert"))
        .style("cursor", d.beiKlick ? "pointer" : "default");
      if (d.beiKlick) {
        neu.on("click", function (ev, c) { if (c.sichtbar) { d.beiKlick(c.i, c.j); } });
      }
      neu.merge(s)
        .attr("x", function (c) { return links + c.j * z; })
        .attr("y", function (c) { return oben + c.i * z; })
        .attr("width", Math.max(1, z - 1)).attr("height", Math.max(1, z - 1))
        .transition().duration(dauer)
        .attr("fill", function (c) {
          return c.sichtbar ? farbe(c.w) : PALETTE.zeichner("maskiert");
        });

      var t = gZeilen.selectAll("text").data(d.labels, function (x, i) { return i; });
      t.exit().remove();
      t.enter().append("text")
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .merge(t)
        .attr("class", function (x, i) { return i === d.zeile ? "gewaehlt" : null; })
        .attr("x", links - 8)
        .attr("y", function (x, i) { return oben + i * z + z / 2; })
        .text(function (x) {
          var s = sichtbar(x);
          return s.length > 17 ? s.slice(0, 16) + "…" : s;
        });

      if (d.zeile !== undefined && d.zeile !== null && d.zeile >= 0) {
        zeilenRahmen.style("opacity", 1).transition().duration(dauer)
          .attr("x", links - 2).attr("y", oben + d.zeile * z - 2)
          .attr("width", T * z + 2).attr("height", z + 2);
      } else {
        zeilenRahmen.style("opacity", 0);
      }

      if (d.auswahl) {
        rahmen.style("opacity", 1).transition().duration(dauer)
          .attr("x", links + d.auswahl[1] * z - 1)
          .attr("y", oben + d.auswahl[0] * z - 1)
          .attr("width", z + 1).attr("height", z + 1);
      } else {
        rahmen.style("opacity", 0);
      }
    };
  }

  // =======================================================================
  // Attention-Kette — die drei Rechenstufen als EIN Bild
  //
  // Gebaut nach dem Vorbild (Transformer Explainer, Abbildung 3), das der
  // Anwender als Beispiel gegeben hat. Massgeblich sind fuenf Dinge, die
  // eine erste Fassung mit drei getrennten Hitzefeldern alle verfehlte:
  //
  //   1. EIN Bild, nicht drei. Die Zeilen sind in allen drei Stufen
  //      dieselben, also steht die Wortliste EINMAL links — nicht dreimal.
  //   2. Kreise statt Quadrate. Ein Punktraster laesst die Flaeche atmen;
  //      aneinanderstossende Quadrate lesen sich als Block.
  //   3. Pfeile zwischen den Stufen. Es ist eine Kette, keine Reihe.
  //   4. Je Stufe eine SCHMALE Farbleiste mit den echten Grenzen, direkt
  //      unter ihrer Matrix — nicht eine gemeinsame irgendwo unten.
  //   5. Klein. Das Vorbild braucht fuer alle drei Stufen 715 x 330 px.
  //
  // Query steht links (die Zeilen: wer fragt), Key oben (die Spalten: wer
  // wird gefragt) — beide in ihrer Bauteilfarbe, damit sichtbar ist,
  // woraus die Matrix entsteht.
  // =======================================================================

  function attentionkette(wurzel, opts) {
    opts = opts || {};
    var namen = opts.namen === undefined ? 104 : opts.namen;
    // Der Kopf traegt DREI Zeilen uebereinander: den Key-Achsentitel, den
    // Namen der Stufe und ihre Formel. Mit 46 px sassen sie ineinander.
    var oben = 68, unten = 44, luecke = 30;

    var svg = d3.select(wurzel).append("svg").attr("class", "d3-kette")
      .attr("width", "100%");
    var gAchse = svg.append("g").attr("class", "achse");
    var gNamen = svg.append("g").attr("class", "beschriftung");
    var gStufen = svg.append("g");

    // Query- und Key-Beschriftung sind die beiden Achsentitel dieses
    // Bildes: die Zeile fragt, die Spalte wird gefragt.
    var yT = gAchse.append("text").attr("class", "achsentitel bauteil query")
      .attr("text-anchor", "middle").text(opts.yTitel || "Query — dieses Wort fragt ↓");
    var xT = gAchse.append("text").attr("class", "achsentitel bauteil key")
      .attr("text-anchor", "middle").text(opts.xTitel || "Key — wird gefragt →");

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var T = d.labels.length;
      var n = d.stufen.length;
      var zell = Math.max(7, Math.min(opts.zelle || 20,
        Math.floor(((opts.breite || 840) - namen - (n - 1) * luecke) / (n * T))));
      var mb = T * zell;                                  // Matrixbreite
      var b = namen + n * mb + (n - 1) * luecke + 12;
      var h = oben + T * zell + unten;
      svg.attr("viewBox", "0 0 " + b + " " + h).attr("height", h)
         .style("max-width", b + "px");
      yT.attr("transform", "translate(12," + (oben + T * zell / 2) + ") rotate(-90)");
      // Der Key-Titel steht ueber der GANZEN Kette, nicht ueber der ersten
      // Matrix: die Spalten bedeuten in allen dreien dasselbe.
      xT.attr("x", namen + (b - namen) / 2 - 6).attr("y", 14);

      function x0(k) { return namen + k * (mb + luecke); }

      // ── Die Wortliste: EINMAL, links ──────────────────────────────────
      var t = gNamen.selectAll("text").data(d.labels, function (s, i) { return i; });
      t.exit().remove();
      t.enter().append("text")
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .merge(t)
        .attr("class", function (s, i) { return i === d.zeile ? "gewaehlt" : null; })
        .attr("x", namen - 9)
        .attr("y", function (s, i) { return oben + i * zell + zell / 2; })
        .text(function (s) {
          var v = sichtbar(s);
          return v.length > 11 ? v.slice(0, 10) + "…" : v;
        });

      // ── Die Stufen ────────────────────────────────────────────────────
      var g = gStufen.selectAll("g.stufe").data(d.stufen, function (s) { return s.name; });
      g.exit().remove();
      var neu = g.enter().append("g").attr("class", "stufe");
      neu.append("text").attr("class", "stufenname").attr("text-anchor", "middle");
      // Die Formel als ECHTE Formel: ein Bruch mit Bruchstrich, eine
      // Wurzel mit Wurzelzeichen. Die Vorlage benutzt dafuer KaTeX; das
      // waere hier eine neue Abhaengigkeit in einem Verzeichnis, das ohne
      // Internet laufen muss. MathML kann Chrome von sich aus — und in
      // einem SVG braucht es dafuer ein foreignObject.
      neu.append("foreignObject").attr("class", "formelfeld")
        .attr("height", 26);
      neu.append("g").attr("class", "punkte");
      neu.append("rect").attr("class", "zeilenmarke").attr("fill", "none")
        .attr("stroke", auswahlfarbe()).attr("stroke-width", 1.4).attr("rx", 3)
        .style("opacity", 0);
      // Die Leiste traegt die Klasse `farbleiste`, damit das Gate sie
      // findet: sie steht hier IM Bild (direkt unter ihrer Matrix) statt
      // im Fuss des Diagramms, und ohne diese Kennung haette der Pruefer
      // eine eingefaerbte Flaeche ohne Skala gemeldet.
      neu.append("rect").attr("class", "leiste farbleiste");
      neu.append("text").attr("class", "grenze links").attr("text-anchor", "start");
      neu.append("text").attr("class", "grenze rechts").attr("text-anchor", "end");
      // Der Pfeil ist ein ECHTES Icon, kein Textzeichen. Die Vorlage
      // benutzt genau diesen Pfad (AttentionMatrix.svelte:387); ein "→"
      // aus der Schriftart sitzt je nach Schnitt anders auf der Grundlinie
      // und ist mal duenn, mal fett.
      neu.append("path").attr("class", "pfeil")
        .attr("d", "M19 12H5m14 0-4 4m4-4-4-4")
        .attr("fill", "none").attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round").attr("stroke-width", 2);

      var alle = neu.merge(g);
      alle.each(function (s, k) {
        var sel = d3.select(this);
        var links = x0(k);

        sel.select("text.stufenname")
          .attr("x", links + mb / 2).attr("y", oben - 34).text(s.name);
        sel.select("foreignObject.formelfeld")
          .attr("x", links).attr("y", oben - 30).attr("width", mb)
          .html(s.mathml
            ? "<div class='formel'>" + s.mathml + "</div>"
            : "<div class='formel roh'>" + (s.formel || "") + "</div>");

        // Die Zellen als KREISE. Die Farbe traegt den Wert; gesperrte
        // Felder bekommen einen blassen Umriss statt einer Fuellung —
        // dort steht kein Wert, dort ist der Blick verboten.
        var zellen = [];
        for (var i = 0; i < T; i++) {
          for (var j = 0; j < T; j++) {
            var w = s.matrix[i][j];
            zellen.push({ id: i + ":" + j, i: i, j: j, w: w,
                          gesperrt: w === null || w === undefined });
          }
        }
        // Radius so, dass zwischen zwei Kreisen 3 px Luft bleiben — die
        // Vorlage setzt `rowGap={3} colGap={3}` bei gleicher Zellgroesse.
        var r = Math.max(1.5, (zell - 3) / 2);
        var p = sel.select("g.punkte").selectAll("circle")
          .data(zellen, function (c) { return c.id; });
        p.exit().remove();
        var pneu = p.enter().append("circle").attr("r", r)
          .attr("fill", PALETTE.zeichner("gitterleer"));
        if (d.beiKlick) {
          pneu.style("cursor", "pointer")
            .on("click", function (ev, c) { if (!c.gesperrt) { d.beiKlick(c.i, c.j); } });
        }
        pneu.merge(p)
          .attr("cx", function (c) { return links + c.j * zell + zell / 2; })
          .attr("cy", function (c) { return oben + c.i * zell + zell / 2; })
          .attr("r", r)
          // Gesperrte Zellen bekommen KEINE Kontur — die Vorlage setzt
          // dort `stroke: 'none'` (AttentionMatrix.svelte:310) und faerbt
          // sie in der Grundfarbe. Sie verschwinden damit fast; genau das
          // ist die Aussage. Meine erste Fassung zeichnete leere Ringe,
          // die staerker ins Auge fielen als die Werte daneben.
          .attr("stroke", "none")
          .transition().duration(dauer)
          .attr("fill", function (c) {
            return c.gesperrt ? PALETTE.zeichner("gesperrt") : s.farbe(c.w);
          });

        // Die gewaehlte Zeile in JEDER Stufe (Regel A-6).
        if (d.zeile !== undefined && d.zeile !== null && d.zeile >= 0) {
          sel.select("rect.zeilenmarke").style("opacity", 1)
            .transition().duration(dauer)
            .attr("x", links - 2).attr("y", oben + d.zeile * zell)
            .attr("width", mb + 4).attr("height", zell);
        } else {
          sel.select("rect.zeilenmarke").style("opacity", 0);
        }

        // Farbleiste DIREKT unter ihrer Matrix, mit den echten Grenzen.
        var lid = "kette-" + k + "-" + (opts.kennung || "a");
        var alt = svg.select("#" + lid);
        if (alt.empty()) {
          alt = svg.append("defs").append("linearGradient").attr("id", lid);
        } else {
          alt.selectAll("stop").remove();
        }
        for (var q = 0; q <= 12; q++) {
          alt.append("stop").attr("offset", (q / 12 * 100) + "%")
            .attr("stop-color", s.leiste(q / 12));
        }
        var ly = oben + T * zell + 13;
        sel.select("rect.leiste")
          .attr("x", links).attr("y", ly)
          .attr("width", mb).attr("height", 7).attr("rx", 3)
          .attr("fill", "url(#" + lid + ")");
        sel.select("text.grenze.links")
          .attr("x", links).attr("y", ly + 20).text(s.links);
        sel.select("text.grenze.rechts")
          .attr("x", links + mb).attr("y", ly + 20).text(s.rechts);

        // Der Pfeil in die naechste Stufe — es ist eine Kette.
        // Das Icon ist auf 24 x 24 gezeichnet; hier auf die Luecke gesetzt.
        sel.select("path.pfeil")
          .attr("transform", "translate(" + (links + mb + luecke / 2 - 12) +
            "," + (oben + T * zell / 2 - 12) + ")")
          .style("opacity", k < n - 1 ? 1 : 0);
      });
    };
  }

  // =======================================================================
  // Verwandlungstafel — eine Zeile je Stueck, eine Spalte je Rechenstufe
  //
  // Gebraucht, wo DIESELBE Groesse mehrere Stadien durchlaeuft und man
  // sehen soll, was aus EINEM Ding wird: rohes Logit -> geteilt durch die
  // Temperatur -> Anteil -> nach dem Schnitt. Vier getrennte Balkenbilder
  // koennten das auch zeigen, aber dort stuende die Namensliste viermal
  // da, und den Weg eines einzelnen Stueckes muesste man sich ueber vier
  // Bilder hinweg zusammensuchen.
  //
  // Ausgeschnittene Zeilen bleiben STEHEN und werden grau. Wer sie
  // entfernt, zeigt das Ergebnis des Schnitts, nicht den Schnitt.
  //
  // opts.spalten: [{titel, einheit, art}] — art "wert" (Balken von der
  //               kleinsten gezeigten Zahl an) oder "anteil" (Balken von
  //               null an, in Prozent).
  // =======================================================================

  function verwandlungstafel(wurzel, opts) {
    opts = opts || {};
    var spalten = opts.spalten || [];

    var aussen = d3.select(wurzel).append("div").attr("class", "tafel-aussen");
    if (opts.yTitel) {
      // Als eigenes Element neben dem Bild, nicht im Bild: die Tafel ist
      // HTML und hat kein SVG, in das ein Achsentext passte.
      aussen.append("div").attr("class", "achsenzeile tafel-ytitel")
        .text(opts.yTitel);
    }
    var tafel = aussen.append("div").attr("class", "tafel verwandlungstafel");

    // Die Kopfzeile IST die x-Achse dieser Darstellung — sie sagt, was in
    // welcher Spalte steht. Deshalb traegt sie die Achsen-Kennung.
    var kopf = tafel.append("div").attr("class", "achsenzeile tafel-kopf");
    var kopfName = kopf.append("div").attr("class", "tafel-name");
    kopfName.append("span").attr("class", "wort")
      .text(opts.stueckTitel || "Stück");

    // DER AUFKLAPPER — wie in der Vorlage.
    //
    // Dort steht `let isSoftmaxExpanded = false`: die Tafel beginnt KNAPP,
    // man sieht nur Wort, Balken und Prozent. Die Zahlenspalten erscheinen
    // erst auf Klick. Genau andersherum gebaut sah der Anwender beim ersten
    // Blick eine Wand aus Zahlen ("da kommt nur scheiss raus, naemlich
    // zahlen") — und das ist auch richtig so: zwoelf Zeilen mal vier
    // Zahlenspalten sind 48 Zahlen, bevor irgendetwas gesagt wurde.
    var lupe = null;
    if (opts.beiAufklappen) {
      lupe = kopfName.append("button").attr("class", "tafel-lupe")
        .attr("type", "button");
      lupe.on("click", function (ev) {
        ev.stopPropagation();
        opts.beiAufklappen();
      });
    }

    spalten.forEach(function (s, si) {
      var z = kopf.append("div").attr("class", "tafel-spalte sp" + si);
      var zt = z.append("div").attr("class", "titel");
      zt.append("span").attr("class", "wort").text(s.titel);
      // Ein Knopf IM Spaltenkopf — wie im Vorbild das Auge an "Logits". Er
      // gehoert dorthin und nicht daneben: er oeffnet, woher genau DIESE
      // Spalte kommt, und die Zuordnung muss ohne Erklaerung stimmen.
      if (s.knopf) {
        var b = zt.append("button").attr("class", "spaltenknopf")
          .attr("type", "button").attr("title", s.knopf.titel || "");
        b.append("span").attr("class", "zeichen").text(s.knopf.zeichen || "◉");
        if (s.knopf.text) { b.append("span").text(" " + s.knopf.text); }
        b.on("click", function (ev) {
          ev.stopPropagation();
          s.knopf.beiKlick(b);
        });
      }
      // Die Unterzeile IMMER anlegen, auch wenn sie zunaechst leer ist:
      // sie traegt die Skalengrenzen, und die stehen erst fest, wenn
      // gerechnet wurde. Wer sie nur bei anfangs gefuelltem Text anlegt,
      // hat spaeter nichts, was er beschriften koennte — genau so fehlten
      // die Grenzen der Spalten 2 und 4.
      z.append("div").attr("class", "unter").text(s.unter || "");
    });

    var koerper = tafel.append("div").attr("class", "tafel-koerper");

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;

      // Knapp oder ausfuehrlich. Voreinstellung ist KNAPP (siehe oben).
      var auf = !!d.aufgeklappt;
      tafel.classed("knapp", !auf);
      if (lupe) {
        lupe.html("<span class='zeichen'>" + (auf ? "⊖" : "⊕") + "</span>" +
          "<span class='wort'>" + (auf ? "Zahlen aus" : "Zahlen") + "</span>");
        lupe.attr("title", auf
          ? "die Rechenschritte ausblenden"
          : "zeigen, wie aus dem Logit die Wahrscheinlichkeit wird");
      }

      // Die Kopfzeile kann sich mit den Daten aendern (die Temperatur steht
      // darin) — sonst behauptete sie einen Wert, mit dem nicht gerechnet
      // wurde.
      if (d.spalten) {
        kopf.selectAll(".tafel-spalte").each(function (x, i) {
          var s = d.spalten[i];
          if (!s) { return; }
          // NUR das Wort neu setzen, nicht die ganze Titelzeile: dort steht
          // gegebenenfalls ein Knopf, und `.text()` auf den Elter loeschte ihn
          // beim ersten Datenwechsel spurlos.
          d3.select(this).select(".titel .wort").text(s.titel);
          d3.select(this).select(".unter").text(s.unter || "");
        });
      }

      var z = koerper.selectAll("div.tafel-zeile")
        .data(d.zeilen, function (r) { return r.id; });
      z.exit().remove();

      var neu = z.enter().append("div").attr("class", "tafel-zeile");
      neu.append("div").attr("class", "tafel-name");
      spalten.forEach(function (s, i) {
        var zelle = neu.append("div").attr("class", "tafel-zelle sp" + i);
        zelle.append("div").attr("class", "balken");
        zelle.append("div").attr("class", "zahl");
      });
      if (d.beiKlick) {
        neu.style("cursor", "pointer")
           .on("click", function (ev, r) { d.beiKlick(r); });
      }

      var alle = neu.merge(z);
      alle.attr("class", function (r) {
        return "tafel-zeile" + (r.raus ? " raus" : "") +
               (r.gewaehlt ? " gewaehlt" : "") +
               // Die Zeile, in der der Schnitt faellt, traegt einen Strich
               // unter sich — wie im Vorbild. Ohne ihn muss man die Zeilen
               // zaehlen, um zu sehen, WO geschnitten wurde.
               (r.schnitt ? " schnittzeile" : "");
      });
      alle.select(".tafel-name").text(function (r) { return sichtbar(r.name); });

      // NUR DIE LETZTE SPALTE BEKOMMT EINEN BALKEN — wie im Vorbild.
      //
      // Die erste Fassung setzte in JEDE Spalte einen Balken. Das war
      // vierfaches Rauschen: die Logit-Spalten sind Zahlen, die man liest,
      // keine Groessen, die man vergleicht — und weil sie alle dicht
      // beieinanderliegen (gemessen 16,4 bis 20,0), sahen die Balken ohnehin
      // gleich lang aus. Das Vorbild zeigt dort reine Zahlen und haelt den
      // einen Balken fuer die Groesse auf, um die es geht.
      spalten.forEach(function (s, i) {
        var zellen = alle.select(".tafel-zelle.sp" + i);
        // Die Spaltenangabe aus den DATEN (nicht die vom Bau) — nur sie
        // weiss, ob der Schnitt gerade ueberhaupt in diese Tafel faellt.
        var sd = (d.spalten && d.spalten[i]) || {};
        var mitBalken = s.balken === true;
        zellen.classed("nurzahl", !mitBalken);
        zellen.select(".balken")
          .style("display", mitBalken ? null : "none");
        if (mitBalken) {
          zellen.select(".balken").transition().duration(dauer)
            .style("width", function (r) {
              var t = r.anteile[i];
              return (t === null || t === undefined ? 0 : Math.max(0, t) * 100) + "%";
            })
            .style("background", function (r) {
              var t = r.anteile[i];
              if (t === null || t === undefined) { return "transparent"; }
              // EINE FARBE FÜR ALLE BALKEN — wie in der Vorlage.
              //
              // Vorher trug die Farbe denselben Wert wie die Länge. Das ist
              // doppelt gesagt und kostet eine Farbleiste, die dann auch noch
              // Platz unter dem Bild braucht. In der Vorlage sind alle Balken
              // gleich gefärbt; die LÄNGE trägt den Wert, sonst nichts.
              // Grau heisst weiterhin: dieses Stück ist raus.
              return r.raus ? PALETTE.zeichner("raus")
                : (r.gewaehlt ? auswahlfarbe() : PALETTE.zeichner("knoten"));
            });
        }
        // DIE HINTERLEGUNG SITZT AN DER ZELLE, NICHT AN DER SCHRIFT.
        //
        // Das Vorbild hinterlegt in der Schnitt-Spalte die behaltenen
        // Zeilen blass — eine FLAECHE. Bisher trug das hier nur die
        // Textfarbe, und damit war es auf einen Blick nicht zu sehen, wer
        // drin ist: man musste jede Zahl einzeln lesen. Eine Flaeche liest
        // man als Block.
        //
        // UND: sie unterbleibt, wenn NICHTS ausgeschnitten ist. Bei k = 40
        // und zwoelf gezeigten Zeilen waeren sonst alle zwoelf hinterlegt —
        // eine Markierung, die immer an ist, markiert nichts. Dann sagt die
        // Kopfzeile "Schnitt liegt ausserhalb", und das genuegt.
        zellen.classed("behalten", function (r) {
          return !!s.schnitt && !r.raus && sd.hinterlegen !== false;
        });

        zellen.select(".zahl")
          .attr("class", function (r) {
            return "zahl" + (s.schnitt ? (r.raus ? " gesperrt" : " behalten") : "");
          });

        // DIE ZAHLEN LAUFEN MIT, STATT ZU SPRINGEN.
        //
        // Im Vorbild zaehlen die Wahrscheinlichkeiten auf ihren neuen Wert.
        // Das ist nicht Schmuck (Regel A-9): wer die Temperatur zieht, will
        // SEHEN, welche Zahl steigt und welche faellt — ein Sprung zeigt nur
        // den neuen Stand, die Bewegung zeigt die Richtung.
        //
        // Vorbedingung ist ein Zahlenwert und eine Formatierung je Spalte
        // (r.werte / s.form). Wo beides fehlt (Text wie "−∞"), wird gesetzt
        // statt gezaehlt — eine Unendlichkeit zaehlt nicht hoch.
        var laeuftMit = typeof s.form === "function";
        zellen.select(".zahl").each(function (r) {
          var self = d3.select(this);
          var neuerWert = laeuftMit && r.werte ? r.werte[i] : null;
          if (neuerWert === null || neuerWert === undefined || !dauer) {
            this.__wert = neuerWert;
            self.interrupt().text(r.texte[i]);
            return;
          }
          var alt = (this.__wert === null || this.__wert === undefined)
            ? neuerWert : this.__wert;
          this.__wert = neuerWert;
          if (alt === neuerWert) { self.interrupt().text(r.texte[i]); return; }
          var ip = d3.interpolateNumber(alt, neuerWert);
          self.transition().duration(dauer).tween("zahl", function () {
            return function (t) { self.text(s.form(ip(t))); };
          }).on("end", function () { self.text(r.texte[i]); });
        });
      });
    };
  }

  // =======================================================================
  // Beitragsbalken — Groessen MIT VORZEICHEN, von einer Nulllinie aus
  //
  // Gebraucht fuer die Aufschluesselung eines Logits: jede der 2.048 Zahlen
  // des Zustands traegt ein Stueck bei, und ungefaehr die Haelfte davon
  // traegt NEGATIV bei. Ein Balken von links (wie `balken`) koennte das
  // nicht zeigen — er hat kein Vorzeichen. Deshalb eine Nulllinie in der
  // Mitte: was rechts steht, spricht fuer das Stueck, was links steht,
  // dagegen. Die Farbe ist dieselbe zweiseitige Skala wie ueberall sonst
  // (zweiseitig()), damit Legende und Bild nicht auseinanderlaufen.
  // =======================================================================

  function beitragsbalken(wurzel, opts) {
    opts = opts || {};
    var breite = opts.breite || 620, zeile = 24;
    var namensbreite = opts.namen || 190;
    var kopf = 22, fuss = opts.xTitel ? 26 : 6;
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-beitraege")
      .attr("width", "100%");
    var achse = svg.append("g").attr("class", "achse");
    var g = svg.append("g");
    if (opts.yTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("x", namensbreite - 10).attr("y", 12)
        .attr("text-anchor", "end").text(opts.yTitel);
    }
    var xT = opts.xTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.xTitel) : null;
    var null_ = achse.append("line").attr("class", "nulllinie");
    var nullT = achse.append("text").attr("class", "grenze")
      .attr("text-anchor", "middle").text("0");

    return function (liste, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var hoehe = liste.length * zeile + kopf + fuss + 8;
      var mitte = namensbreite + breite / 2;
      svg.attr("viewBox", "0 0 " + (namensbreite + breite + 90) + " " + hoehe)
         .attr("height", hoehe);
      if (xT) { xT.attr("x", mitte).attr("y", hoehe - 8); }
      null_.attr("x1", mitte).attr("x2", mitte)
           .attr("y1", kopf - 6).attr("y2", kopf + liste.length * zeile);
      nullT.attr("x", mitte).attr("y", kopf - 10);

      var max = d3.max(liste, function (p) { return Math.abs(p.wert); }) || 1;
      var x = d3.scaleLinear().domain([0, max]).range([0, breite / 2 - 8]);

      var z = g.selectAll("g.z").data(liste, function (p) { return p.id; });
      z.exit().remove();
      var e = z.enter().append("g").attr("class", "z");
      e.append("text").attr("class", "wort").attr("x", namensbreite - 10)
        .attr("text-anchor", "end").attr("dominant-baseline", "middle");
      e.append("rect").attr("class", "bar").attr("y", -7).attr("height", 14)
        .attr("rx", 3).attr("width", 0);
      e.append("text").attr("class", "wert")
        .attr("dominant-baseline", "middle");

      var alle = e.merge(z);
      alle.transition().duration(dauer).attr("transform", function (p, i) {
        return "translate(0," + (kopf + i * zeile + 10) + ")";
      });
      alle.select("text.wort").text(function (p) { return p.text; });
      alle.select("rect.bar").transition().duration(dauer)
        .attr("x", function (p) {
          return p.wert < 0 ? mitte - x(Math.abs(p.wert)) : mitte;
        })
        .attr("width", function (p) { return Math.max(1, x(Math.abs(p.wert))); })
        .style("fill", function (p) { return zweiseitig(p.wert / max); });
      // Die Zahl steht IMMER aussen neben ihrem Balken und traegt eine feste
      // Farbe — nie die Wertfarbe (die ist bei kleinen Werten dunkel, und
      // Schrift hat keine Flaeche, ueber die man sie noch lesen koennte).
      alle.select("text.wert").transition().duration(dauer)
        .attr("x", function (p) {
          return p.wert < 0 ? mitte - x(Math.abs(p.wert)) - 8
                            : mitte + x(Math.abs(p.wert)) + 8;
        })
        .attr("text-anchor", function (p) { return p.wert < 0 ? "end" : "start"; })
        .tween("text", function (p) {
          var self = d3.select(this);
          var alt = parseFloat(String(self.text()).replace(",", ".")) || 0;
          var ip = d3.interpolateNumber(alt, p.wert);
          return function (t) {
            self.text(ip(t).toFixed(2).replace(".", ","));
          };
        });
    };
  }

  // =======================================================================
  // Kleines Hitzefeld ohne Beschriftung — fuer viele Koepfe nebeneinander
  // =======================================================================

  function kleinesFeld(wurzel, kante) {
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-klein")
      .attr("width", "100%");
    var g = svg.append("g");
    return function (matrix, dauer) {
      var T = matrix.length;
      var z = Math.max(2, Math.floor((kante || 190) / Math.max(1, T)));
      var s = T * z + 1;
      svg.attr("viewBox", "0 0 " + s + " " + s).attr("height", s)
         .style("max-width", s + "px");
      var zellen = [];
      for (var i = 0; i < T; i++) {
        for (var j = 0; j < T; j++) {
          zellen.push({ id: i + ":" + j, i: i, j: j, w: matrix[i][j] });
        }
      }
      var sel = g.selectAll("rect").data(zellen, function (c) { return c.id; });
      sel.exit().remove();
      sel.enter().append("rect")
        .attr("width", Math.max(1, z - 0.5)).attr("height", Math.max(1, z - 0.5))
        .attr("fill", PALETTE.zeichner("maskiert"))
        .merge(sel)
        .attr("x", function (c) { return c.j * z; })
        .attr("y", function (c) { return c.i * z; })
        .attr("width", Math.max(1, z - 0.5)).attr("height", Math.max(1, z - 0.5))
        .transition().duration(dauer === undefined ? DAUER : dauer)
        .attr("fill", function (c) {
          return c.j <= c.i ? hitze(c.w) : PALETTE.zeichner("maskiert");
        });
    };
  }

  // =======================================================================
  // Balken einer Verteilung — Breite und Zahl laufen mit
  // =======================================================================

  function balken(wurzel, opts) {
    opts = opts || {};
    var breite = opts.breite || 620, zeile = 26, namensbreite = opts.namen || 150;
    // Ein liegender Balken hat zwei Achsen wie jedes andere Diagramm: die
    // Zeile sagt, WAS gemessen wurde, die Laenge WIEVIEL. Beides stand
    // bisher nur im Fliesstext daneben.
    var kopf = opts.yTitel ? 20 : 0;
    var fuss = opts.xTitel ? 24 : 0;
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-balken")
      .attr("width", "100%");
    var achse = svg.append("g").attr("class", "achse");
    var g = svg.append("g");
    if (opts.yTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("x", namensbreite - 10).attr("y", 12)
        .attr("text-anchor", "end").text(opts.yTitel);
    }
    var xT = opts.xTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("x", namensbreite + breite / 2).attr("text-anchor", "middle")
      .text(opts.xTitel) : null;

    return function (liste, dauer) {
      dauer = dauer === undefined ? 520 : dauer;
      var hoehe = liste.length * zeile + 14 + kopf + fuss;
      var b = namensbreite + breite + 110;
      svg.attr("viewBox", "0 0 " + b + " " + hoehe).attr("height", hoehe);
      if (xT) { xT.attr("y", hoehe - 8); }
      var max = liste.length ? d3.max(liste, function (p) { return p.p; }) : 1;
      var x = d3.scaleLinear().domain([0, max || 1]).range([0, breite]);

      var z = g.selectAll("g.z").data(liste, function (p) { return p.id; });
      var e = z.enter().append("g").attr("class", "z")
        .attr("transform", function (p, i) { return "translate(0," + (kopf + i * zeile + 10) + ")"; })
        .style("opacity", 0);
      e.append("text").attr("class", "wort").attr("x", namensbreite - 10)
        .attr("text-anchor", "end").attr("dominant-baseline", "middle");
      e.append("rect").attr("class", "bar").attr("x", namensbreite)
        .attr("y", -7).attr("height", 14).attr("rx", 3).attr("width", 0);
      e.append("text").attr("class", "wert").attr("dominant-baseline", "middle");

      var alle = e.merge(z);
      alle.transition().duration(dauer)
        .style("opacity", 1)
        .attr("transform", function (p, i) { return "translate(0," + (kopf + i * zeile + 10) + ")"; });
      // Eine angeklickte Stelle MUSS im Bild wiederzufinden sein. Sonst ist
      // der Klick oben eine Bedienung ohne Wirkung.
      alle.attr("class", function (p) {
        return "z" + (p.markiert ? " markiert" : "");
      });
      alle.select("text.wort").text(function (p) { return sichtbar(p.text); });
      // Die Farbe traegt den Wert, und die AUSWAHL faerbt den Balken selbst
      // — nicht einen Kasten um ihn herum.
      // style statt attr: eine CSS-Regel wuerde ein Praesentationsattribut
      // ueberschreiben, und die Farbe kaeme nie an.
      //
      // Die Auswahl hebt sich durch DREI Dinge zugleich ab — Farbe, heller
      // Rand und groessere Hoehe. Eine Farbe allein reicht nicht, wenn
      // daneben zwoelf andere Farben stehen.
      alle.select("rect.bar").transition().duration(dauer)
        .attr("width", function (p) { return Math.max(1, x(p.p)); })
        .attr("y", function (p) { return p.markiert ? -10 : -7; })
        .attr("height", function (p) { return p.markiert ? 20 : 14; })
        .style("fill", function (p) {
          return p.markiert ? auswahlfarbe() : balkenfarbe(p.p / (max || 1));
        })
        .style("stroke", function (p) { return p.markiert ? PALETTE.zeichner("markiert") : "none"; })
        .style("stroke-width", function (p) { return p.markiert ? 1.5 : 0; });
      // DIE KENNLINIE GEHOERT AUF DIE FLAECHE, NIE AUF SCHRIFT.
      //
      // Befund des Anwenders (13.08.2026): "schwarze schrift auf schwarzem
      // grund in den diagrammen". Hier stand er: die Zahl neben dem Balken
      // bekam DIESELBE Wertfarbe wie der Balken. Bei kleinen Werten ist das
      // `balkenfarbe(0)` = #0d3b5e, und gegen den Kartengrund #161b22 sind
      // das **1,48:1** — nachgerechnet und im Browser nachgemessen (1,54
      // bis 1,59:1 an mehreren Stellen). Unter 3,0:1 wird Text nicht mehr
      // gelesen, sondern erraten.
      //
      // Der Denkfehler dahinter: die Regel "Farbe traegt den Wert" ist
      // richtig — aber sie gilt fuer FLAECHEN. Eine Flaeche darf beliebig
      // dunkel sein, sie hat eine Groesse. Schrift hat keine; sie ist
      // entweder lesbar oder weg. Deshalb traegt die Zahl eine feste
      // Farbe, und den Wert traegt der Balken daneben.
      alle.select("text.wert")
        .style("fill", function (p) { return p.markiert ? auswahlfarbe() : null; })
        .style("font-weight", function (p) { return p.markiert ? 700 : null; });
      alle.select("text.wert").transition().duration(dauer)
        .attr("x", function (p) { return namensbreite + 9 + x(p.p); })
        .tween("text", function (p) {
          var self = d3.select(this);
          var alt = parseFloat(String(self.text()).replace(",", ".")) || 0;
          var ip = d3.interpolateNumber(alt, p.p * 100);
          return function (t) { self.text(ip(t).toFixed(1).replace(".", ",") + " %"); };
        });
      z.exit().transition().duration(260).style("opacity", 0).remove();
    };
  }

  // =======================================================================
  // Saeulen — z.B. die Laenge des Residualstroms je Stufe
  // =======================================================================

  function saeulen(wurzel, opts) {
    opts = opts || {};
    var breite = opts.breite || 1060, hoehe = opts.hoehe || 300;
    var unten = opts.xTitel ? 62 : 44, links = opts.yTitel ? 76 : 52;
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-saeulen")
      .attr("width", "100%").attr("viewBox", "0 0 " + breite + " " + hoehe)
      .attr("height", hoehe);
    var g = svg.append("g");
    var achse = svg.append("g").attr("class", "achse");
    achse.append("line").attr("x1", links).attr("x2", breite - 10)
      .attr("y1", hoehe - unten).attr("y2", hoehe - unten);
    // Ohne obere Marke ist die Saeulenhoehe eine Zierde: man sieht, dass eine
    // hoeher ist als die andere, aber nicht, um wieviel.
    var yOben = achse.append("text").attr("x", links - 8).attr("y", 20)
      .attr("text-anchor", "end");
    achse.append("text").attr("x", links - 8).attr("y", hoehe - unten)
      .attr("text-anchor", "end").text("0");
    if (opts.yTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("transform", "translate(16," + ((hoehe - unten) / 2) + ") rotate(-90)")
        .attr("text-anchor", "middle").text(opts.yTitel);
    }
    if (opts.xTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("x", (links + breite) / 2).attr("y", hoehe - 10)
        .attr("text-anchor", "middle").text(opts.xTitel);
    }
    var beschriftung = svg.append("g").attr("class", "beschriftung");

    return function (werte, labels, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var n = werte.length;
      var bb = (breite - links - 14) / Math.max(1, n);
      var max = d3.max(werte) || 1;
      var y = d3.scaleLinear().domain([0, max]).range([0, hoehe - unten - 24]);
      yOben.text(opts.einheit === "prozent"
        ? Math.round(max * 100) + " %" : (Math.round(max * 100) / 100));

      // Auch hier traegt die Farbe den Wert: bei 28 gleich blauen Saeulen
      // muss man jede Hoehe einzeln vergleichen, mit Kennlinie sieht man
      // die arbeitenden Schichten sofort.
      function farbe(d) {
        return d.i === 0 ? PALETTE.token("--text-muted")
          : balkenfarbe(d.w / (max || 1));
      }
      var s = g.selectAll("rect").data(werte.map(function (w, i) {
        return { i: i, w: w };
      }), function (d) { return d.i; });
      s.exit().remove();
      s.enter().append("rect")
        .attr("x", function (d) { return links + d.i * bb + 1; })
        .attr("y", hoehe - unten).attr("height", 0)
        .attr("width", Math.max(1.5, bb - 2))
        .style("fill", farbe)
        .merge(s)
        .attr("x", function (d) { return links + d.i * bb + 1; })
        .attr("width", Math.max(1.5, bb - 2))
        .transition().duration(dauer)
        .attr("y", function (d) { return hoehe - unten - y(d.w); })
        .attr("height", function (d) { return Math.max(0, y(d.w)); })
        .style("fill", farbe);

      var t = beschriftung.selectAll("text").data(labels || [], function (x, i) { return i; });
      t.exit().remove();
      t.enter().append("text").attr("text-anchor", "middle")
        .merge(t)
        .attr("x", function (x, i) { return links + (i + 0.5) * bb; })
        .attr("y", hoehe - unten + 18)
        .text(function (x) { return x; });
    };
  }

  // =======================================================================
  // Stufenkurve — die Sicherheit des Modells nach jeder Schicht
  // =======================================================================

  function stufenkurve(wurzel, opts) {
    opts = opts || {};
    var breite = opts.breite || 1080, hoehe = opts.hoehe || 300;
    // mehr Platz links und unten: dort stehen jetzt die Achsentitel
    var links = opts.yTitel ? 78 : 52;
    var unten = opts.xTitel ? 62 : 52;
    var oben = 18;
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-kurve")
      .attr("width", "100%").attr("viewBox", "0 0 " + breite + " " + hoehe)
      .attr("height", hoehe);
    var gFlaeche = svg.append("path").attr("class", "flaeche");
    var gLinie = svg.append("path").attr("class", "kurve");
    var gPunkte = svg.append("g");
    var gWechsel = svg.append("g").attr("class", "wechsel");
    // Marken auf der x-Achse: ohne sie sieht man zwar einen Verlauf, kann
    // ihn aber keiner Schicht zuordnen.
    var gMarken = svg.append("g").attr("class", "xmarken");
    var achse = svg.append("g").attr("class", "achse");
    achse.append("line").attr("x1", links).attr("x2", breite - 12)
      .attr("y1", hoehe - unten).attr("y2", hoehe - unten);
    var obenText = achse.append("text").attr("x", links - 8)
      .attr("y", oben + 6).attr("text-anchor", "end").text("100 %");
    achse.append("text").attr("x", links - 8).attr("y", hoehe - unten)
      .attr("text-anchor", "end").text("0");

    // Achsentitel — ohne sie muss man raten, was aufgetragen ist
    if (opts.yTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("transform", "translate(16," + ((hoehe - unten + oben) / 2) +
              ") rotate(-90)")
        .attr("text-anchor", "middle").text(opts.yTitel);
    }
    if (opts.xTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("x", (links + breite) / 2).attr("y", hoehe - 10)
        .attr("text-anchor", "middle").text(opts.xTitel);
    }

    return function (stufen, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var n = stufen.length;
      var x = d3.scaleLinear().domain([0, Math.max(1, n - 1)])
        .range([links + 6, breite - 18]);
      // Die Achse laeuft normalerweise bis 100 %, weil dort
      // Wahrscheinlichkeiten stehen. Wo die Groesse eine andere ist (etwa
      // ein Abstand, der 0,3 nicht ueberschreitet), wuerde die Kurve am
      // unteren Rand kleben und nichts zeigen — dann wird auf den
      // tatsaechlichen Hoechstwert skaliert.
      var hoechst = 1;
      if (opts.frei) {
        hoechst = d3.max(stufen, function (d) { return d.p; }) || 1;
        hoechst = Math.max(0.02, hoechst * 1.15);
      }
      var y = d3.scaleLinear().domain([0, hoechst]).range([hoehe - unten, oben]);
      obenText.text(hoechst >= 0.999 ? "100 %"
        : (hoechst * 100).toFixed(hoechst < 0.1 ? 1 : 0).replace(".", ",") + " %");

      var linie = d3.line().x(function (d, i) { return x(i); })
        .y(function (d) { return y(d.p); }).curve(d3.curveMonotoneX);
      var flaeche = d3.area().x(function (d, i) { return x(i); })
        .y0(hoehe - unten).y1(function (d) { return y(d.p); })
        .curve(d3.curveMonotoneX);

      gLinie.datum(stufen).transition().duration(dauer).attr("d", linie);
      gFlaeche.datum(stufen).transition().duration(dauer).attr("d", flaeche);

      // x-Marken: erste, letzte und ein paar dazwischen. Beschriftet wird
      // mit dem, was in den Daten steht (etwa „nach Schicht 14“), gekürzt
      // auf die Zahl — der Achsentitel sagt bereits, worum es geht.
      var schrittweite = Math.max(1, Math.round(n / 8));
      var marken = stufen.map(function (d, i) { return { d: d, i: i }; })
        .filter(function (m) {
          return m.i === 0 || m.i === n - 1 || m.i % schrittweite === 0;
        });
      var mk = gMarken.selectAll("text").data(marken, function (m) { return m.i; });
      mk.exit().remove();
      mk.enter().append("text").attr("text-anchor", "middle")
        .merge(mk)
        .attr("x", function (m) { return x(m.i); })
        .attr("y", hoehe - unten + 16)
        .text(function (m) {
          if (m.i === 0) { return "Tabelle"; }
          var t = String(m.d.stufe || m.d.text || m.i);
          var zahl2 = t.match(/(\\d+)/);
          return zahl2 ? zahl2[1] : String(m.i);
        });

      var p = gPunkte.selectAll("circle").data(stufen, function (d, i) { return i; });
      p.exit().remove();
      p.enter().append("circle").attr("r", 3.5)
        .merge(p)
        .attr("class", function (d) { return d.wechsel ? "wechsel" : null; })
        .transition().duration(dauer)
        .attr("cx", function (d, i) { return x(i); })
        .attr("cy", function (d) { return y(d.p); })
        .attr("r", function (d) { return d.wechsel ? 5.5 : 3.5; });

      // Beschriftung nur an den Stellen, an denen die Antwort wechselt —
      // sonst waere die Kurve mit 29 Woertern zugestellt.
      var w = gWechsel.selectAll("text").data(
        stufen.map(function (d, i) { return { d: d, i: i }; })
              .filter(function (x) { return x.d.wechsel; }),
        function (x) { return x.i; });
      w.exit().remove();
      w.enter().append("text").attr("text-anchor", "middle")
        .merge(w)
        .transition().duration(dauer)
        .attr("x", function (x) { return x.i > n / 2 ? x.i * 0 + 0 : 0; })
        .attr("transform", function (x) {
          return "translate(" + x.i * 0 + ",0)";
        })
        .attr("x", function (x) { return x.i; })
        .attr("x", function (x) { return d3.scaleLinear().domain([0, Math.max(1, n - 1)]).range([links + 6, breite - 18])(x.i); })
        .attr("y", function (x) { return y(x.d.p) - 12; })
        .text(function (x) { return sichtbar(x.d.text); });
    };
  }

  // =======================================================================
  // Gitter — Stufe mal Position
  // =======================================================================

  function gitter(wurzel, opts) {
    opts = opts || {};
    var links = opts.links || 190;
    var fuss = opts.xTitel ? 26 : 0;
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-gitter")
      .attr("width", "100%");
    var gZellen = svg.append("g");
    var gText = svg.append("g").attr("class", "zelltext");
    var gZeilen = svg.append("g").attr("class", "beschriftung");
    var gSpalten = svg.append("g").attr("class", "beschriftung kopf");
    // Zweite Kopfzeile: worauf beziehen sich die Zellen? Ohne sie muss man
    // die Bezugsgroesse im Fliesstext suchen — und tut es nicht.
    var gSpalten2 = svg.append("g").attr("class", "beschriftung kopf zwei");
    var achse = svg.append("g").attr("class", "achse");
    var xT = opts.xTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.xTitel) : null;
    var yT = opts.yTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.yTitel) : null;
    // Rahmen um die gewaehlte Spalte: welche Stelle des Satzes gerade
    // gemeint ist, muss IM Bild stehen.
    var spaltenRahmen = svg.append("rect").attr("class", "auswahl")
      .attr("fill", "none").attr("stroke", auswahlfarbe()).attr("stroke-width", 2)
      .attr("rx", 3).style("opacity", 0);

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var Z = d.zeilen.length, S = d.spalten.length;
      var oben = d.spalten2 ? 40 : 22;
      var zb = Math.max(46, Math.min(96, Math.floor(880 / Math.max(1, S))));
      var zh = 22;
      var b = links + S * zb + 12, h = oben + Z * zh + 12 + fuss;
      svg.attr("viewBox", "0 0 " + b + " " + h).attr("height", h)
         .style("max-width", b + "px");
      if (xT) { xT.attr("x", links + S * zb / 2).attr("y", h - 8); }
      if (yT) {
        yT.attr("transform", "translate(13," + (oben + Z * zh / 2) + ") rotate(-90)");
      }

      var zellen = [];
      d.zellen.forEach(function (zeile, i) {
        zeile.forEach(function (c, j) {
          zellen.push({ id: i + ":" + j, i: i, j: j, p: c.p, text: c.text });
        });
      });

      var r = gZellen.selectAll("rect").data(zellen, function (c) { return c.id; });
      r.exit().remove();
      r.enter().append("rect").attr("rx", 2)
        .merge(r)
        .attr("x", function (c) { return links + c.j * zb; })
        .attr("y", function (c) { return oben + c.i * zh; })
        .attr("width", zb - 2).attr("height", zh - 2)
        .transition().duration(dauer)
        .attr("fill", function (c) { return hitze(c.p); });

      var t = gText.selectAll("text").data(zellen, function (c) { return c.id; });
      t.exit().remove();
      t.enter().append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .merge(t)
        .attr("x", function (c) { return links + c.j * zb + zb / 2; })
        .attr("y", function (c) { return oben + c.i * zh + zh / 2; })
        .attr("fill", function (c) { return PALETTE.schriftAuf(c.p); })
        .text(function (c) {
          var s = sichtbar(c.text);
          var grenze = Math.max(3, Math.floor(zb / 7));
          return s.length > grenze ? s.slice(0, grenze - 1) + "…" : s;
        });

      var zl = gZeilen.selectAll("text").data(d.zeilen, function (x, i) { return i; });
      zl.exit().remove();
      zl.enter().append("text").attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .merge(zl)
        .attr("x", links - 8)
        .attr("y", function (x, i) { return oben + i * zh + zh / 2; })
        .text(function (x) { return x; });

      var grenze = Math.max(3, Math.floor(zb / 7));
      function kuerzen(x) {
        var s = sichtbar(x);
        return s.length > grenze ? s.slice(0, grenze - 1) + "…" : s;
      }

      var sp = gSpalten.selectAll("text").data(d.spalten, function (x, i) { return i; });
      sp.exit().remove();
      sp.enter().append("text").attr("text-anchor", "middle")
        .merge(sp)
        .attr("x", function (x, i) { return links + i * zb + zb / 2; })
        .attr("y", d.spalten2 ? oben - 24 : oben - 8)
        .text(kuerzen);

      var sp2 = gSpalten2.selectAll("text")
        .data(d.spalten2 || [], function (x, i) { return i; });
      sp2.exit().remove();
      sp2.enter().append("text").attr("text-anchor", "middle")
        .merge(sp2)
        .attr("x", function (x, i) { return links + i * zb + zb / 2; })
        .attr("y", oben - 8)
        .text(kuerzen);

      if (d.spalte !== undefined && d.spalte !== null && d.spalte >= 0) {
        spaltenRahmen.style("opacity", 1).transition().duration(dauer)
          .attr("x", links + d.spalte * zb - 2)
          .attr("y", oben - 2)
          .attr("width", zb + 2).attr("height", Z * zh + 2);
      } else {
        spaltenRahmen.style("opacity", 0);
      }
    };
  }

  // =======================================================================
  // Landkarte — ALLE Schichten mal ALLE Koepfe auf einmal
  //
  // Bisher zeigte der Demonstrator immer einen Kopf einer Schicht: einen von
  // 448. Wer so sucht, findet den auffaelligen Kopf nie. Hier steht jeder
  // Kopf als ein Feld, eingefaerbt nach einer waehlbaren Kennzahl.
  // =======================================================================

  // Eigene Skala fuer die Landkarte: mehrere Stuetzpunkte statt einer
  // Gamma-Kurve. Das gibt ueber den ganzen Bereich sichtbare Abstufungen —
  // entscheidend, wenn 448 Werte auf einmal unterschieden werden sollen.
  // Als Funktion, damit sie beim Umschalten der Fassung mitgeht.
  function LANDFARBE(t) { return PALETTE.hitze()(t); }

  function landkarte(wurzel, opts) {
    opts = opts || {};
    var links = opts.links === undefined ? (opts.yTitel ? 98 : 78) : opts.links;
    var oben = opts.oben === undefined ? 42 : opts.oben;
    var zb = opts.zelle || 30, zh = opts.zeile || 19;

    var svg = d3.select(wurzel).append("svg").attr("class", "d3-landkarte")
      .attr("width", "100%");
    var gZellen = svg.append("g");
    var gZeilen = svg.append("g").attr("class", "beschriftung");
    var gSpalten = svg.append("g").attr("class", "beschriftung kopf");
    var achsL = svg.append("text").attr("class", "achsentitel leise");
    var achsO = svg.append("text").attr("class", "achsentitel");
    var achsY = opts.yTitel ? svg.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.yTitel) : null;
    var rahmen = svg.append("rect").attr("class", "auswahl")
      .attr("fill", "none").attr("stroke", auswahlfarbe()).attr("stroke-width", 2)
      .attr("rx", 2).style("opacity", 0);

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var S = d.werte.length, H = S ? d.werte[0].length : 0;
      var b = links + H * zb + 16, h = oben + S * zh + 30;
      svg.attr("viewBox", "0 0 " + b + " " + h).attr("height", h)
         .style("max-width", b + "px");

      // Die Skala wird auf das 2.- bis 98.-Perzentil gelegt, nicht auf die
      // Extremwerte. Sonst drueckt ein einziger Ausreisser — und davon gibt
      // es bei Aufmerksamkeitskoepfen regelmaessig welche — alle uebrigen
      // 447 Felder auf dieselbe Farbe, und die Landkarte zeigt nichts.
      var alleWerte = [];
      d.werte.forEach(function (z) {
        z.forEach(function (w) { alleWerte.push(w); });
      });
      alleWerte.sort(function (a, c) { return a - c; });
      function perzentil(q) {
        if (!alleWerte.length) { return 0; }
        var i = Math.min(alleWerte.length - 1,
                         Math.max(0, Math.round(q * (alleWerte.length - 1))));
        return alleWerte[i];
      }
      var min = d.min !== undefined ? d.min : perzentil(0.02);
      var max = d.max !== undefined ? d.max : perzentil(0.98);
      if (max <= min) { max = min + 1e-9; }
      var spanne = max - min;

      var zellen = [];
      d.werte.forEach(function (zeile, s) {
        zeile.forEach(function (w, k) {
          zellen.push({ id: s + ":" + k, s: s, k: k, w: w,
                        n: Math.max(0, Math.min(1, (w - min) / spanne)) });
        });
      });

      var sel = gZellen.selectAll("rect").data(zellen, function (c) { return c.id; });
      sel.exit().remove();
      var neu = sel.enter().append("rect").attr("rx", 2)
        .attr("fill", PALETTE.zeichner("maskiert"))
        .style("cursor", d.beiKlick ? "pointer" : "default");
      if (d.beiKlick) {
        neu.on("click", function (ev, c) { d.beiKlick(c.s, c.k, c.w); });
        neu.append("title");
      }
      var alle = neu.merge(sel)
        .attr("x", function (c) { return links + c.k * zb; })
        .attr("y", function (c) { return oben + c.s * zh; })
        .attr("width", zb - 2).attr("height", zh - 2);
      alle.select("title").text(function (c) {
        return "Schicht " + (c.s + 1) + " · Kopf " + (c.k + 1) + ": " +
          (d.form ? d.form(c.w) : c.w);
      });
      alle.transition().duration(dauer)
        .attr("fill", function (c) { return LANDFARBE(c.n); });

      // Zeilen: nur jede zweite Schicht beschriften, sonst klebt es
      var zl = gZeilen.selectAll("text").data(d3.range(S), function (i) { return i; });
      zl.exit().remove();
      zl.enter().append("text").attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .merge(zl)
        .attr("x", links - 8)
        .attr("y", function (i) { return oben + i * zh + zh / 2; })
        .text(function (i) {
          return (i === 0 || i === S - 1 || (i + 1) % 4 === 0)
            ? "Schicht " + (i + 1) : "";
        });

      var sp = gSpalten.selectAll("text").data(d3.range(H), function (i) { return i; });
      sp.exit().remove();
      sp.enter().append("text").attr("text-anchor", "middle")
        .merge(sp)
        .attr("x", function (i) { return links + i * zb + zb / 2; })
        .attr("y", oben - 8)
        .text(function (i) { return String(i + 1); });

      achsO.attr("x", links).attr("y", oben - 22)
        .text(opts.xTitel || "Kopf →");
      if (achsY) {
        achsY.attr("transform",
          "translate(13," + (oben + S * zh / 2) + ") rotate(-90)");
      }
      achsL.attr("x", 4).attr("y", oben + S * zh + 20)
        .text(d.legende || "");

      if (d.auswahl) {
        rahmen.style("opacity", 1).transition().duration(dauer)
          .attr("x", links + d.auswahl[1] * zb - 1)
          .attr("y", oben + d.auswahl[0] * zh - 1)
          .attr("width", zb).attr("height", zh);
      } else {
        rahmen.style("opacity", 0);
      }
    };
  }

  // =======================================================================
  // Dimensionsfeld — Stufen mal ALLE 2 048 Zahlen des Zustands
  //
  // 59 392 Werte. Als SVG-Rechtecke waere das unbedienbar, deshalb Canvas
  // mit direkt geschriebenen Bildpunkten. Die Ueberblendung von einem Stand
  // zum naechsten wird von Hand interpoliert, damit auch hier gilt: man
  // sieht, WAS sich aendert, nicht nur DASS.
  // =======================================================================

  function dimensionsfeld(wurzel, opts) {
    opts = opts || {};
    var zeilenHoehe = opts.zeile || 11;
    var links = opts.links === undefined ? 132 : opts.links;

    // Achsentitel als DOM-Elemente statt im Bild: das Bild ist eine
    // Leinwand mit einem Bildpunkt je Zahl — dort ist kein Platz fuer
    // Schrift, und skaliert wuerde sie unlesbar.
    var aussen = d3.select(wurzel).append("div").attr("class", "dimfeld-aussen");
    if (opts.yTitel) {
      aussen.append("div").attr("class", "dimfeld-ytitel").text(opts.yTitel);
    }
    var huelle = aussen.append("div").attr("class", "dimfeld");
    var leiste = huelle.append("div").attr("class", "dimfeld-namen");
    var bildhuelle = huelle.append("div").attr("class", "dimfeld-huelle");
    var c = bildhuelle.append("canvas").attr("class", "dimfeld-bild").node();
    var ctx = c.getContext("2d");
    var marke = bildhuelle.append("div").attr("class", "dimfeld-marke").node();
    var markeText = bildhuelle.append("div").attr("class", "dimfeld-markentext").node();
    var xTitelText = null;
    if (opts.xTitel) {
      var xz = aussen.append("div").attr("class", "dimfeld-xtitel");
      xz.append("span").style("width", links + "px");
      xTitelText = xz.append("span").attr("class", "titel").text(opts.xTitel);
    }
    var alt = null, laeuft = null;

    c.addEventListener("mousemove", function (ev) {
      if (!alt || !opts.beiZeigen) { return; }
      var r = c.getBoundingClientRect();
      var d = Math.floor((ev.clientX - r.left) / r.width * alt[0].length);
      var s = Math.floor((ev.clientY - r.top) / r.height * alt.length);
      if (d >= 0 && s >= 0 && s < alt.length) { opts.beiZeigen(d, s, alt[s][d]); }
    });
    c.addEventListener("click", function (ev) {
      if (!alt || !opts.beiKlick) { return; }
      var r = c.getBoundingClientRect();
      var d = Math.floor((ev.clientX - r.left) / r.width * alt[0].length);
      if (d >= 0) { opts.beiKlick(d); }
    });

    function malen(Z) {
      var S = Z.length, D = Z[0].length;
      c.width = D; c.height = S * zeilenHoehe;
      c.style.width = "100%";
      c.style.height = (S * zeilenHoehe) + "px";
      var bild = ctx.createImageData(D, S * zeilenHoehe);
      var p = bild.data;
      for (var s = 0; s < S; s++) {
        for (var d = 0; d < D; d++) {
          var w = Z[s][d];
          // Dieselbe zweiseitige Skala wie die Farbleiste darunter — aus
          // EINER Quelle. Frueher stand die Farbrechnung hier ein zweites
          // Mal woertlich im Code; beim Umfaerben haette man zwangslaeufig
          // eine der beiden Stellen vergessen, und die Legende zeigte dann
          // eine andere Skala als das Bild.
          // Ausschlag: |w| = 3 ist voll ausgefaerbt (Standardabweichungen).
          var farbe = zweiseitigRGB(w / 3);
          var r = farbe[0], g = farbe[1], bl = farbe[2];
          for (var y = 0; y < zeilenHoehe; y++) {
            var o = ((s * zeilenHoehe + y) * D + d) * 4;
            var rand = (y === zeilenHoehe - 1) ? 0.45 : 1;   // feine Trennlinie
            p[o] = Math.round(r * rand);
            p[o + 1] = Math.round(g * rand);
            p[o + 2] = Math.round(bl * rand);
            p[o + 3] = 255;
          }
        }
      }
      ctx.putImageData(bild, 0, 0);
    }

    // Die Bedeutung der x-Achse HAENGT AN DER SORTIERUNG: sind die Spalten
    // umsortiert, steht dort nicht mehr "Dimension 0 … 2047". Ein fester
    // Achsentitel waere dann schlicht falsch, deshalb ist er nachsetzbar.
    zeichne.setzeXTitel = function (t) {
      if (xTitelText) { xTitelText.text(t); }
    };
    return zeichne;

    function zeichne(d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var Z = d.z;
      leiste.style("width", links + "px");
      var n = leiste.selectAll("div").data(d.stufen, function (x, i) { return i; });
      n.exit().remove();
      n.enter().append("div").merge(n)
        .style("height", zeilenHoehe + "px")
        .text(function (x, i) {
          return (i === 0 || i === d.stufen.length - 1 || (i % 4 === 0)) ? x : "";
        });

      markeSetzen(d.marke, d.markeText, Z[0].length);

      if (laeuft) { cancelAnimationFrame(laeuft); laeuft = null; }
      if (!alt || alt.length !== Z.length || alt[0].length !== Z[0].length || !dauer) {
        alt = Z; malen(Z);
        return;
      }
      var von = alt, t0 = performance.now();
      (function schritt(t) {
        var f = Math.min(1, (t - t0) / dauer);
        var e = f * f * (3 - 2 * f);
        var Zw = von.map(function (zeile, s) {
          return zeile.map(function (w, i) { return w + (Z[s][i] - w) * e; });
        });
        malen(Zw);
        if (f < 1) { laeuft = requestAnimationFrame(schritt); }
        else { alt = Z; laeuft = null; }
      })(t0);
    }

    /** Eine senkrechte Marke im Feld, mit Beschriftung.
     *
     *  Die Marke liegt IM Bildbereich (eigene Huelle), nicht ueber der
     *  ganzen Zeile — sonst muesste die Breite der Namensleiste in die
     *  Rechnung, und die steht erst nach dem Layout fest. */
    function markeSetzen(spalte, text, D) {
      if (spalte === undefined || spalte === null || spalte < 0) {
        marke.style.display = "none";
        markeText.style.display = "none";
        return;
      }
      var anteil = Math.max(0, Math.min(1, spalte / D));
      marke.style.display = "block";
      marke.style.left = (anteil * 100) + "%";
      if (text) {
        markeText.style.display = "block";
        markeText.style.left = (anteil * 100) + "%";
        markeText.textContent = text;
      } else {
        markeText.style.display = "none";
      }
    }
  }

  // =======================================================================
  // Doppelsaeulen — zwei Bauteile je Schicht nebeneinander
  // =======================================================================

  function doppelsaeulen(wurzel, opts) {
    opts = opts || {};
    var breite = opts.breite || 1060, hoehe = opts.hoehe || 300;
    var unten = opts.xTitel ? 64 : 46, links = opts.yTitel ? 80 : 56, oben = 14;
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-saeulen")
      .attr("width", "100%").attr("viewBox", "0 0 " + breite + " " + hoehe)
      .attr("height", hoehe);
    var gA = svg.append("g"), gB = svg.append("g");
    var achse = svg.append("g").attr("class", "achse");
    achse.append("line").attr("x1", links).attr("x2", breite - 10)
      .attr("y1", hoehe - unten).attr("y2", hoehe - unten);
    var yText = achse.append("text").attr("x", links - 8).attr("y", oben + 6)
      .attr("text-anchor", "end");
    achse.append("text").attr("x", links - 8).attr("y", hoehe - unten)
      .attr("text-anchor", "end").text("0");
    if (opts.yTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("transform", "translate(18," + ((hoehe - unten + oben) / 2) + ") rotate(-90)")
        .attr("text-anchor", "middle").text(opts.yTitel);
    }
    if (opts.xTitel) {
      achse.append("text").attr("class", "achsentitel")
        .attr("x", (links + breite) / 2).attr("y", hoehe - 10)
        .attr("text-anchor", "middle").text(opts.xTitel);
    }
    var beschriftung = svg.append("g").attr("class", "beschriftung");

    return function (a, bWerte, labels, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var n = a.length;
      var bb = (breite - links - 14) / Math.max(1, n);

      // Die Achse wird NICHT auf den Hoechstwert gelegt. Die erste Schicht
      // baut den Zustand regelmaessig um ein Vielfaches um (mehrere hundert
      // Prozent), alle uebrigen liegen weit darunter — eine Achse bis zum
      // Hoechstwert macht 27 von 28 Schichten unsichtbar. Stattdessen wird
      // auf ein oberes Perzentil skaliert; was darueber liegt, wird an der
      // Decke abgeschnitten und mit seinem echten Wert beschriftet.
      var alle = a.concat(bWerte).slice().sort(function (x, y2) { return x - y2; });
      var p90 = alle[Math.min(alle.length - 1, Math.round(0.90 * (alle.length - 1)))];
      var echtesMax = alle[alle.length - 1] || 1;
      var max = Math.max(p90 * 1.25, 0.02);
      if (max > echtesMax) { max = echtesMax; }
      var y = d3.scaleLinear().domain([0, max]).range([0, hoehe - unten - oben]);
      yText.text(Math.round(max * 100) + " %" + (echtesMax > max ? " ↑" : ""));

      function spur(g, werte, versatz, farbe) {
        var s = g.selectAll("rect").data(werte.map(function (w, i) {
          return { i: i, w: w, ab: w > max };
        }), function (d) { return d.i; });
        s.exit().remove();
        s.enter().append("rect")
          .attr("y", hoehe - unten).attr("height", 0).attr("fill", farbe)
          .merge(s)
          .attr("x", function (d) { return links + d.i * bb + versatz; })
          .attr("width", Math.max(1.2, bb / 2 - 1.5))
          .attr("fill", farbe)
          .attr("opacity", function (d) { return d.ab ? 0.75 : 1; })
          .transition().duration(dauer)
          .attr("y", function (d) { return hoehe - unten - y(Math.min(d.w, max)); })
          .attr("height", function (d) { return Math.max(0, y(Math.min(d.w, max))); });

        // Nur ECHTE Ausreisser bekommen ihren Wert an die Spitze. Alles, was
        // nur knapp ueber der Decke liegt, wuerde sich sonst mit den
        // Nachbarbeschriftungen ueberlagern und nichts mehr aussagen.
        var t2 = g.selectAll("text").data(werte.map(function (w, i) {
          return { i: i, w: w };
        }).filter(function (d) { return d.w > max * 1.5; }), function (d) { return d.i; });
        t2.exit().remove();
        t2.enter().append("text").attr("text-anchor", "middle")
          .attr("font-size", "10px").attr("fill", farbe)
          .merge(t2)
          .attr("x", function (d) { return links + d.i * bb + versatz + bb / 4; })
          .attr("y", oben - 2)
          .text(function (d) { return Math.round(d.w * 100) + " %"; });
      }
      spur(gA, a, 1, PALETTE.token("--cyan"));
      spur(gB, bWerte, bb / 2 + 0.5, auswahlfarbe());

      var t = beschriftung.selectAll("text").data(labels || [], function (x, i) { return i; });
      t.exit().remove();
      t.enter().append("text").attr("text-anchor", "middle")
        .merge(t)
        .attr("x", function (x, i) { return links + (i + 0.5) * bb; })
        .attr("y", hoehe - unten + 18)
        .text(function (x) { return x; });
    };
  }

  // =======================================================================
  // Positionsfeld — Schicht mal Position (rechteckig, nicht quadratisch)
  // =======================================================================

  function positionsfeld(wurzel, opts) {
    opts = opts || {};
    var links = opts.links === undefined ? (opts.yTitel ? 94 : 74) : opts.links;
    var oben = opts.oben === undefined ? 30 : opts.oben;
    var zh = opts.zeile || 15;
    var fuss = opts.xTitel ? 26 : 0;

    var svg = d3.select(wurzel).append("svg").attr("class", "d3-posfeld")
      .attr("width", "100%");
    var gZellen = svg.append("g");
    var gZeilen = svg.append("g").attr("class", "beschriftung");
    var gSpalten = svg.append("g").attr("class", "beschriftung kopf");
    var achse = svg.append("g").attr("class", "achse");
    var xT = opts.xTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.xTitel) : null;
    var yT = opts.yTitel ? achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle").text(opts.yTitel) : null;
    var spaltenRahmen = svg.append("rect").attr("class", "auswahl")
      .attr("fill", "none").attr("stroke", auswahlfarbe()).attr("stroke-width", 2)
      .attr("rx", 3).style("opacity", 0);

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var S = d.werte.length, T = S ? d.werte[0].length : 0;
      var zb = Math.max(22, Math.min(76, Math.floor(820 / Math.max(1, T))));
      var b = links + T * zb + 12, h = oben + S * zh + 12 + fuss;
      svg.attr("viewBox", "0 0 " + b + " " + h).attr("height", h)
         .style("max-width", b + "px");
      if (xT) { xT.attr("x", links + T * zb / 2).attr("y", h - 8); }
      if (yT) {
        yT.attr("transform", "translate(13," + (oben + S * zh / 2) + ") rotate(-90)");
      }

      // Wie bei der Landkarte auf ein oberes Perzentil skalieren statt auf
      // den Hoechstwert: die erste Schicht baut den Zustand um ein
      // Vielfaches um und wuerde alle uebrigen 27 Zeilen auf dieselbe dunkle
      // Farbe druecken. Was darueber liegt, faerbt voll aus.
      var flach = [];
      d.werte.forEach(function (z) { z.forEach(function (w) { flach.push(w); }); });
      flach.sort(function (a, c) { return a - c; });
      var max = d.max;
      if (max === undefined) {
        max = flach.length
          ? flach[Math.min(flach.length - 1, Math.round(0.94 * (flach.length - 1)))]
          : 1;
        if (!(max > 0)) { max = flach[flach.length - 1] || 1; }
      }

      var zellen = [];
      d.werte.forEach(function (zeile, s) {
        zeile.forEach(function (w, t) {
          zellen.push({ id: s + ":" + t, s: s, t: t, w: w });
        });
      });

      var sel = gZellen.selectAll("rect").data(zellen, function (c) { return c.id; });
      sel.exit().remove();
      sel.enter().append("rect").attr("fill", PALETTE.zeichner("maskiert"))
        .append("title");
      var alle = gZellen.selectAll("rect")
        .attr("x", function (c) { return links + c.t * zb; })
        .attr("y", function (c) { return oben + c.s * zh; })
        .attr("width", zb - 1.5).attr("height", zh - 1.5);
      alle.select("title").text(function (c) {
        return "Schicht " + (c.s + 1) + " · " + (d.spalten[c.t] || "") + ": " +
          (c.w * 100).toFixed(1).replace(".", ",") + " %";
      });
      alle.transition().duration(dauer)
        .attr("fill", function (c) { return hitze(Math.min(1, c.w / max)); });

      var zl = gZeilen.selectAll("text").data(d3.range(S), function (i) { return i; });
      zl.exit().remove();
      zl.enter().append("text").attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .merge(zl)
        .attr("x", links - 8)
        .attr("y", function (i) { return oben + i * zh + zh / 2; })
        .text(function (i) {
          return (i === 0 || i === S - 1 || (i + 1) % 3 === 0) ? "Schicht " + (i + 1) : "";
        });

      var sp = gSpalten.selectAll("text").data(d.spalten, function (x, i) { return i; });
      sp.exit().remove();
      sp.enter().append("text").attr("text-anchor", "start")
        .merge(sp)
        .attr("class", function (x, i) { return i === d.spalte ? "gewaehlt" : null; })
        .attr("transform", function (x, i) {
          return "translate(" + (links + i * zb + zb / 2 + 4) + "," + (oben - 8) + ") rotate(-38)";
        })
        .text(function (x) {
          var s = sichtbar(x);
          return s.length > 11 ? s.slice(0, 10) + "…" : s;
        });

      if (d.spalte !== undefined && d.spalte !== null && d.spalte >= 0) {
        spaltenRahmen.style("opacity", 1).transition().duration(dauer)
          .attr("x", links + d.spalte * zb - 2)
          .attr("y", oben - 2)
          .attr("width", zb + 1.5).attr("height", S * zh + 1.5);
      } else {
        spaltenRahmen.style("opacity", 0);
      }
    };
  }

  // =======================================================================
  // Flussbild (Sankey) — vom Satz zur naechsten Fortsetzung
  //
  // Die Bauform ist dem Transformer Explainer (Georgia Tech) abgeschaut:
  // Baender statt Pfeile, Breite gleich Menge. Der Unterschied zu einem
  // gemalten Schaubild ist, dass hier JEDE Breite eine gemessene Groesse
  // ist — links die Aufmerksamkeit, rechts die Wahrscheinlichkeit, und in
  // der Wirkungsansicht die tatsaechliche Verschiebung durch Weglassen.
  //
  // Zwei Ansichten, weil zwei verschiedene Fragen:
  //   "weg"     — WIE laeuft es: Satz -> eine Stelle -> Verteilung. Der
  //               Engpass in der Mitte ist die Aussage: alles muss durch
  //               EINEN Zustand.
  //   "wirkung" — WAS bewirkt ein Wort: direkte Baender vom Satzstueck zum
  //               Kandidaten, Breite gleich gemessene Verschiebung.
  // =======================================================================

  function band(x0, y0, x1, y1, d0, d1) {
    var xm = (x0 + x1) / 2;
    return "M" + x0 + "," + (y0 - d0) +
           "C" + xm + "," + (y0 - d0) + " " + xm + "," + (y1 - d1) +
           " " + x1 + "," + (y1 - d1) +
           "L" + x1 + "," + (y1 + d1) +
           "C" + xm + "," + (y1 + d1) + " " + xm + "," + (y0 + d0) +
           " " + x0 + "," + (y0 + d0) + "Z";
  }

  // =======================================================================
  // „Vorhersage als Netz“ — die urspruengliche Anschauung, wiederhergestellt
  //
  // Diese Darstellung stammt aus dem ersten Demonstrator
  // (`lehre/demo_src/app.js`, Commit 4ad059b, Zeile 1591 ff.,
  // „Vorhersage als Netz — Kantendicke ist die Wahrscheinlichkeit“). Sie
  // wurde beim Umbau auf den Server-Demonstrator ersatzlos durch eine
  // Balkenliste ersetzt — das war ein Verlust, denn die Balkenliste zeigt
  // die Verteilung, aber nicht den BEZUG zwischen Kontext und Fortsetzung.
  //
  // Uebernommen ist die Geometrie des Originals: Kontext als gerundete
  // Kaesten nebeneinander, ein Knick nach rechts, von dort Bezier-Kanten zu
  // den Kandidatenkaesten, Kantendicke gleich Wahrscheinlichkeit, der beste
  // Kandidat hervorgehoben, Prozentwert rechts daneben in Festbreitenschrift.
  // Geaendert ist nur die Technik (SVG statt Leinwand, damit die Kanten
  // anklickbar sind) und die Quelle der Zahlen: nicht mehr Trigramm-
  // Haeufigkeiten aus einem Textbestand, sondern das echte Modell.
  // =======================================================================

  var URFARBE = {
    get cyan() { return PALETTE.token("--cyan"); },
    get teal() { return PALETTE.token("--teal"); },
    get tief() { return PALETTE.token("--primary-deep"); },
    get rand() { return PALETTE.token("--rand"); },
    get elev() { return PALETTE.token("--bg-elev"); },
    get text() { return PALETTE.token("--text"); },
    get muted() { return PALETTE.token("--text-muted"); }
  };

  function vorhersagenetz(wurzel, opts) {
    opts = opts || {};
    var B = opts.breite || 900;

    var svg = d3.select(wurzel).append("svg").attr("class", "d3-urnetz")
      .attr("width", "100%");
    var gKanten = svg.append("g").attr("class", "kanten");
    var gKasten = svg.append("g").attr("class", "kaesten");
    var gText = svg.append("g").attr("class", "beschriftung");
    var achse = svg.append("g").attr("class", "achse");
    var xT = achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle");
    var yT = achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "start");

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var kand = d.kandidaten || [];
      var kontext = d.kontext || [];      // die letzten Stuecke, als Kaesten
      var mehr = d.mehr || 0;             // wieviele Stuecke davor wegblieben

      // Maße wie im Original (Leinwand 840 x 340), auf die Breite gestreckt.
      var kastenH = 38, abstand = 48;
      var H = Math.max(240, 42 + kand.length * abstand + 40);
      var kandX = B - 290, kandB = 152;
      svg.attr("viewBox", "0 0 " + B + " " + H).attr("height", H)
         .style("max-width", B + "px");

      var mitteY = H / 2;
      xT.attr("x", (kandX + kandB / 2)).attr("y", 16)
        .text("mögliche nächste Stücke");
      yT.attr("x", 6).attr("y", H - 8)
        .text("Kontext — Ihr Satz bis hierher");

      // --- Kontextkaesten links ------------------------------------------
      var kb = 150, luecke = 12;
      var startX = 14;
      var kk = kontext.map(function (t, i) {
        return { id: "kx" + i, x: startX + i * (kb + luecke), y: mitteY - 23,
                 b: kb, h: 46, t: sichtbar(t.text), index: t.index,
                 gewaehlt: t.index === d.markiert, kontext: true };
      });
      var knickX = kk.length ? kk[kk.length - 1].x + kb + 34 : 200;

      var kkk = kand.map(function (k, i) {
        return { id: "kd" + i, x: kandX, y: 42 + i * abstand, b: kandB,
                 h: kastenH, t: sichtbar(k.text), best: i === 0,
                 gewaehlt: i === d.markierterKandidat, kandidat: i };
      });

      // --- Kanten: Knick -> Kandidat, Dicke = Wahrscheinlichkeit ----------
      var max = kand.length ? kand[0].p : 1;
      var kanten = kand.map(function (k, i) {
        var y = 42 + i * abstand + kastenH / 2;
        return {
          id: "e" + i, i: i,
          d: "M" + knickX + "," + mitteY +
             "C" + (knickX + 116) + "," + mitteY + " " +
             (kandX - 80) + "," + y + " " + kandX + "," + y,
          breite: Math.max(1, (k.p / Math.max(1e-9, max)) * 13),
          deck: 0.3 + 0.7 * (k.p / Math.max(1e-9, max)),
          best: i === 0, kandidat: i
        };
      });

      var e = gKanten.selectAll("path").data(kanten, function (x) { return x.id; });
      e.exit().remove();
      e.enter().append("path").attr("fill", "none")
        .style("cursor", d.beiKandidat ? "pointer" : "default")
        .on("click", function (ev, x) { if (d.beiKandidat) { d.beiKandidat(x.kandidat); } })
        .merge(e)
        .transition().duration(dauer)
        .attr("d", function (x) { return x.d; })
        .attr("stroke-width", function (x) { return x.breite; })
        .attr("stroke", function (x) {
          return x.kandidat === d.markierterKandidat ? auswahlfarbe()
               : (x.best ? URFARBE.cyan : URFARBE.teal);
        })
        .attr("stroke-opacity", function (x) { return x.deck; });

      // --- Kaesten --------------------------------------------------------
      var alle = kk.concat(kkk);
      var r = gKasten.selectAll("rect").data(alle, function (x) { return x.id; });
      r.exit().remove();
      r.enter().append("rect").attr("rx", 8)
        .style("cursor", "pointer")
        .on("click", function (ev, x) {
          if (x.kontext && d.beiStelle) { d.beiStelle(x.index); }
          if (x.kandidat !== undefined && d.beiKandidat) { d.beiKandidat(x.kandidat); }
        })
        .merge(r)
        .transition().duration(dauer)
        .attr("x", function (x) { return x.x; })
        .attr("y", function (x) { return x.y; })
        .attr("width", function (x) { return x.b; })
        .attr("height", function (x) { return x.h; })
        .attr("fill", function (x) {
          return x.best ? URFARBE.tief : URFARBE.elev;
        })
        .attr("stroke", function (x) {
          if (x.gewaehlt) { return auswahlfarbe(); }
          return x.best ? URFARBE.cyan : (x.kontext ? URFARBE.teal : URFARBE.rand);
        })
        .attr("stroke-width", function (x) { return x.gewaehlt ? 2.2 : 1.5; });

      // --- Beschriftung ---------------------------------------------------
      var texte = [];
      kk.forEach(function (x) {
        texte.push({ id: "t" + x.id, x: x.x + x.b / 2, y: x.y + 23,
                     anker: "middle", t: x.t, gewaehlt: x.gewaehlt });
      });
      kkk.forEach(function (x, i) {
        texte.push({ id: "t" + x.id, x: x.x + x.b / 2, y: x.y + 19,
                     anker: "middle", t: x.t, best: x.best, gewaehlt: x.gewaehlt });
        // Der Prozentwert steht wie im Original RECHTS neben dem Kasten,
        // in Festbreitenschrift — so stehen die Kommas untereinander.
        texte.push({ id: "p" + x.id, x: x.x + x.b + 12, y: x.y + 19,
                     anker: "start", t: pz(kand[i].p, 1), zahl: true });
      });
      if (mehr > 0) {
        texte.push({ id: "mehr", x: startX, y: mitteY - 34, anker: "start",
                     t: "… " + mehr + " Stück" + (mehr === 1 ? "" : "e") +
                        " davor", klein: true });
      }

      var t = gText.selectAll("text").data(texte, function (x) { return x.id; });
      t.exit().remove();
      t.enter().append("text").attr("dominant-baseline", "middle")
        .merge(t)
        .attr("x", function (x) { return x.x; })
        .attr("y", function (x) { return x.y; })
        .attr("text-anchor", function (x) { return x.anker; })
        .attr("class", function (x) {
          return x.zahl ? "zahlfeld" : (x.gewaehlt ? "gewaehlt" : null);
        })
        .attr("fill", function (x) {
          if (x.gewaehlt) { return auswahlfarbe(); }
          // Der beste Kandidat wird hervorgehoben — in der Schriftfarbe
          // der Diagramme, nicht in einem festen Weiss.
          if (x.best) { return PALETTE.token("--diagrammtext"); }
          return (x.zahl || x.klein) ? URFARBE.muted : URFARBE.text;
        })
        .style("font-family", function (x) {
          return x.zahl ? "Consolas, monospace" : null;
        })
        .style("font-size", function (x) {
          return x.zahl ? "12px" : (x.klein ? "11px" : "15px");
        })
        .text(function (x) {
          return x.t.length > 18 ? x.t.slice(0, 17) + "…" : x.t;
        });
    };
  }

  function fluss(wurzel, opts) {
    opts = opts || {};
    var breite = opts.breite || 900;
    var linksRand = opts.linksRand || 150;   // Platz fuer die Satzstuecke
    var rechtsRand = opts.rechtsRand || 150; // Platz fuer die Kandidaten
    var oben = 40, unten = 26;

    // NICHT `d3-feld`: unter dieser Klasse fuehrt `pruefe_diagramme.js` die
    // Farbflaechen und verlangt eine Farbleiste mit Zellskala. Ein Flussbild
    // ist keine Farbflaeche — seine Aussage steckt in der BREITE der
    // Baender, nicht in der Farbe einer Zelle.
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-fluss")
      .attr("width", "100%");
    // Farbverlaeufe je Band — nach dem Transformer Explainer, der seine
    // Baender nicht in Volltonfarbe, sondern mit horizontalem Verlauf und
    // Deckkraft-Stopps zeichnet. Das ist der Unterschied zwischen „ein
    // Diagramm“ und „ein Fluss“.
    var defs = svg.append("defs");
    var gBaender = svg.append("g").attr("class", "baender");
    var gVektor = svg.append("g").attr("class", "vektorsaeule");
    var gKnoten = svg.append("g").attr("class", "knoten");
    var gText = svg.append("g").attr("class", "beschriftung");
    var kennung = "fl" + Math.floor(performance.now() * 1000).toString(36);
    var achse = svg.append("g").attr("class", "achse");
    var xT = achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "middle");
    var yTl = achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "start");
    var yTr = achse.append("text").attr("class", "achsentitel")
      .attr("text-anchor", "end");

    return function (d, dauer) {
      dauer = dauer === undefined ? DAUER : dauer;
      var stellen = d.stellen || [];
      var kand = d.kandidaten || [];
      var wirkungsSicht = d.ansicht === "wirkung";

      var zh = Math.max(17, Math.min(30, 420 / Math.max(1, stellen.length)));
      var hoehe = oben + Math.max(stellen.length, kand.length) * zh + unten;
      svg.attr("viewBox", "0 0 " + breite + " " + hoehe)
         .attr("height", hoehe).style("max-width", breite + "px");

      var xL = linksRand, xM = breite / 2, xR = breite - rechtsRand;
      xT.attr("x", breite / 2).attr("y", 15)
        .text(wirkungsSicht
          ? "Bandbreite = gemessene Verschiebung der Wahrscheinlichkeit (Prozentpunkte)"
          : "Bandbreite links = Aufmerksamkeit · rechts = Wahrscheinlichkeit");
      yTl.attr("x", 4).attr("y", 32).text("Stücke Ihres Satzes ↓");
      yTr.attr("x", breite - 4).attr("y", 32).text("↓ mögliche Fortsetzung");

      // --- Lage der Knoten ------------------------------------------------
      stellen.forEach(function (s, i) { s._y = oben + i * zh + zh / 2; });
      var pSumme = 0;
      kand.forEach(function (k) { pSumme += k.p; });
      var yLauf = oben;
      kand.forEach(function (k) {
        // Hoehe des Kandidatenknotens proportional zu seiner
        // Wahrscheinlichkeit — der Balken IST die Zahl.
        k._h = Math.max(6, (k.p / Math.max(1e-9, pSumme)) *
                        (Math.max(stellen.length, kand.length) * zh - kand.length * 6));
        k._y = yLauf + k._h / 2;
        yLauf += k._h + 6;
      });

      var maxBlick = 0;
      stellen.forEach(function (s) {
        if (!s.ist_ziel) { maxBlick = Math.max(maxBlick, s.blick); }
      });
      var maxWirkung = 0;
      stellen.forEach(function (s) {
        (s.wirkung || []).forEach(function (w) {
          maxWirkung = Math.max(maxWirkung, Math.abs(w));
        });
      });

      // --- Baender --------------------------------------------------------
      var lines = [];
      if (wirkungsSicht) {
        // Nur die Baender des gewaehlten Stuecks — 13 Stuecke mal 6
        // Kandidaten waeren 78 Baender und damit ein Knaeuel. Ist nichts
        // gewaehlt, die staerksten quer ueber alle.
        var kandidatenBaender = [];
        stellen.forEach(function (s) {
          if (s.ist_ziel) { return; }
          (s.wirkung || []).forEach(function (w, j) {
            if (!kand[j]) { return; }
            kandidatenBaender.push({
              id: "w" + s.index + "-" + j, von: s, nach: kand[j],
              wert: Math.abs(w), stuetzt: w > 0, stelle: s.index
            });
          });
        });
        if (d.markiert !== null && d.markiert !== undefined) {
          lines = kandidatenBaender.filter(function (b) {
            return b.stelle === d.markiert;
          });
        } else {
          kandidatenBaender.sort(function (a, b) { return b.wert - a.wert; });
          lines = kandidatenBaender.slice(0, 14);
        }
        lines.forEach(function (b) {
          b.x0 = xL; b.y0 = b.von._y; b.x1 = xR; b.y1 = b.nach._y;
          b.d = Math.max(0.6, (b.wert / Math.max(1e-9, maxWirkung)) * 11);
        });
      } else {
        stellen.forEach(function (s) {
          if (s.ist_ziel) { return; }
          lines.push({
            id: "l" + s.index, x0: xL, y0: s._y, x1: xM, y1: hoehe / 2,
            d: Math.max(0.5, (s.blick / Math.max(1e-9, maxBlick)) * 13),
            wert: s.blick, stuetzt: true, stelle: s.index, links: true
          });
        });
        kand.forEach(function (k, j) {
          lines.push({
            id: "r" + j, x0: xM, y0: hoehe / 2, x1: xR, y1: k._y,
            d: Math.max(0.8, k._h / 2), wert: k.p, stuetzt: true,
            kandidat: j
          });
        });
      }

      // Ein Verlauf JE Band: links die Farbe der Quelle, rechts die des
      // Ziels — so wandert das Auge mit dem Fluss mit.
      function bandfarbe(x) {
        if (x.stelle !== undefined && x.stelle === d.markiert) { return auswahlfarbe(); }
        if (x.kandidat !== undefined && x.kandidat === d.markierterKandidat) {
          return auswahlfarbe();
        }
        var t = x.wert / Math.max(1e-9,
          wirkungsSicht ? maxWirkung : (x.links ? maxBlick : 1));
        return balkenfarbe(0.25 + 0.6 * Math.max(0, Math.min(1, t)));
      }
      var gd = defs.selectAll("linearGradient").data(lines, function (x) { return x.id; });
      gd.exit().remove();
      var gdNeu = gd.enter().append("linearGradient")
        .attr("id", function (x) { return kennung + "-" + x.id; })
        .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
      gdNeu.append("stop").attr("class", "s0").attr("offset", "0%");
      gdNeu.append("stop").attr("class", "s1").attr("offset", "100%");
      var gdAlle = gdNeu.merge(gd);
      gdAlle.select("stop.s0")
        .attr("stop-color", function (x) { return bandfarbe(x); })
        .attr("stop-opacity", 0.85);
      gdAlle.select("stop.s1")
        .attr("stop-color", function (x) { return bandfarbe(x); })
        .attr("stop-opacity", 0.28);

      var b = gBaender.selectAll("path").data(lines, function (x) { return x.id; });
      b.exit().remove();
      var bNeu = b.enter().append("path").attr("fill-opacity", 0.7);
      // Hover: das angefahrene Band tritt hervor, die uebrigen treten
      // zurueck — 120 ms, wie im Vorbild. Ohne das ist ein Fluss mit
      // zwanzig Baendern ein Knaeuel.
      bNeu
        .on("mouseover", function (ev, x) {
          gBaender.selectAll("path").transition().duration(120)
            .attr("fill-opacity", function (y) { return y.id === x.id ? 1 : 0.12; });
        })
        .on("mouseleave", function () {
          gBaender.selectAll("path").transition().duration(120)
            .attr("fill-opacity", function (y) { return y.stuetzt ? 0.7 : 0.35; });
        });
      bNeu.merge(b)
        .attr("stroke", function (x) {
          return x.stuetzt ? "none" : bandfarbe(x);
        })
        .attr("stroke-dasharray", function (x) { return x.stuetzt ? null : "4,3"; })
        .attr("stroke-width", function (x) { return x.stuetzt ? 0 : 1.2; })
        .transition().duration(dauer)
        .attr("d", function (x) {
          return band(x.x0, x.y0, x.x1, x.y1, x.d, x.d);
        })
        .style("fill", function (x) {
          return "url(#" + kennung + "-" + x.id + ")";
        })
        .attr("fill-opacity", function (x) { return x.stuetzt ? 0.7 : 0.35; });

      // --- Der Zustand als Saeule ----------------------------------------
      // Im Transformer Explainer steht an jeder Station der echte Vektor als
      // feines Streifenbild. Hier steht er in der Mitte: das ist der eine
      // Zustand, durch den alles hindurchmuss.
      var ziel = stellen.filter(function (s) { return s.ist_ziel; })[0];
      var saeule = (!wirkungsSicht && ziel && ziel.vektor) ? ziel.vektor : [];
      // Die Saeule muss GROSS sein, sonst ist der Zustand ein Fleck. Im
      // Vorbild ist der Vektor das auffaelligste Element der Station.
      var saeuleH = 176, saeuleB = 30;
      var sh = saeule.length ? saeuleH / saeule.length : 0;
      var sMin = 0, sMax = 1;
      if (saeule.length) {
        sMin = d3.min(saeule); sMax = d3.max(saeule);
      }
      var vs = gVektor.selectAll("rect").data(saeule.map(function (w, i) {
        return { i: i, w: w };
      }), function (x) { return x.i; });
      vs.exit().remove();
      vs.enter().append("rect")
        .merge(vs)
        .attr("x", xM - saeuleB / 2).attr("width", saeuleB)
        .attr("y", function (x) { return hoehe / 2 - saeuleH / 2 + x.i * sh; })
        .attr("height", Math.max(0.7, sh + 0.3))
        .attr("fill", function (x) {
          return balkenfarbe((x.w - sMin) / Math.max(1e-9, sMax - sMin));
        });

      // --- Knoten ---------------------------------------------------------
      var knoten = [];
      stellen.forEach(function (s) {
        knoten.push({ id: "s" + s.index, x: xL - 7, y: s._y - zh / 2 + 3,
                      w: 7, h: zh - 6, gewaehlt: s.index === d.markiert,
                      ziel: s.ist_ziel, klick: function () {
                        if (d.beiStelle) { d.beiStelle(s.index); } } });
      });
      if (!wirkungsSicht) {
        knoten.push({ id: "mitte", x: xM - saeuleB / 2 - 2,
                      y: hoehe / 2 - saeuleH / 2 - 2,
                      w: saeuleB + 4, h: saeuleH + 4, mitte: true });
      }
      kand.forEach(function (k, j) {
        knoten.push({ id: "k" + j, x: xR, y: k._y - k._h / 2, w: 7, h: k._h,
                      gewaehlt: j === d.markierterKandidat,
                      klick: function () {
                        if (d.beiKandidat) { d.beiKandidat(j); } } });
      });

      var kn = gKnoten.selectAll("rect").data(knoten, function (x) { return x.id; });
      kn.exit().remove();
      kn.enter().append("rect").attr("rx", 2)
        .style("cursor", function (x) { return x.klick ? "pointer" : "default"; })
        .on("click", function (ev, x) { if (x.klick) { x.klick(); } })
        .merge(kn)
        .attr("x", function (x) { return x.x; })
        .attr("y", function (x) { return x.y; })
        .attr("width", function (x) { return x.w; })
        .attr("height", function (x) { return Math.max(3, x.h); })
        .style("fill", function (x) {
          if (x.gewaehlt) { return auswahlfarbe(); }
          // Der Mittelknoten ist nur noch ein Rahmen: darin steht die
          // Vektorsaeule mit den echten Zahlen, die darf er nicht zudecken.
          if (x.mitte) { return "none"; }
          if (x.ziel) { return auswahlfarbe(); }
          return balkenfarbe(0.55);
        })
        .style("stroke", function (x) { return x.mitte ? balkenfarbe(0.9) : "none"; })
        .style("stroke-width", function (x) { return x.mitte ? 1.4 : 0; });

      // --- Beschriftung ---------------------------------------------------
      var texte = [];
      stellen.forEach(function (s) {
        texte.push({ id: "ts" + s.index, x: xL - 13, y: s._y, anker: "end",
                     t: sichtbar(s.text), gewaehlt: s.index === d.markiert || s.ist_ziel,
                     klick: function () {
                       if (d.beiStelle) { d.beiStelle(s.index); } } });
      });
      kand.forEach(function (k, j) {
        texte.push({ id: "tk" + j, x: xR + 13, y: k._y, anker: "start",
                     t: sichtbar(k.text) + "  " + pz(k.p, 1),
                     gewaehlt: j === d.markierterKandidat,
                     klick: function () {
                       if (d.beiKandidat) { d.beiKandidat(j); } } });
      });
      if (!wirkungsSicht) {
        texte.push({ id: "tm", x: xM, y: hoehe / 2 + saeuleH / 2 + 18,
                     anker: "middle", lang: true,
                     t: d.vektorTitel || "alles läuft durch diesen einen Zustand" });
      }

      var tx = gText.selectAll("text").data(texte, function (x) { return x.id; });
      tx.exit().remove();
      tx.enter().append("text")
        .attr("dominant-baseline", "middle")
        .style("cursor", function (x) { return x.klick ? "pointer" : "default"; })
        .on("click", function (ev, x) { if (x.klick) { x.klick(); } })
        .merge(tx)
        .attr("class", function (x) { return x.gewaehlt ? "gewaehlt" : null; })
        .attr("x", function (x) { return x.x; })
        .attr("y", function (x) { return x.y; })
        .attr("text-anchor", function (x) { return x.anker; })
        .text(function (x) {
          // Der Text unter der Saeule traegt eine Zahl („128 von 2.048“) und
          // darf deshalb nicht gekuerzt werden — eine halbe Zahl ist falsch.
          if (x.lang) { return x.t; }
          return x.t.length > 22 ? x.t.slice(0, 21) + "…" : x.t;
        });
    };
  }

  return {
    rahmen: rahmen, farbleiste: farbleiste,
    hitzefeld: hitzefeld, kleinesFeld: kleinesFeld, balken: balken,
    saeulen: saeulen, stufenkurve: stufenkurve, gitter: gitter,
    landkarte: landkarte, dimensionsfeld: dimensionsfeld,
    verwandlungstafel: verwandlungstafel, attentionkette: attentionkette,
    beitragsbalken: beitragsbalken,
    doppelsaeulen: doppelsaeulen, positionsfeld: positionsfeld,
    fluss: fluss, vorhersagenetz: vorhersagenetz,
    // Bauteilfamilien (Regel C-1). Die Farbwerte selbst kommen aus
    // palette.js; hier stehen nur die Zugaenge.
    familie: familie, familienlegende: familienlegende,
    /** Die Auswahlfarbe der laufenden Fassung. FUNKTION, nicht Wert —
     *  ein Wert waere beim Umschalten der Fassung eingefroren. */
    auswahlfarbe: auswahlfarbe,
    // Die zweiseitige Skala fuer Groessen mit Vorzeichen — dieselbe, die
    // die Farbleiste zeichnet. Wer sie selbst braucht, nimmt DIESE, damit
    // Bild und Legende nicht auseinanderlaufen.
    zweiseitig: zweiseitig,
    hitze: hitze, sichtbar: sichtbar, pz: pz, DAUER: DAUER
  };
})();
