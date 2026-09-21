/* Die Kopfansicht: Linien zwischen den Satzteilen.
 *
 * Nach dem Vorbild von BertViz (jessevig/bertviz): links die fragenden
 * Stuecke, rechts die betrachteten, dazwischen je eine Linie. Farbe = Kopf,
 * Deckkraft und Staerke = Aufmerksamkeitsgewicht. Wer will, blendet alle
 * Koepfe zugleich ein und sieht die Arbeitsteilung als Farbmuster.
 *
 * Gezeichnet mit D3 (liegt lokal unter web/vendor/), damit jede Aenderung
 * ueberblendet statt zu springen: beim Wechsel von Schicht oder Kopf wandern
 * die Linien in ihre neue Lage, statt neu aufzupoppen. Das ist kein Schmuck -
 * man sieht dadurch, WELCHE Linien sich aendern.
 */

var LINIEN = (function () {
  "use strict";

  // Farben je Kopf. Bewusst aus dem Markenspektrum abgeleitet und in der
  // Helligkeit gestaffelt, damit sich 16 Koepfe noch unterscheiden lassen.
  function kopffarbe(h, n) {
    var t = n > 1 ? h / (n - 1) : 0;
    return d3.interpolateCool(0.08 + 0.84 * t);
  }

  /** Zeichnet die Kopfansicht in `wurzel`.
   *
   *  daten = { stuecke, attention (Koepfe x T x T), koepfeAn (Menge),
   *            gewaehlt (Position oder -1) }
   *  Rueckgabe: eine Funktion zum Aktualisieren mit neuen Daten.
   */
  function bauen(wurzel, daten, beiWahl) {
    var randOben = 26, zeile = 27, spalte = 470;
    var linksX = 168, rechtsX = linksX + spalte;

    var svg = d3.select(wurzel).append("svg")
      .attr("class", "linien-svg")
      .attr("width", "100%");

    var g = svg.append("g");
    var gLinien = g.append("g").attr("class", "linien");
    var gLinks = g.append("g").attr("class", "seite links");
    var gRechts = g.append("g").attr("class", "seite rechts");

    // Ueberschriften: ohne sie sieht man denselben Satz zweimal untereinander
    // und weiss nicht, warum. Genau daran ist die erste Fassung gescheitert.
    // Sie sind die Achsentitel dieses Bildes und tragen deshalb dieselbe
    // Klasse — und damit dasselbe Aussehen — wie in allen uebrigen Diagrammen.
    var kopfLinks = svg.append("text").attr("class", "spaltenkopf achsentitel")
      .attr("text-anchor", "end").attr("y", 15)
      .text("links: dieses Wort wird gerade verarbeitet ↓");
    var kopfRechts = svg.append("text").attr("class", "spaltenkopf achsentitel")
      .attr("text-anchor", "start").attr("y", 15)
      .text("rechts: von diesen Wörtern holt es sich Information ↓");

    function zeichnen(d, dauer) {
      var T = d.stuecke.length;
      var hoehe = randOben + T * zeile + 20;
      kopfLinks.attr("x", linksX - 12);
      kopfRechts.attr("x", rechtsX + 12);
      svg.attr("viewBox", "0 0 " + (rechtsX + 190) + " " + hoehe)
         .attr("height", hoehe);

      var koepfe = d.koepfeAn;
      var nKoepfe = d.attention.length;

      // ── Linien ──────────────────────────────────────────────────────
      var kanten = [];
      koepfe.forEach(function (h) {
        var A = d.attention[h];
        for (var i = 0; i < T; i++) {
          if (d.gewaehlt >= 0 && i !== d.gewaehlt) { continue; }
          for (var j = 0; j <= i; j++) {
            var w = A[i][j];
            if (w < 0.012) { continue; }
            kanten.push({ id: h + ":" + i + ":" + j, h: h, i: i, j: j, w: w });
          }
        }
      });

      var pfad = function (k) {
        var y1 = randOben + k.i * zeile + zeile / 2;
        var y2 = randOben + k.j * zeile + zeile / 2;
        var mitte = (linksX + rechtsX) / 2;
        return "M" + linksX + "," + y1 +
               "C" + mitte + "," + y1 + " " + mitte + "," + y2 +
               " " + rechtsX + "," + y2;
      };

      var l = gLinien.selectAll("path").data(kanten, function (k) { return k.id; });

      l.exit().transition().duration(dauer * 0.6)
        .attr("stroke-opacity", 0).remove();

      var neu = l.enter().append("path")
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .attr("d", pfad)
        .attr("stroke", function (k) { return kopffarbe(k.h, nKoepfe); })
        .attr("stroke-width", 0.4)
        .attr("stroke-opacity", 0);

      // EINE LINIE MUSS EINE LINIE BLEIBEN, auch wenn sie wenig traegt.
      //
      // Befund des Anwenders, 14.08.2026: "jetzt sind die linien in der
      // grafik weg". Nachgemessen: die schwachen Linien waren 0,7 bis 1,1 px
      // breit BEI 15 bis 25 % Deckkraft. Beides zusammen ist weniger als ein
      // Fuenftel eines Bildpunktes Farbe — der Browser rechnet das zu einem
      // Grauschleier, den man nicht mehr sieht. Sichtbar war allein die
      // dickste Linie (3,3 px).
      //
      // Die Untergrenzen sind deshalb angehoben: mindestens 1,2 px breit und
      // mindestens 38 % deckend. Die STAERKE traegt weiterhin den Wert — sie
      // laeuft jetzt von 1,2 bis 8,2 px und von 0,38 bis 1,0 —, aber die
      // schwaechste Linie ist noch zu sehen, statt zu verschwinden. Eine
      // Linie, die man nicht sieht, sagt nicht "wenig", sie sagt "nichts".
      neu.merge(l).transition().duration(dauer)
        .attr("d", pfad)
        .attr("stroke", function (k) { return kopffarbe(k.h, nKoepfe); })
        .attr("stroke-width", function (k) { return 1.2 + 7.0 * Math.pow(k.w, 0.8); })
        .attr("stroke-opacity", function (k) { return 0.38 + 0.62 * Math.pow(k.w, 0.6); });

      // ── Stuecke links und rechts ────────────────────────────────────
      [["links", gLinks, linksX - 12, "end"],
       ["rechts", gRechts, rechtsX + 12, "start"]].forEach(function (seite) {
        var name = seite[0], gruppe = seite[1], x = seite[2], anker = seite[3];

        var t = gruppe.selectAll("g.stueck").data(d.stuecke.map(function (s, i) {
          return { s: s, i: i };
        }), function (x) { return x.i; });

        var e = t.enter().append("g").attr("class", "stueck");
        e.append("rect").attr("rx", 4);
        var neuText = e.append("text").attr("dominant-baseline", "middle");
        // Das Stueck UND seine Token-ID. Die ID ist die Zahl, mit der das
        // Modell tatsaechlich rechnet — ohne sie bleibt der Sprung von Text
        // zu Zahl unsichtbar. Links steht sie vor dem Wort (die Zeile ist
        // rechtsbuendig), rechts dahinter.
        neuText.append("tspan").attr("class", "erst");
        neuText.append("tspan").attr("class", "zweit");

        var alle = e.merge(t);
        alle.attr("transform", function (x) {
          return "translate(0," + (randOben + x.i * zeile) + ")";
        });
        var txt = alle.select("text")
          .attr("x", x).attr("y", zeile / 2)
          .attr("text-anchor", anker)
          .attr("class", function (x) {
            return d.gewaehlt === x.i ? "gewaehlt" : null;
          });
        var idErst = anker === "end";
        txt.select("tspan.erst")
          .attr("class", idErst ? "erst tokenid" : "erst wort")
          .text(function (x) {
            return idErst ? (d.ids ? d.ids[x.i] + "   " : "")
                          : x.s.replace(/ /g, "·");
          });
        txt.select("tspan.zweit")
          .attr("class", idErst ? "zweit wort" : "zweit tokenid")
          .text(function (x) {
            return idErst ? x.s.replace(/ /g, "·")
                          : (d.ids ? "   " + d.ids[x.i] : "");
          });
        alle.select("rect")
          .attr("x", anker === "end" ? 0 : rechtsX + 4)
          .attr("y", 2).attr("height", zeile - 4)
          .attr("width", anker === "end" ? linksX - 4 : 180)
          .attr("class", function (x) {
            return d.gewaehlt === x.i ? "gewaehlt" : "";
          })
          .style("cursor", name === "links" ? "pointer" : "default");

        if (name === "links") {
          alle.style("cursor", "pointer").on("click", function (ev, x) {
            beiWahl(d.gewaehlt === x.i ? -1 : x.i);
          });
        }
        t.exit().remove();
      });
    }

    zeichnen(daten, 0);
    return function (neueDaten, dauer) {
      zeichnen(neueDaten, dauer === undefined ? 620 : dauer);
    };
  }

  /** Balken einer Verteilung, die bei Aenderung auf ihren neuen Wert laufen. */
  function verteilungBauen(wurzel) {
    var breite = 620, zeile = 26;
    var svg = d3.select(wurzel).append("svg").attr("class", "vert-svg")
      .attr("width", "100%");
    var g = svg.append("g");

    return function (liste, dauer) {
      var hoehe = liste.length * zeile + 12;
      svg.attr("viewBox", "0 0 " + (breite + 240) + " " + hoehe)
         .attr("height", hoehe);
      var max = liste.length ? Math.max.apply(null, liste.map(function (p) { return p.p; })) : 1;
      var x = d3.scaleLinear().domain([0, max]).range([0, breite]);

      var z = g.selectAll("g.z").data(liste, function (p) { return p.id; });
      var e = z.enter().append("g").attr("class", "z");
      e.append("text").attr("class", "wort").attr("x", 150)
        .attr("text-anchor", "end").attr("dominant-baseline", "middle");
      e.append("rect").attr("class", "bar").attr("x", 160).attr("height", 13)
        .attr("rx", 3).attr("width", 0);
      e.append("text").attr("class", "wert").attr("dominant-baseline", "middle");

      var alle = e.merge(z);
      alle.transition().duration(dauer === undefined ? 520 : dauer)
        .attr("transform", function (p, i) { return "translate(0," + (i * zeile + 8) + ")"; });
      alle.select("text.wort").text(function (p) {
        return p.text.replace(/ /g, "·");
      });
      alle.select("rect.bar").transition().duration(dauer === undefined ? 520 : dauer)
        .attr("y", -6).attr("width", function (p) { return Math.max(1, x(p.p)); });
      alle.select("text.wert").transition().duration(dauer === undefined ? 520 : dauer)
        .attr("x", function (p) { return 168 + x(p.p); })
        .tween("text", function (p) {
          var self = d3.select(this);
          var alt = parseFloat(String(self.text()).replace(",", ".")) || 0;
          var i = d3.interpolateNumber(alt, p.p * 100);
          return function (t) { self.text(i(t).toFixed(1).replace(".", ",") + " %"); };
        });
      z.exit().transition().duration(260).style("opacity", 0).remove();
    };
  }

  return { bauen: bauen, verteilungBauen: verteilungBauen, kopffarbe: kopffarbe };
})();
