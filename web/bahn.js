/* DIE BAHN — der ganze Weg einer Anfrage in EINEM Bild.
 *
 * Gebaut nach der Hauptansicht des Vorbilds (`_vorbild/bilder/01-oben.png`)
 * und nach der am 15.08.2026 abgenommenen Skizze: links der Satz, dann das
 * Embedding, dann Query/Key/Value AM WORT, in der Mitte ein abgesetztes Feld
 * fuer die Aufmerksamkeit mit drei Faechern und dem Punktraster, danach der
 * Ausgang, das Feedforward und der Zustand, rechts die Wahrscheinlichkeiten.
 *
 * DER STRANG LAEUFT DURCH. Das ist der Unterschied zur ersten Fassung vom
 * 14.08.: dort gab es Baender nur ganz links und ganz rechts, dazwischen
 * standen vier gleich aussehende Streifenspalten nebeneinander — man sah eine
 * Tabelle, keinen Weg. Jetzt traegt ein durchgehendes Band jede Station.
 *
 * FEEDFORWARD BLEIBT ZEILENWEISE. Die Aufweitung 2.048 -> 6.144 steht als
 * laengeres Band JE STELLE, nicht als gemeinsame Saeule: das Bauteil rechnet
 * jede Stelle fuer sich, und ein Bild, in dem alle Stuecke in einem Punkt
 * zusammenlaufen, wuerde den Mechanismus falsch zeigen.
 *
 * Was hier anders ist als im Vorbild: jede Breite und jede Farbe ist eine am
 * Modell gemessene Groesse. Nichts daran ist gemalt.
 *
 * Alle Zahlen kommen aus EINEM Aufruf von /api/bahn, also aus EINEM Durchlauf
 * durch das Modell. Sechs Aufrufe haetten sechs Durchlaeufe bedeutet — und
 * damit Stationen, die nicht zueinander gehoeren.
 */
