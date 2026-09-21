/* DAS FEEDFORWARD — der Filter mit 6.144 Schaltern.
 *
 * Das Bauteil haelt rund zwei Drittel aller Parameter eines Blocks
 * (gemessen 17.08.2026: 37.748.736 von 54.525.952 = 69,2 %) und kam im
 * Demonstrator bis dahin gar nicht vor.
 *
 * Es rechnet nicht einfach, es SCHLAEGT NACH UND SCHALTET:
 *
 *     innen = silu(gate_proj(x)) * up_proj(x)      6.144 Zahlen
 *     aus   = down_proj(innen)                     2.048 Zahlen
 *
 * `up` sagt, WAS ein Neuron beitragen wuerde. `gate` sagt, OB es
 * durchkommt. Beide Zahlen entstehen aus DEMSELBEN Zustand — dieselbe
 * Eingabe wird zweimal verschieden befragt.
 *
 * ZWEI FARBEN SIND NEU (Regel C-1a): Gate fuchsia, Up smaragd. Das
 * PRODUKT traegt die bestehende Feedforward-Farbe violett — es ist das,
 * was im grossen Bild als "Feedforward" steht. So sieht man, dass die
 * beiden Zutaten zu genau diesem Streifen werden.
 */
var FEEDFORWARD = (function () {
  "use strict";

  var FARBE = {
    zustand: [148, 163, 184],   // schiefergrau — wie im grossen Bild
    gate:    [217,  70, 239],   // fuchsia — der Schalter
    up:      [ 52, 211, 153],   // smaragd — der Inhalt
    innen:   [167, 139, 250]    // violett — das Feedforward selbst
  };
  var GELB = [255, 192, 0];

  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  /** Helligkeit traegt den Wert (Regel C-1). */
  function tonWert(basis, wert, spanne) {
    var a = Math.min(1, Math.abs(wert) / (spanne || 1));
    a = 0.16 + 0.84 * Math.pow(a, 0.6);
    return "rgb(" + Math.round(basis[0] * a) + "," + Math.round(basis[1] * a) +
      "," + Math.round(basis[2] * a) + ")";
  }

  function spanneVon(liste, feld) {
    var m = 0;
    liste.forEach(function (s) {
      (s[feld] || []).forEach(function (x) { m = Math.max(m, Math.abs(x)); });
    });
    return m || 1;
  }

  function band(x1, y1, b1, x2, y2, b2) {
    var m = (x1 + x2) / 2;
    return "M" + x1 + "," + (y1 - b1) +
      "C" + m + "," + (y1 - b1) + " " + m + "," + (y2 - b2) + " " + x2 + "," + (y2 - b2) +
      "L" + x2 + "," + (y2 + b2) +
      "C" + m + "," + (y2 + b2) + " " + m + "," + (y1 + b1) + " " + x1 + "," + (y1 + b1) + "Z";
  }

  /* ══ BILD 1 — DIE AUFWEITUNG ══════════════════════════════════════════
   *
   * 2.048 -> 6.144 -> 2.048, je Satzstueck eine Zeile. Der Zustand geht an
   * ZWEI Stellen zugleich hinein (Gate und Up); dass beide aus derselben
   * Zahl entstehen und dann multipliziert werden, ist der Kern.
   *
   * opts.beiStelle(i)
   */
  function aufweitung(wurzel, opts) {
    opts = opts || {};
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-aufweitung")
      .attr("width", "100%");
    var gBand = svg.append("g"), gStreifen = svg.append("g"),
        gKopf = svg.append("g");

    return function (d, dauer) {
      dauer = dauer === undefined ? 620 : dauer;
      var st = d.stationen, T = st.length;
      var zeile = Math.max(20, Math.min(34, 470 / Math.max(1, T)));
      var oben = 96, unten = 46;   // Platz fuer den Verzweigungsbogen
      var hoehe = Math.round(oben + T * zeile + unten);
      var breite = 1180;
      svg.attr("viewBox", "0 0 " + breite + " " + hoehe).attr("height", null);

      // GATE UND UP STEHEN NEBENEINANDER, nicht uebereinander. Der erste
      // Bau legte sie in eine Spalte; dann sieht man zwei enge Streifen,
      // aber nicht mehr, dass es ZWEI getrennte Befragungen desselben
      // Zustands sind — und das Malzeichen dazwischen hat keinen Platz.
      var X = { wort: 116, zu: 130, zuB: 74,
                gate: 258, gateB: 148, mal: 430,
                up: 452, upB: 148,
                innen: 690, innenB: 148, raus: 900, rausB: 74 };
      var y = function (i) { return oben + i * zeile + zeile / 2; };
      var zh = Math.max(7, Math.min(14, zeile * 0.36));
      var qh = zh;

      var sp = {
        gate: spanneVon(st, "gate"), up: spanneVon(st, "up"),
        innen: spanneVon(st, "innen")
      };

      // Kopfzeile
      var kopf = [
        ["Zustand " + tausend(d.breiten.zustand), X.zu, "start", null],
        ["Gate " + tausend(d.breiten.feedforward), X.gate, "start", "gate"],
        ["Up " + tausend(d.breiten.feedforward), X.up, "start", "up"],
        ["Produkt " + tausend(d.breiten.feedforward), X.innen, "start", "innen"],
        ["zurück " + tausend(d.breiten.zustand), X.raus, "start", null]
      ];
      var kt = gKopf.selectAll("text.stationsname").data(kopf);
      kt.enter().append("text").attr("class", "stationsname").merge(kt)
        .attr("x", function (p) { return p[1]; })
        .attr("y", 30)
        .attr("text-anchor", function (p) { return p[2]; })
        .style("fill", function (p) { return p[3] ? rgb(FARBE[p[3]]) : null; })
        .text(function (p) { return p[0]; });
      kt.exit().remove();

      var at = gKopf.selectAll("text.achsentitel")
        .data([["Stücke Ihres Satzes ↓", X.wort, 56, "end"],
               ["dieselbe Zahl zweimal befragt, dann multipliziert →",
                (X.zu + X.raus) / 2, hoehe - 12, "middle"]]);
      at.enter().append("text").attr("class", "achsentitel").merge(at)
        .attr("x", function (p) { return p[1]; })
        .attr("y", function (p) { return p[2]; })
        .attr("text-anchor", function (p) { return p[3]; })
        .text(function (p) { return p[0]; });
      at.exit().remove();

      // Das Malzeichen — die eigentliche Aussage des Bildes.
      // Das Malzeichen steht ZWISCHEN Gate und Up, mittig auf der Hoehe
      // des Bildes — es ist die Aussage der Kachel in einem Zeichen.
      var mz = gKopf.selectAll("text.malzeichen").data([1]);
      mz.enter().append("text").attr("class", "malzeichen").merge(mz)
        .attr("x", X.mal + 11).attr("y", oben + 8)
        .attr("text-anchor", "middle").text("×");

      // DER VERZWEIGUNGSBOGEN: derselbe Zustand geht in BEIDE Spalten.
      // Ein zweites Band quer durch die Gate-Streifen waere unlesbar —
      // also laeuft die Verzweigung oben herum, wie der Residualstrom im
      // grossen Bild.
      var bg = gKopf.selectAll("path.gabel").data([1]);
      bg.enter().append("path").attr("class", "gabel").merge(bg)
        .attr("d", "M" + (X.zu + X.zuB - 6) + "," + (oben - 26) +
                   "C" + (X.zu + X.zuB + 60) + "," + (oben - 76) + " " +
                   (X.up - 60) + "," + (oben - 76) + " " +
                   (X.up + 6) + "," + (oben - 26));
      // KEIN Text am Bogen: der Achsentitel unten sagt bereits "dieselbe
      // Zahl zweimal befragt, dann multipliziert". Zweimal dasselbe zu
      // schreiben kostet nur Platz und kollidiert mit der Kopfzeile.

      // Streifen
      var zellen = [];
      st.forEach(function (s, i) {
        var gew = s.ist_ziel;
        function reihe(feld, x, yv, h, b, basis) {
          var v = s[feld] || [];
          var zb = b / Math.max(1, v.length);
          v.forEach(function (w, n) {
            zellen.push({
              id: i + ":" + feld + ":" + n, i: i,
              x: x + n * zb, y: yv - h / 2, b: Math.max(0.9, zb - 0.4), h: h,
              f: gew ? tonWert(GELB, w, sp[feld] || 1)
                     : tonWert(basis, w, sp[feld] || 1)
            });
          });
        }
        // Der Zustand: hier ist er nur ein schmaler Balken, weil die
        // Kachel nicht von ihm handelt.
        zellen.push({ id: i + ":zu", i: i, x: X.zu, y: y(i) - zh / 2,
                      b: X.zuB, h: zh,
                      f: gew ? rgb(GELB) : rgb(FARBE.zustand), o: gew ? .9 : .34 });
        reihe("gate", X.gate, y(i), qh, X.gateB, FARBE.gate);
        reihe("up", X.up, y(i), qh, X.upB, FARBE.up);
        reihe("innen", X.innen, y(i), zh, X.innenB, FARBE.innen);
        zellen.push({ id: i + ":raus", i: i, x: X.raus, y: y(i) - zh / 2,
                      b: X.rausB, h: zh,
                      f: gew ? rgb(GELB) : rgb(FARBE.zustand), o: gew ? .9 : .34 });
      });

      var z = gStreifen.selectAll("rect.zelle").data(zellen, function (c) { return c.id; });
      z.exit().remove();
      z.enter().append("rect").attr("class", "zelle")
        .style("cursor", "pointer")
        .on("click", function (ev, c) { if (opts.beiStelle) { opts.beiStelle(c.i); } })
        .merge(z)
        .attr("x", function (c) { return c.x; })
        .attr("y", function (c) { return c.y; })
        .attr("width", function (c) { return c.b; })
        .attr("height", function (c) { return c.h; })
        .style("opacity", function (c) { return c.o === undefined ? 1 : c.o; })
        .transition().duration(dauer)
        .style("fill", function (c) { return c.f; });

      // Woerter
      var w = gStreifen.selectAll("text.wort").data(st, function (s) { return s.index; });
      w.exit().remove();
      w.enter().append("text").attr("class", "wort")
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .style("cursor", "pointer")
        .on("click", function (ev, s) { if (opts.beiStelle) { opts.beiStelle(s.index); } })
        .merge(w)
        .attr("x", X.wort).attr("y", function (s) { return y(s.index); })
        .attr("class", function (s) { return "wort" + (s.ist_ziel ? " gewaehlt" : ""); })
        .text(function (s) { return s.text.replace(/ /g, "·"); });

      // Baender: EIN Zustand -> ZWEI Befragungen -> EIN Produkt -> zurueck
      var baender = [];
      st.forEach(function (s, i) {
        var gew = s.ist_ziel;
        // Der Zustand geht an ZWEI Stellen hinein — deshalb zwei Baender
        // aus derselben Quelle. Das eine laeuft UNTER der Gate-Spalte
        // hindurch zu Up: sonst muesste es die Streifen kreuzen.
        baender.push({ id: "g" + i, i: i, f: gew ? GELB : FARBE.gate,
          o: gew ? .42 : .18,
          d: band(X.zu + X.zuB, y(i), zh / 2, X.gate - 4, y(i), qh / 2) });
        // Kein zweites Band vom Zustand zu Up — es muesste die Gate-
        // Streifen kreuzen. Die Verzweigung sagt der Bogen oben.
        baender.push({ id: "gi" + i, i: i, f: gew ? GELB : FARBE.gate,
          o: gew ? .34 : .14,
          d: band(X.gate + X.gateB, y(i), qh / 2, X.mal, y(i), qh / 2) });
        baender.push({ id: "ui" + i, i: i, f: gew ? GELB : FARBE.up,
          o: gew ? .34 : .14,
          d: band(X.up + X.upB, y(i), qh / 2, X.innen - 4, y(i), zh / 2) });
        baender.push({ id: "r" + i, i: i, f: gew ? GELB : FARBE.innen,
          o: gew ? .36 : .16,
          d: band(X.innen + X.innenB, y(i), zh / 2, X.raus - 4, y(i), zh / 2) });
      });
      var bb = gBand.selectAll("path.ffband").data(baender, function (p) { return p.id; });
      bb.exit().remove();
      bb.enter().append("path").attr("class", "ffband")
        .style("cursor", "pointer")
        .on("click", function (ev, p) { if (opts.beiStelle) { opts.beiStelle(p.i); } })
        .merge(bb)
        .attr("d", function (p) { return p.d; })
        .transition().duration(dauer)
        .style("fill", function (p) { return rgb(p.f); })
        .style("opacity", function (p) { return p.o; });
    };
  }

  /* ══ BILD 2 UND 3 — DIESELBE ZEICHNUNG, ZWEIMAL VERWENDET ═════════════
   *
   * Beide zeigen Zeilen mal drei Groessen: silu(Gate), Up, Produkt. In
   * Bild 2 ist eine Zeile ein NEURON (welche springen an?), in Bild 3 ein
   * SATZSTUECK (wie verhaelt sich EIN Neuron ueber den Satz?). Weil die
   * Struktur dieselbe ist, ist es auch dieselbe Zeichnung — eine
   * Verbesserung an ihr wirkt in beiden Bildern (Regel: geteilte
   * Bausteine statt Nachbau).
   *
   * opts.beiZeile(zeile, i) · opts.name(zeile) · opts.gewaehlt(zeile)
   */
  function dreiBalken(wurzel, opts) {
    opts = opts || {};
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-dreibalken")
      .attr("width", "100%");
    var gKopf = svg.append("g"), gZeilen = svg.append("g");

    return function (liste, dauer) {
      dauer = dauer === undefined ? 620 : dauer;
      var n = liste.length;
      var zeile = 22, oben = 46, unten = 34;
      var hoehe = oben + n * zeile + unten;
      var breite = 1180;
      var namen = 168, spalte = 300, luecke = 32;
      svg.attr("viewBox", "0 0 " + breite + " " + hoehe).attr("height", null);

      var x0 = namen;
      // ALLE DREI SPALTEN SIND ZWEISEITIG. Der erste Bau zeichnete `gate`
      // einseitig von links — silu ist aber NICHT nur positiv: die Funktion
      // hat ein Minimum bei rund -0,278. Negative Gate-Werte erschienen
      // dadurch als positive Balken, also mit falschem Vorzeichen. Im
      // zweiten Bild fiel das nicht auf (dort sind die staerksten Gates
      // alle positiv), im dritten sofort.
      var spalten = [
        { id: "gate", titel: "silu(Gate) — der Schalter", f: FARBE.gate,
          x: x0 },
        { id: "up", titel: "Up — der Inhalt", f: FARBE.up,
          x: x0 + spalte + luecke },
        { id: "innen", titel: "Produkt — was durchkommt", f: FARBE.innen,
          x: x0 + 2 * (spalte + luecke) }
      ];
      // DIE BALKEN LASSEN PLATZ FUER IHRE ZAHL. Der laengste Balken nimmt
      // nur 78 % der halben Spalte ein, damit die Zahl IMMER daneben passt.
      //
      // Der erste Bau legte die Zahl bei langen Balken nach innen und
      // faerbte sie dunkel. Der Kontrast-Pruefer meldete daraufhin drei
      // unlesbare Stellen (1,64:1): er sieht den Balken nicht als Grund,
      // sondern misst gegen den Seitenhintergrund — und auf dem steht
      // dunkle Schrift auf dunklem Grund. Ob ein Mensch es lesen koennte,
      // ist dabei zweitrangig: eine Schrift, deren Lesbarkeit davon
      // abhaengt, dass genau das richtige Rechteck darunterliegt, ist
      // zerbrechlich. Aussen ist sie immer lesbar.
      var PLATZ = 0.78;
      var max = {};
      spalten.forEach(function (s) {
        var m = 0;
        liste.forEach(function (z) { m = Math.max(m, Math.abs(z[s.id])); });
        max[s.id] = (m || 1) / PLATZ;
      });

      var kt = gKopf.selectAll("text.spaltentitel").data(spalten, function (s) { return s.id; });
      kt.exit().remove();
      kt.enter().append("text").attr("class", "spaltentitel").merge(kt)
        .attr("x", function (s) { return s.x; })
        .attr("y", 20)
        .style("fill", function (s) { return rgb(s.f); })
        .text(function (s) { return s.titel; });

      // Nulllinien: `gate` ist nach silu fast immer positiv und bekommt
      // deshalb eine Achse am linken Rand; `up` und `innen` haben ein
      // Vorzeichen und wachsen von der Mitte.
      var nl = gKopf.selectAll("line.nulllinie").data(spalten, function (s) { return s.id; });
      nl.exit().remove();
      nl.enter().append("line").attr("class", "nulllinie").merge(nl)
        .attr("x1", function (s) { return s.x + spalte / 2; })
        .attr("x2", function (s) { return s.x + spalte / 2; })
        .attr("y1", oben - 8).attr("y2", oben + n * zeile);

      var zg = gZeilen.selectAll("g.zeile").data(liste, function (z, i) {
        return opts.name ? opts.name(z) : i;
      });
      zg.exit().remove();
      var neu = zg.enter().append("g").attr("class", "zeile")
        .style("cursor", opts.beiZeile ? "pointer" : null);
      neu.append("text").attr("class", "zname")
        .attr("text-anchor", "end").attr("dominant-baseline", "middle");
      spalten.forEach(function (s) {
        neu.append("rect").attr("class", "bal bal-" + s.id).attr("rx", 2);
        neu.append("text").attr("class", "bwert bwert-" + s.id)
          .attr("dominant-baseline", "middle");
      });
      var alle = neu.merge(zg);
      alle.on("click", function (ev, z) {
        if (opts.beiZeile) { opts.beiZeile(z, liste.indexOf(z)); }
      });
      alle.attr("class", function (z) {
        return "zeile" + (opts.gewaehlt && opts.gewaehlt(z) ? " gewaehlt" : "");
      });
      alle.select("text.zname")
        .attr("x", namen - 14)
        .attr("y", function (z, i) { return oben + i * zeile + zeile / 2; })
        .text(function (z) { return opts.name ? opts.name(z) : ""; });

      spalten.forEach(function (s) {
        alle.select("rect.bal-" + s.id)
          .attr("height", 11)
          .attr("y", function (z, i) { return oben + i * zeile + zeile / 2 - 5.5; })
          .style("fill", function (z) {
            return (opts.gewaehlt && opts.gewaehlt(z)) ? rgb(GELB) : rgb(s.f);
          })
          .transition().duration(dauer)
          .attr("x", function (z) {
            var w = (z[s.id] / max[s.id]) * (spalte / 2);
            return s.x + spalte / 2 + Math.min(0, w);
          })
          .attr("width", function (z) {
            return Math.max(1.5, Math.abs(z[s.id]) / max[s.id] * (spalte / 2));
          });

        // Die Zahl steht IMMER aussen am Balkenende — dank der Reserve
        // oben laeuft sie nie in die Nachbarspalte.
        alle.select("text.bwert-" + s.id)
          .attr("y", function (z, i) { return oben + i * zeile + zeile / 2; })
          .attr("x", function (z) {
            var w = Math.abs(z[s.id]) / max[s.id] * (spalte / 2);
            return z[s.id] < 0 ? s.x + spalte / 2 - w - 7
                               : s.x + spalte / 2 + w + 7;
          })
          .attr("text-anchor", function (z) {
            return z[s.id] < 0 ? "end" : "start";
          })
          .text(function (z) {
            return String(z[s.id].toFixed(2)).replace(".", ",");
          });
      });

      var at = gKopf.selectAll("text.achsentitel").data([1]);
      at.enter().append("text").attr("class", "achsentitel").merge(at)
        .attr("x", (namen + 3 * spalte) / 2).attr("y", hoehe - 10)
        .attr("text-anchor", "middle")
        .text(opts.xTitel || "Balkenlänge = Betrag · Richtung = Vorzeichen");
    };
  }

  function tausend(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  return { aufweitung: aufweitung, dreiBalken: dreiBalken, FARBE: FARBE };
})();