var BAHN = (function () {
  "use strict";

  // Farbfamilien nach Regel C-1a: je Bauteil eine Familie, innerhalb der
  // Familie traegt die HELLIGKEIT den Wert. Alle Familien sind kalt, weil
  // die Auswahl die einzige warme Farbe ist (Regel C-1).
  //
  // Welche Farbe ein Bauteil traegt, haengt seit dem 20.08.2026 an der
  // Fassung und steht in palette.js. Hier stehen nur noch die NAMEN — die
  // Zuordnung "was dieses Bild ein Feld nennt" auf "welches Bauteil das
  // ist". Sie ist eine Frage dieses Bildes, keine der Palette.
  var FELD_ZU_BAUTEIL = {
    einbettung: "res",    // schiefergrau — der Residualstrom
    query:      "q",      // indigo
    key:        "k",      // teal
    value:      "v",      // cyan
    attn_aus:   "att",    // blau — die Aufmerksamkeit
    ff_innen:   "ff",     // violett — das Feedforward
    mlp_aus:    "ff"
  };

  /** Die volle Erkennungsfarbe eines Feldes — dort, wo kein Wert im Spiel
   *  ist (Beschriftungen, Baender, Legende). */
  function bauteilfarbe(feld) {
    return PALETTE.erkennung(FELD_ZU_BAUTEIL[feld] || "res");
  }

  /** Die Auswahlfarbe der laufenden Fassung. */
  function auswahl() { return PALETTE.token("--wahl"); }

  // Tausenderpunkte wie im uebrigen Demonstrator — "2048" fiel aus dem Bild.
  function tausend(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Die Kennlinie: kleine Betraege bleiben sichtbar (0,16 als Untergrenze),
  // die obere Haelfte faellt nicht zusammen (Wurzel 0,6). Ob das gegen
  // Schwarz oder gegen Weiss blendet, entscheidet die Fassung — deshalb
  // rechnet es PALETTE.gegenGrund und nicht mehr diese Datei.
  function farbe(feld, wert, spanne) {
    var a = Math.min(1, Math.abs(wert) / (spanne || 1));
    a = 0.16 + 0.84 * Math.pow(a, 0.6);
    return PALETTE.gegenGrund(bauteilfarbe(feld), a);
  }

  // Dieselbe Kennlinie in der Auswahlfarbe — fuer die gewaehlte Zeile.
  function farbeGewaehlt(wert, spanne) {
    var a = Math.min(1, Math.abs(wert) / (spanne || 1));
    a = 0.20 + 0.80 * Math.pow(a, 0.6);
    return PALETTE.gegenGrund(auswahl(), a);
  }

  function spanneVon(stationen, feld) {
    var m = 0;
    stationen.forEach(function (s) {
      (s[feld] || []).forEach(function (x) { m = Math.max(m, Math.abs(x)); });
    });
    return m || 1;
  }

  /** Ein Band von (x1,y1) nach (x2,y2) mit den Halbbreiten b1/b2. */
  function band(x1, y1, b1, x2, y2, b2, glatt) {
    var g = glatt === undefined ? 0.5 : glatt;
    var a = x1 + (x2 - x1) * g, b = x2 - (x2 - x1) * g;
    return "M" + x1 + "," + (y1 - b1) +
      "C" + a + "," + (y1 - b1) + " " + b + "," + (y2 - b2) + " " + x2 + "," + (y2 - b2) +
      "L" + x2 + "," + (y2 + b2) +
      "C" + b + "," + (y2 + b2) + " " + a + "," + (y1 + b1) + " " + x1 + "," + (y1 + b1) + "Z";
  }

  /** opts.beiStelle(i) · opts.beiKandidat(j) */
  function zeichnen(wurzel, opts) {
    opts = opts || {};
    var svg = d3.select(wurzel).append("svg").attr("class", "d3-bahn")
      .attr("width", "100%");
    var gGrund = svg.append("g").attr("class", "grund");
    var gBand = svg.append("g").attr("class", "baender");
    var gStat = svg.append("g").attr("class", "stationen");
    var gKopf = svg.append("g").attr("class", "kopfzeile");

    return function (d, dauer) {
      dauer = dauer === undefined ? 620 : dauer;
      var st = d.stationen, T = st.length;

      // ── Das Mass des Bildes waechst mit der Zahl der Satzstuecke ──────
      //
      // Die abgenommene Skizze zeigte sechs Stuecke; ein echter Satz hat
      // hier fuenfzehn. Der bestimmende Platzbedarf sind die DREI Faecher
      // (Key, Query, Value) mit je einer Zeile pro Stueck — nicht die
      // Wortzeilen. Also gibt der Faecherbereich die Hoehe vor, und die
      // Wortzeilen verteilen sich darin.
      var fz = Math.min(13, Math.max(6, 165 / Math.max(1, T)));  // Faecherzeile
      var luft = 30, kopfraum = 56;
      var inhaltH = Math.max(260, 3 * T * fz + 2 * luft + kopfraum);
      var zeile = inhaltH / Math.max(1, T);
      // Unten brauchen ZWEI Dinge Platz: die Klammer, die die Aufweitung des
      // Feedforward beschriftet, und der waagerechte Achsentitel. Mit 52
      // Bildpunkten lagen beide hinter der Fusszeile.
      var oben = 118, unten = 84;
      var hoehe = Math.round(oben + inhaltH + unten);
      // KEINE feste Hoehe. Das SVG ist auf die Breite der Kachel eingepasst
      // (rund 1.190 Bildpunkte); eine zusaetzlich gesetzte Hoehe wuerde das
      // Bild nicht groesser machen, sondern es nur senkrecht zentrieren und
      // darueber wie darunter Leerraum lassen. `height: auto` im Stylesheet
      // laesst den Browser massstabsgetreu rechnen.
      var breite = 1440;
      svg.attr("viewBox", "0 0 " + breite + " " + hoehe).attr("height", null);

      // ── Die Spalten der Bahn ────────────────────────────────────────
      //
      // Die Streifen sind bewusst schmal gehalten: was das Bild traegt, sind
      // die BAENDER dazwischen. Stehen die Stationen zu dicht, sieht man
      // wieder Spalten statt eines Weges — genau der Fehler der ersten
      // Fassung.
      var X = {
        wort: 116, emb: 130, embB: 62,
        qkv: 240, qkvB: 62,
        panel: 344, panelB: 404,
        faecher: 470, faecherB: 38,
        aus: 792, ausB: 56,
        ff: 916, ffB: 124,           // sichtbar laenger: 2.048 -> 6.144
        zustand: 1102, zustandB: 56,
        kand: 1268, kandB: 88     // schmalerer Balken, dafuer mehr Faecherraum
      };
      var y = function (i) { return oben + i * zeile + zeile / 2; };
      var zielY = y(d.position);

      // ══ Grund: der Kartenstapel und das Feld der Aufmerksamkeit ══════
      //
      // Der Stapel sagt, dass dieser Block nicht einmal, sondern 28-mal
      // hintereinander steht — im Vorbild "11 more identical Blocks".
      var stapel = [];
      for (var q = 4; q >= 1; q--) {
        stapel.push({ id: "k" + q, dx: q * 7, dy: q * 7, o: 0.30 });
      }
      stapel.push({ id: "k0", dx: 0, dy: 0, o: 0.5 });
      var sk = gGrund.selectAll("rect.stapel").data(stapel, function (p) { return p.id; });
      sk.exit().remove();
      sk.enter().append("rect").attr("class", "stapel")
        .merge(sk)
        .attr("x", function (p) { return X.qkv - 18 + p.dx; })
        .attr("y", function (p) { return oben - 12 + p.dy; })
        .attr("width", X.zustand + X.zustandB + 24 - (X.qkv - 18))
        .attr("height", inhaltH)
        .attr("rx", 12)
        .style("opacity", function (p) { return p.o; });

      var panelH = 3 * T * fz + 2 * luft + 40;
      var panelY = oben - 12 + (inhaltH - panelH) / 2;
      var pf = gGrund.selectAll("rect.attfeld").data([1]);
      pf.enter().append("rect").attr("class", "attfeld").merge(pf)
        .attr("x", X.panel).attr("y", panelY)
        .attr("width", X.panelB).attr("height", panelH).attr("rx", 10);

      // ── Kopfzeile: die Namen der Stationen ──────────────────────────
      // Der vierte Eintrag jeder Zeile ist die Kennung der Station. Ueber
      // sie fuehrt ein Klick auf den Namen in die Kachel, die genau diese
      // Station vergroessert (opts.beiStation) — der Weg von der Uebersicht
      // ins Einzelne, an der Stelle, an der man ihn sucht.
      var kopfDaten = [
        ["Ihr Satz", X.wort, "end", "wort"],
        ["Embedding", X.emb, "start", "emb"],
        ["Q · K · V", X.qkv, "start", "qkv"],
        ["Aufmerksamkeit", X.panel + 44, "start", "matrix"],
        ["Ausgang", X.aus, "start", "aus"],
        ["Feedforward", X.ff, "start", "ff"],
        ["Zustand nach " + (d.schichten || 28), X.zustand, "start", "kand"],
        ["Wahrscheinlichkeit", X.kand + 10, "start", "kand"]
      ];
      var kt = gKopf.selectAll("text.stationsname").data(kopfDaten);
      kt.enter().append("text").attr("class", "stationsname")
        .merge(kt)
        .attr("x", function (p) { return p[1]; })
        .attr("y", 26)
        .attr("text-anchor", function (p) { return p[2]; })
        .attr("class", function (p) {
          // Eine Station ohne Kachel bleibt sichtbar, ist aber kein Knopf.
          var offen = opts.hatStation && !opts.hatStation(p[3]);
          return "stationsname" + (offen ? " ohne-kachel" : " fuehrt");
        })
        .style("cursor", function (p) {
          return (opts.hatStation && !opts.hatStation(p[3])) ? null : "pointer";
        })
        .on("click", function (ev, p) {
          if (opts.beiStation) { opts.beiStation(p[3]); }
        })
        .text(function (p) { return p[0]; });
      kt.exit().remove();

      // Die beiden Achsen des Bildes: senkrecht die Stuecke des Satzes,
      // waagerecht die Stationen des Modells. Ohne sie waere nicht gesagt,
      // was eine Zeile und was eine Spalte bedeutet (Regel A-5).
      var at = gKopf.selectAll("text.achsentitel")
        .data([["Stücke Ihres Satzes ↓", X.wort, 48, "end"],
               ["die Stationen des Modells, von links nach rechts →",
                (X.emb + X.kand) / 2, hoehe - 12, "middle"]]);
      at.enter().append("text").attr("class", "achsentitel")
        .merge(at)
        .attr("x", function (p) { return p[1]; })
        .attr("y", function (p) { return p[2]; })
        .attr("text-anchor", function (p) { return p[3]; })
        .text(function (p) { return p[0]; });
      at.exit().remove();

      // ── Der Residualstrom: zwei Boegen, die am Bauteil vorbeilaufen ──
      //
      // Er erklaert, warum das Modell 28 Schichten tief sein kann, ohne
      // dass der urspruengliche Zustand verlorengeht. Im Vorbild ist er
      // beschriftet; hier ebenso.
      var boegen = [
        { id: "r1", x1: X.emb + X.embB, x2: X.aus - 6 },
        { id: "r2", x1: X.aus + X.ausB + 6, x2: X.zustand - 6 }
      ];
      var rb = gBand.selectAll("path.residual").data(boegen, function (p) { return p.id; });
      rb.exit().remove();
      rb.enter().append("path").attr("class", "residual").merge(rb)
        .attr("d", function (p) {
          var m = (p.x1 + p.x2) / 2, s = Math.min(58, (p.x2 - p.x1) * 0.16);
          return "M" + p.x1 + "," + (oben - 18) +
                 "C" + (p.x1 + (m - p.x1) * 0.7) + "," + (oben - 18 - s) + " " +
                 (p.x2 - (p.x2 - m) * 0.7) + "," + (oben - 18 - s) + " " +
                 p.x2 + "," + (oben - 18);
        });
      var rt = gKopf.selectAll("text.residuallabel").data(boegen, function (p) { return p.id; });
      rt.exit().remove();
      rt.enter().append("text").attr("class", "residuallabel")
        .style("cursor", "pointer")
        .on("click", function () {
          if (opts.beiStation) { opts.beiStation("residual"); }
        })
        .merge(rt)
        .attr("x", function (p) { return (p.x1 + p.x2) / 2; })
        .attr("y", function (p) {
          return oben - 22 - Math.min(58, (p.x2 - p.x1) * 0.16) * 0.72;
        })
        .attr("text-anchor", "middle")
        .text("Residual");

      // ── Die Streifen je Station ─────────────────────────────────────
      var spannen = {};
      ["einbettung", "query", "key", "value", "attn_aus", "ff_innen"]
        .forEach(function (f) { spannen[f] = spanneVon(st, f); });

      var zh = Math.max(7, Math.min(15, zeile * 0.32));   // Hoehe eines Streifens
      var qh = Math.max(4, Math.min(9, zeile * 0.19));    // Hoehe eines Q/K/V-Blocks
      var zellen = [];
      st.forEach(function (s, i) {
        var gew = s.ist_ziel;
        function streifen(feld, x, yv, h, b) {
          var v = s[feld] || [];
          var zb = b / Math.max(1, v.length);
          v.forEach(function (w, n) {
            zellen.push({
              id: i + ":" + feld + ":" + n,
              x: x + n * zb, y: yv - h / 2, b: Math.max(0.9, zb - 0.4), h: h,
              f: gew ? farbeGewaehlt(w, spannen[feld]) : farbe(feld, w, spannen[feld]),
              i: i
            });
          });
        }
        streifen("einbettung", X.emb, y(i), zh, X.embB);
        // Q, K und V sitzen AM WORT — drei gestapelte Bloecke je Satzstueck,
        // jeder speist unten seinen eigenen Faecher.
        streifen("query", X.qkv, y(i) - (qh + 1.6), qh, X.qkvB);
        streifen("key",   X.qkv, y(i),             qh, X.qkvB);
        streifen("value", X.qkv, y(i) + (qh + 1.6), qh, X.qkvB);
        streifen("attn_aus", X.aus, y(i), zh, X.ausB);
        streifen("ff_innen", X.ff, y(i), zh, X.ffB);
        streifen("einbettung", X.zustand, y(i), zh, X.zustandB);
      });

      var z = gStat.selectAll("rect.zelle").data(zellen, function (c) { return c.id; });
      z.exit().remove();
      z.enter().append("rect").attr("class", "zelle")
        .merge(z)
        .attr("x", function (c) { return c.x; })
        .attr("y", function (c) { return c.y; })
        .attr("width", function (c) { return c.b; })
        .attr("height", function (c) { return c.h; })
        .style("cursor", "pointer")
        .on("click", function (ev, c) { if (opts.beiStelle) { opts.beiStelle(c.i); } })
        .transition().duration(dauer)
        .style("fill", function (c) { return c.f; });

      // Die Buchstaben Q/K/V am Block — sonst weiss niemand, welcher
      // Streifen welcher ist (Regel A-1).
      var qkvNamen = (qh >= 6) ? [
        { id: "Q", f: "query", o: -1 }, { id: "K", f: "key", o: 0 },
        { id: "V", f: "value", o: 1 }
      ] : [];
      var qn = gStat.selectAll("text.qkvname").data(qkvNamen, function (p) { return p.id; });
      qn.exit().remove();
      qn.enter().append("text").attr("class", "qkvname").merge(qn)
        .attr("x", X.qkv - 6)
        .attr("y", function (p) { return y(0) + p.o * (qh + 1.6) + 3; })
        .attr("text-anchor", "end")
        .style("fill", function (p) { return bauteilfarbe(p.f); })
        .text(function (p) { return p.id; });

      // ── Die Woerter links ───────────────────────────────────────────
      var w = gStat.selectAll("text.wort").data(st, function (s) { return s.index; });
      w.exit().remove();
      w.enter().append("text").attr("class", "wort")
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .style("cursor", "pointer")
        .on("click", function (ev, s) { if (opts.beiStelle) { opts.beiStelle(s.index); } })
        .merge(w)
        .attr("x", X.wort).attr("y", function (s) { return y(s.index); })
        .attr("class", function (s) {
          return "wort" + (s.ist_ziel ? " gewaehlt" : "") +
                 (d.markiert === s.index ? " markiert" : "");
        })
        .text(function (s) { return s.text.replace(/ /g, "·"); });

      // ══ Das Feld der Aufmerksamkeit: drei Faecher und das Punktraster ══
      //
      // Key, Query und Value bekommen je einen eigenen beschrifteten Faecher,
      // wie im Vorbild. Wird der Satz so lang, dass die Zeilen enger als
      // zehn Bildpunkte stehen, entfaellt die Beschriftung — ein Faecher aus
      // uebereinanderliegenden Woertern waere unlesbar (Regel A-1: lieber
      // keine Beschriftung als eine, die man nicht lesen kann).
      // Beschriftet werden die Faecherzeilen nur, wenn sie weit genug
      // auseinanderstehen. Bei einem langen Satz stuenden fuenfzehn Woerter
      // uebereinander und waeren unlesbar; dann traegt NUR die gewaehlte
      // Zeile ihren Namen — der ist der, den man sucht.
      var mitNamen = fz >= 12;
      var faecher = [
        { id: "key", name: "Key", f: "key" },
        { id: "query", name: "Query", f: "query" },
        { id: "value", name: "Value", f: "value" }
      ];
      faecher.forEach(function (fa, b) {
        fa.y0 = panelY + 34 + b * (T * fz + luft);
      });

      var fl = gStat.selectAll("text.faechername").data(faecher, function (p) { return p.id; });
      fl.exit().remove();
      fl.enter().append("text").attr("class", "faechername").merge(fl)
        .attr("x", X.faecher - 4)
        .attr("y", function (p) { return p.y0 - 12; })
        .attr("text-anchor", "end")
        .style("fill", function (p) { return bauteilfarbe(p.f); })
        .text(function (p) { return p.name; });

      var linien = [];
      faecher.forEach(function (fa) {
        st.forEach(function (s, i) {
          linien.push({ id: fa.id + ":" + i, fa: fa, i: i, s: s,
                        y: fa.y0 + i * fz });
        });
      });
      var ln = gStat.selectAll("line.faecherlinie").data(linien, function (p) { return p.id; });
      ln.exit().remove();
      ln.enter().append("line").attr("class", "faecherlinie")
        .style("cursor", "pointer")
        .on("click", function (ev, p) { if (opts.beiStelle) { opts.beiStelle(p.i); } })
        .merge(ln)
        .attr("x1", X.faecher).attr("x2", X.faecher + X.faecherB)
        .attr("y1", function (p) { return p.y; })
        .attr("y2", function (p) { return p.y; })
        .style("stroke", function (p) {
          return p.s.ist_ziel ? auswahl() : bauteilfarbe(p.fa.f);
        })
        .style("opacity", function (p) { return p.s.ist_ziel ? 1 : 0.8; });

      var namen = mitNamen ? linien
        : linien.filter(function (p) { return p.s.ist_ziel; });
      var fn = gStat.selectAll("text.faecherwort").data(namen, function (p) { return p.id; });
      fn.exit().remove();
      fn.enter().append("text").attr("class", "faecherwort")
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .style("cursor", "pointer")
        .on("click", function (ev, p) { if (opts.beiStelle) { opts.beiStelle(p.i); } })
        .merge(fn)
        .attr("x", X.faecher - 6)
        .attr("y", function (p) { return p.y; })
        .style("fill", function (p) { return p.s.ist_ziel ? auswahl() : null; })
        .text(function (p) { return p.s.text.replace(/ /g, "·"); });

      // Das Punktraster des gewaehlten Kopfes — runde Punkte wie im Vorbild,
      // untere Dreiecksform, weil kein Stueck sehen darf, was nach ihm kommt.
      var mb = Math.min(20, Math.max(6, 168 / Math.max(1, T)));
      var mZellen = [];
      (d.matrix || []).forEach(function (reihe, i) {
        reihe.forEach(function (v, j) {
          if (j > i) { return; }
          mZellen.push({ id: i + "," + j, i: i, j: j, v: v });
        });
      });
      // Das Raster sitzt rechts IM Feld — nicht daneben. Seine Breite haengt
      // an der Zahl der Satzstuecke, also wird es von der rechten Kante des
      // Feldes aus gesetzt, damit es bei langen Saetzen nicht herauslaeuft.
      var mx = X.panel + X.panelB - T * mb - 24;
      var my = panelY + (panelH - T * mb) / 2 + mb / 2;
      var m = gStat.selectAll("circle.mzelle").data(mZellen, function (c) { return c.id; });
      m.exit().remove();
      m.enter().append("circle").attr("class", "mzelle")
        .style("cursor", "pointer")
        .on("click", function (ev, c) { if (opts.beiStelle) { opts.beiStelle(c.i); } })
        .merge(m)
        .attr("cx", function (c) { return mx + c.j * mb; })
        .attr("cy", function (c) { return my + c.i * mb; })
        .transition().duration(dauer)
        .attr("r", function (c) {
          return Math.max(1.2, (mb / 2 - 1.4) * Math.sqrt(Math.min(1, c.v / 0.9)) + 1.2);
        })
        .style("fill", function (c) {
          return c.i === d.position ? auswahl() : bauteilfarbe("attn_aus");
        })
        .style("opacity", function (c) { return 0.30 + 0.68 * Math.min(1, c.v / 0.9); });

      var ml = gKopf.selectAll("text.rasterlabel")
        .data([["Kopf " + d.kopf + " von " + (d.koepfe || 16) + " · Stelle × Stelle",
                mx - 8, my - mb / 2 - 12],
               ["Aufmerksamkeit", mx - 8, my - mb / 2 + T * mb + 16]]);
      ml.enter().append("text").attr("class", "rasterlabel").merge(ml)
        .attr("x", function (p) { return p[1]; })
        .attr("y", function (p) { return p[2]; })
        .text(function (p) { return p[0]; });
      ml.exit().remove();

      // ══ DIE BAENDER — der Strang, der durch das ganze Bild laeuft ══════
      var maxBlick = 0;
      st.forEach(function (s) { maxBlick = Math.max(maxBlick, s.blick); });
      var baender = [];

      st.forEach(function (s, i) {
        var gew = s.ist_ziel;
        var fam = gew ? auswahl() : bauteilfarbe("einbettung");
        var o = gew ? 0.34 : 0.15;

        // 1) Embedding → Q/K/V am Wort
        baender.push({ id: "a" + i, i: i, seite: "links", f: fam, o: o,
          d: band(X.emb + X.embB, y(i), zh / 2 + 2,
                  X.qkv - 4, y(i), (qh * 3 + 4) / 2) });

        // 2) Q, K und V → ihre Faecher
        [["query", -1], ["key", 0], ["value", 1]].forEach(function (p) {
          var fa = faecher.filter(function (x) { return x.id === p[0]; })[0];
          baender.push({
            id: p[0] + "b" + i, i: i, seite: "links",
            f: gew ? auswahl() : bauteilfarbe(p[0]), o: gew ? 0.5 : 0.24,
            d: band(X.qkv + X.qkvB, y(i) + p[1] * (qh + 1.6), qh / 2,
                    X.faecher - 6, fa.y0 + i * fz, 1.6)
          });
        });
      });

      // 3) Die Faecher → das Punktraster (ein breites Band je Bauteil)
      faecher.forEach(function (fa, b) {
        baender.push({
          id: "f" + fa.id, seite: "keine", f: bauteilfarbe(fa.f), o: 0.11,
          d: band(X.faecher + X.faecherB, fa.y0 + T * fz / 2, T * fz / 2,
                  mx - mb, my - mb / 2 + T * mb * (0.25 + b * 0.25),
                  T * mb / 4.6)
        });
      });

      // 4) Das Raster → der Ausgang. HIER laeuft der Satz in EINE Stelle
      //    zusammen und von dort in jede Zeile zurueck — die Breite ist die
      //    gemessene Aufmerksamkeit dieser Stelle auf das Stueck.
      var rasterRand = mx + (T - 1) * mb + mb / 2;
      st.forEach(function (s, i) {
        var gew = s.ist_ziel;
        var anteil = s.blick / (maxBlick || 1);
        baender.push({
          id: "o" + i, i: i, seite: "links",
          f: gew ? auswahl() : bauteilfarbe("attn_aus"),
          o: gew ? 0.34 : 0.14 + 0.28 * anteil,
          d: band(rasterRand + 10, my - mb / 2 + T * mb / 2, T * mb / 3.6,
                  X.aus - 6, y(i), Math.max(1.4, zh / 2 + 1))
        });

        // 5) Ausgang → Feedforward → Zustand. Zeilenweise, weil das Bauteil
        //    jede Stelle fuer sich rechnet.
        baender.push({ id: "p" + i, i: i, seite: "links",
          f: gew ? auswahl() : bauteilfarbe("ff_innen"), o: gew ? 0.38 : 0.26,
          d: band(X.aus + X.ausB, y(i), zh / 2 + 1, X.ff - 4, y(i), zh / 2 + 1) });
        baender.push({ id: "q" + i, i: i, seite: "links",
          f: gew ? auswahl() : bauteilfarbe("ff_innen"), o: gew ? 0.38 : 0.26,
          d: band(X.ff + X.ffB, y(i), zh / 2 + 1, X.zustand - 4, y(i), zh / 2 + 1) });
      });

      // 6) Der Zustand → die Kandidaten. Breit aufgefaechert, nicht als
      //    Striche aus einem Punkt.
      var kand = d.kandidaten || [];
      var maxP = kand.length ? kand[0].p : 1;
      var kSchritt = Math.max(22, Math.min(34, inhaltH / Math.max(1, kand.length)));
      var kY = function (j) {
        return oben + (inhaltH - kand.length * kSchritt) / 2 + j * kSchritt + kSchritt / 2;
      };
      kand.forEach(function (c, j) {
        var anteil = c.p / (maxP || 1);
        baender.push({
          id: "R" + j, seite: "rechts", j: j,
          f: j === 0 ? auswahl() : bauteilfarbe("value"),
          o: 0.18 + 0.42 * anteil,
          d: band(X.zustand + X.zustandB, zielY, zh / 2 + 3,
                  X.kand - 6, kY(j), Math.max(2, 13 * anteil), 0.58)
        });
      });

      var bb = gBand.selectAll("path.bahnband").data(baender, function (p) { return p.id; });
      bb.exit().remove();
      bb.enter().append("path").attr("class", "bahnband")
        .merge(bb)
        .attr("d", function (p) { return p.d; })
        .style("cursor", function (p) { return p.seite === "keine" ? null : "pointer"; })
        .on("click", function (ev, p) {
          if (p.seite === "links" && opts.beiStelle) { opts.beiStelle(p.i); }
          if (p.seite === "rechts" && opts.beiKandidat) { opts.beiKandidat(p.j); }
        })
        .transition().duration(dauer)
        .style("fill", function (p) { return p.f; })
        .style("opacity", function (p) { return p.o; });

      // ── Die Klammer unter dem Feedforward: die Aufweitung ────────────
      var kl = gKopf.selectAll("path.ffklammer").data([1]);
      var klY = oben + inhaltH + 16;
      kl.enter().append("path").attr("class", "ffklammer").merge(kl)
        .attr("d", "M" + X.ff + "," + (klY - 7) + "L" + X.ff + "," + klY +
                   "L" + (X.ff + X.ffB) + "," + klY +
                   "L" + (X.ff + X.ffB) + "," + (klY - 7));
      var klt = gKopf.selectAll("text.ffklammertext").data([1]);
      klt.enter().append("text").attr("class", "ffklammertext").merge(klt)
        .attr("x", X.ff + X.ffB / 2).attr("y", klY + 16)
        .attr("text-anchor", "middle")
        .text("je Stelle einzeln: " + tausend(d.breiten ? d.breiten.zustand : 2048) +
              " → " + tausend(d.breiten ? d.breiten.feedforward : 6144) +
              " → " + tausend(d.breiten ? d.breiten.zustand : 2048));

      // ── Die Kandidaten rechts ───────────────────────────────────────
      var k = gStat.selectAll("g.kand").data(kand, function (c) { return c.id; });
      k.exit().remove();
      var kn = k.enter().append("g").attr("class", "kand")
        .style("cursor", "pointer");
      kn.append("rect").attr("class", "kbalken").attr("height", 5).attr("rx", 2.5);
      kn.append("text").attr("class", "kwort").attr("dominant-baseline", "middle");
      var ka = kn.merge(k);
      ka.on("click", function (ev, c) {
        if (opts.beiKandidat) { opts.beiKandidat(kand.indexOf(c)); }
      });
      ka.attr("class", function (c, j) {
        return "kand" + (j === 0 ? " erste" : "") +
               (d.markierterKandidat === j ? " markiert" : "");
      });
      ka.select("rect.kbalken").transition().duration(dauer)
        .attr("x", X.kand).attr("y", function (c, j) { return kY(j) - 2.5; })
        .attr("width", function (c) { return Math.max(2, X.kandB * (c.p / (maxP || 1))); });
      ka.select("text.kwort")
        .attr("y", function (c, j) { return kY(j); })
        .transition().duration(dauer)
        .attr("x", function (c) { return X.kand + Math.max(2, X.kandB * (c.p / (maxP || 1))) + 9; })
        .tween("text", function (c) {
          var self = d3.select(this);
          var alt = parseFloat(String(self.text()).replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
          var ip = d3.interpolateNumber(alt, c.p * 100);
          var name = c.text.replace(/ /g, "·");
          return function (tt) {
            self.text(name + "  " + ip(tt).toFixed(1).replace(".", ",") + " %");
          };
        });

      // Der Hinweis am Stapel: dieser Block steht nicht einmal da.
      var sh = gKopf.selectAll("text.stapeltext")
        .data([["noch " + ((d.schichten || 28) - 1) + " gleiche",
                X.zustand + X.zustandB + 34, oben + 4],
               ["Blöcke", X.zustand + X.zustandB + 34, oben + 18]]);
      sh.enter().append("text").attr("class", "stapeltext").merge(sh)
        .attr("x", function (p) { return p[1]; })
        .attr("y", function (p) { return p[2]; })
        .text(function (p) { return p[0]; });
      sh.exit().remove();
    };
  }

  return { zeichnen: zeichnen, bauteilfarbe: bauteilfarbe };
})();
