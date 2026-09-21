/* Die Kacheln des Demonstrators.
 *
 * Jede Kachel hat ihr eigenes Satzfeld: der Satz gehoert zur Kachel und
 * steht dort, wo er gebraucht wird. Zwischen den Kacheln bleibt er erhalten,
 * damit man denselben Satz durch alle Stationen verfolgen kann.
 *
 * Gerechnet wird nichts hier: alle Zahlen kommen vom lokalen Server, der ein
 * echtes, vortrainiertes Sprachmodell auf diesem Rechner betreibt.
 */

var KACHELN = (function () {
  "use strict";

  // ── kleine Helfer ──────────────────────────────────────────────────────

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) { e.className = klasse; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function zahl(x, n) { return Number(x).toFixed(n === undefined ? 2 : n).replace(".", ","); }
  function pz(x, n) { return (x * 100).toFixed(n === undefined ? 1 : n).replace(".", ",") + " %"; }
  function tausend(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function sichtbar(s) {
    return String(s).replace(/ /g, "·").replace(/\n/g, "↵").replace(/\t/g, "→");
  }

  function feld(titel) {
    var f = el("div", "feld");
    if (titel) { f.appendChild(el("h4", null, titel)); }
    return f;
  }
  /** Die Erklaerung — sie steht seit dem 14.08.2026 NICHT mehr oben auf der
   *  Seite, sondern im Abschnitt „Worum es geht" der einen Erklaerzelle ganz
   *  unten (User-Direktive: nur Ueberschrift und Darstellung sichtbar).
   *
   *  Die Ueberschrift entfaellt hier: sie steht bereits in der Kopfzeile der
   *  Seite. Zweimal derselbe Titel ist kein Aufbau, sondern eine Wiederholung.
   */
  function lead(u, titel, text) {
    var z = (u.erklaerung ? null : u.erklaerZiel);
    var lege = u.erklaerung
      ? function (k) { u.erklaerung("worum", k); }
      : function (k) { z.appendChild(k); };
    lege(el("p", "lead", text));
  }

  /** Ein aufklappbarer Kasten.
   *
   *  Der Anwender haelt mit diesem Demonstrator Vorlesungen — er braucht die
   *  ausfuehrliche Erklaerung, aber nicht staendig vor Augen. Deshalb steht
   *  sie hinter einer Zeile, die man aufklappt. Zugeklappt bleibt das Bild
   *  gross, aufgeklappt steht alles da, was man zum Erklaeren braucht.
   */
  function aufklapp(titel, bauInhalt, offen) {
    var d = document.createElement("details");
    d.className = "aufklapp";
    if (offen) { d.open = true; }
    var s = document.createElement("summary");
    s.innerHTML = "<span class='zeichen'>?</span>" +
      "<span class='wort'>" + titel + "</span>";
    d.appendChild(s);
    var inhalt = el("div", "aufklapp-inhalt");
    d.appendChild(inhalt);
    if (typeof bauInhalt === "function") { bauInhalt(inhalt); }
    else if (bauInhalt) { inhalt.innerHTML = bauInhalt; }
    return d;
  }

  /** Die Leseanleitung — Abschnitt „So lesen Sie das Bild" der Erklaerzelle.
   *  Kein eigener Aufklapper mehr: die Zelle IST der Aufklapper. */
  function anleitung(u, titel, punkte) {
    var ul = document.createElement("ul");
    ul.className = "anleitung";
    punkte.forEach(function (t) {
      var li = document.createElement("li");
      li.innerHTML = t;
      ul.appendChild(li);
    });
    if (u.erklaerung) { u.erklaerung("lesen", ul); }
    else { u.erklaerZiel.appendChild(aufklapp(titel, function (z) { z.appendChild(ul); })); }
  }
  /** Ein Hinweis unter einer Anschauung.
   *
   *  Setzt den Text als HTML, damit Hervorhebungen wirken. Die Texte stehen
   *  samt und sonders hier im Quelltext; wo Modellausgaben eingesetzt
   *  werden, laufen sie vorher durch JSON.stringify und stehen in
   *  Anfuehrungszeichen. */
  function hinweis(t) {
    // Lange Hinweise klappen sich selbst weg. Die Grenze ist mit Absicht
    // knapp: was laenger ist als zwei Zeilen, steht zwischen dem Betrachter
    // und dem Bild.
    var roh = String(t).replace(/<[^>]+>/g, "");
    if (roh.length > 190) {
      var punkt = roh.indexOf(". ");
      var anriss = (punkt > 20 && punkt < 150)
        ? t.slice(0, t.indexOf(". ") + 1) : "";
      var d = aufklapp(anriss || "worum es hier geht",
                       "<p>" + t + "</p>");
      d.className = "aufklapp schmal";
      return d;
    }
    var p = el("p", "hinweis");
    p.innerHTML = t;
    return p;
  }

  /** Der Befund zu einer Anschauung: was in ihr zu sehen IST, in einem Satz
   *  mit Zahlen aus derselben Antwort. Ein Bild ohne Befund ueberlaesst dem
   *  Betrachter die Arbeit, die der Demonstrator ihm abnehmen soll. */
  function befund(html) {
    var f = el("div", "befund");
    var p = document.createElement("p");
    p.innerHTML = html;
    f.appendChild(p);
    f.setzen = function (neu) { p.innerHTML = neu; };
    f.dazu = function (neu, klasse) {
      var q = el("p", klasse || null);
      q.innerHTML = neu;
      f.appendChild(q);
      return q;
    };
    return f;
  }

  /** Ein Absatz mit anklickbaren Verweisen auf andere Kacheln.
   *  Aufbau: teile = ["Text ", {zu:"koepfe", wort:"dort"}, " weiter."] */
  function satzMitVerweisen(u, teile, klasse) {
    var p = el("p", klasse || "hinweis");
    teile.forEach(function (t) {
      if (typeof t === "string") { p.appendChild(document.createTextNode(t)); }
      else { p.appendChild(u.verweis(t.zu, t.wort)); }
    });
    return p;
  }

  // Die frühere freistehende Farblegende ist entfallen: eine Legende gehoert
  // AN das Bild, nicht daneben. Sie steckt jetzt im Fuss von
  // ZEICHNEN.rahmen(...) — siehe die legende:-Angaben an den Diagrammen.

  /** Umschalter zwischen mehreren Kennzahlen derselben Anschauung. */
  function wahlreihe(beschriftung, punkte, aktiv, beiWahl) {
    var r = reihe(beschriftung);
    punkte.forEach(function (p) {
      r.appendChild(chip(p.name, p.id === aktiv, function () { beiWahl(p.id); }));
    });
    return r;
  }
  function reihe(beschriftung) {
    var r = el("div", "reihe");
    if (beschriftung) { r.appendChild(el("span", "beschriftung", beschriftung)); }
    return r;
  }
  function knopf(text, klasse, beiKlick) {
    var k = el("button", "btn " + (klasse || ""), text);
    k.type = "button";
    if (beiKlick) { k.addEventListener("click", beiKlick); }
    return k;
  }
  function chip(text, aktiv, beiKlick) {
    var k = el("button", "chip" + (aktiv ? " aktiv" : ""), text);
    k.type = "button";
    k.addEventListener("click", beiKlick);
    return k;
  }
  function regler(name, min, max, schritt, start, beiEnde) {
    var l = el("label", "regler");
    l.appendChild(el("span", "name", name));
    var i = document.createElement("input");
    i.type = "range"; i.min = min; i.max = max; i.step = schritt; i.value = start;
    var stellen = schritt < 1 ? 2 : 0;
    var a = el("span", "wert", zahl(start, stellen));
    i.addEventListener("input", function () { a.textContent = zahl(i.value, stellen); });
    i.addEventListener("change", function () { beiEnde(parseFloat(i.value)); });
    l.appendChild(i); l.appendChild(a);
    return l;
  }
  function laedt(text) { return el("div", "laedt", text || "wird gerechnet"); }

  /** Die Kennzahlenzeile eines Bildes — das, was frueher ein Satz war.
   *
   *  Entscheidung des Anwenders, 14.08.2026: der Text am Bild wird auf eine
   *  Zeile eingedampft. Das ist keine Kuerzung um der Kuerze willen — die
   *  Zahlen aendern sich mit jedem Reglerzug, ein Satz drumherum aendert
   *  sich nicht mit und liest sich beim dritten Mal wie eine Behauptung.
   *
   *  `punkte` ist eine Liste [name, wert] oder [name, wert, hervor].
   *  Leere Eintraege fallen weg — eine Kennzahl ohne Wert ist keine.
   */
  function kennzahlen(punkte) {
    return punkte.filter(function (p) {
      return p && p[1] !== null && p[1] !== undefined && p[1] !== "";
    }).map(function (p) {
      return "<span class='kz" + (p[2] ? " stark" : "") + "'>" +
        "<span class='kz-name'>" + p[0] + "</span>" +
        "<span class='kz-wert'>" + p[1] + "</span></span>";
    }).join("<span class='kz-punkt'>·</span>");
  }

  function leinwand(breite, hoehe) {
    var c = document.createElement("canvas");
    var s = window.devicePixelRatio || 1;
    c.width = Math.round(breite * s); c.height = Math.round(hoehe * s);
    c.style.width = "100%"; c.style.maxWidth = breite + "px";
    var ctx = c.getContext("2d");
    ctx.scale(s, s); ctx.textBaseline = "middle";
    c.ctx = ctx; c.b = breite; c.h = hoehe;
    return c;
  }
  function hitze(w) {
    if (!(w > 0)) { return PALETTE.zeichner("gitterleer"); }
    var a = Math.pow(Math.min(1, w), 0.55);
    return "rgb(" + Math.round(1 + a * 150) + "," + Math.round(60 + a * 175) +
      "," + Math.round(90 + a * 165) + ")";
  }

  function verteilung(liste, hoechst) {
    var l = el("div", "verteilung");
    var max = hoechst || (liste.length ? liste[0].p : 1);
    liste.forEach(function (p) {
      var z = el("div", "vzeile");
      z.appendChild(el("div", "wort", sichtbar(p.text)));
      var sp = el("div", "spur"), bar = el("div", "bar");
      bar.style.width = Math.max(1, (p.p / max) * 100) + "%";
      sp.appendChild(bar); z.appendChild(sp);
      z.appendChild(el("div", "wert", pz(p.p)));
      l.appendChild(z);
    });
    return l;
  }

  function tokenreihe(token, gewaehlt, beiWahl) {
    var r = el("div", "tokenreihe");
    token.stuecke.forEach(function (s, i) {
      var t = el("div", "tok" + (i === gewaehlt ? " aktiv" : ""));
      t.appendChild(el("span", "stueck", sichtbar(s)));
      t.appendChild(el("span", "id", String(token.ids[i])));
      t.title = "Position " + i + " · ID " + token.ids[i];
      if (beiWahl) { t.addEventListener("click", function () { beiWahl(i); }); }
      r.appendChild(t);
    });
    return r;
  }

  // ── Die eine Stellenwahl der Seite ──────────────────────────────────────
  //
  // Wie der Satz (Runde 7) gehoert auch die gewaehlte STELLE im Satz der
  // ganzen Seite und nicht der einzelnen Anschauung. Vorher hatte jede
  // Kachel ihre eigene Wahl — `attnZeile`, `dimPosition`, `linienWahl`,
  // `position` —, und in drei Kacheln liess sich ueberhaupt nichts waehlen.
  // Ein Klick auf ein Stueck oben blieb dort ohne Wirkung.
  //
  // Regel ab jetzt: `zustand.position` ist die gewaehlte Stelle, -1 heisst
  // „die letzte“ (dort entsteht die Fortsetzung) und wird erst beim
  // Zeichnen aufgeloest — sonst zeigte ein Satzwechsel auf eine Stelle, die
  // es im neuen Satz nicht mehr gibt. JEDES Diagramm, in dem der Satz
  // vorkommt, markiert diese Stelle.

  /** Die gewaehlte Stelle, aufgeloest gegen die Laenge DIESES Satzes. */
  function stelle(u, T) {
    var p = u.zustand.position;
    if (p === undefined || p === null || p < 0 || p >= T) { return T - 1; }
    return p;
  }

  /** Eine Stueckreihe, die auf die gemeinsame Stellenwahl schreibt.
   *
   *  `beiWahl` zeichnet nur noch neu — den Zustand setzt die Reihe selbst,
   *  damit keine Kachel ihn vergisst. */
  function stellenreihe(u, token, beiWahl) {
    var T = token.stuecke.length;
    var r = tokenreihe(token, stelle(u, T), function (i) {
      u.zustand.position = i;
      beiWahl(i);
    });
    r.classList.add("stellenreihe");
    return r;
  }

  // ── Der Bezug: worauf rechnet dieses Bild? ──────────────────────────────
  //
  // Befund des Anwenders (11.08.): „in den unteren Darstellungen ist nicht
  // klar, ob es derselbe Satz wie oben ist und ob es sich verändert. Der
  // Bezug muss glasklar sein.“ Er hat recht: auf einer Seite mit vier
  // Diagrammen sieht man dem dritten nicht an, ob es den Satz von oben
  // meint, einen alten Stand zeigt oder etwas ganz anderes rechnet.
  //
  // Deshalb traegt JEDES Diagramm eine Bezugszeile, und zwar aus den Daten
  // gesetzt, mit denen es GERADE gezeichnet wurde — nicht aus dem Zustand.
  // Wird sie gesetzt, ist das Bild aktuell; steht dort ein anderer Satz als
  // oben, sieht man genau das.

  /** Den Satz als Stueckfolge schreiben, die gewaehlte Stelle hervorgehoben.
   *  Bei langen Saetzen wird um die Auswahl herum gekuerzt — die Zeile soll
   *  ein Bezug sein, keine zweite Anschauung. */
  function satzzeile(token, pos) {
    var st = token.stuecke;
    var von = 0, bis = st.length;
    var GRENZE = 78;
    var laenge = st.join("").length;
    if (laenge > GRENZE) {
      // ein Fenster um die gewaehlte Stelle
      var l = 0;
      von = pos; bis = pos + 1;
      while (l < GRENZE && (von > 0 || bis < st.length)) {
        if (von > 0) { von -= 1; l += st[von].length; }
        if (l < GRENZE && bis < st.length) { l += st[bis].length; bis += 1; }
      }
    }
    var teile = [];
    if (von > 0) { teile.push("<span class='rest'>…</span>"); }
    for (var i = von; i < bis; i++) {
      var s = sichtbar(st[i])
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      teile.push(i === pos ? "<span class='stelle'>" + s + "</span>"
                           : "<span class='satz'>" + s + "</span>");
    }
    if (bis < st.length) { teile.push("<span class='rest'>…</span>"); }
    // Eigene Huelle: daran erkennt der Pruefer, welcher Teil der Zeile der
    // SATZ ist — und kann ihn gegen das Eingabefeld oben halten.
    return "<span class='satzfolge'>" + teile.join("") + "</span>";
  }

  /** Die Bezugszeile eines Diagramms setzen.
   *
   *  `token` ist die Zerlegung, die der Server MIT dieser Antwort geliefert
   *  hat; `pos` die Stelle, auf die dieses Bild rechnet (oder -1, wenn es
   *  keine gibt). `zusatz` nimmt auf, was sonst noch gilt (Schicht, Kopf,
   *  Eingriffe). */
  function bezugSetzen(rahmen, u, token, pos, zusatz, heil) {
    // KURZ (Entscheidung des Anwenders, 14.08.2026): Stelle und Parameter,
    // NICHT der ganze Satz. Der steht eine Handbreit darüber im Eingabefeld
    // der Bedienleiste; ihn unter jedem Bild zu wiederholen war genau die
    // Textlast, um die es ging. Die Vorlage hat gar keine solche Zeile.
    //
    // Was die Zeile weiterhin leistet: sie sagt, auf WELCHE STELLE und mit
    // WELCHEN Parametern dieses Bild gerechnet hat, und sie wird bei jeder
    // Neuberechnung neu gesetzt — damit bleibt sie der Beleg, dass das Bild
    // aktuell ist.
    var teile = [];
    if (pos !== undefined && pos >= 0) {
      // MENSCHEN ZAEHLEN AB EINS. Hier stand "Stelle " + pos + "/" +
      // (laenge - 1) — beides nullbasiert. Bei sieben Stuecken las man
      // "Stelle 6/6", waehrend die Aussage daneben "Stuecke 7" sagte: ein
      // Widerspruch in derselben Zeile. Die Zaehlung im Code bleibt
      // nullbasiert, nur die Anzeige nicht. (26.08.2026)
      teile.push("<span class='rest'>Stelle " + (pos + 1) + " von " +
        token.stuecke.length + "</span><span class='stelle'>" +
        sichtbar(token.stuecke[pos]) + "</span>");
    } else {
      teile.push("<span class='rest'>" + token.stuecke.length +
        " Stücke</span>");
    }
    if (zusatz) { teile.push("<span class='rest'>" + zusatz + "</span>"); }
    // Ein beschaedigtes Modell gehoert an JEDES Bild geschrieben, das es
    // gerechnet hat — sonst haelt man die Zahlen fuer die echten. `heil`
    // ist die Ausnahme fuer die Vergleichsseite, die bewusst ohne
    // Eingriffe gerechnet wurde.
    var e = u.zustand.eingriffe;
    var n = e.kopfAus.length + e.schichtAus.length + e.mlpAus.length +
      e.attnAus.length;
    if (n && !heil) {
      teile.push("<span class='warn'>Modell beschädigt: " + n + " Eingriff" +
        (n === 1 ? "" : "e") + "</span>");
    }
    rahmen.setzeBezug(teile.join(" "));
  }

  /** Die Legende einer Balkenanschauung: die Farbkennlinie und die Farbe
   *  der Auswahl. Steht in JEDER Balkenanschauung gleich, damit man Gelb
   *  ueberall als „das habe ich gewaehlt“ liest. */
  function balkenlegende(rahmen, was) {
    ZEICHNEN.farbleiste(rahmen.fuss, {
      skala: "balken", links: "klein", rechts: "groß",
      was: (was ? was + " " : "") +
        "Die Farbe läuft mit der Balkenlänge; der gewählte Balken trägt die Auswahlfarbe."
    });
  }

  /** Die Beschriftung ueber einer Stueckreihe — immer gleich formuliert,
   *  damit man sie auf jeder Kachel wiedererkennt. */
  function stellenbeschriftung(text) {
    return el("div", "beschriftung",
      text || "Welche Stelle des Satzes? (anklicken — alle Bilder folgen)");
  }


  /** „Wie es rechnet" — der Rechenweg der Aufmerksamkeit an einem winzigen
   *  Satz, mit den echten Gewichten dieses Modells.
   *
   *  Am Ende steht die Probe: dieselbe Zahl, die das Modell selbst
   *  herausbekommen hat. Ohne diese Probe wäre das hier eine Nacherzählung;
   *  mit ihr ist bewiesen, dass es DIE Rechnung ist.
   */
  function rechenwegBauen(wurzel, u, opts) {
    opts = opts || {};
    var st = u.zustand;
    // Der Satz oben auf der Seite gilt AUCH hier — sonst steht dort ein
    // Eingabefeld, das auf diesen Abschnitt keine Wirkung hat, und man fragt
    // sich zu Recht, wozu es da ist. Nur wenn er zu lang ist, um jede Zahl
    // noch zu zeigen, wird auf ein kurzes Beispiel ausgewichen; das steht
    // dann auch so da.
    if (st.rwSchicht === undefined) { st.rwSchicht = 0; }
    if (st.rwKopf === undefined) { st.rwKopf = 0; }

    var f = feld("Wie es rechnet — Schritt für Schritt");
    f.appendChild(hinweis("Bis hierher haben Sie das <b>Ergebnis</b> der " +
      "Aufmerksamkeit gesehen. Hier steht, wie es entsteht — an <b>Ihrem " +
      "Satz von oben</b>, mit den echten Gewichten dieses Modells. Je kürzer " +
      "der Satz, desto besser lässt sich jede einzelne Zahl verfolgen."));

    // ── Die Metapher, ohne die Q/K/V leere Buchstaben bleiben ──
    var meta = el("div", "klartext");
    meta.innerHTML =
      "<p>Jedes Wort stellt eine <b>Frage</b> und trägt zugleich eine " +
      "<b>Aufschrift</b> und einen <b>Inhalt</b>. Wie in einer Suchmaschine:</p>" +
      "<p class='klein'><b>Query</b> (Frage) — wonach dieses Wort sucht. " +
      "„Ich bin ein Verb, wer ist mein Subjekt?“<br>" +
      "<b>Key</b> (Aufschrift) — wofür ein Wort sich anbietet. " +
      "„Ich bin ein Substantiv im Nominativ.“<br>" +
      "<b>Value</b> (Inhalt) — was ein Wort weitergibt, wenn es gewählt wird.</p>" +
      "<p class='klein'>Alle drei entstehen aus demselben Wortzustand, jeweils " +
      "durch eine eigene gelernte Matrix. Die Frage eines Wortes wird mit den " +
      "Aufschriften aller Wörter davor verglichen — je besser sie " +
      "zusammenpassen, desto mehr Inhalt fließt von dort.</p>";
    f.appendChild(meta);

    var steuer = el("div");
    f.appendChild(steuer);
    var ziel = el("div");
    f.appendChild(ziel);
    wurzel.appendChild(f);

    function laden() {
      ziel.innerHTML = "";
      ziel.appendChild(laedt("der Rechenweg wird nachgerechnet"));
      u.senden("/api/rechenweg", {
        text: st.satz, schicht: st.rwSchicht, kopf: st.rwKopf, zeile: -1
      }, function (d) {
        ziel.innerHTML = "";
        if (d.leer) { ziel.appendChild(hinweis("Kein Text.")); return; }
        zeichnen(d);
        steuerZeichnen(d);
      });
    }

    function vek(liste, laenge) {
      var s2 = "[" + liste.map(function (x) {
        return (x >= 0 ? " " : "") + zahl(x, 2);
      }).join("  ") + "  …]";
      return laenge !== undefined ? s2 : s2;
    }

    function schritt(nr, titel, text) {
      var e = el("div", "rechenschritt");
      e.appendChild(el("div", "nr", String(nr)));
      var k = el("div", "inhalt");
      k.appendChild(el("h5", null, titel));
      var p2 = el("div", "was");
      p2.innerHTML = text;
      k.appendChild(p2);
      e.appendChild(k);
      return e;
    }

    function zeichnen(d) {
      var wort = d.token.stuecke[d.zeile];
      var T = d.token.stuecke.length;

      // Schritt 1 — aus dem Zustand werden drei Vektoren
      var s1 = schritt(1, "Aus einem Wort werden drei Vektoren",
        "Das Wort <b>" + JSON.stringify(sichtbar(wort)) + "</b> trägt an " +
        "dieser Stelle einen Zustand aus " + tausend(u.info.d) + " Zahlen. " +
        "Drei gelernte Matrizen machen daraus je einen Vektor mit " +
        d.kopf_dim + " Zahlen — <b>Frage</b>, <b>Aufschrift</b>, " +
        "<b>Inhalt</b>. Gezeigt sind die ersten sechs Zahlen.");
      var tab1 = el("table", "tab rechen");
      [["Zustand des Wortes (" + tausend(u.info.d) + " Zahlen)", vek(d.zustand)],
       ["nach der Normierung", vek(d.zustand_norm)],
       ["<b>Query</b> — die Frage dieses Wortes (" + d.kopf_dim + ")", vek(d.query)]
      ].forEach(function (z) {
        var r = el("tr");
        var td1 = el("td"); td1.innerHTML = z[0];
        r.appendChild(td1);
        r.appendChild(el("td", "mono", z[1]));
        tab1.appendChild(r);
      });
      s1.querySelector(".inhalt").appendChild(tab1);
      ziel.appendChild(s1);

      // Schritt 2 — Frage trifft Aufschrift
      var s2 = schritt(2, "Die Frage wird mit jeder Aufschrift verglichen",
        "Für jedes Wort davor — und für das Wort selbst — wird das " +
        "<b>Punktprodukt</b> aus Frage und Aufschrift gebildet: die beiden " +
        "Vektoren werden Zahl für Zahl multipliziert und aufsummiert. Ein " +
        "hoher Wert heißt: die beiden passen zusammen.");
      var tab2 = el("table", "tab rechen");
      var kopfz = el("tr");
      ["Wort", "Key (Aufschrift)", "Frage · Aufschrift", "÷ √" + d.kopf_dim +
       " = " + d.wurzel, "nach der Maske", "Softmax"].forEach(function (x) {
        kopfz.appendChild(el("th", null, x));
      });
      tab2.appendChild(kopfz);
      d.keys.forEach(function (k) {
        var r = el("tr");
        if (k.pos === d.zeile) { r.className = "selbst"; }
        r.appendChild(el("td", "mono", sichtbar(k.stueck)));
        r.appendChild(el("td", "mono klein", vek(k.key)));
        r.appendChild(el("td", "zahl", zahl(k.punkt, 2)));
        r.appendChild(el("td", "zahl", zahl(k.skaliert, 3)));
        var m = el("td", "zahl");
        if (k.maskiert === null) {
          m.textContent = "−∞";
          m.title = "liegt nach dem gewählten Wort — darf nicht gesehen werden";
          m.style.color = PALETTE.token("--text-muted");
        } else { m.textContent = zahl(k.maskiert, 3); }
        r.appendChild(m);
        var g = el("td", "zahl");
        g.textContent = pz(k.gewicht, 2);
        g.style.color = PALETTE.token("--marke-text");
        r.appendChild(g);
        tab2.appendChild(r);
      });
      s2.querySelector(".inhalt").appendChild(tab2);
      ziel.appendChild(s2);

      // Schritt 3 — die drei Umformungen erklären
      var s3 = schritt(3, "Warum drei Umformungen nötig sind",
        "<b>Teilen durch √" + d.kopf_dim + " = " + d.wurzel + ":</b> das " +
        "Punktprodukt zweier Vektoren mit " + d.kopf_dim + " Zahlen wird " +
        "sonst sehr groß, und der Softmax danach würde alles auf ein " +
        "einziges Wort legen. Die Wurzel hält die Werte in einem Bereich, in " +
        "dem noch abgestuft werden kann.<br><br>" +
        "<b>Die Maske:</b> alles, was nach dem gewählten Wort steht, wird " +
        "auf minus unendlich gesetzt. Kein Wort darf sehen, was nach ihm " +
        "kommt — sonst wäre die Vorhersage geschummelt.<br><br>" +
        "<b>Der Softmax:</b> macht aus beliebigen Zahlen Anteile, die sich " +
        "zu 100 % summieren. Große Werte werden stark bevorzugt (er " +
        "potenziert), minus unendlich wird zu null.");
      ziel.appendChild(s3);

      // Schritt 4 — gewichtete Summe
      var summe = 0;
      d.keys.forEach(function (k) { summe += k.gewicht; });
      var s4 = schritt(4, "Die Inhalte werden gemischt",
        "Jetzt werden die <b>Inhalte</b> (Value) aller Wörter mit genau " +
        "diesen Anteilen zusammengemischt: " +
        d.keys.filter(function (k) { return k.gewicht > 0.001; })
          .map(function (k) {
            return pz(k.gewicht, 0) + " × Inhalt von " +
              JSON.stringify(sichtbar(k.stueck));
          }).join(" + ") + ". Die Anteile ergeben zusammen " +
        pz(summe, 1) + ". Heraus kommt <b>ein</b> Vektor — das, was dieser " +
        "eine Kopf dem Wort " + JSON.stringify(sichtbar(wort)) + " an dieser " +
        "Stelle hinzufügt:");
      var tab4 = el("table", "tab rechen");
      var r4 = el("tr");
      r4.appendChild(el("td", null, "Ergebnis dieses Kopfes"));
      r4.appendChild(el("td", "mono", vek(d.ergebnis)));
      tab4.appendChild(r4);
      s4.querySelector(".inhalt").appendChild(tab4);
      s4.querySelector(".inhalt").appendChild(hinweis("Dasselbe geschieht in " +
        "dieser Schicht für alle " + u.info.koepfe + " Köpfe zugleich. Ihre " +
        "Ergebnisse werden aneinandergehängt, durch eine weitere gelernte " +
        "Matrix geschickt und auf den Zustand <b>addiert</b> — der alte " +
        "Zustand bleibt darunter erhalten. Das ist der Residualstrom."));
      ziel.appendChild(s4);

      // Die Probe
      var probe = el("div", d.stimmt ? "befund" : "warnung");
      var pp = document.createElement("p");
      pp.innerHTML = d.stimmt
        ? "<b>Die Probe:</b> nachgerechnet ergibt " +
          d.keys.map(function (k) { return pz(k.gewicht, 2); }).join(" · ") +
          ". Das Modell selbst hat " +
          d.echt.map(function (x) { return pz(x, 2); }).join(" · ") +
          " herausbekommen. Größte Abweichung: <span class='zahl'>" +
          d.abweichung.toExponential(1).replace(".", ",") + "</span> — das " +
          "ist Rundung. <b>Was hier vorgerechnet wurde, ist also nicht eine " +
          "vereinfachte Nacherzählung, sondern genau die Rechnung, die das " +
          "Modell ausführt.</b>"
        : "Die Nachrechnung weicht vom Modell ab (" + d.abweichung +
          "). Das sollte nicht sein.";
      probe.appendChild(pp);
      ziel.appendChild(probe);
    }

    function steuerZeichnen(d) {
      steuer.innerHTML = "";
      var r2 = reihe("Schicht");
      [0, 1, 13, 27].forEach(function (n) {
        r2.appendChild(chip(String(n + 1), st.rwSchicht === n, function () {
          st.rwSchicht = n; laden();
        }));
      });
      steuer.appendChild(r2);

      var r3 = reihe("Kopf");
      for (var h = 0; h < Math.min(8, u.info.koepfe); h++) {
        (function (h) {
          r3.appendChild(chip(String(h + 1), st.rwKopf === h, function () {
            st.rwKopf = h; laden();
          }));
        })(h);
      }
      steuer.appendChild(r3);
    }

    laden();
  }


  /** „Wozu überhaupt?" — das Problem, das die Aufmerksamkeit löst.
   *
   *  Ein Embedding ist kontextlos: „Bank“ ist in der Tabelle EIN Vektor, ob
   *  im Park oder in der Innenstadt. Die Bedeutung entsteht erst, während
   *  das Wort durch die Schichten läuft. Das ist messbar — und diese
   *  Messung ist der beste Einstieg, den es gibt.
   */
  function kontextproblemBauen(wurzel, u) {
    var st = u.zustand;
    var PAARE = [
      { wort: "Bank",
        a: "Im Park stand eine alte Bank aus Holz",
        b: "In der Innenstadt eröffnete eine Bank für Firmenkunden",
        was: "zwei Bedeutungen" },
      { wort: "Schloss",
        a: "Der Schlüssel passte nicht ins Schloss der Tür",
        b: "Der Graf lud zum Fest in sein Schloss am See",
        was: "zwei Bedeutungen" },
      { wort: "Maschine",
        a: "Die Werkstatt reparierte die defekte Maschine",
        b: "Der Betrieb kaufte eine gebrauchte Maschine",
        was: "gleiche Bedeutung" },
      { wort: "Maschine",
        a: "Die Maschine steht in der Halle",
        b: "Die Maschine wurde gestern geliefert",
        was: "identischer Anfang" }
    ];
    if (st.kpWahl === undefined) { st.kpWahl = -1; }
    if (st.kpB === undefined) { st.kpB = PAARE[0].b; }
    if (st.kpWort === undefined) { st.kpWort = PAARE[0].wort; }

    var f = feld("Wozu überhaupt? Das Problem, das die Aufmerksamkeit löst");
    f.appendChild(hinweis("In der Tabelle des Modells hat jedes Stück " +
      "<b>genau einen</b> Vektor. „Bank“ ist dort ein einziger Eintrag — ob " +
      "im Park oder in der Innenstadt. Die Bedeutung entsteht erst, während " +
      "das Wort durch die Schichten läuft und sich von den Wörtern davor " +
      "holt, was es braucht. Genau das ist die Aufgabe der Aufmerksamkeit."));

    // ── Die Parameter: alles frei verstellbar ──
    var stell = el("div", "stellwerk");
    stell.appendChild(el("div", "stellwerk-titel", "Zum Verstellen"));
    function zeile(beschriftung, wert, breit, beiAenderung) {
      var z = el("label", "stellzeile");
      z.appendChild(el("span", "was", beschriftung));
      var i = document.createElement("input");
      i.type = "text"; i.value = wert; i.spellcheck = false;
      if (breit) { i.className = "breit"; }
      i.addEventListener("change", function () { beiAenderung(i.value); });
      i.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { beiAenderung(i.value); }
      });
      z.appendChild(i);
      return z;
    }
    stell.appendChild(el("div", "stellhinweis",
      "Satz A ist Ihr Satz von oben — ändern Sie ihn dort, rechnet dieses " +
      "Diagramm sofort neu. Satz B ist der Vergleichssatz."));
    var zeigeA = el("div", "stellzeile");
    zeigeA.appendChild(el("span", "was", "Satz A (von oben)"));
    zeigeA.appendChild(el("span", "festwert", st.satz));
    stell.appendChild(zeigeA);
    stell.appendChild(zeile("Satz B", st.kpB, true, function (v) {
      st.kpB = v; laden(ZEICHNEN.DAUER);
    }));
    stell.appendChild(zeile("beobachtetes Wort", st.kpWort, false, function (v) {
      st.kpWort = v; laden(ZEICHNEN.DAUER);
    }));
    var bsp = reihe("fertige Paare");
    PAARE.forEach(function (x, i) {
      bsp.appendChild(chip(x.wort + " — " + x.was, st.kpWahl === i, function () {
        st.kpWahl = i; st.satz = x.a; st.kpB = x.b; st.kpWort = x.wort;
        neuAufbauen();
      }));
    });
    stell.appendChild(bsp);
    f.appendChild(stell);

    var saetze = el("div", "klartext");
    f.appendChild(saetze);
    var diagrammZiel = el("div");
    f.appendChild(diagrammZiel);
    var kBefund = befund("");
    f.appendChild(kBefund);
    wurzel.appendChild(f);

    // Der Rahmen: Aussage oben, Legende unten — beides gehoert ans Bild,
    // nicht in den Fliesstext daneben.
    var rahmen = ZEICHNEN.rahmen(diagrammZiel, {
      aussage: "",
      legende: [
        ["Abstand der beiden Zustände desselben Wortes", PALETTE.token("--marke-text"), "linie"],
        ["0 = Zahl für Zahl identisch", null],
        ["1 = völlig unabhängig", null]
      ]
    });
    var zeichneKurve = ZEICHNEN.stufenkurve(rahmen.wurzel, {
      breite: 1060, hoehe: 300, frei: true,
      yTitel: "Abstand der Zustände",
      xTitel: "Stufe im Modell  —  von der Tabelle (links) bis zur letzten Schicht (rechts)"
    });

    function neuAufbauen() { u.neu(); }

    function laden(dauer) {
      saetze.innerHTML = "<p><b>A:</b> " + st.satz + "<br><b>B:</b> " + st.kpB +
        "<br><span class='klein'>Beobachtet wird " +
        JSON.stringify(st.kpWort) + " — in beiden Sätzen startet es mit " +
        "<b>demselben</b> Vektor aus der Tabelle.</span></p>";

      // Der Bezug wird VOR der Fallunterscheidung gesetzt — gerade wenn
      // nichts messbar ist, muss dastehen, WORAUF nichts messbar war.
      rahmen.setzeBezug(
        "<span class='was'>vergleicht A</span> " +
        "<span class='satzfolge'><span class='satz'>" + st.satz +
        "</span></span> " +
        "<span class='rest'>(Ihr Satz von oben)</span> " +
        "<span class='was'>gegen B</span> " +
        "<span class='satz'>" + st.kpB + "</span> " +
        "<span class='was'>am Wort</span> " +
        "<span class='stelle'>" + st.kpWort + "</span>");

      u.senden("/api/kontext",
        { satz_a: st.satz, satz_b: st.kpB, wort: " " + st.kpWort.trim() },
        function (d) {
          if (d.leer) {
            rahmen.setzeAussage("<span class='warn'>" +
              (d.grund || "Nicht messbar.") + "</span>");
            kBefund.setzen("Das Wort muss in <b>beiden</b> Sätzen genau so " +
              "vorkommen, wie Sie es oben eingetragen haben.");
            return;
          }
          var stufen = d.stufen.map(function (x) {
            return { p: x.abstand, text: x.stufe, stufe: x.stufe, wechsel: false };
          });
          zeichneKurve(stufen, dauer);

          var groesste = 0, wo = 0;
          d.stufen.forEach(function (x, i) {
            if (x.abstand > groesste) { groesste = x.abstand; wo = i; }
          });
          var ende = d.stufen[d.stufen.length - 1].abstand;

          // DIE AUSSAGE — der eine Satz, der sagt, was im Bild zu sehen ist.
          if (groesste < 0.01) {
            rahmen.setzeAussage(
              "Die Linie bleibt auf <b>null</b> — beide Zustände sind " +
              "Zahl für Zahl gleich. <b>Ein Wort kann nur nach links " +
              "schauen.</b>");
            kBefund.setzen(
              "Das ist kein Fehler, sondern die wichtigste Regel des " +
              "Modells. Beide Sätze sind bis zu diesem Wort <b>Zeichen für " +
              "Zeichen gleich</b>, und was <b>danach</b> kommt, darf den " +
              "Zustand nicht beeinflussen — sonst wäre die Vorhersage " +
              "geschummelt. Setzen Sie den Unterschied <b>vor</b> das Wort, " +
              "dann bewegt sich die Linie.");
          } else {
            rahmen.setzeAussage(
              "Links <b>null</b> — dasselbe Wort, derselbe Vektor. Rechts " +
              "<b>" + zahl(ende, 2) + "</b> — daraus sind zwei verschiedene " +
              "Bedeutungen geworden. <b>Diesen Anstieg rechnet die " +
              "Aufmerksamkeit.</b>");
            kBefund.setzen(
              "Größter Abstand <span class='zahl'>" + zahl(groesste, 3) +
              "</span> " + d.stufen[wo].stufe + ", am Ende <span class='zahl'>" +
              zahl(ende, 3) + "</span>. Die Bedeutung eines Wortes steht " +
              "also <b>nicht in der Tabelle</b> — sie wird gerechnet, indem " +
              "das Wort sich von seinen Nachbarn holt, was es zur " +
              "Unterscheidung braucht. Verstellen Sie oben die Sätze: je " +
              "deutlicher der Zusammenhang <b>vor</b> dem Wort abweicht, " +
              "desto weiter laufen die Linien auseinander.");
          }
        });
    }
    laden(0);
  }


  /** Die Aufmerksamkeit in ihren DREI Rechenstufen — als Herleitung.
   *
   *  Die Kachel zeigt darunter das ERGEBNIS: die fertige Attention-Matrix.
   *  Wie sie entsteht, war bis hierher unsichtbar. Diese Kette zeigt es:
   *
   *    1  Punktprodukt        Q · Kᵀ        roh, ohne Grenze, OHNE Maske
   *    2  Skalierung + Maske  ÷ √kopf_dim   die Zukunft wird gesperrt
   *    3  Softmax             je Zeile 1    erst jetzt sind es Anteile
   *
   *  Bauform (Entscheidung des Anwenders, 13.08.2026): ZUGEKLAPPT steht
   *  das Ergebnis, AUFGEKLAPPT die Herleitung darueber — wie im Vorbild.
   *  Zwei Gruende gegen eine eigene Station: die dritte Stufe IST die
   *  Matrix darunter, und wer sie zweimal gross sieht, sucht den
   *  Unterschied. Und wer die Herleitung nicht braucht, soll sie nicht
   *  wegscrollen muessen.
   *
   *  Gerechnet wird erst beim AUFKLAPPEN, und dann nur bei geaendertem
   *  Satz, Schicht oder Kopf. Ein Stellenwechsel setzt bloss die Marke —
   *  dieselbe Regel wie im 3D-Raum: einmal rechnen, danach nur filtern.
   */
  /** Die passende zweiseitige Skala fuer einen gemessenen Wertebereich.
   *
   *  Befund am eigenen Bild (13.08.2026): mit einer FEST symmetrischen
   *  Skala (±max|min|) war Stufe 1 bei Schicht 1 / Kopf 1 nahezu
   *  einfarbig — dort laufen die Werte von +18,6 bis +100,4, es kommt
   *  also kein einziger negativer vor. Die halbe Skala blieb ungenutzt,
   *  alle Felder lagen im oberen Fuenftel, und die Leiste versprach einen
   *  negativen Bereich, den das Bild gar nicht hat.
   *
   *  Deshalb: die Null behaelt ihren dunklen Mittelpunkt NUR, wenn sie im
   *  Bereich liegt. Sonst laeuft die Skala von min bis max und nutzt ihre
   *  ganze Laenge — mit Grenzen, die die Leiste ehrlich nennt.
   */
  function skalaFuer(min, max) {
    if (min < 0 && max > 0) {
      // Beide Vorzeichen: symmetrisch, sonst waere die Farbe fuer -61 eine
      // andere Staerke als fuer +61 und das Bild zeigte eine Schieflage,
      // die in den Zahlen nicht steckt.
      var sp = Math.max(-min, max) || 1;
      return {
        leiste: "zweiseitig",
        farbe: function (w) { return ZEICHNEN.zweiseitig(w / sp); },
        // `probe(t)` mit t von 0 bis 1 liefert dieselbe Skala fuer eine
        // selbstgezeichnete Farbleiste — damit Bild und Leiste nicht
        // auseinanderlaufen koennen, auch wenn die Leiste im SVG steckt.
        probe: function (t) { return ZEICHNEN.zweiseitig(-1 + 2 * t); },
        links: "−" + zahl(sp, 1), mitte: "0", rechts: "+" + zahl(sp, 1),
        was: "Teal = negativ (passt nicht), Indigo = positiv (passt); " +
          "die Mitte ist die Null. Tatsächlich vorkommend: " +
          zahl(min, 1) + " bis " + zahl(max, 1) + "."
      };
    }
    var w2 = (max - min) || 1;
    if (min >= 0) {
      return {
        leiste: "zweiseitig-plus",
        farbe: function (w) { return ZEICHNEN.zweiseitig((w - min) / w2); },
        probe: function (t) { return ZEICHNEN.zweiseitig(t); },
        links: zahl(min, 1), mitte: "", rechts: zahl(max, 1),
        was: "Indigo = passt, dunkel = passt weniger. Hier ist KEIN Wert " +
          "negativ, deshalb beginnt die Skala nicht bei null, sondern beim " +
          "kleinsten vorkommenden Wert " + zahl(min, 1) + "."
      };
    }
    return {
      leiste: "zweiseitig-minus",
      farbe: function (w) { return ZEICHNEN.zweiseitig(-(max - w) / w2); },
      probe: function (t) { return ZEICHNEN.zweiseitig(-1 + t); },
      links: zahl(min, 1), mitte: "", rechts: zahl(max, 1),
      was: "Teal = passt nicht, dunkel = passt eher. Hier ist KEIN Wert " +
        "positiv, deshalb endet die Skala nicht bei null, sondern beim " +
        "größten vorkommenden Wert " + zahl(max, 1) + "."
    };
  }

  /** Die Vorhersage-Tafel — die HAUPTANSICHT der Kachel „Was als Nächstes
   *  kommt", nicht mehr eine zugeklappte Herleitung darunter.
   *
   *  WARUM DIESER UMBAU (14.08.2026). Vorher standen hier zwei Bilder
   *  uebereinander, die dasselbe zeigten: ein Balkenbild „die
   *  wahrscheinlichsten Fortsetzungen" und, dahinter weggeklappt, dieselben
   *  Stuecke noch einmal mit ihrem Rechenweg. Das Vorbild (Transformer
   *  Explainer, Abbildung 8) macht daraus EIN Bild: die Balken SIND die
   *  letzte Spalte der Tafel. Wer die Tafel wegklappt, hat kein Ergebnis
   *  ohne Weg mehr — er hat nur den Weg versteckt.
   *
   *  Aufbau, von oben nach unten, wie im Vorbild:
   *    Regler (Temperatur, Verfahren, Wert)   OBEN, ueber der Tafel
   *    Stück | Logit | ÷T | Schnitt | Softmax
   *
   *  Die Reihenfolge der Rechnung ist die von `erzeugen` — der Schnitt
   *  setzt auf −∞, DANN laeuft der Softmax. Anders herum gezeigt waere es
   *  eine Rechnung, die dieses Programm nirgends ausfuehrt; die Probe im
   *  Befund weist nach, dass beide Wege dieselbe Verteilung ergeben.
   *
   *  Temperatur, Verfahren und Schnittwert schreiben in denselben Zustand
   *  wie die Kachel „Weiterschreiben" (Regel A-4) — es ist derselbe
   *  Parameter, und zwei Regler fuer dieselbe Sache waeren zwei Wahrheiten.
   */
  function vorhersagetafelBauen(wurzel, u, stellwerkZiel, beiParameter,
                                beiStueckwahl) {
    var st = u.zustand;
    // Wird gerufen, wenn ein Parameter der Kachel sich aendert. Die Kachel
    // haengt daran ihre UEBRIGEN Darstellungen — das ist die Mechanik der
    // Regel „ein Parameter wirkt auf ALLE Bilder der Kachel".
    var weitersagen = beiParameter || function () {};
    // Und dasselbe fuer die Wahl eines Stuecks: sie gehoert in JEDES Bild
    // der Kachel (Regel A-6 — der Klick kommt ueberall an).
    var weitersagenStueck = beiStueckwahl || function () {};
    if (st.tafelAufgeklappt === undefined) { st.tafelAufgeklappt = false; }
    var stand = null, laeuft = null, daten = null;
    var rahmen = null, zeichne = null, tBefund = null;
    var stellwerk = null, augeZiel = null, augeOffen = false;
    var augeRahmen = null, augeZeichne = null, augeStand = null;

    // Welches Stueck ist gewaehlt? Voreingestellt keines — dann gilt das
    // wahrscheinlichste. Ein Klick auf eine Zeile waehlt sie; dieselbe Wahl
    // steuert die Aufschluesselung hinter dem Auge.
    if (st.vorhersageStueck === undefined) { st.vorhersageStueck = null; }

    var inhalt = el("div", "tafelblock");
    wurzel.appendChild(inhalt);

    // Der Spaltentext gehoert in die Erklaerzelle, nicht ueber die Tafel.
    (function () {
      var ziel = { appendChild: function (k) { u.erklaerung("lesen", k); } };
      var vor = el("div", "klartext");
      vor.innerHTML =
        "<p>Eine Zeile je möglichem nächsten Stück, eine Spalte je " +
        "Rechenschritt. Man liest sie <b>quer</b>: was wird aus diesem " +
        "Stück?</p>" +
        "<p class='klein'><b>Logit</b> — je Stück eine rohe Zahl, beliebig " +
        "groß, auch negativ. Sie entsteht am Ende des Modells aus einer " +
        "einzigen Multiplikation; das Auge im Spaltenkopf zeigt sie.<br>" +
        "<b>÷ Temperatur</b> — kleiner als 1 spreizt die Abstände (das " +
        "Modell wird entschiedener), größer als 1 zieht sie zusammen (es " +
        "wird beliebiger).<br>" +
        "<b>Der Schnitt</b> — was ausgeschlossen wird, geht auf <b>−∞</b>. " +
        "Bei <i>top-k</i> bleibt eine feste <b>Anzahl</b>, bei <i>top-p</i> " +
        "bleiben so viele, wie zusammen eine feste <b>Menge</b> " +
        "ausmachen.<br>" +
        "<b>Softmax</b> — macht aus den verbliebenen Zahlen Anteile; " +
        "zusammen 100 %. Erst diese Spalte entscheidet, was beim " +
        "Weiterschreiben gezogen werden kann.</p>";
      ziel.appendChild(vor);
    }());

    // ── Die Regler stehen in der BEDIENLEISTE der Kachel ────────────────
    //
    // Nicht mehr über der Tafel, sondern ganz oben bei Satz und Stelle —
    // denn sie gelten für JEDE Darstellung der Kachel, nicht nur für die
    // Tafel (User-Direktive 14.08.2026). `stellwerkZiel` kommt von der
    // Kachel; ohne Angabe baut die Tafel sich ihre Leiste selbst, damit sie
    // auch einzeln verwendbar bleibt.
    stellwerk = stellwerkZiel || el("div", "stellwerk oben");
    if (!stellwerkZiel) { inhalt.appendChild(stellwerk); }
    stellwerkBauen();

    rahmen = ZEICHNEN.rahmen(inhalt, {
      aussage: "",
      // LEGENDE: Marke und wenige Wörter (Entscheidung 14.08.2026). Die
      // Begründung, warum die ersten Spalten keine Balken tragen, steht in
      // der Erklärzelle — sie erklärt, sie beschriftet nicht.
      legende: [
        ["Balkenlänge = Wahrscheinlichkeit", PALETTE.zeichner("knoten")],
        ["hinterlegt = bleibt", PALETTE.mit("--marke-rgb", 0.55)],
        ["durchgestrichen = raus", PALETTE.zeichner("raus")],
        ["gewählt", PALETTE.token("--wahl")]
      ]
    });
    zeichne = ZEICHNEN.verwandlungstafel(rahmen.wurzel, {
      stueckTitel: "Stück",
      beiAufklappen: function () {
        st.tafelAufgeklappt = !st.tafelAufgeklappt;
        if (daten) { zeichnen(daten); }
      },
      // KEIN eigener y-Titel mehr: die Kopfzeile IST die Achsenbeschriftung
      // (sie trägt die Klasse `achsenzeile`), und die Vorlage setzt über die
      // Tafel keine zweite Überschrift. „Eine Zeile je Stück, nach
      // Wahrscheinlichkeit geordnet" steht jetzt in der Erklärzelle.
      spalten: [
        { titel: "Logit", unter: "roh", form: function (v) { return zahl(v, 2); },
          knopf: { zeichen: "◉", titel: "Woher kommt dieses Logit?",
                   beiKlick: augeUmschalten } },
        { titel: "÷ Temperatur", unter: "",
          form: function (v) { return zahl(v, 2); } },
        { titel: "Schnitt", unter: "", schnitt: true },
        { titel: "Softmax", unter: "", balken: true,
          form: function (v) { return pz(v, 2); } }
      ]
    });
    // KEINE FARBLEISTE MEHR: alle Balken tragen dieselbe Farbe, die Länge
    // trägt den Wert. Eine Farbleiste verspräche eine Skala, die es nicht
    // gibt — und kostete unter dem Bild eine Zeile, die die Vorlage nicht
    // hat. (`verwandlungstafel` ist deshalb aus der FARBIG-Liste des
    // Diagramm-Prüfers genommen, mit Begründung dort.)
    u.erklaerung("lesen", el("p", null,
      "Nur die letzte Spalte hat einen Balken; seine Länge und seine Farbe " +
      "sind dieselbe Größe — die Wahrscheinlichkeit. Die drei Spalten davor " +
      "sind Zahlen, keine Größen: sie liegen so dicht beieinander (gemessen " +
      "16,4 bis 20,0), dass Balken dort nichts zeigten."));
    tBefund = befund("");
    u.erklaerung("zusehen", tBefund);

    augeZiel = el("div", "auge-ziel");
    augeZiel.style.display = "none";
    inhalt.appendChild(augeZiel);

    /** Die Bedienzeile. Wird neu gebaut, wenn das Verfahren wechselt — der
     *  zweite Regler gehoert dann einer anderen Groesse. */
    function stellwerkBauen() {
      stellwerk.innerHTML = "";
      stellwerk.appendChild(el("span", "leiste-name", "Rechnung"));
      stellwerk.appendChild(regler("Temperatur", 0.05, 2.0, 0.05,
        st.temperatur, function (v) { st.temperatur = v; alleNeu(); }));

      var wahl = el("div", "verfahrenwahl");
      wahl.appendChild(el("span", "beschriftung", "Schnitt"));
      [["top-k  (feste Anzahl)", "top_k"],
       ["top-p  (feste Menge)", "top_p"]].forEach(function (p) {
        wahl.appendChild(chip(p[0], st.verfahren === p[1], function () {
          st.verfahren = p[1];
          stellwerkBauen();
          alleNeu();
        }));
      });
      stellwerk.appendChild(wahl);

      if (st.verfahren === "top_p") {
        stellwerk.appendChild(regler("top-p", 0.05, 1.0, 0.05, st.topP,
          function (v) { st.topP = v; alleNeu(); }));
      } else {
        // Bis 50, damit die Voreinstellung 40 auch DARSTELLBAR ist. Ein
        // Regler, der 30 anzeigt, waehrend 40 gilt, ist eine Falschaussage.
        stellwerk.appendChild(regler("top-k", 1, 50, 1, st.topK,
          function (v) { st.topK = v; alleNeu(); }));
      }
    }

    /** Ein Parameter hat sich geaendert: erst die eigene Tafel, dann ALLE
     *  uebrigen Darstellungen der Kachel. Nie nur das eine Bild. */
    function alleNeu() {
      pruefen();
      weitersagen();
    }

    function schluessel() {
      return st.satz + "|" + st.position + "|" + st.temperatur + "|" +
        st.verfahren + "|" + st.topK + "|" + st.topP + "|" +
        JSON.stringify(st.eingriffe);
    }

    function pruefen() {
      var jetzt = schluessel();
      if (laeuft === jetzt) { return; }
      if (stand === jetzt && daten) { augePruefen(); return; }
      holen(jetzt);
    }

    var ladeMarke = null;

    function holen(jetzt) {
      // EINE ECHTE LADEMARKE, nicht nur ein Satz in der Aussage.
      //
      // Die Prüfer (pruefe_diagramme.js, uat.js) warten darauf, dass keine
      // `.laedt`-Marke mehr auf der Seite steht, und messen erst dann. Ohne
      // sie fotografierten sie die leere Tafel und meldeten "Bild ist leer"
      // — und zwar je nach Serverlast mal ja, mal nein.
      if (!daten && !ladeMarke) {
        ladeMarke = laedt("die vier Stufen werden gerechnet");
        rahmen.wurzel.appendChild(ladeMarke);
      }
      laeuft = jetzt;
      u.senden("/api/logit_kette", {
        text: st.satz, position: st.position, temperatur: st.temperatur,
        verfahren: st.verfahren, top_k: st.topK, top_p: st.topP,
        oben: 12, eingriffe: st.eingriffe
      }, function (d) {
        if (laeuft !== jetzt) { return; }
        laeuft = null;
        if (ladeMarke) { ladeMarke.remove(); ladeMarke = null; }
        if (d.leer) {
          rahmen.setzeAussage("Kein Text.");
          return;
        }
        stand = jetzt;
        daten = d;
        zeichnen(d);
        augePruefen();
      });
    }

    function zeichnen(d) {
      var lo = d.grenzen.logit, sk = d.grenzen.skaliert, pm = d.grenzen.p || 1;
      var pTop = st.verfahren === "top_p";

      // Ein gewaehltes Stueck, das es in dieser Liste nicht mehr gibt (neuer
      // Satz, andere Stelle), faellt weg — sonst zeigte die Aufschluesselung
      // ein Stueck, das in der Tafel gar nicht steht.
      var vorhanden = d.kandidaten.some(function (c) {
        return c.id === st.vorhersageStueck;
      });
      if (!vorhanden) { st.vorhersageStueck = null; }
      var gewaehltId = st.vorhersageStueck === null
        ? d.kandidaten[0].id : st.vorhersageStueck;

      var zeilen = d.kandidaten.map(function (c) {
        return {
          id: c.id, name: c.text, raus: !c.drin,
          gewaehlt: c.id === gewaehltId,
          schnitt: !!c.schnitt_hier,
          anteile: [null, null, null, c.p / pm],
          werte: [
            c.logit, c.skaliert,
            // top-k zeigt den Wert NACH dem Schnitt (oder −∞); top-p zeigt
            // die laufende Summe, denn genau sie entscheidet dort, wo
            // geschnitten wird. Beide Male steht in der Spalte die Groesse,
            // die den Schnitt bestimmt.
            pTop ? c.kumuliert : (c.drin ? c.nach_schnitt : null),
            c.p
          ],
          texte: [
            zahl(c.logit, 2),
            zahl(c.skaliert, 2),
            // MINUS UNENDLICH statt eines Strichs. Das ist keine Zierde:
            // genau das setzt der Schnitt ein, und genau deshalb faellt
            // die Zahl im naechsten Schritt auf null. Ein "—" verschwiege
            // den Mechanismus.
            pTop ? pz(c.kumuliert, 1) : (c.drin ? zahl(c.nach_schnitt, 2) : "−∞"),
            pz(c.p, 2)
          ]
        };
      });

      zeichne({
        zeilen: zeilen,
        aufgeklappt: st.tafelAufgeklappt,
        beiKlick: function (r) {
          // KEIN AB-UND-WIEDER-AN. Vorher nahm ein zweiter Klick auf
          // dieselbe Zeile die Wahl zurueck — und weil dann wieder das
          // wahrscheinlichste Stueck gilt, was bei Zeile 1 dasselbe ist,
          // passierte sichtbar NICHTS. Gemessen am 14.08.: Klick auf
          // `.tafel-zeile.gewaehlt` = tot. Ein Klick, der nichts tut, ist
          // ein Konstruktionsfehler (Regel A-2/A-6).
          //
          // Jetzt waehlt jeder Klick, und die Wahl geht ins ANDERE Bild
          // derselben Kachel weiter: im Netz wird dasselbe Stueck markiert.
          st.vorhersageStueck = r.id;
          zeichnen(daten);
          augeStand = null;
          augePruefen();
          weitersagenStueck(r.id);
        },
        // KURZE UNTERZEILEN: in der Vorlage sind die Spaltenköpfe einzelne
        // kleine Wörter. Eine Unterzeile, die auf drei Zeilen umbricht,
        // macht den Kopf höher als drei Datenzeilen zusammen.
        spalten: [
          { titel: "Logit", unter: zahl(lo[0], 1) + "…" + zahl(lo[1], 1) },
          { titel: "÷ " + zahl(d.temperatur, 2),
            unter: zahl(sk[0], 1) + "…" + zahl(sk[1], 1) },
          pTop
            ? { titel: "top-p " + zahl(d.top_p, 2), schnitt: true,
                hinterlegen: d.schnitt_sichtbar,
                unter: d.behalten_anzahl + " bleiben" }
            : { titel: "top-k " + d.top_k, schnitt: true,
                hinterlegen: d.schnitt_sichtbar,
                unter: d.schnitt_sichtbar ? "Rest −∞" : "außerhalb" },
          { titel: "Softmax", balken: true, unter: "= 100 %" }
        ]
      }, 420);

      var erste = d.kandidaten[0];
      var raus = d.kandidaten.filter(function (c) { return !c.drin; }).length;
      bezugSetzen(rahmen, u, d.token, d.position,
        "Temperatur " + zahl(d.temperatur, 2) + " · " +
        (pTop ? "top-p " + zahl(d.top_p, 2) : "top-k " + d.top_k) + " · " +
        tausend(d.vokabular) + " Stücke insgesamt");

      // DIE AUSSAGE IST EINE KENNZAHLENZEILE, kein Satz (Entscheidung des
      // Anwenders, 14.08.2026). Sie ist kein Erklärtext, sondern ein
      // Messergebnis, das sich mit jedem Reglerzug ändert — also steht sie
      // in der Sprache von Messwerten da: Größe, Wert, Trennpunkt.
      //
      // Die GEWÄHLTE STELLE muss darin vorkommen: wer oben ein anderes Stück
      // anklickt, muss es hier wiederfinden, sonst ist die Stellenwahl eine
      // Bedienung ohne sichtbare Wirkung (Regel A-6, geprüft von
      // pruefe_diagramme.js).
      rahmen.setzeAussage(kennzahlen([
        ["nach", sichtbar(d.token.stuecke[d.position])],
        ["wahrscheinlichstes Stück", sichtbar(erste.text), true],
        ["Logit", zahl(erste.logit, 2)],
        ["÷ T " + zahl(d.temperatur, 2), zahl(erste.skaliert, 2)],
        ["Softmax", pz(erste.p, 1), true],
        ["ohne Temperatur", pz(erste.p_ohne_temperatur, 1)],
        pTop
          ? ["bleiben", d.behalten_anzahl + " von " + tausend(d.vokabular)]
          : (raus ? ["raus", raus + " der 12 gezeigten"]
                  : ["Schnitt", "Rang " + d.top_k + " — außerhalb"])
      ]));

      var letzte = d.kandidaten[d.kandidaten.length - 1];
      tBefund.innerHTML =
        "Diese <b>" + d.kandidaten.length + "</b> Stücke tragen zusammen " +
        "<b>" + pz(letzte.kumuliert, 1) + "</b> der Wahrscheinlichkeit; die " +
        "übrigen " + tausend(d.vokabular - d.kandidaten.length) + " teilen " +
        "sich den Rest. Der Schnitt setzt die ausgeschlossenen Stücke auf " +
        "<b>−∞</b>; erst danach läuft der Softmax. Er behält <b>" +
        pz(d.behalten, 2) + "</b> der Wahrscheinlichkeit, die ohne Schnitt " +
        "entstanden wäre. Nachgerechnet gegen den anderen Weg (erst " +
        "Softmax, dann abschneiden und neu auf 100 % bringen — so macht es " +
        "das Weiterschreiben): größter Unterschied <b>" +
        (d.probe || 0).toExponential(1).replace(".", ",") + "</b>. Es ist " +
        "dieselbe Verteilung, nur anders herum gezeigt.";
    }

    // ── Das Auge am Spaltenkopf: woher das Logit kommt ──────────────────

    function augeUmschalten(knopfSel) {
      augeOffen = !augeOffen;
      augeZiel.style.display = augeOffen ? "" : "none";
      // Ein Umschalter muss ansehen lassen, in welchem Zustand er ist.
      if (knopfSel) { knopfSel.classed("an", augeOffen); }
      if (augeOffen) { augePruefen(); }
    }

    function augePruefen() {
      if (!augeOffen || !daten) { return; }
      var id = st.vorhersageStueck === null
        ? daten.kandidaten[0].id : st.vorhersageStueck;
      var jetzt = st.satz + "|" + st.position + "|" + id + "|" +
        JSON.stringify(st.eingriffe);
      if (augeStand === jetzt) { return; }
      augeStand = jetzt;
      if (!augeRahmen) { augeAufbauen(); }
      u.senden("/api/logit_beitraege", {
        text: st.satz, position: st.position, stueck_id: id, oben: 14,
        eingriffe: st.eingriffe
      }, function (b) {
        if (b.leer) { return; }
        augeZeichnen(b);
      });
    }

    function augeAufbauen() {
      augeZiel.innerHTML = "";
      u.erklaerung("rechnung", el("p", null,
        "Das Auge im Kopf der Logit-Spalte schlüsselt auf, woher diese erste " +
        "Zahl kommt. Am Ende des Modells steht eine einzige Multiplikation: " +
        "der Zustand an der gewählten Stelle, Zahl für Zahl mal der Spalte, " +
        "die dieses Stück im Ausgabe-Wortschatz hat. Die Summe dieser " +
        "Produkte IST das Logit. Ein Klick auf eine Zeile der Tafel " +
        "schlüsselt ein anderes Stück auf; gezeigt werden die Zahlen mit dem " +
        "größten Betrag — eine Stichprobe, deren Anteil in der " +
        "Kennzahlenzeile steht."));
      augeRahmen = ZEICHNEN.rahmen(augeZiel, {
        aussage: "",
        legende: [
          ["rechts = dafür", PALETTE.erkennung("q")],
          ["links = dagegen", PALETTE.erkennung("k")]
        ]
      });
      augeZeichne = ZEICHNEN.beitragsbalken(augeRahmen.wurzel, {
        breite: 620, namen: 210,
        yTitel: "Zahl des Zustands ↓",
        xTitel: "Beitrag zum Logit  =  Zustandswert × Gewicht"
      });
      ZEICHNEN.farbleiste(augeRahmen.fuss, {
        skala: "zweiseitig", links: "dagegen", mitte: "0", rechts: "dafür"
      });
    }

    function augeZeichnen(b) {
      augeZeichne(b.zahlen.map(function (z) {
        return {
          id: z.dim,
          text: "Zahl " + z.dim + "   " + zahl(z.h, 2) + " × " + zahl(z.w, 3),
          wert: z.beitrag
        };
      }), 420);

      bezugSetzen(augeRahmen, u, b.token, b.position,
        "Stück " + JSON.stringify(sichtbar(b.stueck)) + " · " +
        tausend(b.dimensionen) + " Zahlen im Zustand");

      // DIE PROBE gehoert in die Kennzahlenzeile: sie ist der Grund, warum
      // man dieser Aufschluesselung glauben darf, und sie ist selbst eine
      // Messung — kein Erklaertext.
      var vielfaches = b.schritt ? b.abweichung / b.schritt : 0;
      augeRahmen.setzeAussage(kennzahlen([
        ["Stück", sichtbar(b.stueck), true],
        ["Summe von " + tausend(b.dimensionen), zahl(b.summe, 3)],
        ["Logit des Modells", zahl(b.logit, 3)],
        ["Unterschied", zahl(b.abweichung, 4) + " = " + zahl(vielfaches, 2) +
          " Schritte " + b.zahlenformat, true],
        [b.gezeigt + " gezeigt", pz(b.anteil_betrag, 1) + " des Betrags"],
        ["dafür", zahl(b.positiv, 1)],
        ["dagegen", zahl(b.negativ, 1)]
      ]));
    }

    return {
      pruefen: pruefen,
      // Von aussen aufgerufen, wenn ein ANDERES Bild der Kachel ein Stueck
      // gewaehlt hat — die Tafel muss dieselbe Wahl zeigen.
      neuZeichnen: function () { if (daten) { zeichnen(daten); augeStand = null; augePruefen(); } }
    };
  }

  function attentionStufenBauen(wurzel, u, beiStellenwahl) {
    var st = u.zustand;
    var stand = null;      // wofuer die Daten unten geholt wurden
    var daten = null;
    var inhalt = null, rahmen = null, zeichne = null, tBefund = null;

    var kasten = aufklapp("Wie diese Matrix entsteht — die drei Rechenstufen",
      function (ziel) { inhalt = ziel; });
    // Eigene Kennung: daran erkennt der Pruefer die Herleitungen und klappt
    // sie auf, bevor er prueft. Ohne das blieben genau die Bilder
    // ungeprueft, die neu dazugekommen sind.
    kasten.classList.add("herleitung");
    wurzel.appendChild(kasten);

    kasten.addEventListener("toggle", function () {
      if (kasten.open) { pruefen(); }
    });

    /** Von aussen aufgerufen, wenn sich auf der Kachel etwas geaendert hat. */
    function pruefen() {
      if (!kasten.open) { return; }              // zu = nichts rechnen
      var jetzt = st.satz + "|" + st.schicht + "|" + st.kopf;
      if (laeuft === jetzt) { return; }          // laeuft schon
      if (stand === jetzt && daten) { markieren(); return; }
      holen(jetzt);
    }

    var laeuft = null;

    function holen(jetzt) {
      inhalt.innerHTML = "";
      inhalt.appendChild(laedt("die drei Stufen werden nachgerechnet"));
      rahmen = null; zeichne = null;
      laeuft = jetzt;
      u.senden("/api/attention_stufen", {
        text: st.satz, schicht: st.schicht, kopf: st.kopf
      }, function (d) {
        // Ist inzwischen etwas Neues angefordert worden, gehoert diese
        // Antwort zu einem ueberholten Stand und darf nichts mehr
        // zeichnen — sonst stuende am Ende das aeltere Bild da.
        if (laeuft !== jetzt) { return; }
        laeuft = null;
        inhalt.innerHTML = "";
        rahmen = null; zeichne = null;
        if (d.leer) { inhalt.appendChild(hinweis("Kein Text.")); return; }
        stand = jetzt;
        daten = d;
        aufbauen(d);
      });
    }

    function aufbauen(d) {
      inhalt.innerHTML = "";

      var vor = el("div", "klartext");
      vor.innerHTML =
        "<p>Die Matrix darunter ist das <b>Ergebnis</b>. Sie entsteht in " +
        "drei Schritten, und hier laufen sie von links nach rechts " +
        "durch — dieselben Zeilen, dieselben Spalten, nur in " +
        "verschiedenen Stadien.</p>" +
        "<p class='klein'><b>Punktprodukt</b> — jede <b>Frage</b> (Query, " +
        "links) wird mit jeder <b>Aufschrift</b> (Key, oben) verrechnet. " +
        "Eine Zahl je Paar, beliebig groß, positiv wie negativ, und noch " +
        "<b>ohne jede Sperre</b>: hier steht auch, wie gut das erste Wort " +
        "zum letzten passen würde.<br>" +
        "<b>÷ √" + d.kopf_dim + " und Maske</b> — geteilt, sonst kippt der " +
        "nächste Schritt in ein Alles-oder-nichts; und alles nach rechts " +
        "oben gesperrt. Dort bleiben nur noch leere Ringe: kein Wort darf " +
        "sehen, was nach ihm kommt.<br>" +
        "<b>Softmax</b> — jede Zeile auf Summe 1. Erst jetzt sind es " +
        "<b>Anteile</b>, und erst jetzt ist es die Matrix darunter.</p>";
      inhalt.appendChild(vor);

      // EIN Diagramm, nicht drei. Die Zeilen sind in allen drei Stufen
      // dieselben — also stehen Bezug, Aussage und Wortliste EINMAL da.
      // Eine erste Fassung baute drei getrennte Diagramme mit je eigenem
      // Bezugskasten, eigener Aussage und eigener Wortliste; das war
      // dreimal dasselbe und dreimal so gross wie noetig.
      rahmen = ZEICHNEN.rahmen(inhalt, {
        aussage: "",
        legende: [
          ["Query — die Fragen, zeilenweise links", PALETTE.erkennung("q")],
          ["Key — die Aufschriften, spaltenweise", PALETTE.erkennung("k")],
          ["leerer Ring: gesperrt, liegt in der Zukunft", null],
          ["umrandet: die Zeile des gewählten Wortes", PALETTE.token("--wahl")],
          ["alle drei Stufen in <b>derselben</b> Farbfamilie — es ist " +
            "dieselbe Größe in drei Stadien. Die Softmax-Stufe ist " +
            "gestaucht gefärbt (Wurzelkennlinie), sonst bliebe sie bis auf " +
            "die Diagonale schwarz", null]
        ]
      });
      zeichne = ZEICHNEN.attentionkette(rahmen.wurzel, {
        breite: 860, zelle: 20, kennung: "attn"
      });
      tBefund = befund("");
      inhalt.appendChild(tBefund);

      markieren(0);
    }

    function markieren(dauer) {
      if (!daten || !zeichne) { return; }
      var d = daten;
      var T = d.token.stuecke.length;
      var pos = stelle(u, T);

      // EINE FARBSKALA FUER ALLE DREI STUFEN — nur die Domain wechselt.
      //
      // So macht es die Vorlage (AttentionMatrix.svelte:286-297): dieselbe
      // Farbe von "nichts" nach "viel" fuer alle drei, und der Unterschied
      // steckt allein darin, WELCHER Zahlenbereich auf diese Farbe
      // abgebildet wird:
      //
      //   Stufe 1  d3.extent(daten)   der echte Bereich der Punktprodukte
      //   Stufe 2  FEST [-3, +3]      nicht die Daten! siehe unten
      //   Stufe 3  [0, 1] LINEAR      ohne jede Kennlinie
      //
      // Meine erste Fassung hatte drei verschiedene Skalen und fuer Stufe 3
      // eine Wurzelkennlinie. Das las sich als drei verschiedene Groessen,
      // und die Kennlinie log ueber die Verteilung: sie liess kleine
      // Anteile groesser aussehen, als sie sind.
      var STUFEN_DOMAIN = [null, [-3, 3], [0, 1]];

      // Die Formeln als echte Formeln (MathML) statt als Zeichenkette.
      // Dieselben drei, die die Vorlage per KaTeX setzt.
      var MATHML = [
        "<math><mrow><mi>Q</mi><mo>·</mo><msup><mi>K</mi><mi>T</mi></msup>" +
          "</mrow></math>",
        "<math><mrow><mfrac><mrow><mi>Q</mi><mo>·</mo><msup><mi>K</mi>" +
          "<mi>T</mi></msup></mrow><msqrt><msub><mi>d</mi><mi>k</mi></msub>" +
          "</msqrt></mfrac><mo>+</mo><mi>M</mi></mrow></math>",
        "<math><mrow><mi>softmax</mi><mo>(</mo><mfrac><mrow><mi>Q</mi>" +
          "<mo>·</mo><msup><mi>K</mi><mi>T</mi></msup></mrow><msqrt><msub>" +
          "<mi>d</mi><mi>k</mi></msub></msqrt></mfrac><mo>+</mo><mi>M</mi>" +
          "<mo>)</mo></mrow></math>"
      ];

      function anteil(w, von, bis) {
        if (w === null || w === undefined) { return null; }
        var t = (w - von) / ((bis - von) || 1);
        return Math.max(0, Math.min(1, t));            // klemmen
      }

      var stufen = d.stufen.map(function (s, nr) {
        if (nr < 2) {
          // Stufe 2 wird auf FEST +-3 abgebildet, obwohl die Werte hier von
          // -10,6 bis +10,5 laufen. Das ist keine Nachlaessigkeit der
          // Vorlage, sondern ihr Punkt: der Softmax reagiert auf
          // Unterschiede von wenigen Einheiten — was daruber liegt, ist
          // ohnehin "praktisch alles" oder "praktisch nichts". Wer auf den
          // vollen Bereich faerbt, drueckt die Unterschiede, auf die es
          // ankommt, in einen Farbton zusammen. Die echten Grenzen stehen
          // an der Leiste.
          var dom = STUFEN_DOMAIN[nr] || [s.min, s.max];
          return {
            name: s.name, formel: s.formel, mathml: MATHML[nr], matrix: s.matrix,
            farbe: function (w) {
              return ZEICHNEN.zweiseitig(anteil(w, dom[0], dom[1]));
            },
            leiste: function (t) { return ZEICHNEN.zweiseitig(t); },
            links: zahl(dom[0], 1) + (s.min < dom[0] ? " und darunter" : ""),
            rechts: zahl(dom[1], 1) + (s.max > dom[1] ? " und darüber" : "")
          };
        }
        // ALLE DREI STUFEN AUF DERSELBEN FARBFAMILIE — wie im Vorbild.
        //
        // Es ist dieselbe Groesse in drei Stadien; drei verschiedene
        // Farbwelten legten nahe, es seien drei verschiedene Dinge. Die
        // erste Fassung nahm hier die Hitzeskala, die ueber Pink bis GELB
        // laeuft — direkt neben der gelben Zeilenmarkierung, und damit
        // gegen Regel C-1 (Gelb gehoert allein der Auswahl).
        //
        // Stufe 3: 0 bis 1, LINEAR und ohne Kennlinie — wie die Vorlage.
        // Dass das Feld dabei fast nur auf wenigen Stellen leuchtet, ist
        // kein Darstellungsfehler, sondern der Befund: nach dem Softmax
        // liegt fast die ganze Aufmerksamkeit auf wenigen Woertern. Eine
        // Wurzelkennlinie (so meine erste Fassung) macht das Bild
        // gleichmaessiger, als die Zahlen es sind.
        return {
          name: s.name, formel: s.formel, mathml: MATHML[nr], matrix: s.matrix,
          farbe: function (w) { return ZEICHNEN.zweiseitig(anteil(w, 0, 1)); },
          leiste: function (t) { return ZEICHNEN.zweiseitig(t); },
          links: "0 %", rechts: "100 %"
        };
      });

      zeichne({
        labels: d.token.stuecke, stufen: stufen, zeile: pos,
        // Ein Klick hier ist derselbe Klick wie oben in der Stueckreihe:
        // er setzt die gemeinsame Stelle, und ALLE Bilder der Seite folgen.
        beiKlick: function (i) {
          st.position = i;
          if (beiStellenwahl) { beiStellenwahl(i); } else { markieren(360); }
        }
      }, dauer === undefined ? 360 : dauer);

      bezugSetzen(rahmen, u, d.token, pos,
        "Schicht " + (d.schicht + 1) + " · Kopf " + (d.kopf + 1) +
        " · " + T + " × " + T + " je Stufe");

      // EINE Aussage, die die Kette entlangliest: was aus derselben Zeile
      // in jeder Stufe wird. Dreimal fast derselbe Satz sagte weniger.
      var roh = d.stufen[0].matrix[pos];
      var weich = d.stufen[2].matrix[pos];
      var bestRoh = 0, bestWeich = 0, j;
      for (j = 0; j < roh.length; j++) {
        if (roh[j] !== null && roh[j] > roh[bestRoh]) { bestRoh = j; }
      }
      for (j = 0; j < weich.length; j++) {
        if (weich[j] !== null &&
            (weich[bestWeich] === null || weich[j] > weich[bestWeich])) {
          bestWeich = j;
        }
      }
      var wort = sichtbar(d.token.stuecke[pos]);
      var offen = pos < T - 1
        ? " In der ersten Stufe steht auch rechts oben etwas — dort passt " +
          "„" + wort + "“ zu Wörtern, die es noch gar nicht sehen darf. " +
          "Genau die verschwinden im zweiten Schritt."
        : "";
      rahmen.setzeAussage(
        "Zeile <b>" + JSON.stringify(wort) + "</b>: roh passt am besten " +
        "<b>" + JSON.stringify(sichtbar(d.token.stuecke[bestRoh])) + "</b> " +
        "mit " + zahl(roh[bestRoh], 1) + ". Nach Maske und Softmax holt " +
        "die Zeile <b>" + pz(weich[bestWeich], 1) + "</b> bei <b>" +
        JSON.stringify(sichtbar(d.token.stuecke[bestWeich])) + "</b>." + offen);

      tBefund.innerHTML =
        "Die dritte Stufe ist gegen die Matrix geprüft, die das Modell " +
        "selbst ausgegeben hat: größter Einzelunterschied <b>" +
        d.abweichung.toExponential(1).replace(".", ",") + "</b>. Was hier " +
        "steht, ist die Rechnung des Modells und nicht ihre Nacherzählung.";
    }

    return { pruefen: pruefen, markieren: markieren };
  }


  // ── Kacheln ────────────────────────────────────────────────────────────

  /** Was die Zerlegung praktisch kostet — gemessen, nicht behauptet.
   *
   *  Dass „deutsche Fachwoerter teuer sind“, stand bisher als Behauptung in
   *  der Erklaerung. Hier wird sie an denselben Saetzen in beiden Sprachen
   *  nachgerechnet, vom selben Tokenizer, im selben Durchlauf.
   */
  function vergleichBauen(wurzel, u) {
    var PAARE = [
      ["Die Produktionsplanung beginnt mit der Stücklistenauflösung.",
       "Production planning starts with the bill of materials explosion."],
      ["Werkzeugmaschinen für die Serienfertigung",
       "machine tools for series production"],
      ["Die Auftragsabwicklung im Maschinenbau erfordert Terminplanung.",
       "Order processing in mechanical engineering requires scheduling."]
    ];

    var f = feld("Was diese Zerlegung kostet — Deutsch gegen Englisch");
    f.appendChild(hinweis("Derselbe Inhalt, zweimal, vom selben Tokenizer " +
      "zerlegt. Das Modell wurde überwiegend auf englischem und chinesischem " +
      "Text trainiert; deutsche Zusammensetzungen kamen selten genug vor, " +
      "dass sie nie zu einem eigenen Stück zusammengefasst wurden. Sie " +
      "zerfallen deshalb — und jedes Bruchstück kostet einen vollen " +
      "Durchlauf durch alle " + u.info.schichten + " Schichten."));
    var tabZiel = el("div");
    f.appendChild(tabZiel);
    var vBefund = befund("wird gerechnet …");
    f.appendChild(vBefund);
    wurzel.appendChild(f);

    var ergebnisse = [];
    function weiter(n) {
      if (n >= PAARE.length) { fertig(); return; }
      u.senden("/api/tokens", { text: PAARE[n][0] }, function (de) {
        u.senden("/api/tokens", { text: PAARE[n][1] }, function (en) {
          ergebnisse.push({ de: de, en: en, texte: PAARE[n] });
          weiter(n + 1);
        });
      });
    }

    function fertig() {
      var tab = el("table", "tab");
      var kopf = el("tr");
      ["Inhalt", "Sprache", "Stücke", "Zeichen", "Zeichen je Stück"]
        .forEach(function (x) { kopf.appendChild(el("th", null, x)); });
      tab.appendChild(kopf);
      var summeDe = 0, summeEn = 0;
      ergebnisse.forEach(function (r, i) {
        summeDe += r.de.ids.length;
        summeEn += r.en.ids.length;
        [["Deutsch", r.de, r.texte[0]], ["Englisch", r.en, r.texte[1]]]
          .forEach(function (p, k) {
            var z = el("tr");
            var td = el("td", null, k === 0 ? ("Beispiel " + (i + 1)) : "");
            z.appendChild(td);
            z.appendChild(el("td", null, p[0]));
            var st = el("td", "zahl", String(p[1].ids.length));
            if (k === 0) { st.style.color = PALETTE.token("--wahl"); }
            z.appendChild(st);
            z.appendChild(el("td", "zahl", String(p[1].zeichen)));
            z.appendChild(el("td", "zahl", zahl(p[1].zeichen_je_token, 2)));
            tab.appendChild(z);
          });
      });
      tabZiel.innerHTML = "";
      tabZiel.appendChild(tab);

      // das teuerste deutsche Wort der drei Beispiele benennen
      var schlimmstes = { n: 0, wort: "", stuecke: [] };
      ergebnisse.forEach(function (r) {
        var lauf = { wort: "", stuecke: [] };
        r.de.stuecke.forEach(function (s, i) {
          if (/^\s/.test(s) || i === 0) {
            if (lauf.stuecke.length > schlimmstes.n) {
              schlimmstes = { n: lauf.stuecke.length, wort: lauf.wort,
                              stuecke: lauf.stuecke };
            }
            lauf = { wort: s, stuecke: [s] };
          } else {
            lauf.wort += s; lauf.stuecke.push(s);
          }
        });
        if (lauf.stuecke.length > schlimmstes.n) {
          schlimmstes = { n: lauf.stuecke.length, wort: lauf.wort,
                          stuecke: lauf.stuecke };
        }
      });

      var mehr = (summeDe / Math.max(1, summeEn) - 1);
      vBefund.setzen(
        "Über die drei Beispiele braucht Deutsch <span class='zahl'>" +
        summeDe + "</span> Stücke, Englisch <span class='zahl'>" + summeEn +
        "</span> — <b>" + pz(mehr, 0) + " mehr</b> für denselben Inhalt. " +
        "Das teuerste Wort ist <b>" + JSON.stringify(sichtbar(schlimmstes.wort.trim())) +
        "</b>: es zerfällt in <span class='zahl'>" + schlimmstes.n + "</span> " +
        "Stücke — " + schlimmstes.stuecke.map(function (s) {
          return JSON.stringify(sichtbar(s));
        }).join(" + ") + ". " +
        "Das heißt: derselbe deutsche Satz kostet mehr Rechenzeit, füllt den " +
        "begrenzten Kontext schneller und muss über mehr Schritte " +
        "zusammengehalten werden als sein englisches Gegenstück.");
    }
    weiter(0);
  }

  function kachelToken(b, u) {
    lead(u, "Aus Text werden Zahlen",
      "Das Modell kennt keine Buchstaben. Ihr Satz wird zuerst in Stücke " +
      "zerlegt, die im Training häufig zusammen auftraten. Häufige Wörter " +
      "werden ein einziges Stück, seltene zerfallen. Deutsche Fachwörter " +
      "zerfallen besonders stark — das kostet Rechenzeit und Kontext.");

    anleitung(u, "Warum das nicht nur eine Formsache ist", [
      "Ein Stück ist die <b>kleinste Einheit, die das Modell überhaupt " +
        "kennt</b>. Alles Weitere — Bedeutung, Aufmerksamkeit, Vorhersage — " +
        "setzt hier auf. Was die Zerlegung trennt, sieht das Modell getrennt.",
      "Die Zerlegung ist <b>nicht sprachlich begründet</b>. Sie stammt aus " +
        "einer Häufigkeitsstatistik über den Trainingstext (BPE): was oft " +
        "zusammen vorkam, wurde zusammengefasst. Silben, Wortstämme und " +
        "Endungen spielen dabei keine Rolle.",
      "Die <b>ID</b> ist eine reine Platznummer in einer Liste von " +
        tausend(u.info.vokabular) + " Einträgen. Kleine Nummern sind " +
        "tendenziell häufigere Stücke. Aus der Nummer selbst folgt keine " +
        "Bedeutung — die steckt im Vektor, der an dieser Stelle liegt.",
      "Ein führendes <b>Leerzeichen gehört zum Stück</b>. „ Motor“ und " +
        "„Motor“ sind für das Modell zwei verschiedene Dinge; deshalb sind " +
        "Leerzeichen unten als · dargestellt."
    ]);

    var ziel = el("div");
    b.appendChild(ziel);

    u.beiSatz(function (d) {
      ziel.innerHTML = "";
      var f = feld(d.ids.length + " Token aus " + d.zeichen + " Zeichen  ·  " +
        zahl(d.zeichen_je_token, 2) + " Zeichen je Token");
      var reiheZiel = el("div");
      f.appendChild(stellenbeschriftung());
      f.appendChild(reiheZiel);

      // Wie gleichmaessig faellt der Satz auseinander? Die Reihe oben zeigt
      // das nicht — dort sieht ein Ein-Zeichen-Stueck aus wie ein
      // Acht-Zeichen-Stueck.
      var laengenZiel = el("div");
      f.appendChild(laengenZiel);
      var einzeln = d.stuecke.filter(function (s) { return s.trim().length <= 2; }).length;
      var laengstes = d.stuecke.reduce(function (a, c) {
        return c.length > a.length ? c : a;
      }, "");
      var lRahmen = ZEICHNEN.rahmen(laengenZiel, {
        aussage: "Ihr Satz zerfällt in <b>" + d.ids.length + "</b> Stücke " +
          "sehr ungleicher Länge: das längste hat <b>" + laengstes.length +
          "</b> Zeichen, <b>" + einzeln + "</b> haben höchstens zwei. " +
          "<b>Jedes kostet gleich viel</b> — einen vollen Durchlauf durch " +
          "alle " + u.info.schichten + " Schichten.",
        legende: [
          ["100 % = das längste Stück dieses Satzes (" +
            laengstes.length + " Zeichen)", null],
          ["· steht für ein führendes Leerzeichen und gehört zum Stück", null]
        ]
      });
      balkenlegende(lRahmen, "Balkenlänge und Farbe = Zeichenzahl des Stücks.");
      var lMaler = ZEICHNEN.balken(lRahmen.wurzel, {
        breite: 460, namen: 190,
        yTitel: "ein Stück je Zeile, in Satzreihenfolge ↓",
        xTitel: "Länge des Stücks in Zeichen  —  als Anteil am längsten Stück"
      });
      var maxL = 1;
      d.stuecke.forEach(function (s) { maxL = Math.max(maxL, s.length); });

      // Die Stellenwahl und das Bild gehoeren zusammen: ein Klick oben
      // markiert den Balken, benennt das Stueck in der Aussage und faerbt
      // seine Zeile in der Tabelle darunter.
      var tBefund = befund("");
      function zeichnen(dauer) {
        var p = stelle(u, d.ids.length);
        reiheZiel.innerHTML = "";
        reiheZiel.appendChild(stellenreihe(u, d, function () { zeichnen(360); }));
        lMaler(d.stuecke.map(function (s, i) {
          return { id: "s" + i, text: sichtbar(s), p: s.length / maxL,
                   markiert: i === p };
        }), dauer);
        bezugSetzen(lRahmen, u, d, p);
        lRahmen.setzeAussage(
          "Ihr Satz zerfällt in <b>" + d.ids.length + "</b> Stücke sehr " +
          "ungleicher Länge: das längste hat <b>" + laengstes.length +
          "</b> Zeichen, <b>" + einzeln + "</b> haben höchstens zwei. " +
          "<b>Jedes kostet gleich viel</b> — einen vollen Durchlauf durch " +
          "alle " + u.info.schichten + " Schichten. Gewählt ist gerade " +
          "Stelle <b>" + p + "</b>: " +
          JSON.stringify(sichtbar(d.stuecke[p])) + " mit " +
          d.stuecke[p].length + " Zeichen, ID " + d.ids[p] + ".");
        Array.prototype.forEach.call(
          tab.querySelectorAll("tr.markiert"),
          function (z) { z.classList.remove("markiert"); });
        var zeilen = tab.querySelectorAll("tr");
        if (zeilen[p + 1]) { zeilen[p + 1].classList.add("markiert"); }
      }

      tBefund.setzen(
        "Ihr Satz wird zu <span class='zahl'>" + d.ids.length + "</span> " +
        "Stücken aus <span class='zahl'>" + d.zeichen + "</span> Zeichen — " +
        "im Mittel <span class='zahl'>" + zahl(d.zeichen_je_token, 2) +
        "</span> Zeichen je Stück. <span class='zahl'>" + einzeln + "</span> " +
        "davon sind Bruchstücke von höchstens zwei Zeichen; das längste " +
        "zusammenhängende Stück ist " + JSON.stringify(sichtbar(laengstes)) +
        ". Jedes Stück kostet einen vollen Durchlauf durch alle " +
        u.info.schichten + " Schichten — die Zerlegung bestimmt also " +
        "unmittelbar, was das Modell rechnen muss.");
      f.appendChild(tBefund);
      ziel.appendChild(f);

      vergleichBauen(ziel, u);

      var t = feld("Jedes Stück einzeln");
      var tab = el("table", "tab");
      var kopf = el("tr");
      ["#", "Stück", "roh", "ID", "Zeichen im Satz"].forEach(function (x) {
        kopf.appendChild(el("th", null, x));
      });
      tab.appendChild(kopf);
      d.stuecke.forEach(function (s, i) {
        var z = el("tr");
        z.appendChild(el("td", "zahl", String(i)));
        z.appendChild(el("td", "mono", JSON.stringify(s)));
        z.appendChild(el("td", "mono", d.roh[i]));
        z.appendChild(el("td", "zahl", String(d.ids[i])));
        z.appendChild(el("td", "zahl", d.spannen[i] ? d.spannen[i].join("–") : ""));
        // Auch die Tabelle waehlt aus: was aussieht wie dieselbe Sache,
        // soll sich auch gleich bedienen lassen.
        z.style.cursor = "pointer";
        z.addEventListener("click", function () {
          u.zustand.position = i; zeichnen(360);
        });
        tab.appendChild(z);
      });
      t.appendChild(tab);
      ziel.appendChild(t);

      zeichnen(620);
    }, "/api/tokens");
  }

  /** DER GANZE WEG — die Hauptansicht nach dem Vorbild.
   *
   *  Ein Bild, durch das die Baender durchlaufen: Satz, Embedding,
   *  Query/Key/Value, Aufmerksamkeit, Ausgang, Feedforward, die uebrigen
   *  Schichten, Wahrscheinlichkeiten. Alle Zahlen aus EINEM Durchlauf
   *  (/api/bahn) — sechs Aufrufe haetten sechs Durchlaeufe bedeutet und
   *  damit Stationen, die nicht zueinander gehoeren.
   */
  function kachelBahn(b, u) {
    var st = u.zustand;
    if (st.bahnKandidat === undefined) { st.bahnKandidat = null; }

    lead(u, "Der ganze Weg",
      "Was zwischen Ihrem Satz und der Antwort liegt, ist keine Kette von " +
      "Einzelbildern, sondern ein durchgehender Weg. Hier ist er in einem " +
      "Bild: links der Satz, rechts die möglichen Fortsetzungen, dazwischen " +
      "jede Station, die das Modell durchläuft.");

    anleitung(u, "So lesen Sie das Bild", [
      "<b>Eine Zeile je Satzstück</b>, von links nach rechts durch alle " +
        "Stationen. Jeder farbige Streifen ist ein <b>Vektor</b> — die Farbe " +
        "sagt, zu welchem Bauteil er gehört, die Helligkeit den Wert.",
      "<b>Die Bänder sind gemessen, nicht gemalt.</b> Links ist ihre Breite " +
        "die Aufmerksamkeit, die die betrachtete Stelle auf dieses Stück " +
        "richtet; rechts die Wahrscheinlichkeit des Kandidaten.",
      "<b>Alles läuft in EINER Stelle zusammen</b> — der, die Sie oben " +
        "gewählt haben — und fächert sich von dort wieder auf. Das ist der " +
        "Kern: der ganze Satz wird zu einem einzigen Zustand, und aus diesem " +
        "einen Zustand entsteht die Verteilung.",
      "<b>Query, Key und Value sitzen am Wort</b> — drei gestapelte Blöcke je " +
        "Satzstück (Q, K, V). Jeder speist im abgesetzten Feld seinen eigenen " +
        "<b>Fächer</b>; von dort laufen die drei Bänder in das Punktraster.",
      "In diesem Feld steht das <b>Punktraster der Aufmerksamkeit</b> des " +
        "gewählten Kopfes: Zeile = wer fragt, Spalte = wen, Punktgröße = wie " +
        "stark. Oben rechts ist es leer, weil kein Wort sehen darf, was nach " +
        "ihm kommt.",
      "Die beiden grauen Bögen oben sind der <b>Residualstrom</b> — der " +
        "Strang, der am Bauteil vorbeiläuft und den bisherigen Zustand " +
        "unverändert weiterreicht. Er ist der Grund, warum ein Modell 28 " +
        "Schichten tief sein kann, ohne den Anfang zu vergessen.",
      "Das <b>Feedforward-Band ist länger</b> als die anderen: dort wird der " +
        "Zustand von 2.048 auf 6.144 Zahlen aufgeweitet und wieder " +
        "zusammengezogen — <b>für jede Stelle einzeln</b>, deshalb bleibt es " +
        "zeilenweise und läuft nicht in einem Punkt zusammen.",
      "Die versetzten Karten im Hintergrund zeigen: <b>dieser Block steht " +
        "28-mal hintereinander</b>. Sie sehen einen davon — welchen, wählen " +
        "Sie oben mit dem Schichtregler.",
      "<b>Jeder Streifen ist eine Stichprobe.</b> Ein Zustand hat 2.048 " +
        "Zahlen, ein Kopf 128, das Feedforward innen 6.144 — gezeigt werden " +
        "24 davon, gleichmäßig gegriffen."
    ]);

    // ── Bedienleiste: Stelle, Schicht, Kopf ────────────────────────────
    var leiste = u.bedienleiste;
    var stellenReihe = el("div", "leiste-zeile");
    stellenReihe.appendChild(el("span", "leiste-name", "Stelle"));
    var stellenZiel = el("div", "leiste-feld");
    stellenReihe.appendChild(stellenZiel);
    leiste.appendChild(stellenReihe);

    var schichtZeile = el("div", "leiste-zeile");
    schichtZeile.appendChild(el("span", "leiste-name", "Schicht"));
    var schichtZiel = el("div", "leiste-feld");
    schichtZeile.appendChild(schichtZiel);
    leiste.appendChild(schichtZeile);

    var kopfZeile = el("div", "leiste-zeile");
    kopfZeile.appendChild(el("span", "leiste-name", "Kopf"));
    var kopfZiel = el("div", "leiste-feld");
    kopfZeile.appendChild(kopfZiel);
    leiste.appendChild(kopfZeile);

    var f = feld("Vom Satz zur Fortsetzung");
    var ziel = el("div");
    f.appendChild(ziel);
    b.appendChild(f);

    var rahmen = ZEICHNEN.rahmen(ziel, {
      aussage: "",
      legende: [
        ["Embedding / Zustand", PALETTE.erkennung("res")],
        ["Query", PALETTE.erkennung("q")],
        ["Key", PALETTE.erkennung("k")],
        ["Value", PALETTE.erkennung("v")],
        ["Aufmerksamkeit", PALETTE.erkennung("att")],
        ["Feedforward", PALETTE.erkennung("ff")],
        ["Auswahl", PALETTE.token("--wahl")],
        ["Bandbreite = gemessene Größe", null]
      ]
    });
    var zeichneBahn = BAHN.zeichnen(rahmen.wurzel, {
      beiStelle: function (i) { st.position = i; laden(320); },
      beiKandidat: function (j) {
        st.bahnKandidat = (st.bahnKandidat === j ? null : j);
        if (daten) { malen(daten, 240); }
      },
      // Ein Klick auf den Namen einer Station fuehrt in die Kachel, die
      // genau diese Station vergroessert. Stationen ohne Kachel bleiben
      // sichtbar, sind aber kein Knopf.
      beiStation: function (name) { u.zuStation(name); },
      hatStation: function (name) { return u.hatStation(name); }
    });
    var bBefund = befund("");
    u.erklaerung("zusehen", bBefund);

    var daten = null;
    var ladeMarke = null;

    function knoepfe(d) {
      schichtZiel.innerHTML = "";
      // Nicht alle 28 als Knopf — ein Regler ist hier das ruhigere Mittel.
      schichtZiel.appendChild(regler("von 0 bis " + (d.schichten - 1), 0,
        d.schichten - 1, 1, st.schicht, function (v) {
          st.schicht = v; laden(320);
        }));
      kopfZiel.innerHTML = "";
      kopfZiel.appendChild(regler("von 0 bis " + (d.koepfe - 1), 0,
        d.koepfe - 1, 1, st.kopf, function (v) {
          st.kopf = v; laden(320);
        }));
    }

    function malen(d, dauer) {
      d.markierterKandidat = st.bahnKandidat;
      zeichneBahn(d, dauer);
      bezugSetzen(rahmen, u, d.token, d.position,
        "Schicht " + d.schicht + " · Kopf " + d.kopf + " · Streifen zeigen " +
        d.gezeigt + " Zahlen");
      var erste = d.kandidaten[0];
      var mb = d.stationen.reduce(function (a, s) {
        return s.blick > a.blick ? s : a;
      }, d.stationen[0]);
      rahmen.setzeAussage(kennzahlen([
        ["nach", sichtbar(d.token.stuecke[d.position])],
        ["Stücke", d.stationen.length + " → 1 Stelle"],
        ["meiste Aufmerksamkeit", sichtbar(mb.text) + " " + pz(mb.blick, 1), true],
        ["Fortsetzung", sichtbar(erste.text) + " " + pz(erste.p, 1), true],
        ["Zustand", tausend(d.breiten.zustand) + " Zahlen"],
        ["Kopf", tausend(d.breiten.kopf)],
        ["Feedforward", tausend(d.breiten.feedforward)]
      ]));
      bBefund.setzen(
        "Der ganze Satz — <b>" + d.stationen.length + " Stücke</b> — läuft " +
        "über die Aufmerksamkeit in <b>eine einzige Stelle</b> zusammen, und " +
        "erst aus deren Zustand fächert sich die Verteilung wieder auf. Am " +
        "meisten Aufmerksamkeit bekommt " +
        JSON.stringify(sichtbar(mb.text)) + " mit <b>" + pz(mb.blick, 1) +
        "</b>. Jeder Streifen im Bild ist eine Stichprobe: <b>" + d.gezeigt +
        "</b> von " + tausend(d.breiten.zustand) + " Zahlen des Zustands, " +
        "von " + tausend(d.breiten.kopf) + " je Kopf, von " +
        tausend(d.breiten.feedforward) + " im Feedforward.");
    }

    function laden(dauer) {
      // TEMPERATUR UND SCHNITT KOMMEN VON DER SEITE, NICHT AUS DIESER ZEILE.
      //
      // Hier standen bis zum 26.08.2026 feste Werte: `temperatur: 1.0,
      // verfahren: "top_k", top_k: 0`. `top_k: 0` heisst KEIN SCHNITT — das
      // grosse Bild zeigte damit rohe Wahrscheinlichkeiten ueber das ganze
      // Vokabular, waehrend die Kachel "Was als Naechstes kommt" dieselbe
      // Stelle mit Schnitt zeigte. Gemessen am Satz "Mein Hunde heisst":
      // hier 4,0 % fuer " Max", dort 15,6 %. Zwei Bilder, zwei Wahrheiten.
      //
      // Genau dieser Fehler war am 14.08.2026 fuer /api/netz schon einmal
      // behoben worden; die Bahn entstand am selben Abend und bekam ihn neu.
      // Der Temperaturregler der Seite hatte auf dieses Bild ueberhaupt
      // keine Wirkung — ein Verstoss gegen Regel B-3.
      // EINE ECHTE LADEMARKE, damit die Prüfer (pruefe_diagramme.js, uat.js)
      // nicht in die leere Tafel messen. Ohne sie fotografierten sie je nach
      // Serverlast mal die gerechnete, mal die noch leere Bahn — der
      // Kaltstart-Fehlalarm vom 03.09.2026. Dieselbe Marke trägt /api/netz
      // seit dem 14.08.; die Bahn bekam sie hier erst jetzt.
      if (!daten && !ladeMarke) {
        ladeMarke = laedt("der ganze Weg wird gerechnet");
        rahmen.wurzel.appendChild(ladeMarke);
      }
      u.senden("/api/bahn", {
        text: st.satz, schicht: st.schicht, kopf: st.kopf,
        position: st.position, oben: 10, proben: 24,
        temperatur: st.temperatur, verfahren: st.verfahren,
        top_k: st.topK, top_p: st.topP,
        eingriffe: st.eingriffe
      }, function (d) {
        if (ladeMarke) { ladeMarke.remove(); ladeMarke = null; }
        if (d.leer) { return; }
        daten = d;
        stellenZiel.innerHTML = "";
        stellenZiel.appendChild(stellenreihe(u, d.token, function () {
          laden(320);
        }));
        knoepfe(d);
        malen(d, dauer);
      });
    }

    laden(0);
  }

  /* ══ DAS FEEDFORWARD — der Filter mit 6.144 Schaltern ═════════════════
   *
   * Station 6 des grossen Bildes. Sie hatte bis zum 17.08.2026 keine
   * Vergroesserung, obwohl das Bauteil rund zwei Drittel aller Parameter
   * eines Blocks haelt (gemessen: 37.748.736 von 54.525.952 = 69,2 %).
   *
   * ALLE AUSSAGEN DIESER KACHEL WERDEN AUS DEN DATEN GERECHNET, keine
   * steht fest im Code. Das ist hier nicht Formsache: beim Bau standen in
   * der abgenommenen Skizze zwei Behauptungen, die die Messung widerlegt
   * hat — "die staerksten zwoelf Neuronen tragen 38 %" (es sind in
   * Schicht 0 gemessene 6,1 %) und "das Gate entscheidet, nicht der
   * Inhalt" (bei den meisten Neuronen steht das Gate weit offen und der
   * Inhalt entscheidet). Was zu sehen ist, sagt die Anschauung selbst.
   */
  function kachelFeedforward(b, u) {
    var st = u.zustand;
    if (st.ffNeuron === undefined) { st.ffNeuron = null; }

    lead(u, "Der Filter mit 6.144 Schaltern",
      "Zwei Drittel aller Parameter eines Blocks stecken nicht in der " +
      "Aufmerksamkeit, sondern hier. Das Feedforward schaut weder nach links " +
      "noch nach rechts — es arbeitet nur mit dem, was an dieser einen Stelle " +
      "schon da ist. Und es rechnet nicht einfach: es schlägt nach und " +
      "schaltet.");

    anleitung(u, "So lesen Sie diese Kachel", [
      "Der Zustand einer Stelle hat <b>2.048 Zahlen</b>. Das Bauteil weitet " +
        "ihn auf <b>6.144</b> auf, arbeitet dort, und zieht ihn wieder auf " +
        "2.048 zusammen. Diese 6.144 Zwischenwerte nennt man die Neuronen " +
        "des Feedforward.",
      "<b>Derselbe Zustand wird zweimal verschieden befragt.</b> Einmal " +
        "entsteht daraus <b>Up</b> — was ein Neuron beitragen würde. Einmal " +
        "<b>Gate</b> — ob es überhaupt durchkommt. Beide werden " +
        "<b>multipliziert</b>. Steht das Gate nahe Null, ist der Beitrag weg, " +
        "gleichgültig wie groß Up ist.",
      "Im <b>ersten Bild</b> sehen Sie diesen Weg für jedes Satzstück. Im " +
        "<b>zweiten</b> stehen die Neuronen, die an der gewählten Stelle am " +
        "stärksten anspringen — ein Klick auf eine Zeile wählt eines aus. Im " +
        "<b>dritten</b> verfolgen Sie dieses eine Neuron durch den ganzen Satz.",
      "<b>Der Schichtregler ist hier die eigentliche Frage.</b> Wieviele der " +
        "6.144 Neuronen bei einem Wort arbeiten, hängt stark von der Tiefe " +
        "ab — ziehen Sie ihn und sehen Sie zu, wie sich die Zahl im Befund " +
        "verändert.",
      "<b>Jeder Streifen ist eine Stichprobe.</b> Gezeigt werden 24 der " +
        "2.048 bzw. 6.144 Zahlen, gleichmäßig gegriffen."
    ]);

    // ── Bedienleiste: Stelle und Schicht ───────────────────────────────
    var leiste = u.bedienleiste;
    var stellenReihe = el("div", "leiste-zeile");
    stellenReihe.appendChild(el("span", "leiste-name", "Stelle"));
    var stellenZiel = el("div", "leiste-feld");
    stellenReihe.appendChild(stellenZiel);
    leiste.appendChild(stellenReihe);

    var schichtZeile = el("div", "leiste-zeile");
    schichtZeile.appendChild(el("span", "leiste-name", "Schicht"));
    var schichtZiel = el("div", "leiste-feld");
    schichtZeile.appendChild(schichtZiel);
    leiste.appendChild(schichtZeile);

    // ── Bild 1: die Aufweitung ─────────────────────────────────────────
    var f1 = feld("Die Aufweitung: 2.048 → 6.144 → 2.048");
    var z1 = el("div");
    f1.appendChild(z1);
    b.appendChild(f1);
    var r1 = ZEICHNEN.rahmen(z1, {
      aussage: "",
      legende: [
        ["Zustand", PALETTE.erkennung("res")],
        ["Gate — der Schalter", PALETTE.zeichner("gate")],
        ["Up — der Inhalt", PALETTE.zeichner("up")],
        ["Produkt = silu(Gate) · Up", PALETTE.erkennung("ff")],
        ["Auswahl", PALETTE.token("--wahl")],
        ["Helligkeit = Wert", null]
      ]
    });
    var zeichneAufweitung = FEEDFORWARD.aufweitung(r1.wurzel, {
      beiStelle: function (i) { st.position = i; st.ffNeuron = null; laden(320); }
    });
    var b1 = befund("");
    u.erklaerung("zusehen", b1);

    // ── Bild 2: welche Neuronen anspringen ─────────────────────────────
    var f2 = feld("Welche Neuronen anspringen");
    var z2 = el("div");
    f2.appendChild(z2);
    b.appendChild(f2);
    var r2 = ZEICHNEN.rahmen(z2, {
      aussage: "",
      legende: [
        ["silu(Gate)", PALETTE.zeichner("gate")],
        ["Up", PALETTE.zeichner("up")],
        ["Produkt", PALETTE.erkennung("ff")],
        ["gewähltes Neuron", PALETTE.token("--wahl")]
      ]
    });
    var zeichneSpitzen = FEEDFORWARD.dreiBalken(r2.wurzel, {
      name: function (z) { return "Neuron " + z.neuron; },
      gewaehlt: function (z) { return daten && z.neuron === daten.neuron; },
      beiZeile: function (z) { st.ffNeuron = z.neuron; laden(240); },
      xTitel: "die stärksten Neuronen an der gewählten Stelle · Klick wählt eines für das dritte Bild"
    });
    var b2 = befund("");
    f2.appendChild(b2);

    // ── Bild 3: ein Neuron durch den ganzen Satz ───────────────────────
    var f3 = feld("Ein Neuron durch den ganzen Satz");
    var z3 = el("div");
    f3.appendChild(z3);
    b.appendChild(f3);
    var r3 = ZEICHNEN.rahmen(z3, {
      aussage: "",
      legende: [
        ["silu(Gate)", PALETTE.zeichner("gate")],
        ["Up", PALETTE.zeichner("up")],
        ["Produkt", PALETTE.erkennung("ff")],
        ["gewählte Stelle", PALETTE.token("--wahl")]
      ]
    });
    var zeichneVerlauf = FEEDFORWARD.dreiBalken(r3.wurzel, {
      name: function (z) { return sichtbar(z.text); },
      gewaehlt: function (z) { return z.ist_ziel; },
      beiZeile: function (z) { st.position = z.index; laden(240); },
      xTitel: "dasselbe Neuron an jeder Stelle des Satzes"
    });
    var b3 = befund("");
    f3.appendChild(b3);

    var daten = null;

    function knoepfe(d) {
      schichtZiel.innerHTML = "";
      schichtZiel.appendChild(regler("von 0 bis " + (d.schichten - 1), 0,
        d.schichten - 1, 1, st.schicht, function (v) {
          st.schicht = v; st.ffNeuron = null; laden(320);
        }));
    }

    function malen(d, dauer) {
      zeichneAufweitung(d, dauer);
      zeichneSpitzen(d.spitzen, dauer);
      zeichneVerlauf(d.verlauf, dauer);

      var stelle = d.stationen[d.position];
      var k12 = d.kurve.filter(function (p) { return p.k === 12; })[0];
      var k200 = d.kurve.filter(function (p) { return p.k === 200; })[0];

      // ── Bild 1 ────────────────────────────────────────────────────────
      bezugSetzen(r1, u, d.token, d.position,
        "Schicht " + d.schicht + " · Streifen zeigen " + d.gezeigt + " Zahlen");
      r1.setzeAussage(kennzahlen([
        ["an", sichtbar(d.token.stuecke[d.position])],
        ["Weg", tausend(d.breiten.zustand) + " → " +
                tausend(d.breiten.feedforward) + " → " +
                tausend(d.breiten.zustand)],
        ["Schalter offen", tausend(stelle.offen) + " von " +
                           tausend(d.breiten.feedforward) + " (" +
                           pz(stelle.offen_anteil, 1) + ")", true],
        ["Parameter hier", tausend(d.parameter.feedforward)],
        ["Anteil am Block", pz(d.parameter.anteil, 1), true],
        ["Probe", "Abweichung " + d.probe.groesste_abweichung]
      ]));
      b1.setzen(
        "Das Bauteil hält an dieser Schicht <b>" +
        tausend(d.parameter.feedforward) + " Parameter</b> — <b>" +
        pz(d.parameter.anteil, 1) + "</b> alles dessen, was in einem Block " +
        "steckt. Es weitet den Zustand von " + tausend(d.breiten.zustand) +
        " auf " + tausend(d.breiten.feedforward) + " Zahlen auf, und der " +
        "Zustand geht dabei an <b>zwei</b> Stellen zugleich hinein: einmal " +
        "als Gate, einmal als Up. Beide werden multipliziert. " +
        "<b>Probe:</b> die hier gezeigte Rechnung weicht vom echten Ausgang " +
        "des Bauteils um <b>" + d.probe.groesste_abweichung + "</b> ab " +
        "(größter Wert dort: " + d.probe.groesster_wert + ").");

      // ── Bild 2 ────────────────────────────────────────────────────────
      // Der Satz beschreibt, was DIESE Messung zeigt — spärlich oder breit
      // ist eine Frage der Schicht, keine feststehende Behauptung.
      bezugSetzen(r2, u, d.token, d.position,
        "Schicht " + d.schicht + " · die " + d.spitzen.length +
        " stärksten von " + tausend(d.breiten.feedforward) + " Neuronen");
      var spitz = k12.anteil > 0.15;
      r2.setzeAussage(kennzahlen([
        ["Schicht", String(d.schicht) + " von " + (d.schichten - 1)],
        ["stärkste 12 tragen", pz(k12.anteil, 1), true],
        ["stärkste 200 tragen", pz(k200.anteil, 1)],
        ["Schalter offen", pz(stelle.offen_anteil, 1), true],
        ["gewähltes Neuron", "#" + d.neuron]
      ]));
      b2.setzen(
        "An dieser Stelle tragen die <b>stärksten zwölf</b> von " +
        tausend(d.breiten.feedforward) + " Neuronen <b>" + pz(k12.anteil, 1) +
        "</b> der gesamten Aktivierung, die stärksten 200 zusammen <b>" +
        pz(k200.anteil, 1) + "</b>. " +
        (spitz
          ? "Die Arbeit ist also auf <b>wenige Neuronen zugespitzt</b>."
          : "Die Arbeit ist <b>breit verteilt</b> — es sind nicht einige " +
            "wenige Neuronen, die alles tragen.") +
        " Ziehen Sie den Schichtregler: dieser Anteil ändert sich mit der " +
        "Tiefe erheblich.");

      // ── Bild 3 ────────────────────────────────────────────────────────
      // Auch hier wird der Befund gerechnet: ob das Gate bei diesem Neuron
      // ueberhaupt als Schalter auffaellt, ist von Neuron zu Neuron
      // verschieden.
      var gr = 0, zuMitInhalt = 0, maxUpZu = 0, offenMax = 0;
      d.verlauf.forEach(function (v) {
        gr = Math.max(gr, Math.abs(v.gate));
        offenMax = Math.max(offenMax, Math.abs(v.innen));
      });
      var schwelle = gr * 0.05;
      d.verlauf.forEach(function (v) {
        if (Math.abs(v.gate) < schwelle && Math.abs(v.up) > 0.3) {
          zuMitInhalt += 1;
          maxUpZu = Math.max(maxUpZu, Math.abs(v.up));
        }
      });
      var staerkste = d.verlauf.reduce(function (a, v) {
        return Math.abs(v.innen) > Math.abs(a.innen) ? v : a;
      }, d.verlauf[0]);

      bezugSetzen(r3, u, d.token, d.position,
        "Schicht " + d.schicht + " · Neuron #" + d.neuron + " von " +
        tausend(d.breiten.feedforward) + " · alle Stellen des Satzes");

      r3.setzeAussage(kennzahlen([
        ["Neuron", "#" + d.neuron],
        ["stärkste Stelle", sichtbar(staerkste.text) + "  " +
                            zahl(staerkste.innen, 2), true],
        ["Gate dort", zahl(staerkste.gate, 2)],
        ["Up dort", zahl(staerkste.up, 2)],
        ["Gate zu bei", zuMitInhalt + " von " + d.verlauf.length + " Stellen"]
      ]));
      b3.setzen(
        "Neuron <b>#" + d.neuron + "</b> spricht am stärksten auf <b>" +
        sichtbar(staerkste.text) + "</b> an (Produkt " +
        zahl(staerkste.innen, 2) + " aus Gate " + zahl(staerkste.gate, 2) +
        " mal Up " + zahl(staerkste.up, 2) + "). " +
        (zuMitInhalt > 0
          ? "An <b>" + zuMitInhalt + "</b> Stelle" + (zuMitInhalt === 1 ? "" : "n") +
            " ist das Gate praktisch zu, obwohl Up dort bis <b>" +
            zahl(maxUpZu, 2) + "</b> reicht — <b>dort schaltet das Gate den " +
            "Beitrag ab</b>, gleichgültig was anläge."
          : "Bei diesem Neuron steht das Gate an jeder Stelle offen — hier " +
            "entscheidet also <b>der Inhalt</b> und nicht der Schalter. " +
            "Klicken Sie im Bild darüber ein anderes Neuron an; das " +
            "Verhalten ist von Neuron zu Neuron verschieden.") +
        " Ein Klick auf eine Zeile wechselt die betrachtete Stelle.");
    }

    function laden(dauer) {
      u.senden("/api/feedforward", {
        text: st.satz, schicht: st.schicht, position: st.position,
        neuron: st.ffNeuron, oben: 12, proben: 24,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        daten = d;
        st.ffNeuron = d.neuron;
        stellenZiel.innerHTML = "";
        stellenZiel.appendChild(stellenreihe(u, d.token, function () {
          st.ffNeuron = null; laden(320);
        }));
        knoepfe(d);
        malen(d, dauer);
      });
    }

    laden(0);
  }

  function kachelVorhersage(b, u) {
    lead(u, "Was das Modell als Nächstes sagt",
      "Ein Sprachmodell tut nur eines: es gibt für jedes der " +
      tausend(u.info.vokabular) + " möglichen Stücke eine Wahrscheinlichkeit " +
      "an, dass es als Nächstes kommt. Alles Weitere — Antworten, Übersetzen, " +
      "Programmieren — ist diese eine Fähigkeit, oft genug wiederholt.");

    anleitung(u, "So lesen Sie diese Kachel", [
      "<b>Eine Zeile = ein mögliches nächstes Stück</b>, und die Spalten " +
        "sind die Rechenschritte von links nach rechts. Man liest eine Zeile " +
        "<b>quer</b>: aus der rohen Zahl ganz links wird über Temperatur und " +
        "Schnitt die Wahrscheinlichkeit ganz rechts. Alle " +
        tausend(u.info.vokabular) + " Stücke bekommen eine — gezeigt werden " +
        "die zwölf größten.",
      "<b>Alles, was in der Leiste ganz oben steht, wirkt auf BEIDE " +
        "Darstellungen dieser Kachel</b> — Satz, Stelle, Temperatur, Schnitt " +
        "und die weggenommenen Schichten. Ziehen Sie an der Temperatur, dann " +
        "laufen die Zahlen der Tafel auf ihren neuen Wert UND die Bänder des " +
        "Netzes werden neu gerechnet.",
      "Die Zahlen sind <b>keine Bewertung des Inhalts</b>. Das Modell sagt " +
        "nicht, was richtig wäre, sondern was in seinen Trainingstexten an " +
        "dieser Stelle gefolgt ist.",
      "Ein Stück ist oft <b>kein ganzes Wort</b>. Ein führendes Leerzeichen " +
        "gehört dazu und ist als · dargestellt — „·man“ ist etwas anderes " +
        "als „man“ mitten im Wort.",
      "Das <b>Auge im Kopf der Logit-Spalte</b> zeigt, woher diese erste " +
        "Zahl kommt — sie fällt nicht vom Himmel, sondern ist die Summe von " +
        "2.048 Produkten. Ein Klick auf eine Zeile schlüsselt ein anderes " +
        "Stück auf.",
      "Im Abschnitt „Was hier zu sehen ist“ steht, <b>wie entschieden</b> das " +
        "Modell an dieser Stelle ist. Diese Zahl entscheidet, ob die " +
        "Fortsetzung praktisch feststeht oder ob das Modell die Wahl hat."
    ]);

    var st = u.zustand;
    if (st.netzAnsicht === undefined) { st.netzAnsicht = "weg"; }
    if (st.netzStelle === undefined) { st.netzStelle = null; }
    if (st.netzKandidat === undefined) { st.netzKandidat = null; }

    // ═══════════════════════════════════════════════════════════════════
    // 1. DIE BEDIENLEISTE — alles, was man verstellen kann, an EINEM Ort
    //
    // User-Direktive 14.08.2026: „Parameter, die ich auf einer Kachel
    // verstellen kann, müssen in alle Darstellungen der Kachel wirken."
    // Deshalb steht hier der ganze Parametersatz der Kachel, und beide
    // Darstellungen (Tafel und Netz) rechnen mit demselben.
    //
    // ABGRENZUNG: ein ANSICHTS-Schalter, der nur für eine Darstellung
    // überhaupt einen Sinn ergibt (hier „Der Weg / Die Wirkung" des
    // Netzes — die Tafel hat keine Wirkung zu zeigen), bleibt AN seiner
    // Darstellung. Er verstellt nicht das Modell, sondern die Sicht auf
    // ein Bild. Diese Unterscheidung ist meine Auslegung der Direktive und
    // steht zur Korrektur.
    // ═══════════════════════════════════════════════════════════════════
    var leiste = u.bedienleiste;

    var stellenReihe = el("div", "leiste-zeile");
    stellenReihe.appendChild(el("span", "leiste-name", "Stelle"));
    var stellenZiel = el("div", "leiste-feld");
    stellenReihe.appendChild(stellenZiel);
    leiste.appendChild(stellenReihe);

    var parameterZiel = el("div", "leiste-zeile stellwerk");
    leiste.appendChild(parameterZiel);

    var modellZeile = el("div", "leiste-zeile");
    modellZeile.appendChild(el("span", "leiste-name", "Modell"));
    var rr = el("div", "leiste-feld");
    modellZeile.appendChild(rr);
    leiste.appendChild(modellZeile);

    // ═══════════════════════════════════════════════════════════════════
    // 2. DIE DARSTELLUNGEN
    //
    // DAS BILD ZUERST, DIE LISTE DANACH.
    //
    // Fehler vom 14.08.2026, am Code belegt: bis `7493b86` stand
    // `b.appendChild(nf)` VOR `b.appendChild(f)` — das Flussbild war das
    // Erste, was man sah. Beim Umbau habe ich die Tafel zur
    // „Hauptdarstellung" erklärt und die Reihenfolge gedreht. Damit lag das
    // Bild unter einer Zahlentabelle. Befund des Anwenders: „wo ist jetzt
    // das bild was ich wollte??? du hast es noch schlimmer gemacht."
    //
    // Auch die Vorlage macht es so: ihre Hauptansicht IST das Flussbild
    // (`_vorbild/bilder/02-bahn-0.png`); die Wahrscheinlichkeiten sind
    // dessen rechter Rand, und die Zahlentafel (`fig-8.png`) erscheint
    // überhaupt erst, wenn man sie aufklappt.
    // ═══════════════════════════════════════════════════════════════════

    // Das Netz: Bänder statt Pfeile, Breite gleich Menge — nach dem Vorbild,
    // nur mit dem Unterschied, dass jede Breite eine gemessene Größe ist.
    var nf = feld("Welches Wort im Satz trägt welche Fortsetzung");
    var nAnsicht = el("div", "bild-schalter");
    nf.appendChild(nAnsicht);
    var nZiel = el("div");
    nf.appendChild(nZiel);
    b.appendChild(nf);

    var f = feld("Die wahrscheinlichsten Fortsetzungen");
    var kette = vorhersagetafelBauen(f, u, parameterZiel,
      // Parameter geaendert -> auch das Netz rechnet neu.
      function () { netzLaden(420); },
      // Ein Stueck in der Tafel gewaehlt -> im Netz DASSELBE markieren.
      function (stueckId) {
        if (!netzDaten) { return; }
        var j = -1;
        netzDaten.kandidaten.forEach(function (c, n) {
          if (c.id === stueckId) { j = n; }
        });
        st.netzKandidat = j >= 0 ? j : null;
        netzZeichnen(280);
      });
    b.appendChild(f);

    var nRahmen = ZEICHNEN.rahmen(nZiel, {
      aussage: "",
      legende: [
        ["Bandbreite = Größe", PALETTE.erkennung("att")],
        ["gestrichelt = dämpft", null],
        ["gewählt", PALETTE.token("--wahl")]
      ]
    });
    var zeichneNetz = ZEICHNEN.fluss(nRahmen.wurzel, { breite: 900 });

    // ═══════════════════════════════════════════════════════════════════
    // 3. ALLER TEXT in die eine Erklärzelle — nichts davon steht am Bild
    // ═══════════════════════════════════════════════════════════════════
    u.erklaerung("lesen", el("p", null,
      "Im Netz steht links Ihr Satz, rechts stehen die möglichen " +
      "Fortsetzungen. Die Bänder dazwischen sind nicht gemalt — ihre Breite " +
      "ist jeweils eine am Modell gemessene Größe. Ein Klick auf ein " +
      "Satzstück zeigt nur dessen Bänder."));
    u.erklaerung("lesen", el("p", null,
      "„Der Weg“ zeigt die Aufmerksamkeit, „Die Wirkung“ misst statt dessen, " +
      "was fehlt, wenn man ein Stück weglässt — dafür läuft der Satz so oft " +
      "erneut durch das Modell, wie er Stücke hat."));
    u.erklaerung("lesen", el("p", null,
      "Mit den Knöpfen unter „Modell“ nehmen Sie Schichten weg. Die Zahlen " +
      "und Balken laufen dann auf ihren neuen Wert, statt zu springen — so " +
      "sieht man, welches Wort gewinnt und welches verliert."));

    var vBefund = befund("");
    u.erklaerung("zusehen", vBefund);
    var vBefund2 = befund("");
    u.erklaerung("zusehen", vBefund2);
    var nBefund = befund("");
    u.erklaerung("zusehen", nBefund);

    // --- Netz: laden, zeichnen, umschalten ------------------------------
    var netzDaten = null;

    function ansichtKnoepfe() {
      nAnsicht.innerHTML = "";
      [["Der Weg", "weg"], ["Die Wirkung", "wirkung"]].forEach(function (p) {
        nAnsicht.appendChild(knopf(p[0], st.netzAnsicht === p[1] ? "an" : "",
          function () {
            st.netzAnsicht = p[1];
            // Die Wirkung kostet einen Durchlauf je Satzstueck und wird
            // deshalb erst geholt, wenn sie auch gezeigt werden soll.
            if (p[1] === "wirkung" && netzDaten && !netzDaten.mit_wirkung) {
              netzLaden(420);
            } else {
              netzZeichnen(420);
            }
          }));
      });
    }

    function staerksteWirkung(s) {
      var m = 0;
      (s.wirkung || []).forEach(function (w) { m = Math.max(m, Math.abs(w)); });
      return m;
    }

    function netzZeichnen(dauer) {
      if (!netzDaten) { return; }
      var d = netzDaten;
      ansichtKnoepfe();

      // Solange die Wirkung noch gerechnet wird, stehen in `wirkung` lauter
      // Nullen. Die als Messwerte zu zeichnen waere eine Falschaussage: das
      // Bild zeigte haarduenne Baender und die Aussage „0,00 Prozentpunkte“,
      // als waere nichts messbar. Also sagen, dass gerechnet wird.
      if (st.netzAnsicht === "wirkung" && !d.mit_wirkung) {
        nRahmen.setzeAussage("Die Wirkung wird gerade gemessen: dafür läuft " +
          "der Satz <b>" + d.stellen.length + "-mal erneut</b> durch das " +
          "Modell, jedes Mal ohne ein anderes Stück. Einen Augenblick.");
        nBefund.setzen("Wird gerechnet …");
        return;
      }

      zeichneNetz({
        stellen: d.stellen, kandidaten: d.kandidaten,
        ansicht: st.netzAnsicht,
        markiert: st.netzStelle, markierterKandidat: st.netzKandidat,
        vektorTitel: d.vektor_gezeigt
          ? "der Zustand an dieser Stelle — " + d.vektor_gezeigt + " von " +
            tausend(d.vektor_gesamt) + " Zahlen gezeigt"
          : null,
        beiStelle: function (i) {
          // Zweimal auf dasselbe Stueck hebt die Auswahl wieder auf — sonst
          // kommt man aus der Einzelsicht nicht mehr heraus.
          st.netzStelle = (st.netzStelle === i ? null : i);
          netzZeichnen(280);
        },
        beiKandidat: function (j) {
          st.netzKandidat = (st.netzKandidat === j ? null : j);
          // … und in die Gegenrichtung: die Tafel markiert dasselbe Stück.
          var k = netzDaten && netzDaten.kandidaten[j];
          if (k) {
            st.vorhersageStueck = st.netzKandidat === null ? null : k.id;
            kette.neuZeichnen();
          }
          netzZeichnen(280);
        }
      }, dauer);

      bezugSetzen(nRahmen, u, d.token, d.position,
        st.netzAnsicht === "weg" ? "Ansicht: der Weg" : "Ansicht: die Wirkung",
        !d.beschaedigt);

      var frei = d.stellen.filter(function (s) { return !s.ist_ziel; });
      if (!frei.length) {
        nRahmen.setzeAussage("Der Satz hat nur eine Stelle — es gibt nichts, " +
          "was auf sie einwirken könnte.");
        return;
      }
      var mB = frei[0], mW = frei[0];
      frei.forEach(function (s) {
        if (s.blick > mB.blick) { mB = s; }
        if (staerksteWirkung(s) > staerksteWirkung(mW)) { mW = s; }
      });
      var k1 = d.kandidaten[0];

      if (st.netzAnsicht === "weg") {
        nRahmen.setzeAussage(kennzahlen([
          ["nach", sichtbar(d.token.stuecke[d.position])],
          ["Stücke", d.stellen.length + " → 1 Stelle"],
          ["meiste Aufmerksamkeit", sichtbar(mB.text) + " " + pz(mB.blick, 1),
            true],
          ["wahrscheinlichste Fortsetzung",
            sichtbar(k1.text) + " " + pz(k1.p, 1), true],
          ["T", zahl(d.temperatur, 2)],
          [d.verfahren === "top_p" ? "top-p" : "top-k",
            d.verfahren === "top_p" ? zahl(d.top_p, 2) : String(d.top_k)]
        ]));
      } else {
        var j = 0, best = 0;
        (mW.wirkung || []).forEach(function (w, n) {
          if (Math.abs(w) > best) { best = Math.abs(w); j = n; }
        });
        var wert = mW.wirkung[j];
        nRahmen.setzeAussage(kennzahlen([
          ["nach", sichtbar(d.token.stuecke[d.position])],
          ["stärkste Wirkung", sichtbar(mW.text), true],
          ["ohne es " + (wert > 0 ? "fällt" : "steigt"),
            sichtbar(d.kandidaten[j].text) + " um " +
            zahl(Math.abs(wert) * 100, 2) + " Pp.", true],
          ["gemessen", d.stellen.length + " Durchläufe"],
          ["T", zahl(d.temperatur, 2)]
        ]));
      }

      // Der eigentliche Befund dieser Kachel: Blick und Wirkung sind NICHT
      // dasselbe. Das erste Stueck eines Satzes zieht regelmaessig den
      // Grossteil der Aufmerksamkeit auf sich, ohne die Vorhersage
      // entsprechend zu bewegen.
      nBefund.setzen(
        "Aufmerksamkeit ist nicht Wirkung. Den größten Blick bekommt " +
        JSON.stringify(sichtbar(mB.text)) + " (<span class='zahl'>" +
        pz(mB.blick, 1) + "</span> der Aufmerksamkeit, gemittelt über alle " +
        d.schichten_gemittelt + " Schichten). Die größte gemessene Wirkung " +
        "auf die Vorhersage hat " + JSON.stringify(sichtbar(mW.text)) +
        " (<span class='zahl'>" + zahl(staerksteWirkung(mW) * 100, 2) +
        " Prozentpunkte</span>" +
        (mW.blick < mB.blick
          ? " — bei nur <span class='zahl'>" + pz(mW.blick, 1) + "</span> Blick"
          : "") + "). " +
        (mB === mW
          ? "Hier fällt beides zusammen."
          : "<b>Beides fällt hier auseinander</b> — wer nur auf die " +
            "Aufmerksamkeit schaut, sieht das falsche Wort an."));
    }

    function netzLaden(dauer) {
      u.senden("/api/netz", {
        text: st.satz, position: st.position, oben: 6,
        mit_wirkung: st.netzAnsicht === "wirkung",
        // DIESELBEN PARAMETER WIE DIE TAFEL. Ohne sie zeigte das Netz eine
        // andere Verteilung als die Tafel darueber — und die Regler der
        // Kachel wirkten auf das eine Bild und auf das andere nicht.
        temperatur: st.temperatur,
        verfahren: st.verfahren,
        top_k: st.verfahren === "top_p" ? 0 : st.topK,
        top_p: st.verfahren === "top_p" ? st.topP : 1.0,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        netzDaten = d;
        // Eine Stellenwahl, die es im neuen Satz nicht mehr gibt, faellt weg.
        if (st.netzStelle !== null && st.netzStelle >= d.stellen.length) {
          st.netzStelle = null;
        }
        netzZeichnen(dauer);
      });
    }

    function laden(dauer) {
      u.senden("/api/durchlauf", {
        text: st.satz, schicht: st.schicht, position: st.position,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        stellenZiel.innerHTML = "";
        stellenZiel.appendChild(stellenreihe(u, d.token, function () {
          laden(360);
        }));

        // Die Tafel folgt derselben Stelle und denselben Eingriffen. Sie
        // holt ihre Zahlen selbst — mit Temperatur und Schnitt, die
        // `/api/durchlauf` gar nicht kennt.
        kette.pruefen();

        // DER ABSTAND ZWISCHEN PLATZ 1 UND PLATZ 2 entscheidet, ob die
        // Fortsetzung feststeht oder ob das Modell die Wahl hat. Diese
        // Aussage haengt NICHT an Temperatur und Schnitt und steht deshalb
        // hier, nicht in der Tafel.
        var e1 = d.beste[0], e2 = d.beste[1];
        vBefund.setzen(
          "<b>Der Abstand zwischen Platz 1 und Platz 2</b> — ungerechnet, " +
          "also ohne Temperatur und ohne Schnitt: " +
          JSON.stringify(sichtbar(e1.text)) + " kommt auf <b>" +
          pz(e1.p, 1) + "</b>" +
          (e2 ? ", " + JSON.stringify(sichtbar(e2.text)) + " auf " +
            pz(e2.p, 1) + " — also " + (e1.p / Math.max(1e-9, e2.p) >= 2
              ? "<b>weniger als die Hälfte</b>. Die Fortsetzung steht damit " +
                "praktisch fest, und die Regler oben ändern daran wenig."
              : "fast gleich viel. <b>Hier ist die Fortsetzung offen</b> — " +
                "genau hier entscheiden die Regler oben, was herauskommt.")
            : ".") +
          (u.zustand.eingriffe.schichtAus.length ||
           u.zustand.eingriffe.kopfAus.length
            ? " <b>Achtung: das Modell ist gerade beschädigt.</b>" : ""));

        // Die Rangliste allein sagt nichts darueber, wie entschieden das
        // Modell ist. Zwei Verteilungen koennen dieselbe Spitze haben und
        // sich voellig unterschiedlich verhalten.
        var un = d.unsicherheit;
        if (un) {
          vBefund2.setzen(
            "Wie entschieden ist das Modell hier? Es braucht " +
            "<span class='zahl'>" + un.n50 + "</span> Stück" +
            (un.n50 === 1 ? "" : "e") + " für die Hälfte der " +
            "Wahrscheinlichkeit, <span class='zahl'>" + un.n90 + "</span> für " +
            "90 % und <span class='zahl'>" + tausend(un.n99) + "</span> für " +
            "99 % — von " + tausend(un.vokabular) + " möglichen. Das ist " +
            "so unentschieden wie ein gleichmäßiger Würfel mit " +
            "<b>" + zahl(un.wuerfel, 1) + " Seiten</b>. " +
            (un.wuerfel < 3
              ? "Das Modell ist an dieser Stelle also sehr sicher — der Satz " +
                "lässt kaum eine andere Fortsetzung zu."
              : un.wuerfel < 20
              ? "Das Modell hat also eine Handvoll ernsthafter Kandidaten."
              : "Das Modell ist an dieser Stelle also weitgehend offen — der " +
                "Satz gibt die Fortsetzung kaum vor.") +
            " Genau diese Zahl steuert, wie sich „Temperatur“ beim " +
            "Weiterschreiben auswirkt: wo das Modell entschieden ist, ändert " +
            "sie wenig; wo es offen ist, entscheidet sie fast alles.");
        }
        knoepfe();
        // Das Netz ZULETZT: es rechnet laenger als der Durchlauf, und die
        // uebrigen Diagramme sollen nicht darauf warten muessen.
        netzLaden(dauer);
      });
    }

    function knoepfe() {
      rr.innerHTML = "";
      [["die letzten 4 Schichten weg", [24, 25, 26, 27]],
       ["die letzten 8 Schichten weg", [20, 21, 22, 23, 24, 25, 26, 27]],
       ["alle Feedforward-Schichten weg", null],
       ["alles zurücknehmen", []]
      ].forEach(function (p) {
        var aktiv = p[1] && p[1].length &&
          p[1].every(function (s) { return st.eingriffe.schichtAus.indexOf(s) >= 0; });
        rr.appendChild(knopf(p[0], aktiv ? "an" : "", function () {
          if (p[1] === null) {
            st.eingriffe.mlpAus = [];
            for (var s = 0; s < u.info.schichten; s++) { st.eingriffe.mlpAus.push(s); }
          } else if (p[1].length === 0) {
            st.eingriffe.schichtAus = []; st.eingriffe.mlpAus = [];
            st.eingriffe.attnAus = []; st.eingriffe.kopfAus = [];
            st.eingriffe.kopfSkala = [];
          } else if (aktiv) {
            st.eingriffe.schichtAus = st.eingriffe.schichtAus.filter(function (s) {
              return p[1].indexOf(s) < 0;
            });
          } else {
            p[1].forEach(function (s) {
              if (st.eingriffe.schichtAus.indexOf(s) < 0) { st.eingriffe.schichtAus.push(s); }
            });
          }
          laden(700);
        }));
      });
      // `rr` haengt schon in der Bedienleiste — die Eingriffe sind
      // Modell-Parameter und gehoeren dorthin, nicht in ein eigenes Feld
      // unter den Bildern.
    }

    laden(0);
  }

  function kachelAufmerksamkeit(b, u) {
    lead(u, "Wieviel jedes Wort von jedem anderen mitnimmt",
      "Ein Wort allein bedeutet wenig: „Bank“ ist etwas anderes im Wald als " +
      "in der Stadt. Deshalb sammelt das Modell beim Verarbeiten jedes Wortes " +
      "Information bei den Wörtern davor ein. Wieviel es bei welchem holt, " +
      "steht unten — hundert Prozent werden verteilt, und zwar für jedes Wort " +
      "neu.");

    anleitung(u, "So lesen Sie diese Kachel", [
      "<b>Oben der Satz:</b> Sie wählen ein Wort. Darunter steht Ihr Satz " +
        "noch einmal, und jedes Wort ist so hell eingefärbt, wie stark das " +
        "gewählte Wort davon mitnimmt. Die Prozentzahlen ergeben zusammen 100.",
      "<b>Darunter die Matrix:</b> dasselbe für ALLE Wörter zugleich. Jede " +
        "Zeile ist eine solche Einfärbung, hochkant gestellt. Die gewählte " +
        "Zeile ist farbig umrandet.",
      "Nach rechts oben bleibt es dunkel — kein Wort darf sehen, was nach " +
        "ihm kommt.",
      "Ein <b>Kopf</b> ist ein Blickwinkel. Es gibt " + u.info.koepfe +
        " davon je Schicht, und sie achten auf Verschiedenes. Wechseln Sie " +
        "durch, das Muster ändert sich deutlich.",
      "Das Modell hat " + u.info.schichten + " Schichten × " + u.info.koepfe +
        " Köpfe = <b>" + (u.info.schichten * u.info.koepfe) + " solcher " +
        "Matrizen</b> für Ihren Satz. Sie sehen gerade eine davon."
    ]);

    // Reihenfolge nach der Frage, die sich stellt: erst WOZU, dann WIE,
    // dann WAS das Modell damit macht. Wer mit der Matrix beginnt, zeigt
    // eine Antwort auf eine Frage, die noch niemand gestellt hat.
    kontextproblemBauen(b, u);
    rechenwegBauen(b, u);

    var steuer = el("div");

    // Das eigentliche Diagramm: der Satz selbst, eingefaerbt. Eine Matrix
    // muss man lesen lernen — einen eingefaerbten Satz nicht.
    var bandFeld = feld("Beim Verarbeiten dieses Wortes …");
    bandFeld.appendChild(stellenbeschriftung());
    var wortWahl = el("div");
    bandFeld.appendChild(wortWahl);
    var bandTitel = hinweis("");
    bandFeld.appendChild(bandTitel);
    var band = el("div", "satzband");
    bandFeld.appendChild(band);
    // Auch der eingefaerbte Satz ist ein Diagramm und braucht seine Legende
    // am Bild — dieselbe Farbskala wie die Matrix darunter.
    ZEICHNEN.farbleiste(bandFeld, {
      links: "0 % — von hier wird nichts geholt",
      rechts: "100 % — alles von hier",
      was: "Farbe = Anteil, den das gewählte Wort von diesem Wort mitnimmt. " +
        "Blasse Wörter ohne Farbe liegen nach dem gewählten Wort."
    });
    var bandNote = hinweis("");
    bandFeld.appendChild(bandNote);
    var bandBefund = befund("");
    bandFeld.appendChild(bandBefund);

    var f = feld("Dasselbe für alle Wörter zugleich");
    var titelZeile = f.querySelector("h4");
    // Die Herleitung steht ZUGEKLAPPT ueber dem Ergebnis: wer wissen will,
    // wie diese Matrix entsteht, klappt sie auf; wer sie kennt, sieht sie
    // nicht. Gerechnet wird erst dann.
    var stufen = attentionStufenBauen(f, u, function () { laden(360); });
    var feldZiel = el("div");
    f.appendChild(feldZiel);
    f.appendChild(hinweis("Beim Wechsel von Schicht oder Kopf blenden die " +
      "Felder in ihre neue Farbe über — so sieht man, welche Beziehung sich " +
      "ändert."));
    var wirkung = feld("Was das Modell daraufhin sagt");
    var vertZiel = el("div");
    wirkung.appendChild(vertZiel);
    var schalter = el("div", "reihe");
    wirkung.appendChild(schalter);

    b.appendChild(steuer);
    b.appendChild(bandFeld);
    b.appendChild(f);
    b.appendChild(wirkung);

    var feldRahmen = ZEICHNEN.rahmen(feldZiel, {
      aussage: "",
      legende: [
        ["umrandet: die Zeile des gerade gewählten Wortes", PALETTE.token("--wahl")],
        ["dunkelgraue Fläche oben rechts: darf nicht gesehen werden " +
          "(liegt in der Zukunft)", PALETTE.zeichner("maskiert")]
      ]
    });
    var zeichneFeld = ZEICHNEN.hitzefeld(feldRahmen.wurzel, {
      breite: 680, max: 36,
      yTitel: "Zeile: dieses Wort wird verarbeitet ↓",
      xTitel: "Spalte: auf dieses Wort wird geschaut  —  gleiche Reihenfolge wie links →"
    });
    ZEICHNEN.farbleiste(feldRahmen.fuss, {
      links: "0 % — nichts geholt", rechts: "100 % — alles von dort",
      was: "Anteil, den das Wort der Zeile beim Wort der Spalte holt. " +
        "Jede Zeile ergibt zusammen 100 %."
    });
    var vertRahmen = ZEICHNEN.rahmen(vertZiel, { aussage: "" });
    var zeichneBalken = ZEICHNEN.balken(vertRahmen.wurzel, {
      breite: 560,
      yTitel: "mögliches nächstes Stück ↓",
      xTitel: "Wahrscheinlichkeit"
    });
    balkenlegende(vertRahmen, "Wahrscheinlichkeit für das nächste Stück.");
    var st = u.zustand;

    function laden(dauer) {
      u.senden("/api/durchlauf", {
        text: st.satz, schicht: st.schicht, position: st.position,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        var kopf = Math.min(st.kopf, d.attention.length - 1);
        var T = d.token.ids.length;
        // Die Stelle kommt vom Server zurueck, schon gegen die Laenge DIESES
        // Satzes aufgeloest — damit rechnen Bild und Zahlen dieselbe Stelle.
        var pos = d.position;

        titelZeile.textContent = "Schicht " + (d.schicht + 1) + " · Kopf " +
          (kopf + 1) + " · " + T + " × " + T;
        zeichneFeld({ matrix: d.attention[kopf], labels: d.token.stuecke,
                      auswahl: [pos, pos], zeile: pos,
                      beiKlick: function (i) {
                        st.position = i; laden(360);
                      } },
                    dauer);
        zeichneBalken(d.beste.slice(0, 8), dauer);
        var wo = "Schicht " + (d.schicht + 1) + " · Kopf " + (kopf + 1);
        bezugSetzen(feldRahmen, u, d.token, pos, wo);
        bezugSetzen(vertRahmen, u, d.token, pos, wo);

        // Die Aussage der Matrix: die staerkste Beziehung, die NICHT auf der
        // Diagonalen liegt. Die Diagonale ist bei fast jedem Kopf hell und
        // sagt nur, dass ein Wort bei sich selbst bleibt.
        (function () {
          var A = d.attention[kopf], gross = 0, gi = 0, gj = 0, dia = 0;
          for (var i = 0; i < T; i++) {
            dia += A[i][i];
            for (var j = 0; j < i; j++) {
              if (A[i][j] > gross) { gross = A[i][j]; gi = i; gj = j; }
            }
          }
          feldRahmen.setzeAussage(
            "Schicht " + (d.schicht + 1) + ", Kopf " + (kopf + 1) + ": die " +
            "stärkste Verbindung zwischen zwei <b>verschiedenen</b> Wörtern " +
            "ist " + JSON.stringify(sichtbar(d.token.stuecke[gi])) + " → " +
            JSON.stringify(sichtbar(d.token.stuecke[gj])) + " mit <b>" +
            pz(gross, 1) + "</b>. Im Mittel behalten die Wörter <b>" +
            pz(dia / T, 1) + "</b> bei sich selbst (die Diagonale). " +
            "<b>Die obere Hälfte bleibt leer</b> — kein Wort darf sehen, was " +
            "nach ihm kommt.");
          vertRahmen.setzeAussage(
            "An der gewählten Stelle " +
            JSON.stringify(sichtbar(d.token.stuecke[pos])) +
            (pos === T - 1 ? " (dem Satzende)" : "") +
            " sagt das Modell <b>" +
            JSON.stringify(sichtbar(d.beste[0].text)) + "</b> (" +
            pz(d.beste[0].p, 1) + "). Schalten Sie unten den Kopf " +
            "stumm — dann sehen Sie an den Balken, was er beigetragen hat.");
        })();

        bandZeichnen(d, kopf);
        steuerZeichnen(d, kopf);
        // Die Herleitung folgt derselben Stelle, Schicht und demselben Kopf.
        // Sie rechnet nur nach, wenn sie offen ist UND sich Satz, Schicht
        // oder Kopf geaendert haben — ein Stellenwechsel setzt bloss die
        // Marke.
        stufen.pruefen();
      });
    }

    /** Der Satz, eingefaerbt nach dem, was das gewaehlte Wort mitnimmt. */
    function bandZeichnen(d, kopf) {
      var t = d.position;
      var zeile = d.attention[kopf][t];

      wortWahl.innerHTML = "";
      wortWahl.appendChild(stellenreihe(u, d.token, function () {
        laden(360);
      }));

      bandTitel.textContent = "… nimmt das Modell aus dem Satz Folgendes mit " +
        "(Schicht " + (d.schicht + 1) + ", Kopf " + (kopf + 1) + "):";

      band.innerHTML = "";
      var groesster = 0, wo = 0;
      for (var i = 0; i <= t; i++) {
        if (zeile[i] > groesster) { groesster = zeile[i]; wo = i; }
      }
      d.token.stuecke.forEach(function (s, i) {
        var w = i <= t ? zeile[i] : 0;
        var e = el("div", "bandwort" + (i > t ? " zukunft" : "") +
                          (i === wo ? " groesster" : ""));
        var innen = el("div", "wort", sichtbar(s));
        innen.style.background = i <= t ? ZEICHNEN.hitze(w) : "transparent";
        innen.style.color = PALETTE.schriftAuf(w, 0.42);
        e.appendChild(innen);
        e.appendChild(el("div", "anteil", i <= t ? pz(w, 1) : "–"));
        e.title = i > t
          ? "liegt nach dem gewählten Wort — darf nicht gesehen werden"
          : sichtbar(s) + ": " + pz(w, 2);
        band.appendChild(e);
      });

      bandNote.textContent = "Am meisten nimmt " +
        JSON.stringify(d.token.stuecke[t]) + " von " +
        JSON.stringify(d.token.stuecke[wo]) + " mit: " + pz(groesster, 1) +
        ". Die blassen Wörter rechts liegen nach dem gewählten Wort — auf sie " +
        "darf nicht geschaut werden.";

      // Der Befund: wie gezielt schaut dieser Kopf ueberhaupt? Ein Kopf, der
      // 90 % auf ein Wort legt, tut etwas voellig anderes als einer, der auf
      // zehn Woerter gleich verteilt — im Bild sieht das aehnlich aus, in der
      // Zahl nicht.
      var sortiert = [];
      for (var q = 0; q <= t; q++) { sortiert.push(zeile[q]); }
      sortiert.sort(function (a, c) { return c - a; });
      var kumuliert = 0, wieviele = 0;
      while (wieviele < sortiert.length && kumuliert < 0.8) {
        kumuliert += sortiert[wieviele]; wieviele += 1;
      }
      var h = 0;
      sortiert.forEach(function (w) { if (w > 1e-9) { h -= w * Math.log(w); } });
      var maximal = Math.log(Math.max(2, t + 1));
      var breite = h / maximal;
      bandBefund.setzen(
        "Dieser Kopf schaut " + (breite < 0.35 ? "<b>sehr gezielt</b>"
          : breite < 0.7 ? "<b>mittelmäßig gezielt</b>" : "<b>breit gestreut</b>") +
        ": <span class='zahl'>" + wieviele + "</span> von " + (t + 1) +
        " erlaubten Wörtern machen bereits <span class='zahl'>" + pz(kumuliert, 0) +
        "</span> aus. Auf einer Skala von 0 (schaut auf genau ein Wort) bis 1 " +
        "(verteilt gleichmäßig auf alles) liegt er bei <span class='zahl'>" +
        zahl(breite, 2) + "</span>. Diese eine Zahl gibt es für alle " +
        (u.info.schichten * u.info.koepfe) + " Köpfe zugleich — in der " +
        "Kachel „Alle Köpfe“ als Landkarte.");
    }

    function steuerZeichnen(d, kopf) {
      steuer.innerHTML = "";
      var rs = reihe("Schicht");
      for (var s = 0; s < u.info.schichten; s++) {
        (function (s) {
          rs.appendChild(chip(String(s + 1), st.schicht === s, function () {
            st.schicht = s; laden(ZEICHNEN.DAUER);
          }));
        })(s);
      }
      steuer.appendChild(rs);
      var rk = reihe("Kopf");
      for (var h = 0; h < d.attention.length; h++) {
        (function (h) {
          rk.appendChild(chip(String(h + 1), kopf === h, function () {
            st.kopf = h; laden(ZEICHNEN.DAUER);
          }));
        })(h);
      }
      steuer.appendChild(rk);

      schalter.innerHTML = "";
      var aus = u.istKopfAus(d.schicht, kopf);
      schalter.appendChild(knopf(aus
        ? "Kopf " + (kopf + 1) + " wieder anschalten"
        : "Kopf " + (kopf + 1) + " stummschalten",
        aus ? "an" : "", function () {
          var i = -1;
          st.eingriffe.kopfAus.forEach(function (p, n) {
            if (p[0] === d.schicht && p[1] === kopf) { i = n; }
          });
          if (i >= 0) { st.eingriffe.kopfAus.splice(i, 1); }
          else { st.eingriffe.kopfAus.push([d.schicht, kopf]); }
          laden(560);
        }));
      var ausSchicht = st.eingriffe.schichtAus.indexOf(d.schicht) >= 0;
      schalter.appendChild(knopf(ausSchicht
        ? "Schicht " + (d.schicht + 1) + " wieder einschalten"
        : "ganze Schicht " + (d.schicht + 1) + " überspringen",
        ausSchicht ? "an" : "", function () {
          var i = st.eingriffe.schichtAus.indexOf(d.schicht);
          if (i >= 0) { st.eingriffe.schichtAus.splice(i, 1); }
          else { st.eingriffe.schichtAus.push(d.schicht); }
          laden(560);
        }));
    }

    laden(0);
  }

  function kachelKoepfe(b, u) {
    var GESAMT = u.info.schichten * u.info.koepfe;

    lead(u, "Alle " + GESAMT + " Köpfe auf einmal",
      "Ein Kopf ist eine eigenständige Leseweise desselben Satzes. Das Modell " +
      "liest nicht einmal, sondern " + u.info.koepfe + " Mal gleichzeitig — " +
      "und das in jeder der " + u.info.schichten + " Schichten. Für Ihren " +
      "Satz rechnet es also " + GESAMT + " solcher Leseweisen. Bisher zeigte " +
      "dieser Demonstrator immer eine davon. Eine von " + GESAMT + ". So " +
      "findet man den auffälligen Kopf nie — deshalb steht hier zuerst die " +
      "ganze Landkarte, und die Matrizen kommen danach.");

    anleitung(u, "So lesen Sie die Landkarte", [
      "<b>Ein Feld = ein Kopf.</b> " + u.info.schichten + " Zeilen " +
        "(Schichten, unten ist die erste) mal " + u.info.koepfe + " Spalten " +
        "(Köpfe) = " + GESAMT + " Felder. Hell heißt: bei dieser Kennzahl " +
        "hat der Kopf einen hohen Wert.",
      "<b>Die Kennzahl wählen Sie</b> — es sind fünf verschiedene Fragen an " +
        "denselben Durchlauf. Beim Umschalten bleiben die Felder stehen und " +
        "wechseln ihre Farbe: man sieht, welche Köpfe bei welcher Frage " +
        "auffallen.",
      "<b>Ein Feld anklicken</b> holt die echte Matrix dieses Kopfes nach " +
        "unten. Erst die Landkarte, dann gezielt hineinschauen — nicht " +
        "umgekehrt.",
      "Kein Mensch hat diese Arbeitsteilung vorgegeben. Sie hat sich im " +
        "Training ergeben, weil sie sich rechnet. Was die Landkarte zeigt, " +
        "ist also keine Konstruktion, sondern ein Fund."
    ]);

    var KENNZAHLEN = [
      { id: "rueckblick", name: "wie weit zurück",
        was: "Der mittlere Abstand, über den dieser Kopf Information holt — " +
             "in Positionen. Nahe 0: er bleibt bei sich. Große Werte: er " +
             "greift weit in den Satz zurück.",
        form: function (w) { return zahl(w, 2) + " Positionen"; } },
      { id: "entropie", name: "gezielt oder breit",
        was: "0 heißt: der Kopf schaut auf genau ein Wort. 1 heißt: er " +
             "verteilt gleichmäßig auf alles, was er sehen darf — er wählt " +
             "also gar nicht aus.",
        form: function (w) { return zahl(w, 3); } },
      { id: "selbst", name: "bleibt bei sich",
        was: "Wieviel ein Wort bei sich selbst behält, statt woanders zu " +
             "holen. Werte nahe 1 heißen: dieser Kopf reicht durch.",
        form: function (w) { return pz(w, 1); } },
      { id: "anfang", name: "parkt am Satzanfang",
        was: "Wieviel an die allererste Position geht. Hohe Werte sind ein " +
             "bekanntes Muster: Köpfe, die gerade nichts zu tun haben, legen " +
             "ihre Aufmerksamkeit dort ab, weil sie sie irgendwo hinlegen " +
             "müssen — die Zeile muss sich zu 100 % summieren.",
        form: function (w) { return pz(w, 1); } },
      { id: "vorher", name: "schaut aufs Wort davor",
        was: "Wieviel genau an das unmittelbar vorangehende Wort geht. Hohe " +
             "Werte kennzeichnen Köpfe, die die Wortfolge verfolgen.",
        form: function (w) { return pz(w, 1); } }
    ];

    var st = u.zustand;
    if (!st.kennzahl) { st.kennzahl = "rueckblick"; }

    var karteFeld = feld("Die Landkarte — jeder Kopf ein Feld");
    var wahlZiel = el("div");
    karteFeld.appendChild(wahlZiel);
    var wasZiel = hinweis("");
    karteFeld.appendChild(wasZiel);
    var karteZiel = el("div");
    karteFeld.appendChild(karteZiel);
    var karteBefund = befund("");
    karteFeld.appendChild(karteBefund);
    b.appendChild(karteFeld);

    var matrixFeld = feld("Der angeklickte Kopf, als echte Matrix");
    var matrixTitel = matrixFeld.querySelector("h4");
    matrixFeld.appendChild(stellenbeschriftung());
    var matrixStellen = el("div");
    matrixFeld.appendChild(matrixStellen);
    var matrixZiel = el("div");
    matrixFeld.appendChild(matrixZiel);
    var matrixBefund = befund("");
    matrixFeld.appendChild(matrixBefund);
    var matrixSchalter = el("div", "reihe");
    matrixFeld.appendChild(matrixSchalter);
    b.appendChild(matrixFeld);

    b.appendChild(satzMitVerweisen(u, [
      "Dieselbe Matrix noch einmal, aber als eingefärbter Satz statt als " +
      "Gitter, finden Sie unter ",
      { zu: "attention", wort: "Aufmerksamkeit" },
      " — und als Linien zwischen den Wörtern unter ",
      { zu: "linien", wort: "Woher ein Wort seine Information holt" }, "."
    ]));

    // Die Landkarte wird nach dem Laden neu aufgebaut (das Zielelement wird
    // geleert). Beides — Rahmen UND Maler — muss deshalb aus einer Hand
    // kommen, sonst steht der Rahmen ohne Bild da.
    var karteRahmen = null, zeichneKarte = null, karteLeisteZiel = null;
    function karteBauen() {
      karteRahmen = ZEICHNEN.rahmen(karteZiel, {
        aussage: "",
        legende: [
          ["umrandet: der angeklickte Kopf", PALETTE.token("--wahl")],
          ["jedes Feld ist ein Kopf — " + u.info.schichten + " Schichten × " +
            u.info.koepfe + " Köpfe = " + GESAMT, null]
        ]
      });
      zeichneKarte = ZEICHNEN.landkarte(karteRahmen.wurzel, {
        zelle: 30, zeile: 19,
        xTitel: "Kopf 1 … " + u.info.koepfe + " innerhalb der Schicht →",
        yTitel: "Schicht 1 … " + u.info.schichten + " ↓"
      });
      // Die Farbleiste gehoert zur GEWAEHLTEN Kennzahl — sie traegt deren
      // Einheit und wird beim Umschalten neu beschriftet.
      karteLeisteZiel = el("div");
      karteRahmen.fuss.appendChild(karteLeisteZiel);
    }
    karteBauen();
    var matrixRahmen = ZEICHNEN.rahmen(matrixZiel, {
      aussage: "",
      legende: [["dunkelgraue Fläche oben rechts: liegt in der Zukunft und " +
        "darf nicht gesehen werden", PALETTE.zeichner("maskiert")]]
    });
    var zeichneMatrix = ZEICHNEN.hitzefeld(matrixRahmen.wurzel, {
      breite: 620, max: 34,
      yTitel: "Zeile: dieses Wort wird verarbeitet ↓",
      xTitel: "Spalte: auf dieses Wort wird geschaut  —  gleiche Reihenfolge wie links →"
    });
    ZEICHNEN.farbleiste(matrixRahmen.fuss, {
      links: "0 %", rechts: "100 %",
      was: "Anteil, den das Wort der Zeile beim Wort der Spalte holt."
    });
    var daten = null;

    function kennzahlZu(id) {
      var t = KENNZAHLEN[0];
      KENNZAHLEN.forEach(function (k) { if (k.id === id) { t = k; } });
      return t;
    }

    function karteZeichnen(dauer) {
      if (!daten) { return; }
      var kz = kennzahlZu(st.kennzahl);
      wasZiel.textContent = kz.was;

      wahlZiel.innerHTML = "";
      wahlZiel.appendChild(wahlreihe("Kennzahl", KENNZAHLEN.map(function (k) {
        return { id: k.id, name: k.name };
      }), st.kennzahl, function (id) {
        st.kennzahl = id; karteZeichnen(ZEICHNEN.DAUER);
      }));

      // Die Farbskala der Landkarte liegt auf dem 2.- bis 98.-Perzentil
      // (sonst druecken Ausreisser alle 447 uebrigen Felder auf eine Farbe).
      // Die Leiste muss GENAU diese Grenzen tragen, sonst legt sie eine
      // andere Skala nahe als das Bild darueber zeigt.
      var flach = [];
      daten.felder[kz.id].forEach(function (z) {
        z.forEach(function (w) { flach.push(w); });
      });
      flach.sort(function (a, c) { return a - c; });
      function pQ(q) {
        return flach[Math.min(flach.length - 1,
          Math.max(0, Math.round(q * (flach.length - 1))))];
      }
      karteLeisteZiel.innerHTML = "";
      ZEICHNEN.farbleiste(karteLeisteZiel, {
        links: kz.form(pQ(0.02)), rechts: kz.form(pQ(0.98)),
        was: "Farbe = „" + kz.name + "“. Die Skala liegt auf dem 2. bis " +
          "98. Perzentil aller " + GESAMT + " Köpfe, damit einzelne " +
          "Ausreißer nicht alle übrigen gleich dunkel erscheinen lassen."
      });

      zeichneKarte({
        werte: daten.felder[kz.id],
        auswahl: [st.schicht, st.kopf],
        legende: "hell = hoher Wert bei „" + kz.name + "“",
        form: kz.form,
        beiKlick: function (s, h) {
          st.schicht = s; st.kopf = h;
          karteZeichnen(260);
          matrixLaden(420);
        }
      }, dauer);

      var a = daten.auffaellig[kz.id];
      var eigen = daten.felder[kz.id][st.schicht][st.kopf];
      // Wieviele Koepfe liegen ueber der Haelfte des Hoechstwerts? Das
      // trennt "ein Kopf tut das" von "das tun viele".
      var viele = 0, summe = 0, n = 0;
      daten.felder[kz.id].forEach(function (z) {
        z.forEach(function (w) {
          summe += w; n += 1;
          if (w > a.wert * 0.5) { viele += 1; }
        });
      });
      // Die Landkarte hat keine Stelle im Satz — sie zeigt alle zugleich.
      // Hervorgehoben wird deshalb, was hier tatsaechlich gewaehlt ist:
      // die Kennzahl und der angeklickte Kopf.
      bezugSetzen(karteRahmen, u, daten.token, -1,
        "Kennzahl <span class='stelle'>" + kz.name + "</span> · alle " +
        GESAMT + " Köpfe · angeklickt <span class='stelle'>Schicht " +
        (st.schicht + 1) + " · Kopf " + (st.kopf + 1) + "</span>");
      // DIE AUSSAGE: ist das eine Eigenschaft weniger Koepfe oder vieler?
      karteRahmen.setzeAussage(
        "Bei „" + kz.name + "“ sticht <b>Schicht " + (a.schicht + 1) +
        ", Kopf " + (a.kopf + 1) + "</b> heraus (" + kz.form(a.wert) + "). " +
        (viele <= GESAMT * 0.1
          ? "Nur <b>" + viele + " von " + GESAMT + "</b> Köpfen kommen auch " +
            "nur in die Nähe — <b>das ist die Sache weniger Spezialisten.</b>"
          : "<b>" + viele + " von " + GESAMT + "</b> Köpfen liegen in " +
            "derselben Größenordnung — <b>das tun viele, nicht einer.</b>"));
      karteBefund.setzen(
        "Am stärksten ist hier <b>Schicht " + (a.schicht + 1) + ", Kopf " +
        (a.kopf + 1) + "</b> mit <span class='zahl'>" + kz.form(a.wert) +
        "</span>. Im Mittel über alle " + GESAMT + " Köpfe sind es " +
        "<span class='zahl'>" + kz.form(summe / n) + "</span>; " +
        "<span class='zahl'>" + viele + "</span> Köpfe liegen über der " +
        "Hälfte des Höchstwerts. Angeklickt ist gerade Schicht " +
        (st.schicht + 1) + ", Kopf " + (st.kopf + 1) + " mit " +
        "<span class='zahl'>" + kz.form(eigen) + "</span>.");
    }

    function matrixLaden(dauer) {
      u.senden("/api/durchlauf", {
        text: st.satz, schicht: st.schicht, position: st.position,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        var kopf = Math.min(st.kopf, d.attention.length - 1);
        var A = d.attention[kopf];
        var T = d.token.ids.length;
        var pos = d.position;
        matrixTitel.textContent = "Schicht " + (d.schicht + 1) + " · Kopf " +
          (kopf + 1) + " — die echte Matrix, " + T + " × " + T;
        matrixStellen.innerHTML = "";
        matrixStellen.appendChild(stellenreihe(u, d.token, function () {
          matrixLaden(360);
        }));
        zeichneMatrix({ matrix: A, labels: d.token.stuecke, zeile: pos,
                        auswahl: [pos, pos],
                        beiKlick: function (i) {
                          st.position = i; matrixLaden(360);
                        } }, dauer);

        // Was macht dieser Kopf an der gewaehlten Stelle?
        var zeile = A[pos];
        var gross = 0, wo = 0;
        for (var i = 0; i <= pos; i++) { if (zeile[i] > gross) { gross = zeile[i]; wo = i; } }
        bezugSetzen(matrixRahmen, u, d.token, pos,
          "Schicht " + (d.schicht + 1) + " · Kopf " + (kopf + 1));
        matrixRahmen.setzeAussage(
          "Das ist der angeklickte Kopf im Original: Schicht " +
          (d.schicht + 1) + ", Kopf " + (kopf + 1) + ", " + T + " × " + T +
          " Werte. An der gewählten Stelle " +
          JSON.stringify(sichtbar(d.token.stuecke[pos])) +
          " holt er am meisten von <b>" +
          JSON.stringify(sichtbar(d.token.stuecke[wo])) + "</b> (" +
          pz(gross, 1) + ") — <b>ein Feld der Landkarte oben, aufgeklappt.</b>");
        matrixBefund.setzen(
          "Bei " + JSON.stringify(sichtbar(d.token.stuecke[pos])) +
          " holt dieser Kopf am meisten von " +
          "<b>" + JSON.stringify(sichtbar(d.token.stuecke[wo])) + "</b> " +
          "(<span class='zahl'>" + pz(gross, 1) + "</span>" +
          (wo === pos ? ", also von sich selbst" : ", " + (pos - wo) +
           " Positionen zurück") + ").");

        matrixSchalter.innerHTML = "";
        var aus = u.istKopfAus(d.schicht, kopf);
        matrixSchalter.appendChild(knopf(aus
          ? "Kopf " + (kopf + 1) + " wieder anschalten"
          : "diesen Kopf stummschalten und sehen, was fehlt",
          aus ? "an" : "", function () {
            u.kopfSchalten(d.schicht, kopf);
          }));
      });
    }

    karteZiel.appendChild(laedt("die Landkarte über alle " + GESAMT +
      " Köpfe wird gerechnet"));
    u.senden("/api/landkarte", { text: st.satz, eingriffe: st.eingriffe },
      function (d) {
        karteZiel.innerHTML = "";
        if (d.leer) {
          karteZiel.appendChild(hinweis("Kein Text eingegeben."));
          return;
        }
        karteBauen();
        daten = d;
        karteZeichnen(0);
        matrixLaden(0);
      });
  }

  function kachelLinien(b, u) {
    lead(u, "Woher ein Wort seine Information holt",
      "Beim Verarbeiten eines Wortes schaut das Modell auf die Wörter davor " +
      "und nimmt sich von jedem etwas mit — von manchen viel, von den meisten " +
      "fast nichts. Wieviel, das steht in den Linien.");

    anleitung(u, "So lesen Sie das Bild",
     ["Ihr Satz steht zweimal da: <b>links</b> das Wort, das gerade verarbeitet " +
       "wird, <b>rechts</b> alle Wörter, auf die es dabei schauen darf.",
     "Eine <b>Linie</b> heißt: das linke Wort holt sich Information vom " +
       "rechten. Je dicker und heller, desto mehr.",
     "Nach rechts oben gibt es nie Linien — kein Wort darf sehen, was nach " +
       "ihm kommt. Sonst wäre die Vorhersage geschummelt.",
     "Ein Wort <b>links anklicken</b> zeigt nur dessen Linien. „Alle Wörter“ " +
       "zeigt wieder das ganze Geflecht.",
     "Die <b>Farbe</b> ist der Kopf. Ein Kopf ist ein Blickwinkel: einer " +
       "achtet auf das direkte Vorgängerwort, ein anderer auf den Satzanfang."
     ]);

    // Reihenfolge nach dem Blickverlauf: erst wählen, dann sehen, dann die
    // Wirkung, dann eingreifen. Der Regler gehört unter das Bild, das er
    // verändert — nicht darüber.
    var steuer = el("div");
    var stellenFeld = el("div");
    stellenFeld.appendChild(stellenbeschriftung());
    var stellenZiel = el("div");
    stellenFeld.appendChild(stellenZiel);
    var erklaerung = el("div", "klartext");
    var buehne = el("div", "linien-buehne");
    var wirkung = feld("Was das Modell daraufhin sagt");
    var vertZiel = el("div");
    wirkung.appendChild(vertZiel);
    var vertNote = hinweis("");
    wirkung.appendChild(vertNote);
    var linienBefund = befund("");
    wirkung.appendChild(linienBefund);
    var reglerFeld = el("div");

    b.appendChild(steuer);
    b.appendChild(stellenFeld);
    b.appendChild(erklaerung);
    b.appendChild(buehne);
    b.appendChild(wirkung);
    b.appendChild(reglerFeld);

    /** Dasselbe wie die Linien, nur in Worten. Wer das Bild nicht sofort
     *  liest, liest den Satz — und versteht danach das Bild. */
    function satzErklaerung(d) {
      erklaerung.innerHTML = "";
      var t = st.linienAlle ? -1 : d.position;
      if (t < 0) {
        erklaerung.appendChild(el("p", null,
          "Alle Wörter auf einmal. Klicken Sie links ein Wort an, dann wird " +
          "es übersichtlich — und hier steht in Worten, was zu sehen ist."));
        return;
      }
      var kopf = st.koepfeAn.length ? st.koepfeAn[0] : 0;
      if (kopf >= d.attention.length) { kopf = 0; }
      var zeile = d.attention[kopf][t];
      var paare = [];
      for (var j = 0; j <= t; j++) { paare.push({ j: j, w: zeile[j] }); }
      paare.sort(function (a, c) { return c.w - a.w; });
      var oben = paare.slice(0, 3).filter(function (p) { return p.w > 0.02; });

      var s = el("p");
      s.innerHTML = "Beim Verarbeiten von <b>" +
        JSON.stringify(d.token.stuecke[t]) + "</b> holt sich Kopf " +
        (kopf + 1) + " der Schicht " + (st.schicht + 1) + " " +
        oben.map(function (p) {
          return "<b>" + pz(p.w, 0) + "</b> von " +
            JSON.stringify(d.token.stuecke[p.j]) +
            (p.j === t ? " (von sich selbst)" : "");
        }).join(", ") + ".";
      erklaerung.appendChild(s);
      if (st.koepfeAn.length > 1) {
        erklaerung.appendChild(el("p", "klein",
          "Angezeigt sind " + st.koepfeAn.length + " Köpfe; der Satz oben " +
          "beschreibt den ersten davon."));
      }
    }

    var zeichnen = null, aktualisieren = null;
    var st = u.zustand;
    if (!st.koepfeAn) { st.koepfeAn = [0]; }
    // Vorbelegt ist EIN Wort, nicht alle: fünfzehn mal fünfzehn Linien auf
    // einmal sind unlesbar. Das ganze Geflecht gibt es auf Knopfdruck.
    // WELCHES Wort, steht nicht mehr hier, sondern in der gemeinsamen
    // Stellenwahl der Seite (`zustand.position`); hier bleibt nur der
    // Schalter „alle Wörter zugleich“.
    if (st.linienAlle === undefined) { st.linienAlle = false; }

    // Derselbe Balken-Baustein wie in allen uebrigen Kacheln, nicht der
    // eigene aus linien.js: eine Verbesserung am gemeinsamen Baustein
    // (hier: Achsentitel) soll ueberall zugleich ankommen.
    var vertRahmen = ZEICHNEN.rahmen(vertZiel, { aussage: "" });
    var setzeVerteilung = ZEICHNEN.balken(vertRahmen.wurzel, {
      breite: 560, namen: 160,
      yTitel: "mögliches nächstes Stück ↓",
      xTitel: "Wahrscheinlichkeit"
    });
    balkenlegende(vertRahmen, "Wahrscheinlichkeit für das nächste Stück.");
    var buehneRahmen = ZEICHNEN.rahmen(buehne, {
      aussage: "",
      legende: [
        ["links: das Wort, das gerade verarbeitet wird", null],
        ["rechts: die Wörter, bei denen es holen darf", null],
        ["Dicke und Helligkeit einer Linie = wieviel geholt wird", PALETTE.token("--marke-text")],
        ["Farbe = welcher Kopf", PALETTE.token("--wahl")]
      ]
    });

    function laden(dauer) {
      u.senden("/api/durchlauf", {
        text: st.satz, schicht: st.schicht, position: st.position,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        stellenZiel.innerHTML = "";
        stellenZiel.appendChild(stellenreihe(u, d.token, function () {
          st.linienAlle = false; laden(420);
        }));
        var daten = {
          stuecke: d.token.stuecke,
          ids: d.token.ids,
          attention: d.attention,
          koepfeAn: st.koepfeAn.filter(function (h) { return h < d.attention.length; }),
          gewaehlt: st.linienAlle ? -1 : d.position
        };
        satzErklaerung(d);
        if (!zeichnen) {
          aktualisieren = LINIEN.bauen(buehneRahmen.wurzel, daten, function (i) {
            // Ein Klick ins Bild waehlt dieselbe Stelle wie die Reihe oben.
            if (i < 0) { st.linienAlle = true; }
            else { st.linienAlle = false; st.position = i; }
            laden(420);
          });
          zeichnen = true;
        } else {
          aktualisieren(daten, dauer);
        }
        setzeVerteilung(d.beste.slice(0, 8), dauer);
        (function () {
          var wo = "Schicht " + (st.schicht + 1) + " · " +
            (st.koepfeAn.length === 1 ? "Kopf " + (st.koepfeAn[0] + 1)
              : st.koepfeAn.length + " Köpfe") +
            (st.linienAlle ? " · alle Wörter zugleich" : "");
          bezugSetzen(buehneRahmen, u, d.token,
                      st.linienAlle ? -1 : d.position, wo);
          bezugSetzen(vertRahmen, u, d.token, d.position, wo);
        })();
        vertRahmen.setzeAussage(
          "Mit diesen Linien sagt das Modell <b>" +
          JSON.stringify(sichtbar(d.beste[0].text)) + "</b> (" +
          pz(d.beste[0].p, 1) + ").");

        // Der Befund: wieviel von der Aufmerksamkeit dieses einen Kopfes
        // geht ueberhaupt woanders hin als auf das Wort selbst? Genau das
        // unterscheidet einen Kopf, der Zusammenhang herstellt, von einem,
        // der nur durchreicht.
        (function () {
          var kopf = st.koepfeAn.length ? st.koepfeAn[0] : 0;
          if (kopf >= d.attention.length) { kopf = 0; }
          var t = d.position;
          var zeile = d.attention[kopf][t];
          var selbst = zeile[t];
          var woanders = 1 - selbst;
          var groesster = 0, wo = 0;
          for (var i = 0; i < t; i++) {
            if (zeile[i] > groesster) { groesster = zeile[i]; wo = i; }
          }
          buehneRahmen.setzeAussage(
            "Kopf " + (kopf + 1) + " der Schicht " + (st.schicht + 1) +
            ": beim Wort " +
            JSON.stringify(sichtbar(d.token.stuecke[t])) + " gehen <b>" +
            pz(selbst, 0) + "</b> an das Wort selbst und <b>" +
            pz(woanders, 0) + "</b> an frühere Wörter" +
            (t > 0 ? " — die dickste Linie führt zu <b>" +
              JSON.stringify(sichtbar(d.token.stuecke[wo])) + "</b> (" +
              pz(groesster, 0) + ")." : ".") +
            " <b>Nach rechts oben gibt es nie eine Linie.</b>");
          linienBefund.setzen(
            "Beim Verarbeiten von <b>" +
            JSON.stringify(sichtbar(d.token.stuecke[t])) + "</b> behält " +
            "Kopf " + (kopf + 1) + " der Schicht " + (st.schicht + 1) + " " +
            "<span class='zahl'>" + pz(selbst, 1) + "</span> bei sich selbst " +
            "und holt <span class='zahl'>" + pz(woanders, 1) + "</span> bei " +
            "anderen Wörtern" +
            (t > 0 ? " — am meisten bei <b>" +
             JSON.stringify(sichtbar(d.token.stuecke[wo])) + "</b> (" +
             pz(groesster, 1) + ")." : ".") +
            " Kein einzelner Kopf entscheidet die Vorhersage: es sind " +
            (u.info.schichten * u.info.koepfe) + " Köpfe, deren Ergebnisse " +
            "zusammengelegt werden. Wieviel dieser eine ausmacht, sehen Sie " +
            "am Regler unten.");
        })();
        var skalen = st.eingriffe.kopfSkala.filter(function (p) {
          return p[0] === st.schicht;
        });
        vertNote.textContent = skalen.length
          ? "Beitrag verstellt: " + skalen.map(function (p) {
              return "Kopf " + (p[1] + 1) + " × " + zahl(p[2], 2);
            }).join(" · ") + " — die Balken oben sind die Antwort des veränderten Modells."
          : "Modell unverändert.";
        steuerZeichnen(d.attention.length);
      });
    }

    function steuerZeichnen(nKoepfe) {
      steuer.innerHTML = "";
      var rs = reihe("Schicht");
      for (var s = 0; s < u.info.schichten; s++) {
        (function (s) {
          rs.appendChild(chip(String(s + 1), st.schicht === s, function () {
            st.schicht = s; laden(620);
          }));
        })(s);
      }
      steuer.appendChild(rs);

      var rk = reihe("Köpfe");
      for (var h = 0; h < nKoepfe; h++) {
        (function (h) {
          var an = st.koepfeAn.indexOf(h) >= 0;
          var c = chip(String(h + 1), an, function () {
            var i = st.koepfeAn.indexOf(h);
            if (i >= 0) { st.koepfeAn.splice(i, 1); } else { st.koepfeAn.push(h); }
            laden(620);
          });
          c.style.borderColor = LINIEN.kopffarbe(h, nKoepfe);
          if (an) { c.style.background = LINIEN.kopffarbe(h, nKoepfe);
            c.style.color = PALETTE.schriftAuf(1); }
          rk.appendChild(c);
        })(h);
      }
      rk.appendChild(knopf("alle", "", function () {
        st.koepfeAn = [];
        for (var h = 0; h < nKoepfe; h++) { st.koepfeAn.push(h); }
        laden(620);
      }));
      rk.appendChild(knopf("nur einer", "", function () {
        st.koepfeAn = [0]; laden(620);
      }));
      steuer.appendChild(rk);

      var rw = reihe("Zeigen");
      rw.appendChild(knopf(st.linienAlle
        ? "◆ alle Wörter (jetzt)" : "alle Wörter auf einmal",
        st.linienAlle ? "an" : "", function () {
          st.linienAlle = !st.linienAlle; laden(420);
        }));
      rw.appendChild(el("span", "beschriftung",
        st.linienAlle
          ? "zurzeit alle — oben oder links ein Wort anklicken"
          : "zurzeit nur die gewählte Stelle — oben ein anderes Stück anklicken"));
      steuer.appendChild(rw);

      // Beitrag der gewaehlten Koepfe stufenlos verstellen
      reglerFeld.innerHTML = "";
      var f = feld("Beitrag eines Kopfes verstellen");
      f.appendChild(hinweis("0 heißt: dieser Kopf trägt nichts bei. 1 ist der " +
        "trainierte Zustand. Über 1 wird er gegenüber den anderen verstärkt. " +
        "Die Balken unten laufen auf ihren neuen Wert — so sieht man, welchen " +
        "Anteil dieser eine Kopf an der Vorhersage hat."));
      st.koepfeAn.slice(0, 6).forEach(function (h) {
        var wert = 1;
        st.eingriffe.kopfSkala.forEach(function (p) {
          if (p[0] === st.schicht && p[1] === h) { wert = p[2]; }
        });
        f.appendChild(regler("Kopf " + (h + 1), 0, 2, 0.05, wert, function (v) {
          var gefunden = false;
          st.eingriffe.kopfSkala.forEach(function (p) {
            if (p[0] === st.schicht && p[1] === h) { p[2] = v; gefunden = true; }
          });
          if (!gefunden) { st.eingriffe.kopfSkala.push([st.schicht, h, v]); }
          laden(520);
        }));
      });
      f.appendChild(knopf("Beiträge zurücksetzen", "", function () {
        st.eingriffe.kopfSkala = []; laden(520);
      }));
      reglerFeld.appendChild(f);
    }

    laden(0);
  }

  function kachelSchluss(b, u) {
    lead(u, "Welchen Schluss das Modell nach jeder Schicht zieht",
      "Der Trick: den Zustand nach jeder einzelnen Schicht so behandeln, als " +
      "wäre er schon der letzte, und ihn durch die Ausgabeprojektion schicken. " +
      "Dann sieht man, WANN im Modell die Antwort entsteht — meist nicht am " +
      "Anfang und nicht gleichmäßig, sondern in einem Sprung.");

    anleitung(u, "So lesen Sie die Kurve", [
      "<b>Von links nach rechts läuft das Modell durch.</b> Ganz links der " +
        "Zustand vor der ersten Schicht, ganz rechts nach der letzten. Die " +
        "Höhe ist, wie sicher sich das Modell an dieser Stufe war.",
      "<b>Grün markiert und beschriftet sind nur die Stellen, an denen die " +
        "Antwort wechselt.</b> Dort wird tatsächlich etwas entschieden — " +
        "dazwischen wird eine bereits gefallene Entscheidung nur bestätigt.",
      "Der Trick dahinter: man nimmt den unfertigen Zustand nach einer " +
        "Schicht und behandelt ihn, als wäre er schon fertig. Das ist " +
        "zulässig, aber es ist eine <b>Näherung</b> — in den mittleren " +
        "Schichten kommt dabei oft Unsinn heraus.",
      "Ganz links steht das Wort <b>sich selbst</b>: ohne jede Schicht kann " +
        "der Zustand nur wiedergeben, welches Stück dort steht.",
      "Dieselbe Rechnung für ALLE Stellen des Satzes zugleich — und in einer " +
        "Form, die auch die mittleren Schichten lesbar macht — steht in der " +
        "Kachel „Der ganze Satz auf einen Blick“."
    ]);

    var f = feld("Sicherheit der besten Antwort, Stufe für Stufe");
    f.appendChild(stellenbeschriftung(
      "Für welche Stelle des Satzes? (anklicken — die Kurve rechnet neu)"));
    var stellenZiel = el("div");
    f.appendChild(stellenZiel);
    var kurveZiel = el("div");
    f.appendChild(kurveZiel);
    f.appendChild(hinweis("Die Kurve zeigt, wie sicher sich das Modell nach " +
      "jeder Stufe ist. Beschriftet und dick markiert sind nur die Stellen, " +
      "an denen die Antwort WECHSELT — dort wird tatsächlich etwas " +
      "entschieden. Dazwischen wird nur bestätigt."));
    f.appendChild(hinweis("Zwei Dinge sind ehrlich dazuzusagen. Erstens: ganz " +
      "links steht das Wort sich selbst — ohne jede Schicht kann der Zustand " +
      "nur wiedergeben, welches Stück dort steht. Zweitens: in den mittleren " +
      "Schichten kommt oft Unsinn heraus, gern in fremden Schriftzeichen. " +
      "Das ist kein Fehler der Anzeige. Die Zwischenzustände sind nicht dafür " +
      "gemacht, gelesen zu werden — sie sind Arbeitsmaterial. Erst gegen Ende " +
      "richtet sich der Zustand auf die Ausgabe aus, und genau das sieht man " +
      "an der Kurve."));
    b.appendChild(f);

    var sBefund = befund("");
    f.appendChild(sBefund);

    var t = feld("Alle Stufen im Einzelnen");
    var tabZiel = el("div");
    t.appendChild(tabZiel);
    b.appendChild(t);

    var kurveRahmen = ZEICHNEN.rahmen(kurveZiel, {
      aussage: "",
      legende: [
        ["Sicherheit der jeweils besten Fortsetzung", PALETTE.token("--marke-text"), "linie"],
        ["dicker Punkt mit Wort: hier WECHSELT die beste Antwort", PALETTE.token("--gruen")],
        ["ganz links „Tabelle“: der Zustand vor der ersten Schicht", null]
      ]
    });
    var zeichneKurve = ZEICHNEN.stufenkurve(kurveRahmen.wurzel, {
      breite: 1080, hoehe: 300,
      yTitel: "Sicherheit der besten Antwort",
      xTitel: "Stufe im Modell  —  von der Tabelle (links) bis zur letzten Schicht (rechts)"
    });
    var st = u.zustand;

    function laden(dauer) {
      u.senden("/api/durchlauf", {
        text: st.satz, schicht: st.schicht, position: st.position,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        stellenZiel.innerHTML = "";
        stellenZiel.appendChild(stellenreihe(u, d.token, function () {
          laden(360);
        }));
        var vorher = null;
        var stufen = d.lens.map(function (r) {
          var wechsel = vorher !== null && vorher !== r.beste[0].id;
          vorher = r.beste[0].id;
          return { p: r.beste[0].p, text: r.beste[0].text, wechsel: wechsel,
                   stufe: r.stufe };
        });
        zeichneKurve(stufen, dauer);

        // Der Befund: WANN entsteht die Antwort? Die Kurve zeigt es, aber
        // sie sagt es nicht.
        var wechsel = stufen.filter(function (x) { return x.wechsel; });
        var letzterWechsel = 0, ersterWechsel = -1;
        stufen.forEach(function (x, i) {
          if (x.wechsel) {
            letzterWechsel = i;
            if (ersterWechsel < 0) { ersterWechsel = i; }
          }
        });
        var endgueltig = stufen[stufen.length - 1];
        var steht = stufen.length - 1;
        for (var q = stufen.length - 1; q >= 0; q--) {
          if (stufen[q].text === endgueltig.text) { steht = q; } else { break; }
        }
        bezugSetzen(kurveRahmen, u, d.token, d.position);
        kurveRahmen.setzeAussage(
          "An der Stelle " +
          JSON.stringify(sichtbar(d.token.stuecke[d.position])) +
          ": die Antwort " + JSON.stringify(sichtbar(endgueltig.text)) +
          " steht ab <b>Stufe " + steht + " von " + (stufen.length - 1) +
          "</b> fest; die Kurve steigt danach nur noch von " +
          pz(stufen[steht].p, 0) + " auf <b>" + pz(endgueltig.p, 0) +
          "</b>. <b>Das Modell entscheidet in wenigen Schichten und " +
          "bestätigt danach</b> — die " + wechsel.length + " markierten " +
          "Punkte sind die Stellen, an denen wirklich etwas gewechselt hat.");
        sBefund.setzen(
          "Die endgültige Antwort " + JSON.stringify(sichtbar(endgueltig.text)) +
          " steht ab <b>Stufe " + steht + " von " + (stufen.length - 1) +
          "</b> fest und ändert sich danach nicht mehr — die letzten " +
          "<span class='zahl'>" + (stufen.length - 1 - steht) + "</span> " +
          "Stufen machen sie nur noch sicherer (von <span class='zahl'>" +
          pz(stufen[steht].p, 1) + "</span> auf <span class='zahl'>" +
          pz(endgueltig.p, 1) + "</span>). Insgesamt wechselt die beste " +
          "Antwort <span class='zahl'>" + wechsel.length + "</span> Mal" +
          (ersterWechsel >= 0
            ? ", zum ersten Mal bei Stufe " + ersterWechsel + ", zum letzten " +
              "Mal bei Stufe " + letzterWechsel + "."
            : ", also gar nicht — sie steht von Anfang an fest.") +
          " Das Modell arbeitet nicht gleichmäßig: es entscheidet in wenigen " +
          "Schichten und bestätigt danach.");

        tabZiel.innerHTML = "";
        var tab = el("table", "tab");
        var kopf = el("tr");
        ["Stufe", "beste Fortsetzung", "sicher", "zweitbeste", "dritte"]
          .forEach(function (x) { kopf.appendChild(el("th", null, x)); });
        tab.appendChild(kopf);
        d.lens.forEach(function (r, i) {
          var z = el("tr");
          z.appendChild(el("td", null, r.stufe));
          var td = el("td", "mono", JSON.stringify(sichtbar(r.beste[0].text)));
          if (stufen[i].wechsel) {
            td.style.color = PALETTE.token("--gruen"); td.style.fontWeight = "700";
            td.title = "hier ändert sich die Antwort";
          }
          z.appendChild(td);
          z.appendChild(el("td", "zahl", pz(r.beste[0].p)));
          z.appendChild(el("td", "mono", JSON.stringify(sichtbar(r.beste[1].text))));
          z.appendChild(el("td", "mono", JSON.stringify(sichtbar(r.beste[2].text))));
          tab.appendChild(z);
        });
        tabZiel.appendChild(tab);
      });
    }

    laden(0);
  }

  function kachelGitter(b, u) {
    var S_ = u.info.schichten;

    lead(u, "Wann die Antwort entsteht — für jede Stelle des Satzes",
      "Das Modell rechnet " + S_ + " Schichten. Die Antwort steht aber nicht " +
      "erst am Ende da, und sie entsteht auch nicht gleichmäßig: an manchen " +
      "Stellen des Satzes steht sie nach wenigen Schichten fest, an anderen " +
      "wird bis zuletzt gerechnet. Dieses Gitter zeigt für JEDE Stelle Ihres " +
      "Satzes zugleich, wann sich die endgültige Antwort durchgesetzt hat.");

    anleitung(u, "So lesen Sie das Gitter", [
      "<b>Eine Spalte = eine Stelle im Satz.</b> Oben steht das Wort, " +
        "darunter in Klammern das Stück, das das Modell dort am Ende als " +
        "Fortsetzung wählt. <b>Eine Zeile = eine Stufe</b>, unten die letzte.",
      "<b>In der Zelle steht, wie sicher sich das Modell an dieser Stufe " +
        "schon über genau dieses Endergebnis war.</b> Unten steht deshalb " +
        "immer der volle Endwert; nach oben hin wird es dunkler. Wo die " +
        "Helligkeit früh einsetzt, stand die Antwort früh fest.",
      "Das ist bewusst <b>nicht</b> „welches Wort käme an dieser Stufe " +
        "heraus“. Diese Frage lässt sich zwar stellen (dritte Ansicht), " +
        "liefert für Zwischenschichten aber Unlesbares — Zwischenzustände " +
        "sind Arbeitsmaterial und nicht dafür gemacht, gelesen zu werden. " +
        "Die Sicherheit über das Endergebnis ist an jeder Stufe sinnvoll.",
      "Die <b>erste Spalte</b> ist immer die schwächste: das erste Wort hat " +
        "nichts, worauf es zurückschauen könnte.",
      "Nehmen Sie unten Schichten weg — die Felder blenden in ihre neue " +
        "Farbe über, und man sieht, welche Sicherheit von welcher Schicht kam."
    ]);

    var ANSICHTEN = [
      { id: "rang", name: "auf welchem Platz die Endantwort stand",
        was: "In der Zelle steht, den wievielten Platz das spätere Ergebnis " +
             "an dieser Stufe unter allen " + tausend(u.info.vokabular) +
             " Stücken belegte. „1.“ heißt: es führte hier bereits. Ab " +
             "Platz 1 000 steht nur noch die Größenordnung (10³ = einige " +
             "Tausend, 10⁵ = weit abgeschlagen) — auf die genaue Zahl kommt " +
             "es dort nicht mehr an." },
      { id: "sicher", name: "wie sicher sich das Modell schon war",
        was: "In der Zelle steht, welche Wahrscheinlichkeit das Modell an " +
             "dieser Stufe bereits dem Stück gab, das am Ende gewinnt. Unten " +
             "steht der Endwert. Diese Ansicht ist begrifflich die " +
             "einfachste, zeigt aber in den unteren zwei Dritteln fast nur " +
             "Nullen — die Wahrscheinlichkeit steigt erst ganz zum Schluss." },
      { id: "stueck", name: "welches Stück hier herauskäme",
        was: "Die ehrliche, aber schwer lesbare Ansicht: das an dieser Stufe " +
             "wahrscheinlichste Stück. In den mittleren Schichten steht hier " +
             "regelmäßig Unsinn, gern in fremden Schriftzeichen. Das ist kein " +
             "Fehler der Anzeige — die Zwischenzustände sind nicht dafür " +
             "gemacht, als Text gelesen zu werden." }
    ];

    var st = u.zustand;
    if (!st.gitterSicht) { st.gitterSicht = "rang"; }

    var f = feld("Stufe für Stufe, Stelle für Stelle");
    var wahlZiel = el("div");
    f.appendChild(wahlZiel);
    var wasZiel = hinweis("");
    f.appendChild(wasZiel);
    f.appendChild(stellenbeschriftung(
      "Welche Spalte? (anklicken — die Spalte wird im Gitter markiert)"));
    var stellenZiel = el("div");
    f.appendChild(stellenZiel);
    var ziel = el("div");
    var meldung = laedt("das Gitter wird gerechnet");
    f.appendChild(meldung);
    f.appendChild(ziel);
    var gBefund = befund("");
    f.appendChild(gBefund);
    var schalter = el("div", "reihe");
    f.appendChild(schalter);
    b.appendChild(f);

    b.appendChild(satzMitVerweisen(u, [
      "Dieselbe Rechnung nur für die gewählte Stelle, dafür als Kurve über " +
      "die Stufen, steht in ",
      { zu: "schluss", wort: "Schluss nach jeder Schicht" },
      ". Was das Modell dort antwortet, steht in ",
      { zu: "vorhersage", wort: "Was als Nächstes kommt" },
      " — die gewählte Stelle bleibt dabei erhalten."
    ]));

    var gitterRahmen = ZEICHNEN.rahmen(ziel, {
      aussage: "",
      legende: [["obere Kopfzeile: das Wort im Satz · darunter „→“ die " +
        "Fortsetzung, die an dieser Stelle am Ende gewählt wird", null]]
    });
    var zeichneGitter = ZEICHNEN.gitter(gitterRahmen.wurzel, {
      links: 190,
      yTitel: "Stufe im Modell  —  oben die Tabelle, unten die letzte Schicht ↓",
      xTitel: "Stelle im Satz →"
    });
    var gitterLeisteZiel = el("div");
    gitterRahmen.fuss.appendChild(gitterLeisteZiel);
    var daten = null;

    function ansichtZu(id) {
      var t = ANSICHTEN[0];
      ANSICHTEN.forEach(function (a) { if (a.id === id) { t = a; } });
      return t;
    }

    function zeichnen(dauer) {
      if (!daten) { return; }
      var d = daten;
      var sicht = ansichtZu(st.gitterSicht);
      wasZiel.innerHTML = sicht.was;

      wahlZiel.innerHTML = "";
      wahlZiel.appendChild(wahlreihe("Was in den Zellen steht",
        ANSICHTEN.map(function (a) { return { id: a.id, name: a.name }; }),
        st.gitterSicht, function (id) {
          st.gitterSicht = id; zeichnen(ZEICHNEN.DAUER);
        }));

      var zellen;
      if (st.gitterSicht === "sicher") {
        zellen = d.zeilen.map(function (r) {
          return r.ziel_p.map(function (x) {
            return { p: x, text: (x * 100).toFixed(x < 0.1 ? 1 : 0)
                                   .replace(".", ",") + "%" };
          });
        });
      } else if (st.gitterSicht === "rang") {
        var HOCH = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
        zellen = d.zeilen.map(function (r) {
          return r.ziel_rang.map(function (n) {
            // Farbe logarithmisch: der Unterschied zwischen Platz 1 und 10
            // ist bedeutsam, der zwischen 5 000 und 6 000 nicht. Der
            // schlechteste mögliche Platz (Vokabulargröße) wird ganz dunkel.
            var farbe = 1 - Math.min(1, Math.log10(n) /
              Math.log10(u.info.vokabular));
            // Ab 1 000 nur noch die Größenordnung: eine sechsstellige Zahl
            // in einer 60 Pixel breiten Zelle sagt niemandem etwas, und auf
            // die genaue Stelle kommt es dort auch nicht an.
            var text;
            if (n < 1000) { text = n + "."; }
            else { text = "10" + HOCH[Math.min(9, Math.round(Math.log10(n)))]; }
            return { p: farbe, text: text };
          });
        });
      } else {
        zellen = d.zeilen.map(function (r) {
          return r.zellen.map(function (c) {
            return { p: c.p, text: sichtbar(c.text) };
          });
        });
      }

      stellenZiel.innerHTML = "";
      stellenZiel.appendChild(stellenreihe(u, d.token, function () {
        zeichnen(360);
      }));

      zeichneGitter({
        zeilen: d.zeilen.map(function (r) { return r.stufe; }),
        spalten: d.token.stuecke,
        spalten2: st.gitterSicht === "stueck" ? null
          : d.ziel.map(function (z) { return "→" + sichtbar(z.text); }),
        zellen: zellen,
        spalte: stelle(u, d.token.stuecke.length)
      }, dauer);

      // Die Farbleiste traegt die Einheit der GEWAEHLTEN Ansicht — beim
      // Rang laeuft sie logarithmisch und andersherum als bei den beiden
      // Wahrscheinlichkeits-Ansichten.
      gitterLeisteZiel.innerHTML = "";
      ZEICHNEN.farbleiste(gitterLeisteZiel,
        st.gitterSicht === "rang"
          ? { links: "abgeschlagen (Platz " + tausend(u.info.vokabular) + ")",
              rechts: "Platz 1", mitte: "Platz 1 000",
              was: "Farbe = Platz des späteren Ergebnisses an dieser Stufe, " +
                "logarithmisch: der Unterschied zwischen Platz 1 und 10 ist " +
                "bedeutsam, der zwischen 5 000 und 6 000 nicht." }
          : st.gitterSicht === "sicher"
          ? { links: "0 %", rechts: "100 %",
              was: "Farbe = Wahrscheinlichkeit, die das Modell an dieser " +
                "Stufe bereits dem Stück gab, das am Ende gewinnt." }
          : { links: "0 %", rechts: "100 %",
              was: "Farbe = Wahrscheinlichkeit des an dieser Stufe " +
                "wahrscheinlichsten Stücks." });

      befundSetzen(d);
    }

    function befundSetzen(d) {
      var T = d.token.stuecke.length, S = d.zeilen.length;
      // Ab welcher Stufe steht das Endergebnis ununterbrochen auf Platz 1?
      var abStufe = [];
      for (var t = 0; t < T; t++) {
        var ab = S - 1;
        for (var q = S - 1; q >= 0; q--) {
          if (d.zeilen[q].ziel_rang[t] === 1) { ab = q; } else { break; }
        }
        abStufe.push(ab);
      }
      var frueheste = 0, spaeteste = 0;
      abStufe.forEach(function (x, t) {
        if (x < abStufe[frueheste]) { frueheste = t; }
        if (x > abStufe[spaeteste]) { spaeteste = t; }
      });
      var letzte = T - 1;
      var sprung = 0, sprungHoehe = 0;
      for (var q2 = 1; q2 < S; q2++) {
        var zu = d.zeilen[q2].ziel_p[letzte] - d.zeilen[q2 - 1].ziel_p[letzte];
        if (zu > sprungHoehe) { sprungHoehe = zu; sprung = q2; }
      }
      var gew = stelle(u, T);
      bezugSetzen(gitterRahmen, u, d.token, gew,
        "Ansicht „" + ansichtZu(st.gitterSicht).name + "“");
      gitterRahmen.setzeAussage(
        "<b>Nicht jede Stelle des Satzes ist gleich schwer.</b> Am frühesten " +
        "steht das Ergebnis bei " +
        JSON.stringify(sichtbar(d.token.stuecke[frueheste])) + " fest (ab " +
        "Stufe " + abStufe[frueheste] + " von " + (S - 1) + "), am spätesten " +
        "bei " + JSON.stringify(sichtbar(d.token.stuecke[spaeteste])) +
        " (ab Stufe " + abStufe[spaeteste] + "). <b>Markiert ist gerade " +
        JSON.stringify(sichtbar(d.token.stuecke[gew])) + "</b> — dort steht " +
        "das Ergebnis " + JSON.stringify(sichtbar(d.ziel[gew].text)) +
        " ab Stufe " + abStufe[gew] + " fest.");
      gBefund.setzen(
        "Für Ihren Satz lautet die Antwort <b>" +
        JSON.stringify(sichtbar(d.ziel[letzte].text)) + "</b> mit " +
        "<span class='zahl'>" + pz(d.ziel[letzte].p, 1) + "</span>. Sie " +
        "setzt sich in <b>Schicht " + sprung + "</b> durch — dort steigt " +
        "ihre Wahrscheinlichkeit auf einen Schlag um <span class='zahl'>" +
        pz(sprungHoehe, 1) + "</span>, mehr als in jeder anderen Schicht. " +
        "Ab Stufe <span class='zahl'>" + abStufe[letzte] + "</span> von " +
        (S - 1) + " führt sie ununterbrochen. " +
        "Am frühesten steht das Ergebnis bei <b>" +
        JSON.stringify(sichtbar(d.token.stuecke[frueheste])) +
        "</b> fest (ab Stufe " + abStufe[frueheste] + "), am spätesten bei <b>" +
        JSON.stringify(sichtbar(d.token.stuecke[spaeteste])) +
        "</b> (ab Stufe " + abStufe[spaeteste] + "). Wo eine Stelle früh " +
        "feststeht, war sie aus dem Vorangehenden bereits erzwungen; wo sie " +
        "lange offen bleibt, wird tatsächlich gerechnet.");
    }

    function laden(dauer) {
      u.senden("/api/lens", { text: st.satz, eingriffe: st.eingriffe },
        function (d) {
          if (meldung.parentNode) { meldung.parentNode.removeChild(meldung); }
          if (d.leer) { return; }
          daten = d;
          zeichnen(dauer);
          knoepfe();
        });
    }

    function knoepfe() {
      schalter.innerHTML = "";
      [6, 12].forEach(function (n) {
        var liste = [];
        for (var s = u.info.schichten - n; s < u.info.schichten; s++) { liste.push(s); }
        var aktiv = liste.every(function (s) {
          return st.eingriffe.schichtAus.indexOf(s) >= 0;
        });
        schalter.appendChild(knopf("die letzten " + n + " Schichten weg",
          aktiv ? "an" : "", function () {
            if (aktiv) {
              st.eingriffe.schichtAus = st.eingriffe.schichtAus.filter(function (s) {
                return liste.indexOf(s) < 0;
              });
            } else {
              liste.forEach(function (s) {
                if (st.eingriffe.schichtAus.indexOf(s) < 0) {
                  st.eingriffe.schichtAus.push(s);
                }
              });
            }
            laden(700);
          }));
      });
      schalter.appendChild(knopf("zurücknehmen", "", function () {
        st.eingriffe.schichtAus = []; laden(700);
      }));
    }

    laden(0);
  }

  function dimensionsfeldBauen(b, u) {
    var st = u.zustand;
    var f = feld("Alle " + u.info.d + " Zahlen — ohne Zusammendrücken");
    f.appendChild(hinweis("Der Raum oben zeigt drei Richtungen. Das ist " +
      "ehrlich beschriftet, lässt aber offen, was in den übrigen " +
      (u.info.d - 3) + " Achsen steckt. Hier ist es: <b>eine Zeile je Stufe " +
      "im Modell, eine Spalte je Zahl des Zustands</b> — " + u.info.d +
      " Spalten nebeneinander, jede einzelne davon ein Bildpunkt breit. " +
      "Nichts ist ausgewählt, nichts projiziert."));
    var wortZiel = el("div");
    f.appendChild(wortZiel);
    var ordnungZiel = el("div");
    f.appendChild(ordnungZiel);
    var bildZiel = el("div");
    f.appendChild(bildZiel);
    var fuss = el("div", "dimfeld-fuss");
    f.appendChild(fuss);
    var dimBefund = befund("");
    f.appendChild(dimBefund);
    b.appendChild(f);

    var deutFeld = feld("Was eine einzelne Zahl bedeutet");
    deutFeld.appendChild(hinweis("Klicken Sie oben in das Feld — dann wird " +
      "die angeklickte Spalte hier gedeutet. Gefragt wird: welche Stücke des " +
      "Vokabulars haben in genau dieser Zahl den größten und den kleinsten " +
      "Wert? Das ist der einzige ehrliche Weg, einer einzelnen Dimension " +
      "einen Sinn zuzuschreiben — und oft ist kein Sinn zu erkennen. " +
      "Auch das ist eine Auskunft: die Bedeutung liegt nicht in einzelnen " +
      "Zahlen, sondern in ihrem Zusammenspiel."));
    var deutZiel = el("div");
    deutFeld.appendChild(deutZiel);
    b.appendChild(deutFeld);

    var zeigen = el("span", null, "");
    fuss.appendChild(zeigen);

    // Bei sortierten Spalten ist die Bildspalte NICHT die Dimensionsnummer.
    // Ohne Rueckabbildung wuerde ein Klick die falsche Dimension deuten —
    // und der Demonstrator zeigte eine Zahl, die zu etwas anderem gehoert.
    var aktuelleReihenfolge = null;
    function echteDimension(spalte) {
      return aktuelleReihenfolge ? aktuelleReihenfolge[spalte] : spalte;
    }

    var malen = null;
    var dimRahmen = null;
    function malerBauen() {
      dimRahmen = ZEICHNEN.rahmen(bildZiel, {
        aussage: "",
        legende: [["senkrechte Marke: rechts davon beginnen die " +
          "schwachen Zahlen", PALETTE.token("--wahl")]]
      });
      ZEICHNEN.farbleiste(dimRahmen.fuss, {
        skala: "zweiseitig",
        // Die Grenzen der Leiste sind die ECHTEN Grenzen des Bildes: bei
        // z = ±3 ist die Farbe voll ausgefaerbt, alles darueber liegt auf
        // demselben Ton. Ohne diese Angabe legt die Leiste eine offene
        // Skala nahe, die es nicht gibt.
        links: "z = −3 und darunter: auffällig klein",
        mitte: "z = 0 — unauffällig",
        rechts: "z = +3 und darüber: auffällig groß",
        was: "Verglichen wird innerhalb jeder Stufe (z-Wert). Sonst würde " +
          "das Bild nur zeigen, dass der Zustand nach hinten länger wird — " +
          "das sagt die Kachel „Der Residualstrom“ bereits."
      });
      return ZEICHNEN.dimensionsfeld(dimRahmen.wurzel, {
        zeile: 11, links: 132,
        yTitel: "eine Zeile je Stufe im Modell — oben die Tabelle, unten die letzte Schicht ↓",
        xTitel: "die " + u.info.d + " Zahlen des Zustands, jede einen Bildpunkt breit →",
        beiZeigen: function (d, s, w) {
          zeigen.textContent = "Dimension " + echteDimension(d) +
            " · Stufe " + (s + 1) + " · z = " + zahl(w, 2) +
            (aktuelleReihenfolge ? "  (Spalte " + (d + 1) + " der Sortierung)" : "");
        },
        beiKlick: function (d) { deuten(echteDimension(d)); }
      });
    }

    function deuten(dim) {
      deutZiel.innerHTML = "";
      deutZiel.appendChild(laedt("Dimension " + dim + " wird im Vokabular gesucht"));
      u.senden("/api/dimension", { dim: dim, k: 10 }, function (d) {
        deutZiel.innerHTML = "";
        var k = el("p");
        k.innerHTML = "<b>Dimension " + d.dim + "</b> von " + u.info.d +
          " · Streuung über das ganze Vokabular: " + zahl(d.streuung, 4);
        deutZiel.appendChild(k);
        var karten = el("div", "karten");
        [["ganz oben in dieser Zahl", d.oben],
         ["ganz unten in dieser Zahl", d.unten]].forEach(function (paar) {
          var kk = el("div", "karte");
          kk.appendChild(el("h5", null, paar[0]));
          var liste = el("div");
          paar[1].forEach(function (x) {
            var z = el("div", "vzeile");
            z.appendChild(el("div", "wort", JSON.stringify(sichtbar(x.text))));
            z.appendChild(el("div", "wert", zahl(x.wert, 3)));
            liste.appendChild(z);
          });
          kk.appendChild(liste);
          karten.appendChild(kk);
        });
        deutZiel.appendChild(karten);
      });
    }

    var letzteDaten = null;
    if (!st.dimOrdnung) { st.dimOrdnung = "staerke"; }

    /** Die Spalten umsortieren.
     *
     *  In der Reihenfolge des Modells (0 … 2 047) sieht das Feld aus wie
     *  Rauschen — die Nummer einer Dimension bedeutet nichts, sie ist eine
     *  willkuerliche Platznummer. Sortiert man dagegen nach Staerke, wird
     *  die Aussage sichtbar, die sonst nur im Text steht: ganz links ein
     *  schmaler Block, der fast alles traegt, und rechts daneben zweitausend
     *  Zahlen, die kaum etwas beitragen. */
    function sortieren(d) {
      if (st.dimOrdnung === "modell") {
        return { z: d.z, reihenfolge: null };
      }
      var letzte = d.z[d.z.length - 1];
      var idx = letzte.map(function (w, i) { return i; });
      if (st.dimOrdnung === "staerke") {
        // Nach der Staerke ueber ALLE Stufen, nicht nur ueber die letzte.
        // Sortiert man nach einer einzigen Zeile, ist auch nur diese eine
        // Zeile geordnet und das Bild bleibt als Ganzes Rauschen.
        var mittel = letzte.map(function (_, i) {
          var s2 = 0;
          for (var q = 0; q < d.z.length; q++) { s2 += Math.abs(d.z[q][i]); }
          return s2 / d.z.length;
        });
        idx.sort(function (a, b2) { return mittel[b2] - mittel[a]; });
      } else {                                   // "wandel"
        var weg = letzte.map(function (_, i) {
          var s2 = 0;
          for (var q = 1; q < d.z.length; q++) {
            s2 += Math.abs(d.z[q][i] - d.z[q - 1][i]);
          }
          return s2;
        });
        idx.sort(function (a, b2) { return weg[b2] - weg[a]; });
      }
      return {
        z: d.z.map(function (zeile) {
          return idx.map(function (i) { return zeile[i]; });
        }),
        reihenfolge: idx
      };
    }

    function ordnungZeichnen(dauer) {
      ordnungZiel.innerHTML = "";
      ordnungZiel.appendChild(wahlreihe("Spalten ordnen nach", [
        { id: "staerke", name: "Stärke am Ende" },
        { id: "wandel", name: "wieviel sie sich bewegt haben" },
        { id: "modell", name: "Nummer im Modell (0 … " + (u.info.d - 1) + ")" }
      ], st.dimOrdnung, function (id) {
        st.dimOrdnung = id;
        if (letzteDaten) { zeichnen(letzteDaten, ZEICHNEN.DAUER); }
      }));
      ordnungZiel.appendChild(hinweis(
        st.dimOrdnung === "modell"
          ? "Die Nummer einer Dimension bedeutet nichts — sie ist eine " +
            "willkürliche Platznummer. In dieser Reihenfolge sieht das Feld " +
            "deshalb aus wie Rauschen. <b>Genau das ist der Befund:</b> die " +
            "Bedeutung liegt nicht in der Anordnung."
          : st.dimOrdnung === "staerke"
          ? "Sortiert nach dem Betrag in der letzten Stufe. Links stehen die " +
            "Zahlen, die am Ende tragen — und man sieht auf einen Blick, wie " +
            "<b>schmal</b> dieser Block ist."
          : "Sortiert danach, wieviel sich eine Zahl über die " +
            "Stufen hinweg insgesamt bewegt hat. Links stehen die Zahlen, an " +
            "denen im Modell tatsächlich gearbeitet wird."));
    }

    function zeichnen(d, dauer) {
      var sortiert = sortieren(d);
      aktuelleReihenfolge = sortiert.reihenfolge;
      ordnungZeichnen(dauer);
      // Bei sortierten Spalten steht links das stärkste Prozent. Genau dort
      // wird eine Marke gesetzt — damit die Konzentrationsaussage im BILD
      // steht und nicht nur im Text darunter.
      var eins = Math.max(1, Math.round(d.d / 100));
      // Die x-Achse bedeutet je nach Sortierung etwas ANDERES.
      malen.setzeXTitel(
        st.dimOrdnung === "modell"
          ? "die " + d.d + " Zahlen in der Reihenfolge des Modells (0 … " +
            (d.d - 1) + ") →"
          : st.dimOrdnung === "staerke"
          ? "die " + d.d + " Zahlen, nach Stärke geordnet — links die " +
            "stärksten →"
          : "die " + d.d + " Zahlen, nach Bewegung über die Stufen geordnet " +
            "— links die bewegtesten →");
      malen({
        z: sortiert.z, stufen: d.stufen,
        marke: sortiert.reihenfolge ? eins : -1,
        markeText: sortiert.reihenfolge
          ? "links davon: 1 % der Zahlen — sie tragen " + pz(d.konzentration, 0)
          : null
      }, dauer);
    }

    function laden(dauer) {
      u.senden("/api/dimensionen",
        { text: st.satz, position: st.position === undefined ? -1 : st.position,
          eingriffe: st.eingriffe },
        function (d) {
          if (d.leer) { return; }
          letzteDaten = d;

          wortZiel.innerHTML = "";
          wortZiel.appendChild(stellenbeschriftung(
            "Zustand welches Wortes? (anklicken — das ganze Feld rechnet neu)"));
          wortZiel.appendChild(stellenreihe(u, d.token, function () {
            laden(ZEICHNEN.DAUER);
          }));

          zeichnen(d, dauer);

          var g = d.groesste[0], w = d.bewegteste[0];
          bezugSetzen(dimRahmen, u, d.token, d.position,
            "Spalten geordnet nach " +
            (st.dimOrdnung === "modell" ? "der Nummer im Modell"
              : st.dimOrdnung === "staerke" ? "Stärke" : "Bewegung"));
          dimRahmen.setzeAussage(
            "Das ist der Zustand von " +
            JSON.stringify(sichtbar(d.token.stuecke[d.position])) +
            " ohne jedes Zusammendrücken: <b>" +
            tausend(d.z.length * d.d) + "</b> Werte. <b>Das stärkste Prozent " +
            "der Zahlen trägt " + pz(d.konzentration, 0) + " der gesamten " +
            "Größe</b> — der Zustand nutzt seine " + d.d + " Zahlen also " +
            "sehr ungleich." +
            (st.dimOrdnung === "modell"
              ? " In der Reihenfolge des Modells sieht das aus wie Rauschen: " +
                "<b>die Nummer einer Dimension bedeutet nichts.</b>"
              : ""));
          dimBefund.setzen(
            "Gezeichnet sind <span class='zahl'>" + tausend(d.z.length * d.d) +
            "</span> Werte — " + d.z.length + " Stufen × " + d.d + " Zahlen — " +
            "für das Wort " +
            JSON.stringify(sichtbar(d.token.stuecke[d.position])) + ". " +
            "Der Zustand ist <b>nicht gleichmäßig verteilt</b>: das stärkste " +
            "Prozent der Zahlen trägt <span class='zahl'>" +
            pz(d.konzentration, 1) + "</span> der gesamten Größe. Am " +
            "auffälligsten ist am Ende <b>Dimension " + g.dim + "</b> " +
            "(z = <span class='zahl'>" + zahl(g.z, 1) + "</span>), am " +
            "meisten bewegt hat sich über die Stufen hinweg <b>Dimension " +
            w.dim + "</b>. Klicken Sie eine Spalte an — dann wird sie unten " +
            "im Vokabular nachgeschlagen.");
          if (!deutZiel.childNodes.length) { deuten(g.dim); }
        });
    }

    bildZiel.appendChild(laedt("alle " + tausend(29 * u.info.d) +
      " Werte werden geholt"));
    setTimeout(function () {
      bildZiel.innerHTML = "";
      malen = malerBauen();
      laden(0);
    }, 0);
  }

  function kachelRaum(b, u) {
    lead(u, "Der Bedeutungsraum, zum Drehen",
      "Jedes der " + tausend(u.info.vokabular) + " Stücke ist ein Vektor aus " +
      u.info.d + " Zahlen. Ein Raum mit " + u.info.d + " Achsen lässt sich " +
      "nicht zeigen — deshalb werden die drei Richtungen gesucht, in denen " +
      "die Vektoren am stärksten auseinanderliegen, und nur die werden " +
      "gezeichnet. Drehen mit der linken Maustaste, zoomen mit dem Rad, " +
      "verschieben mit der rechten.");

    anleitung(u, "Was Sie sehen", [
      "<b>Blau</b>: die Stücke Ihres Satzes. Von ihnen läuft eine Linie zum " +
        "Nullpunkt — sie sind Vektoren, nicht bloß Punkte.",
      "<b>Grün</b>: die nächsten Nachbarn dieser Stücke im Bedeutungsraum.",
      "<b>Grau</b>: eine Stichprobe häufiger Stücke als Hintergrund, damit " +
        "man sieht, wo im Raum man sich befindet.",
      "Die drei Achsen sind <b>keine</b> Bedeutungen wie „männlich“ oder " +
        "„Fahrzeug“. Es sind die Richtungen größter Streuung — mehr steckt " +
        "nicht dahinter.",
      "Ein Punkt <b>anklicken</b> zeigt seine Nachbarn als Liste."
    ]);

    var raumFeld = feld("Der Raum");
    // Auch das 3D-Bild bekommt Aussage und Legende AM Bild. Die Farben
    // standen bisher nur in der zugeklappten Leseanleitung — dort sucht sie
    // niemand, waehrend er ins Bild schaut.
    var raumRahmen = ZEICHNEN.rahmen(raumFeld, {
      aussage: "",
      legende: [
        ["die Stücke Ihres Satzes (mit Linie zum Nullpunkt)", PALETTE.token("--marke-text")],
        ["ihre nächsten Nachbarn im Bedeutungsraum", PALETTE.token("--gruen")],
        ["Stichprobe häufiger Stücke als Hintergrund", PALETTE.token("--text-muted")],
        ["die drei Achsen sind die Richtungen größter Streuung — " +
          "KEINE Bedeutungen", null]
      ]
    });
    // Die Achsenbeschriftung des Raums: welche Achse welche Farbe hat und
    // wieviel Streuung sie einfaengt. Die Zahlen kommen aus derselben
    // Antwort und werden unten eingesetzt.
    var raumAchsen = el("div", "achsenzeile");
    raumRahmen.wurzel.appendChild(raumAchsen);
    raumRahmen.wurzel.appendChild(stellenbeschriftung(
      "Welche Stelle des Satzes? (anklicken — der Punkt wird im Raum " +
      "markiert und unten aufgeschlüsselt)"));
    var raumStellen = el("div");
    raumRahmen.wurzel.appendChild(raumStellen);
    var filterZiel = el("div");
    raumRahmen.wurzel.appendChild(filterZiel);
    var buehne = el("div", "raum-buehne");
    raumRahmen.wurzel.appendChild(buehne);
    var steuerReihe = el("div", "reihe");
    raumFeld.appendChild(steuerReihe);
    var reglerZiel = el("div");
    raumFeld.appendChild(reglerZiel);
    var streuung = hinweis("");
    raumFeld.appendChild(streuung);
    b.appendChild(raumFeld);

    var auswahlFeld = feld("Angeklicktes Stück");
    var auswahlZiel = el("div");
    auswahlFeld.appendChild(auswahlZiel);
    auswahlZiel.appendChild(hinweis("Klicken Sie einen Punkt im Raum an."));
    b.appendChild(auswahlFeld);

    // ── Und jetzt ohne Zusammendrücken ───────────────────────────────────
    // Der Raum oben zeigt drei Richtungen und faengt damit rund 5 % ein.
    // Das ist eine ehrliche Aussage, aber sie laesst den Betrachter mit der
    // Frage zurueck, was in den uebrigen 2 045 Achsen steckt. Hier steht es:
    // jede Zahl, jede Stufe, nichts weggelassen.
    dimensionsfeldBauen(b, u);

    var st = u.zustand;
    var raum = null;
    // Namen der Nachbarn sind AUS voreingestellt: mit ihnen stehen bei 529
    // Punkten ueber hundert Schilder im Bild und verdecken einander. Wer
    // sie braucht, schaltet sie zu — oder filtert vorher auf die
    // Nachbarschaft eines Stuecks, dann sind es acht.
    var zeigeNachbarNamen = false, zeigeAchsen = true;
    var nachbarMaler = null;

    if (!window.RAUM3D) {
      buehne.appendChild(el("div", "warnung",
        "Die 3D-Darstellung konnte nicht geladen werden. Sie braucht WebGL " +
        "und den lokalen Server (nicht als Datei geöffnet)."));
      return;
    }

    function auswahl(p) {
      auswahlZiel.innerHTML = "";
      var k = el("p");
      k.innerHTML = "<b>" + JSON.stringify(sichtbar(p.text)) + "</b>  ·  " +
        "Token-ID " + p.id + "  ·  Länge des Vektors " + zahl(p.laenge, 2);
      auswahlZiel.appendChild(k);
      var ziel = el("div");
      auswahlZiel.appendChild(ziel);
      var nRahmen = ZEICHNEN.rahmen(ziel, { aussage: "" });
      nachbarMaler = ZEICHNEN.balken(nRahmen.wurzel, {
        breite: 520, namen: 190,
        yTitel: "nächste Nachbarn im Bedeutungsraum ↓",
        xTitel: "Ähnlichkeit der Richtung (Kosinus)"
      });
      balkenlegende(nRahmen, "Kosinus zwischen den beiden Vektoren: " +
        "1 = dieselbe Richtung, 0 = unabhängig.");
      u.senden("/api/nachbarn", { token_id: p.id, k: 12 }, function (n) {
        nachbarMaler(n.map(function (x) {
          return { id: x.id, text: x.text, p: x.kosinus };
        }), 420);
        if (n.length) {
          // Dieses Bild haengt NICHT am Satz, sondern am angeklickten Punkt
          // — auch das gehoert klar dagestanden.
          nRahmen.setzeBezug(
            "<span class='was'>rechnet auf</span> " +
            "<span class='stelle'>" + sichtbar(p.text) + "</span> " +
            "<span class='rest'>(im Raum angeklickt, Token-ID " + p.id +
            ") — nicht auf dem Satz</span>");
          nRahmen.setzeAussage(
            "Der nächste Nachbar von " + JSON.stringify(sichtbar(p.text)) +
            " ist <b>" + JSON.stringify(sichtbar(n[0].text)) + "</b> (" +
            zahl(n[0].kosinus, 3) + "). <b>Diese Nähe hat niemand " +
            "eingetragen</b> — sie ist im Training entstanden.");
        }
      });
    }

    // ── Was gezeigt wird ─────────────────────────────────────────────────
    // Vierhundert Punkte auf einmal sind eine Wolke, kein Bild. Deshalb
    // laesst sich die Menge einschraenken — vor allem auf die Nachbarschaft
    // EINES Wortes, denn genau das ist die Frage, die man an diesen Raum
    // stellt: „was liegt bei DIESEM Stueck?“
    var SICHTEN = [
      { id: "alles", name: "alles",
        was: "Ihr Satz, alle Nachbarn und der Hintergrund." },
      { id: "satz_nachbarn", name: "Satz + alle Nachbarn",
        was: "Ohne den grauen Hintergrund — nur, was mit Ihrem Satz zu tun " +
             "hat." },
      { id: "nur_nachbarn", name: "nur Nachbarn des gewählten Stücks",
        was: "Das gewählte Stück und ausschließlich SEINE nächsten " +
             "Nachbarn — wieviele, sagt der Regler „Nachbarn je Stück“. " +
             "Alles andere ist ausgeblendet, und die Ansicht zieht auf " +
             "diese Gruppe nach." },
      { id: "nur_satz", name: "nur Ihr Satz",
        was: "Nur die Stücke Ihres Satzes — so sieht man, wie weit sie im " +
             "Raum auseinanderliegen." }
    ];
    if (!st.raumSicht) { st.raumSicht = "alles"; }
    if (st.raumNachbarn === undefined) { st.raumNachbarn = 8; }
    if (st.raumHintergrund === undefined) { st.raumHintergrund = 400; }
    if (st.raumSchrift === undefined) { st.raumSchrift = 1; }

    // EINMAL rechnen, danach nur noch filtern.
    //
    // Der Raum wird beim Öffnen mit dem VOLLEN Vorrat geholt (VORRAT_NACHBARN
    // Nachbarn je Stück, VORRAT_HINTERGRUND Hintergrundpunkte). Jedes
    // Bedienelement des Viewers schneidet daraus nur noch aus — kein Regler
    // fragt den Server. Das kostet beim Laden fast nichts: die teure Arbeit
    // ist die Nachbarsuche (eine Matrixmultiplikation gegen alle 151.936
    // Vektoren je Stück), und die hängt nicht an der Anzahl der Nachbarn.
    //
    // Zwei Dinge werden dadurch gleichzeitig besser: das Verstellen ist
    // sofort, und die drei Achsen bleiben stehen. Vorher wurden sie bei
    // jeder Änderung neu bestimmt, und alle Punkte sprangen.
    var VORRAT_NACHBARN = 20, VORRAT_HINTERGRUND = 800;

    var rohdaten = null, satzToken = null;

    function sichtZu(id) {
      var t = SICHTEN[0];
      SICHTEN.forEach(function (s) { if (s.id === id) { t = s; } });
      return t;
    }

    /** Die Punktmenge nach der gewaehlten Sicht — die Lagen bleiben, wie sie
     *  der Server gerechnet hat. Es wird NICHT neu projiziert: sonst
     *  spraengen die Punkte beim Filtern an andere Stellen, und man haette
     *  ein anderes Bild statt eines Ausschnitts. */
    function gefiltert() {
      if (!rohdaten) { return null; }
      var pos = satzToken ? stelle(u, satzToken.ids.length) : 0;
      var wortId = satzToken ? satzToken.ids[pos] : -1;
      var sicht = st.raumSicht;
      var k = st.raumNachbarn;

      // Welche Nachbarn zaehlen bei der eingestellten Anzahl noch? Der
      // Server hat sie nach Naehe geordnet geliefert; hier wird nur
      // abgeschnitten.
      var erlaubt = {};
      var eigene = {};
      (rohdaten.satz_ids || []).forEach(function (id) {
        var liste = (rohdaten.nachbarn || {})[id] || [];
        liste.slice(0, k).forEach(function (n) {
          erlaubt[n] = true;
          if (id === wortId) { eigene[n] = true; }
        });
      });

      var hintergrundZaehler = 0;
      var punkte = rohdaten.punkte.filter(function (p) {
        if (p.gruppe === "satz") {
          return sicht !== "nur_nachbarn" || p.id === wortId;
        }
        if (p.gruppe === "hintergrund") {
          if (sicht !== "alles") { return false; }
          // Die Hintergrundpunkte sind gleichmaessig aus dem Vokabular
          // gezogen; die ersten N sind deshalb eine ebenso gleichmaessige
          // Stichprobe wie eine neu gezogene.
          hintergrundZaehler += 1;
          return hintergrundZaehler <= st.raumHintergrund;
        }
        // Nachbar
        if (sicht === "nur_satz") { return false; }
        if (sicht === "nur_nachbarn") { return !!eigene[p.id]; }
        return !!erlaubt[p.id];
      });

      var kopie = {};
      Object.keys(rohdaten).forEach(function (k2) { kopie[k2] = rohdaten[k2]; });
      kopie.punkte = punkte;
      return kopie;
    }

    /** Die Kamera bleibt, wo der Anwender sie hingedreht hat.
     *
     *  Sie wird NUR beim ersten Aufbau eingepasst und danach ausschliesslich
     *  auf Knopfdruck. Jede automatische Bewegung — beim Wechsel der Stelle,
     *  beim Umschalten des Filters, beim Verstellen eines Reglers — nimmt
     *  einem den Blickwinkel und die Zoomstufe weg, die man sich gerade
     *  eingestellt hat. Wer die gezeigten Punkte formatfuellend will,
     *  drueckt „Ansicht einpassen“.
     */
    function raumZeichnen(einpassen) {
      var sicht = gefiltert();
      if (!sicht || !raum) { return; }
      raum.setzen(sicht, { nachbarNamen: zeigeNachbarNamen,
                           schrift: st.raumSchrift });
      raum.achsenZeigen(zeigeAchsen);
      if (einpassen) { raum.einpassen(); }
      stelleZeigen(sicht);
      steuerZeichnen(sicht);
    }

    function tokenStelle(id) {
      var p = -1;
      (satzToken ? satzToken.ids : []).forEach(function (x, i) {
        if (x === id && p < 0) { p = i; }
      });
      return p < 0 ? u.zustand.position : p;
    }

    /** Die gewaehlte Stelle markieren und die Zahlen dazu schreiben. */
    function stelleZeigen(sicht) {
      if (!satzToken || !rohdaten) { return; }
      var pos = stelle(u, satzToken.ids.length);
      raumStellen.innerHTML = "";
      raumStellen.appendChild(stellenreihe(u, satzToken, function () {
        raumZeichnen();
      }));
      var p = raum.markieren(satzToken.ids[pos]);
      var mehrfach = satzToken.ids.filter(function (x) {
        return x === satzToken.ids[pos];
      }).length > 1;
      var summe = rohdaten.erklaerte_streuung.reduce(
        function (a, x) { return a + x; }, 0);
      bezugSetzen(raumRahmen, u, satzToken, pos,
        sicht.punkte.length + " von " + rohdaten.punkte.length +
        " Punkten sichtbar · Sicht „" + sichtZu(st.raumSicht).name + "“ · " +
        rohdaten.dimensionen + " Achsen auf 3 zusammengedrückt");
      raumRahmen.setzeAussage(
        (st.raumSicht === "nur_nachbarn"
          ? "Gezeigt sind <b>" + (sicht.punkte.length - 1) + " Nachbarn</b> " +
            "von " + JSON.stringify(sichtbar(satzToken.stuecke[pos])) +
            " und das Stück selbst (in der Auswahlfarbe). "
          : "Gezeichnet sind " + sicht.punkte.length + " Stücke. ") +
        "<b>Diese drei Achsen fangen zusammen nur " + pz(summe) +
        " der tatsächlichen Streuung ein</b> — alles Übrige steckt in den " +
        "anderen " + (rohdaten.dimensionen - 3) + " Achsen und ist hier " +
        "nicht zu sehen. <b>Was nebeneinander liegt, ist sich wirklich " +
        "ähnlich; was weit auseinanderliegt, muss es nicht sein.</b>" +
        (mehrfach ? " Das gewählte Stück kommt im Satz mehrfach vor und hat " +
          "im Raum nur EINEN Punkt." : ""));
      if (p) { auswahl(p); }
    }

    function filterZeichnen() {
      filterZiel.innerHTML = "";
      filterZiel.appendChild(wahlreihe("Zeigen", SICHTEN.map(function (s) {
        return { id: s.id, name: s.name };
      }), st.raumSicht, function (id) {
        st.raumSicht = id; filterZeichnen(); raumZeichnen();
      }));
      filterZiel.appendChild(hinweis(sichtZu(st.raumSicht).was));
    }

    function steuerZeichnen(sicht) {
      steuerReihe.innerHTML = "";
      steuerReihe.appendChild(knopf("Ansicht einpassen", "", function () {
        raum.einpassen();
      }));
      steuerReihe.appendChild(knopf("Ansicht zurücksetzen", "", function () {
        raum.ausrichten();
      }));
      steuerReihe.appendChild(knopf("Namen der Nachbarn",
        zeigeNachbarNamen ? "an" : "", function () {
          zeigeNachbarNamen = !zeigeNachbarNamen;
          raumZeichnen();
        }));
      steuerReihe.appendChild(knopf("Achsen und Gitter",
        zeigeAchsen ? "an" : "", function () {
          zeigeAchsen = !zeigeAchsen;
          raumZeichnen();
        }));

      reglerZiel.innerHTML = "";
      var r = el("div", "reihe");
      // Alle drei Regler schneiden nur aus dem bereits geholten Vorrat aus
      // — keiner fragt den Server. Deshalb wirken sie sofort.
      r.appendChild(regler("Schriftgröße", 0.5, 2, 0.1, st.raumSchrift,
        function (v) { st.raumSchrift = v; raumZeichnen(); }));
      r.appendChild(regler("Nachbarn je Stück", 1, VORRAT_NACHBARN, 1,
        st.raumNachbarn,
        function (v) { st.raumNachbarn = Math.round(v); raumZeichnen(); }));
      r.appendChild(regler("Hintergrundpunkte", 0, VORRAT_HINTERGRUND, 50,
        st.raumHintergrund,
        function (v) { st.raumHintergrund = Math.round(v); raumZeichnen(); }));
      reglerZiel.appendChild(r);
      reglerZiel.appendChild(hinweis("Der Raum wird <b>einmal</b> gerechnet " +
        "— beim Öffnen und wenn Sie den Satz oben ändern. Alle Regler und " +
        "Filter schneiden danach nur noch aus dem Geholten aus und wirken " +
        "sofort. <b>Die drei Achsen bleiben dabei stehen</b>, so dass die " +
        "Punkte liegen bleiben und ein Filter wirklich ein Ausschnitt ist " +
        "und kein neues Bild. <b>Auch Blickwinkel und Zoomstufe bleiben, wo " +
        "Sie sie haben</b> — bewegt wird die Kamera nur von Ihnen oder per " +
        "„Ansicht einpassen“."));
    }

    function laden() {
      buehne.innerHTML = "";
      buehne.appendChild(laedt("der Raum wird gerechnet — einmal, danach " +
        "wirken alle Regler sofort"));
      u.senden("/api/raum", {
        text: st.satz, nachbarn_je: VORRAT_NACHBARN,
        hintergrund: VORRAT_HINTERGRUND
      }, function (d) {
        buehne.innerHTML = "";
        if (d.leer) { buehne.appendChild(hinweis("Kein Text.")); return; }
        rohdaten = d;
        raum = window.RAUM3D.bauen(buehne, function (p) {
          // Ein Klick IM Raum waehlt dieselbe Stelle wie die Reihe darueber,
          // sofern der Punkt zum Satz gehoert.
          if (d.satz_ids.indexOf(p.id) >= 0) {
            u.zustand.position = tokenStelle(p.id);
            raumZeichnen();
          } else {
            auswahl(p);
          }
        });

        var summe = d.erklaerte_streuung.reduce(function (a, x) { return a + x; }, 0);
        // Die drei Farben sind DIESELBEN, mit denen raum3d.js die Achsen
        // zeichnet — sie kommen deshalb aus derselben Quelle. Als feste
        // Werte standen hier #c81164 · #55a730 · #01aeed; das letzte hat
        // auf weissem Grund 2,54:1 und war dort nicht mehr zu lesen.
        raumAchsen.innerHTML =
          "Achsen: <span style='color:var(--magenta)'>waagerecht</span> " +
          pz(d.erklaerte_streuung[0]) +
          " · <span style='color:var(--gruen)'>senkrecht</span> " +
          pz(d.erklaerte_streuung[1]) +
          " · <span style='color:var(--marke-text)'>in die Tiefe</span> " +
          pz(d.erklaerte_streuung[2]) +
          " der Streuung — keine Achse bedeutet etwas";
        streuung.innerHTML = "Die drei Achsen fangen zusammen <b>" +
          pz(summe) + "</b> der tatsächlichen Streuung ein. Das ungekürzte " +
          "Feld aller " + d.dimensionen + " Zahlen steht weiter unten auf " +
          "dieser Seite.";

        // Griff für den Prüfer: er muss sehen können, ob die Kamera bei
        // einer neuen Auswahl stehen bleibt.
        window.__raum = raum;

        filterZeichnen();
        // einzige Stelle, an der die Kamera von selbst einpasst
        if (satzToken) { raumZeichnen(true); return; }
        u.senden("/api/tokens", { text: st.satz }, function (tk) {
          satzToken = tk;
          raumZeichnen(true);
        });
      });
    }

    laden();
  }

  function kachelBedeutung(b, u) {
    lead(u, "Nachbarn im Bedeutungsraum",
      "Jedes der " + tausend(u.info.vokabular) + " Stücke hat einen Vektor aus " +
      u.info.d + " Zahlen. Stücke, die in ähnlichen Zusammenhängen vorkommen, " +
      "landen im Training nahe beieinander — niemand hat das eingetragen. " +
      "Wählen Sie ein Wort Ihres Satzes.");

    anleitung(u, "Was Nähe hier heißt — und was nicht", [
      "Gemessen wird der <b>Kosinus</b> zwischen zwei Vektoren: 1 wäre " +
        "dieselbe Richtung, 0 wäre unabhängig. Nicht der Abstand — die " +
        "Richtung. Länge bedeutet in diesem Raum etwas anderes (grob: wie " +
        "häufig ein Stück ist).",
      "Nachbarschaft heißt <b>„kommt in ähnlichen Zusammenhängen vor“</b>, " +
        "nicht „bedeutet dasselbe“. Gegensatzpaare wie <i>groß</i> und " +
        "<i>klein</i> stehen deshalb oft dicht beieinander — sie stehen an " +
        "denselben Stellen im Satz.",
      "Das hier ist die <b>Tabelle vor dem Modell</b>, nicht das Modell. " +
        "Diese Vektoren sind der Ausgangszustand, bevor eine einzige Schicht " +
        "gerechnet hat. Was das Modell aus ihnen macht, steht in den " +
        "übrigen Kacheln.",
      "Ein Stück ist oft kein ganzes Wort. Bei zerlegten Fachwörtern sehen " +
        "Sie die Nachbarn des <b>ersten Stücks</b> — das ist kein Fehler, " +
        "sondern genau das, womit das Modell arbeitet."
    ]);

    var ziel = el("div");
    b.appendChild(ziel);
    u.beiSatz(function (d) {
      ziel.innerHTML = "";
      // Aufbau EINMAL, danach nur noch Werte tauschen. Vorher baute jeder
      // Klick auf ein Stueck die ganze Kachel neu auf (`u.neu()`) — die
      // Seite sprang an den Anfang zurueck und die Balken konnten nicht
      // ueberblenden, obwohl genau das ihre Aufgabe ist.
      var reiheZiel = el("div");
      ziel.appendChild(stellenbeschriftung(
        "Nachbarn welches Stücks? (anklicken — die Balken laufen über)"));
      ziel.appendChild(reiheZiel);

      var f = feld("Nachbarn");
      var fTitel = f.querySelector("h4");
      var balkenZiel = el("div");
      f.appendChild(balkenZiel);
      f.appendChild(hinweis("Wechseln Sie oben das Stück — die Balken laufen " +
        "auf die neuen Nachbarn über."));
      ziel.appendChild(f);

      var nRahmen = ZEICHNEN.rahmen(balkenZiel, { aussage: "" });
      var malen = ZEICHNEN.balken(nRahmen.wurzel, {
        breite: 560, namen: 190,
        yTitel: "nächste Nachbarn im Bedeutungsraum ↓",
        xTitel: "Ähnlichkeit der Richtung (Kosinus)"
      });
      balkenlegende(nRahmen, "Kosinus zwischen den beiden Vektoren: " +
        "1 = dieselbe Richtung, 0 = unabhängig.");

      var nBefund = befund("");
      f.appendChild(nBefund);

      function zeigen(dauer) {
        var pos = stelle(u, d.ids.length);
        reiheZiel.innerHTML = "";
        reiheZiel.appendChild(stellenreihe(u, d, function () { zeigen(520); }));
        fTitel.textContent = "Nachbarn von " +
          JSON.stringify(d.stuecke[pos]) + " (ID " + d.ids[pos] + ")";

        u.senden("/api/nachbarn", { token_id: d.ids[pos], k: 16 }, function (n) {
          malen(n.map(function (p) {
            return { id: p.id, text: p.text, p: p.kosinus };
          }), dauer);
          if (!n.length) { return; }
          var eng = n.filter(function (p) { return p.kosinus > 0.5; }).length;
          bezugSetzen(nRahmen, u, d, pos,
            "Tabelle VOR dem Modell — keine Schicht gerechnet");
          nRahmen.setzeAussage(
            JSON.stringify(sichtbar(d.stuecke[pos])) + " liegt am dichtesten " +
            "bei <b>" + JSON.stringify(sichtbar(n[0].text)) + "</b> (" +
            zahl(n[0].kosinus, 3) + "). <b>" + eng + " von 16</b> gezeigten " +
            "Nachbarn liegen über 0,5 — zwei zufällig gezogene Stücke lägen " +
            "in einem Raum mit " + u.info.d + " Achsen fast immer nahe 0.");
          nBefund.setzen(
            "Der nächste Nachbar von " + JSON.stringify(sichtbar(d.stuecke[pos])) +
            " ist <b>" + JSON.stringify(sichtbar(n[0].text)) + "</b> mit einem " +
            "Kosinus von <span class='zahl'>" + zahl(n[0].kosinus, 3) + "</span>. " +
            "<span class='zahl'>" + eng + "</span> der 16 gezeigten Nachbarn " +
            "liegen über 0,5. Zum Vergleich: zwei zufällig gezogene Stücke aus " +
            tausend(u.info.vokabular) + " liegen in einem Raum mit " + u.info.d +
            " Achsen fast immer nahe 0 — <b>Nähe ist hier die Ausnahme, nicht " +
            "der Normalfall</b>, und deshalb aussagekräftig.");
        });
      }
      zeigen(520);
    }, "/api/tokens");

    // ── Rechnen mit Bedeutungen ──────────────────────────────────────────
    // Die klassische Probe — und der ehrliche Bericht darueber, wieviel von
    // ihr bei einem heutigen Modell uebrig bleibt. Frueher wurde hier von
    // jedem Wort nur das erste Stueck genommen; bei „Königin“ rechnete der
    // Demonstrator also mit „Kön“ und lieferte folgerichtig Bruchstuecke.
    var aFeld = feld("Mit Bedeutungen rechnen — und was davon aufgeht");
    aFeld.appendChild(hinweis("Wenn Richtungen im Raum etwas bedeuten, muss " +
      "man rechnen können: <b>A − B + C</b>. Man nimmt die Richtung von B " +
      "nach A und legt sie an C an. Die berühmte Fassung lautet " +
      "<i>König − Mann + Frau = Königin</i>."));
    aFeld.appendChild(hinweis("Diese Rechnung stammt aus der Zeit, als jedes " +
      "Wort <b>einen</b> Vektor hatte. Dieses Modell hat keine Wortvektoren " +
      "mehr, sondern <b>Stückvektoren</b> — und die meisten deutschen " +
      "Fachwörter zerfallen in mehrere. Ein Wort aus mehreren Stücken wird " +
      "hier als Summe seiner Stücke gerechnet; das ist eine Näherung, denn " +
      "das Modell selbst setzt Stücke nicht durch Addition zusammen. " +
      "Rechts steht deshalb dieselbe Frage noch einmal, an das ganze Modell " +
      "gestellt."));

    var aZeile = el("div", "reihe");
    function wortfeld(start, breite) {
      var i = document.createElement("input");
      i.type = "text"; i.value = start; i.spellcheck = false;
      i.style.width = (breite || 130) + "px";
      return i;
    }
    var wa = wortfeld("Frankreich"), wb = wortfeld("Paris"),
        wc = wortfeld("Berlin"), we = wortfeld("Deutschland");
    aZeile.appendChild(wa);
    aZeile.appendChild(el("span", "beschriftung", "−"));
    aZeile.appendChild(wb);
    aZeile.appendChild(el("span", "beschriftung", "+"));
    aZeile.appendChild(wc);
    aZeile.appendChild(el("span", "beschriftung", "  erwartet:"));
    aZeile.appendChild(we);
    aZeile.appendChild(knopf("rechnen", "primaer", function () { rechnen(); }));
    aFeld.appendChild(aZeile);

    var bspZeile = reihe("Beispiele");
    [["Frankreich", "Paris", "Berlin", "Deutschland", "geht auf"],
     ["Italien", "Rom", "Madrid", "Spanien", "geht auf"],
     ["König", "Mann", "Frau", "Königin", "geht nicht auf"],
     ["Werkzeug", "Maschine", "Produktion", "Ware", "geht nicht auf"],
     ["Auftrag", "Kunde", "Lieferant", "Bestellung", "Fachbegriffe"]
    ].forEach(function (bs) {
      var c = chip(bs[1] + "→" + bs[0] + ", " + bs[2] + "→?", false, function () {
        wa.value = bs[0]; wb.value = bs[1]; wc.value = bs[2]; we.value = bs[3];
        rechnen();
      });
      c.title = bs[4];
      bspZeile.appendChild(c);
    });
    aFeld.appendChild(bspZeile);

    var zerlegung = hinweis("");
    aFeld.appendChild(zerlegung);

    var aKarten = el("div", "karten");
    var kTabelle = el("div", "karte"), kModell = el("div", "karte");
    kTabelle.appendChild(el("h5", null, "in der Tabelle gerechnet (A − B + C)"));
    kModell.appendChild(el("h5", null, "das ganze Modell gefragt"));
    var aZiel = el("div"), mZiel = el("div");
    kTabelle.appendChild(aZiel); kModell.appendChild(mZiel);
    aKarten.appendChild(kTabelle); aKarten.appendChild(kModell);
    aFeld.appendChild(aKarten);

    var aBefund = befund("");
    aFeld.appendChild(aBefund);
    b.appendChild(aFeld);

    var aRahmen = ZEICHNEN.rahmen(aZiel, { aussage: "" });
    var aMaler = ZEICHNEN.balken(aRahmen.wurzel, {
      breite: 260, namen: 150,
      yTitel: "gefundene ganze Wörter ↓",
      xTitel: "Nähe zur gerechneten Richtung"
    });
    balkenlegende(aRahmen, "Nähe zum Ergebnis von A − B + C (Kosinus).");

    function rechnen() {
      zerlegung.textContent = "wird gerechnet …";
      mZiel.innerHTML = "";
      mZiel.appendChild(laedt("das Modell antwortet"));

      u.senden("/api/analogie", {
        a: " " + wa.value.trim(), b: " " + wb.value.trim(),
        c: " " + wc.value.trim(), k: 8, nur_ganze: true,
        erwartet: " " + we.value.trim()
      }, function (r) {
        if (r.leer) { zerlegung.textContent = "Bitte alle drei Wörter angeben."; return; }
        aMaler(r.treffer.map(function (x) {
          return { id: x.id, text: x.text, p: Math.max(0, x.kosinus) };
        }), 520);

        // Zerlegung offenlegen — sie ist der Grund, warum die Rechnung
        // wackelt, und gehoert deshalb sichtbar neben das Ergebnis.
        var teile = [];
        ["a", "b", "c"].forEach(function (k, n) {
          var w = [wa, wb, wc][n].value.trim();
          var z = r.zerlegung[k];
          teile.push("<b>" + w + "</b> = " + z.map(function (x) {
            return JSON.stringify(sichtbar(x));
          }).join(" + ") + (z.length > 1 ? " (" + z.length + " Stücke)" : ""));
        });
        zerlegung.innerHTML = "So zerfallen Ihre Wörter: " + teile.join(" · ") +
          ". Gesucht wird nur unter den <span class='zahl'>" +
          tausend(r.ganze_im_vokabular) + "</span> Stücken des Vokabulars, " +
          "die ganze Wörter sind — sonst stünden hier Wortanfänge.";

        // Diese Anschauung rechnet NICHT auf dem Satz von oben, sondern auf
        // den drei Woertern daneben. Wer das nicht dazuschreibt, laesst den
        // Betrachter einen Bezug suchen, den es nicht gibt.
        aRahmen.setzeBezug(
          "<span class='was'>rechnet auf</span> " +
          "<span class='stelle'>" + wa.value.trim() + "</span> " +
          "<span class='rest'>−</span> " +
          "<span class='stelle'>" + wb.value.trim() + "</span> " +
          "<span class='rest'>+</span> " +
          "<span class='stelle'>" + wc.value.trim() + "</span> " +
          "<span class='rest'>— den drei Wörtern oben, NICHT auf Ihrem " +
          "Satz. Nur die Tabelle des Modells, keine Schicht.</span>");
        aRahmen.setzeAussage(
          "<b>" + wa.value.trim() + " − " + wb.value.trim() + " + " +
          wc.value.trim() + "</b> ergibt in der Tabelle <b>" +
          JSON.stringify(sichtbar(r.treffer[0].text)) + "</b>" +
          (r.erwartet && r.erwartet.ist_eigenes_wort
            ? " — erwartet war " + r.erwartet.wort + ", und das steht auf " +
              "Platz " + tausend(r.erwartet.platz) + " von " +
              tausend(r.ganze_im_vokabular) + "."
            : r.erwartet
            ? " — <b>" + r.erwartet.wort + " ist gar kein eigenes Stück und " +
              "kann so nicht gefunden werden.</b>"
            : "."));
        var text = "Die Tabellenrechnung liefert <b>" +
          JSON.stringify(sichtbar(r.treffer[0].text)) + "</b>.";
        if (r.erwartet) {
          var e = r.erwartet;
          if (!e.ist_eigenes_wort) {
            // Der wichtigste Fall — und der Grund, warum diese Rechnung mit
            // Fachwoertern nicht funktionieren KANN.
            text += " Ihr erwartetes Wort <b>" + e.wort + "</b> steht im " +
              "Vokabular <b>gar nicht als eigenes Stück</b>: es zerfällt in " +
              e.zerlegung.map(function (x) {
                return JSON.stringify(sichtbar(x));
              }).join(" + ") + ". Diese Rechnung sucht unter einzelnen " +
              "Stücken — <b>sie kann " + e.wort + " prinzipiell nicht " +
              "finden</b>, so gut die Richtung auch stimmen mag. Das ist " +
              "keine Panne, sondern die Bauart des Modells. Rechts sehen " +
              "Sie, was herauskommt, wenn man dieselbe Frage dem ganzen " +
              "Modell stellt: es antwortet Stück für Stück und kann " +
              "zusammengesetzte Wörter bilden.";
          } else {
            text += " Ihr erwartetes Wort <b>" + e.wort + "</b> steht auf " +
              "<b>Platz <span class='zahl'>" + tausend(e.platz) +
              "</span></b> unter den <span class='zahl'>" +
              tausend(r.ganze_im_vokabular) + "</span> ganzen Wörtern. " +
              (e.platz <= 5
                ? "<b>Die Rechnung geht hier auf.</b>"
                : e.platz <= 300
                ? "Die Rechnung zeigt in die richtige Gegend, trifft aber " +
                  "nicht ins Schwarze."
                : "<b>Die Rechnung geht hier nicht auf.</b> Das ist bei " +
                  "einem Modell mit Stückvokabular eher die Regel als die " +
                  "Ausnahme.");
          }
        }
        aBefund.setzen(text);
      });

      u.senden("/api/analogie_sprachlich", {
        a: " " + wa.value.trim(), b: " " + wb.value.trim(),
        c: " " + wc.value.trim()
      }, function (r) {
        mZiel.innerHTML = "";
        var gross = el("div", "fortsetzung");
        gross.appendChild(el("span", "neu", r.wort || "(keine Antwort)"));
        mZiel.appendChild(gross);
        mZiel.appendChild(hinweis("Das Modell bekommt die zwei Wortpaare als " +
          "Liste vorgelegt und schreibt weiter. Es antwortet Stück für " +
          "Stück und kann deshalb <b>ganze Wörter</b> bilden" +
          (r.stuecke > 1 ? " — dieses hier aus " + r.stuecke + " Stücken" : "") +
          ". Wiederholt es nur das dritte Wort, hat es die Beziehung nicht " +
          "erkannt."));
        var vor = el("pre", "muster");
        vor.textContent = r.muster + " ▍";
        mZiel.appendChild(vor);
      });
    }
    rechnen();
  }

  function kachelStrom(b, u) {
    lead(u, "Welche Schicht eigentlich arbeitet",
      "Man stellt sich ein Sprachmodell gern als Fließband vor, auf dem jede " +
      "Station gleich viel tut. So ist es nicht. Keine Schicht ersetzt den " +
      "Zustand — jede rechnet nur etwas dazu, und manche rechnen fast nichts " +
      "dazu. Diese Kachel zeigt, welche der " + u.info.schichten +
      " Schichten bei IHREM Satz tatsächlich etwas verändert haben.");

    anleitung(u, "Was hier gemessen wird", [
      "Der Zustand eines Wortes ist ein Vektor mit " + u.info.d + " Zahlen. " +
        "Er startet als reines Embedding und wird von Schicht zu Schicht " +
        "weitergereicht.",
      "Jede Schicht <b>addiert</b> etwas dazu, statt den Zustand zu ersetzen. " +
        "Genau diesen Zusatz kann man messen.",
      "<b>Eine Säule = eine Schicht.</b> Ihre Höhe ist die Länge des Zusatzes " +
        "im Verhältnis zum bereits vorhandenen Zustand. 20 % heißt: diese " +
        "Schicht hat den Zustand um ein Fünftel seiner bisherigen Größe " +
        "verändert.",
      "Hohe Säulen sind die Stellen, an denen etwas geschieht. Niedrige " +
        "Säulen reichen fast unverändert durch — und die kann man oft " +
        "weglassen, ohne dass das Ergebnis leidet. Probieren Sie es mit den " +
        "Knöpfen unter dem Bild."
    ]);

    // ── Die zwei Bauteile getrennt ───────────────────────────────────────
    // Eine Schicht ist kein Block, sondern zwei Rechenwerke hintereinander.
    // Zusammengezaehlt verschwindet die interessanteste Aussage: dass die
    // beiden zu verschiedenen Zeiten arbeiten.
    // Die Stellenwahl steht GANZ OBEN, weil sie alle vier Bilder dieser
    // Kachel steuert — nicht nur eines.
    var stellenFeld = feld("Welche Stelle des Satzes?");
    stellenFeld.appendChild(hinweis("Jedes Wort hat seinen eigenen Zustand " +
      "und wird von jeder Schicht eigens bearbeitet. <b>Die Wahl hier gilt " +
      "für alle vier Bilder dieser Kachel</b> — Säulen, Bauteile, Kurve und " +
      "Feld rechnen auf der gewählten Stelle."));
    var stellenZiel = el("div");
    stellenFeld.appendChild(stellenZiel);
    b.appendChild(stellenFeld);

    var bt = feld("Die zwei Bauteile jeder Schicht, getrennt");
    bt.appendChild(hinweis("Eine Schicht besteht aus zwei Rechenwerken, die " +
      "nacheinander etwas zum Zustand dazurechnen. Die <b>Aufmerksamkeit</b> " +
      "holt Information von anderen Wörtern. Das <b>Feedforward</b> rechnet " +
      "nur mit dem, was am Wort selbst schon da ist — es schaut weder nach " +
      "links noch nach rechts, und in ihm sitzt der größte Teil des " +
      "gespeicherten Wissens. Beide Säulen zusammen ergeben, was die Schicht " +
      "insgesamt verändert hat."));
    var btZiel = el("div");
    bt.appendChild(btZiel);
    var btBefund = befund("");
    bt.appendChild(btBefund);
    b.appendChild(bt);

    // ── Dasselbe über alle Positionen ────────────────────────────────────
    var pf = feld("Und an welcher Stelle des Satzes");
    pf.appendChild(hinweis("Die Säulen oben gelten für das letzte Wort — dort " +
      "entscheidet sich die Vorhersage. Aber jedes Wort hat seinen eigenen " +
      "Zustand und wird von jeder Schicht eigens bearbeitet. Hier steht " +
      "jede Schicht gegen jede Position: <b>" + u.info.schichten +
      " × Wortzahl</b> Messwerte statt einer Reihe."));
    var pfWahl = el("div");
    pf.appendChild(pfWahl);
    var pfZiel = el("div");
    pf.appendChild(pfZiel);
    var pfBefund = befund("");
    pf.appendChild(pfBefund);
    b.appendChild(pf);

    var f = feld("Beides zusammengezählt, Schicht für Schicht");
    var ziel = el("div");
    f.appendChild(ziel);
    f.appendChild(hinweis("Jede Säule ist EINE Schicht. Ihre Höhe sagt, wie " +
      "stark diese Schicht den Zustand verändert hat — gemessen als Länge " +
      "dessen, was sie dazugerechnet hat, im Verhältnis zu dem, was schon da " +
      "war. Eine hohe Säule heißt: hier ist etwas passiert. Eine niedrige " +
      "heißt: diese Schicht hat fast nur durchgereicht."));
    var deutung = el("div", "klartext");
    f.appendChild(deutung);
    var schalter = el("div", "reihe");
    f.appendChild(schalter);
    b.appendChild(f);

    var g = feld("Und wo dabei die Antwort umgesprungen ist");
    var lensZiel = el("div");
    g.appendChild(lensZiel);
    g.appendChild(hinweis("Zum Vergleich dieselben Schichten, aber mit dem, " +
      "was das Modell nach jeder von ihnen antworten würde. Die Stellen mit " +
      "den hohen Säulen oben und die Sprünge hier unten fallen meist " +
      "zusammen — dort arbeitet das Modell wirklich."));
    b.appendChild(g);

    var saeulenRahmen = ZEICHNEN.rahmen(ziel, {
      aussage: "",
      legende: [
        ["graue erste Säule: der Ausgangszustand aus der Tabelle", PALETTE.token("--text-muted")]
      ]
    });
    var zeichneSaeulen = ZEICHNEN.saeulen(saeulenRahmen.wurzel, {
      breite: 1060, hoehe: 300, einheit: "prozent",
      yTitel: "Zusatz im Verhältnis zum vorhandenen Zustand",
      xTitel: "Schicht 1 … " + u.info.schichten + " →"
    });
    ZEICHNEN.farbleiste(saeulenRahmen.fuss, {
      skala: "balken", links: "verändert wenig", rechts: "verändert viel",
      was: "Höhe UND Farbe sind das, was die Schicht zum Zustand " +
        "dazugerechnet hat — so sieht man die arbeitenden Schichten, ohne " +
        "28 Höhen einzeln zu vergleichen."
    });
    var lensRahmen = ZEICHNEN.rahmen(lensZiel, {
      aussage: "",
      legende: [
        ["Sicherheit der jeweils besten Fortsetzung", PALETTE.token("--marke-text"), "linie"],
        ["dicker Punkt mit Wort: hier wechselt die beste Antwort", PALETTE.token("--gruen")]
      ]
    });
    var zeichneKurve = ZEICHNEN.stufenkurve(lensRahmen.wurzel, {
      breite: 1060, hoehe: 260,
      yTitel: "Sicherheit der besten Antwort",
      xTitel: "nach Schicht 1 … " + u.info.schichten + " →"
    });
    var btRahmen = ZEICHNEN.rahmen(btZiel, {
      aussage: "",
      legende: [
        ["Aufmerksamkeit — holt bei anderen Wörtern", PALETTE.token("--marke-text")],
        ["Feedforward — rechnet am Wort selbst", PALETTE.token("--wahl")],
        ["↑ an der Zahl über einer Säule: sie ist oben abgeschnitten", null]
      ]
    });
    var zeichneBauteile = ZEICHNEN.doppelsaeulen(btRahmen.wurzel, {
      breite: 1060, hoehe: 300,
      yTitel: "Zusatz im Verhältnis zum vorhandenen Zustand",
      xTitel: "Schicht 1 … " + u.info.schichten + " →"
    });
    var pfRahmen = ZEICHNEN.rahmen(pfZiel, { aussage: "" });
    var zeichnePosfeld = ZEICHNEN.positionsfeld(pfRahmen.wurzel, {
      zeile: 15,
      yTitel: "Schicht 1 … " + u.info.schichten + " ↓",
      xTitel: "Stelle im Satz →"
    });
    var pfLeisteZiel = el("div");
    pfRahmen.fuss.appendChild(pfLeisteZiel);
    var st = u.zustand;
    if (!st.bauteilSicht) { st.bauteilSicht = "attn"; }
    var bauteilDaten = null;

    function bauteileLaden(dauer) {
      u.senden("/api/bauteile", { text: st.satz, eingriffe: st.eingriffe },
        function (d) {
          if (d.leer) { return; }
          bauteilDaten = d;
          // Die Bauteile liegen fuer ALLE Stellen vor — es waere ein Fehler,
          // sie nur fuer die letzte zu zeigen, wenn oben eine andere
          // gewaehlt ist.
          var letzte = stelle(u, d.token.ids.length);
          var a = d.attn.map(function (z) { return z[letzte]; });
          var m = d.mlp.map(function (z) { return z[letzte]; });
          var labels = a.map(function (x, i) {
            return (i % 3 === 0 || i === a.length - 1) ? String(i + 1) : "";
          });
          zeichneBauteile(a, m, labels, dauer);

          // Die Aussage: wo arbeitet welches Bauteil? Erste Schicht gegen
          // letztes Drittel — dort kippt das Verhaeltnis regelmaessig.
          var drittel = Math.floor(a.length / 3);
          function mittel(l, von, bis) {
            var s = 0;
            for (var i = von; i < bis; i++) { s += l[i]; }
            return s / Math.max(1, bis - von);
          }
          var aFrueh = mittel(a, 0, drittel), mFrueh = mittel(m, 0, drittel);
          var aSpaet = mittel(a, a.length - drittel, a.length);
          var mSpaet = mittel(m, m.length - drittel, m.length);
          var groesste = 0, wo = 0, wer = "";
          a.forEach(function (x, i) { if (x > groesste) { groesste = x; wo = i; wer = "die Aufmerksamkeit"; } });
          m.forEach(function (x, i) { if (x > groesste) { groesste = x; wo = i; wer = "das Feedforward"; } });

          bezugSetzen(btRahmen, u, d.token, letzte,
            "Attention und Feedforward getrennt");
          btRahmen.setzeAussage(
            "Für die Stelle " +
            JSON.stringify(sichtbar(d.token.stuecke[letzte])) + ": " +
            "<b>die beiden Rechenwerke arbeiten zu verschiedenen Zeiten.</b> " +
            "Im ersten Drittel trägt die Aufmerksamkeit " + pz(aFrueh, 0) +
            " und das Feedforward " + pz(mFrueh, 0) + ", im letzten Drittel " +
            pz(aSpaet, 0) + " gegen " + pz(mSpaet, 0) + ". " +
            (mSpaet > aSpaet
              ? "<b>Gegen Ende schaut das Modell kaum noch auf andere " +
                "Wörter.</b>"
              : "<b>Bei diesem Satz bleibt die Aufmerksamkeit bis zum " +
                "Schluss die treibende Kraft</b> — das weicht vom üblichen " +
                "Muster ab."));
          btBefund.setzen(
            "Am meisten verändert <b>" + wer + " in Schicht " + (wo + 1) +
            "</b>: <span class='zahl'>" + pz(groesste, 0) + "</span> des " +
            "bisherigen Zustands. Im <b>ersten Drittel</b> trägt die " +
            "Aufmerksamkeit im Mittel <span class='zahl'>" + pz(aFrueh, 1) +
            "</span>, das Feedforward <span class='zahl'>" + pz(mFrueh, 1) +
            "</span>. Im <b>letzten Drittel</b> sind es <span class='zahl'>" +
            pz(aSpaet, 1) + "</span> gegen <span class='zahl'>" + pz(mSpaet, 1) +
            "</span> — " + (mSpaet > aSpaet
              ? "gegen Ende schaut das Modell also kaum noch auf andere Wörter " +
                "und rechnet fast nur noch mit dem, was es schon hat."
              : "hier bleibt die Aufmerksamkeit bis zum Schluss die treibende " +
                "Kraft, was bei diesem Satz vom üblichen Muster abweicht.") +
            " Alle Werte gelten für die gewählte Stelle " +
            JSON.stringify(sichtbar(d.token.stuecke[letzte])) + ".");

          posfeldZeichnen(dauer);
        });
    }

    function posfeldZeichnen(dauer) {
      if (!bauteilDaten) { return; }
      var d = bauteilDaten;
      var werte = st.bauteilSicht === "attn" ? d.attn
        : st.bauteilSicht === "mlp" ? d.mlp
        : d.attn.map(function (z, s) {
            return z.map(function (x, t) { return x + d.mlp[s][t]; });
          });

      pfWahl.innerHTML = "";
      pfWahl.appendChild(wahlreihe("Zeigen", [
        { id: "attn", name: "nur die Aufmerksamkeit" },
        { id: "mlp", name: "nur das Feedforward" },
        { id: "summe", name: "beide zusammen" }
      ], st.bauteilSicht, function (id) {
        st.bauteilSicht = id; posfeldZeichnen(ZEICHNEN.DAUER);
      }));

      zeichnePosfeld({ werte: werte, spalten: d.token.stuecke,
                       spalte: stelle(u, d.token.stuecke.length) }, dauer);

      // Die Farbleiste traegt GENAU die Grenze, auf die das Bild skaliert
      // ist (94. Perzentil) — sonst legt sie eine andere Skala nahe.
      var flach = [];
      werte.forEach(function (z) { z.forEach(function (x) { flach.push(x); }); });
      flach.sort(function (a, c) { return a - c; });
      var deckel = flach.length
        ? flach[Math.min(flach.length - 1, Math.round(0.94 * (flach.length - 1)))]
        : 1;
      pfLeisteZiel.innerHTML = "";
      ZEICHNEN.farbleiste(pfLeisteZiel, {
        links: "0 %", rechts: pz(deckel, 0) + " und mehr",
        was: "Farbe = wieviel diese Schicht an dieser Stelle zum Zustand " +
          "dazugerechnet hat. Die Skala endet beim 94. Perzentil, nicht beim " +
          "Höchstwert — sonst würde die erste Schicht, die den Zustand um " +
          "ein Vielfaches umbaut, alle übrigen gleich dunkel machen."
      });

      // Welche Position wird am meisten bearbeitet — und welche Schicht?
      var maxW = -1, maxS = 0, maxT = 0;
      var jePos = [];
      werte.forEach(function (z, s) {
        z.forEach(function (x, t) {
          if (x > maxW) { maxW = x; maxS = s; maxT = t; }
          jePos[t] = (jePos[t] || 0) + x;
        });
      });
      var besteP = 0;
      jePos.forEach(function (x, t) { if (x > jePos[besteP]) { besteP = t; } });
      // Die markierte Spalte bekommt ihre eigene Zahl — sonst nennt die
      // Aussage nur den Hoechstwert des ganzen Feldes, und der gewaehlten
      // Stelle sieht man nichts an.
      var gew = stelle(u, d.token.stuecke.length);
      var gMax = -1, gMaxS = 0;
      werte.forEach(function (z, s) {
        if (z[gew] > gMax) { gMax = z[gew]; gMaxS = s; }
      });
      bezugSetzen(pfRahmen, u, d.token, gew,
        st.bauteilSicht === "attn" ? "nur die Aufmerksamkeit"
          : st.bauteilSicht === "mlp" ? "nur das Feedforward"
          : "beide Bauteile zusammen");
      pfRahmen.setzeAussage(
        "<b>Nicht jede Stelle des Satzes wird gleich stark bearbeitet.</b> " +
        "In der markierten Spalte " +
        JSON.stringify(sichtbar(d.token.stuecke[gew])) + " geschieht am " +
        "meisten in <b>Schicht " + (gMaxS + 1) + "</b> (" + pz(gMax, 0) +
        "); über das ganze Feld führt " +
        JSON.stringify(sichtbar(d.token.stuecke[maxT])) + " in Schicht " +
        (maxS + 1) + " (" + pz(maxW, 0) + "). Gezeigt ist gerade " +
        (st.bauteilSicht === "attn" ? "<b>nur die Aufmerksamkeit</b>"
          : st.bauteilSicht === "mlp" ? "<b>nur das Feedforward</b>"
          : "<b>beides zusammen</b>") + ".");
      pfBefund.setzen(
        "Am stärksten bearbeitet wird das Wort " +
        "<b>" + JSON.stringify(sichtbar(d.token.stuecke[maxT])) + "</b> " +
        "in <b>Schicht " + (maxS + 1) + "</b> (<span class='zahl'>" +
        pz(maxW, 0) + "</span>). Über alle Schichten aufsummiert bekommt " +
        "<b>" + JSON.stringify(sichtbar(d.token.stuecke[besteP])) + "</b> " +
        "die meiste Arbeit ab. Das erste Wort sieht regelmäßig anders aus als " +
        "alle übrigen — es hat nichts, worauf es zurückschauen könnte.");
    }

    function laden(dauer) {
      u.senden("/api/durchlauf", {
        text: st.satz, schicht: st.schicht, position: st.position,
        eingriffe: st.eingriffe
      }, function (d) {
        if (d.leer) { return; }
        stellenZiel.innerHTML = "";
        stellenZiel.appendChild(stellenreihe(u, d.token, function () {
          laden(360);
        }));
        var werte = d.beitraege.map(function (x) { return x.anteil; });
        var labels = d.beitraege.map(function (x, i) {
          return (i % 3 === 0 || i === d.beitraege.length - 1)
            ? String(x.schicht) : "";
        });
        zeichneSaeulen(werte, labels, dauer);

        // die drei staerksten Schichten benennen — das ist die Aussage
        var sortiert = d.beitraege.slice().sort(function (a, c) {
          return c.anteil - a.anteil;
        });
        bezugSetzen(saeulenRahmen, u, d.token, d.position,
          "beide Bauteile zusammengezählt");
        saeulenRahmen.setzeAussage(
          "Für die Stelle " +
          JSON.stringify(sichtbar(d.token.stuecke[d.position])) + ": " +
          "<b>die Schichten arbeiten sehr ungleich.</b> Am stärksten " +
          "verändert Schicht " + sortiert[0].schicht + " den Zustand (" +
          pz(sortiert[0].anteil, 0) + "), am wenigsten Schicht " +
          sortiert[sortiert.length - 1].schicht + " (" +
          pz(sortiert[sortiert.length - 1].anteil, 1) + ") — ein Unterschied " +
          "um das <b>" +
          zahl(sortiert[0].anteil /
               Math.max(1e-9, sortiert[sortiert.length - 1].anteil), 0) +
          "-fache</b>. Niedrige Säulen reichen fast unverändert durch.");

        deutung.innerHTML = "";
        var p = el("p");
        p.innerHTML = "Am stärksten verändern <b>Schicht " +
          sortiert.slice(0, 3).map(function (x) { return x.schicht; }).join(", ") +
          "</b> den Zustand (" +
          sortiert.slice(0, 3).map(function (x) { return pz(x.anteil, 0); }).join(", ") +
          "). Am wenigsten tut <b>Schicht " + sortiert[sortiert.length - 1].schicht +
          "</b> mit " + pz(sortiert[sortiert.length - 1].anteil, 1) + ".";
        deutung.appendChild(p);

        var vorher = null;
        var stufen = d.lens.slice(1).map(function (r) {
          var wechsel = vorher !== null && vorher !== r.beste[0].id;
          vorher = r.beste[0].id;
          return { p: r.beste[0].p, text: r.beste[0].text, wechsel: wechsel };
        });
        zeichneKurve(stufen, dauer);
        (function () {
          var w = stufen.filter(function (x) { return x.wechsel; }).length;
          var e = stufen[stufen.length - 1];
          bezugSetzen(lensRahmen, u, d.token, d.position,
            "was nach jeder Schicht herauskäme");
          lensRahmen.setzeAussage(
            "Die Antwort " + JSON.stringify(sichtbar(e.text)) + " steht am " +
            "Ende mit " + pz(e.p, 1) + " da; unterwegs wechselt die beste " +
            "Fortsetzung <b>" + w + " Mal</b>. <b>Die Sprünge hier und die " +
            "hohen Säulen oben fallen meist zusammen</b> — dort arbeitet das " +
            "Modell wirklich.");
        })();
        knoepfe();
        bauteileLaden(dauer);
      });
    }

    function knoepfe() {
      schalter.innerHTML = "";
      [4, 8, 14].forEach(function (n) {
        var liste = [];
        for (var s = u.info.schichten - n; s < u.info.schichten; s++) { liste.push(s); }
        var aktiv = liste.every(function (s) {
          return st.eingriffe.schichtAus.indexOf(s) >= 0;
        });
        schalter.appendChild(knopf("die letzten " + n + " Schichten weg",
          aktiv ? "an" : "", function () {
            if (aktiv) {
              st.eingriffe.schichtAus = st.eingriffe.schichtAus.filter(function (s) {
                return liste.indexOf(s) < 0;
              });
            } else {
              liste.forEach(function (s) {
                if (st.eingriffe.schichtAus.indexOf(s) < 0) {
                  st.eingriffe.schichtAus.push(s);
                }
              });
            }
            laden(700);
          }));
      });
      schalter.appendChild(knopf("zurücknehmen", "", function () {
        st.eingriffe.schichtAus = []; laden(700);
      }));
    }

    laden(0);
  }

  function kachelEingriffe(b, u) {
    lead(u, "Das Modell beschädigen",
      "Der ehrlichste Weg zu verstehen, wozu ein Teil da ist: ihn abschalten " +
      "und sehen, was fehlt. Alle Eingriffe wirken sofort auf jede andere " +
      "Kachel und lassen sich jederzeit zurücknehmen — die Gewichte selbst " +
      "bleiben unberührt.");

    anleitung(u, "So lesen Sie diese Kachel", [
      "<b>Oben steht die Wirkung, unten die Schalter.</b> Jede Schaltung " +
        "rechnet Ihren Satz neu durch das beschädigte Modell und stellt das " +
        "Ergebnis neben das unbeschädigte. So sieht man den Schaden, statt " +
        "ihn zu vermuten.",
      "Die Gewichte bleiben unberührt. Ein Eingriff ist ein <b>Haken am " +
        "laufenden Modell</b>, der nach jedem Durchlauf wieder entfernt wird.",
      "Erwartbar ist: einzelne Schichten fehlen kaum auf. Ab einer gewissen " +
        "Zahl bricht die Sprache zusammen — und zwar nicht allmählich, " +
        "sondern ziemlich plötzlich. Probieren Sie es aus."
    ]);

    // ── Die Wirkung, sofort und messbar ──────────────────────────────────
    // Eine Schalttafel ohne Rueckmeldung ist eine Zumutung: man schaltet und
    // muss glauben, dass etwas passiert. Hier steht das unbeschaedigte
    // Ergebnis neben dem beschaedigten, in denselben Balken.
    var wf = feld("Was Ihr Eingriff anrichtet");
    wf.appendChild(hinweis("Links das unbeschädigte Modell, rechts das " +
      "beschädigte — derselbe Satz, dieselbe Stelle. Die Balken laufen bei " +
      "jeder Schaltung auf ihren neuen Wert."));
    wf.appendChild(stellenbeschriftung(
      "An welcher Stelle vergleichen? (anklicken — beide Seiten rechnen neu)"));
    var stellenZiel = el("div");
    wf.appendChild(stellenZiel);
    var wKarten = el("div", "karten");
    var wLinks = el("div", "karte"), wRechts = el("div", "karte");
    wLinks.appendChild(el("h5", null, "unbeschädigt"));
    wRechts.appendChild(el("h5", null, "mit Ihren Eingriffen"));
    var wLinksZiel = el("div"), wRechtsZiel = el("div");
    wLinks.appendChild(wLinksZiel); wRechts.appendChild(wRechtsZiel);
    wKarten.appendChild(wLinks); wKarten.appendChild(wRechts);
    wf.appendChild(wKarten);
    var wBefund = befund("");
    wf.appendChild(wBefund);
    b.appendChild(wf);

    // Beide Seiten tragen DIESELBEN Achsentitel — sonst vergleicht man zwei
    // Bilder, von denen man nicht weiss, ob sie dasselbe messen.
    var linksRahmen = ZEICHNEN.rahmen(wLinksZiel, { aussage: "" });
    var rechtsRahmen = ZEICHNEN.rahmen(wRechtsZiel, {
      aussage: "",
      legende: [["die Reihenfolge kann hier eine andere sein als links", null]]
    });
    var malLinks = ZEICHNEN.balken(linksRahmen.wurzel, {
      breite: 300, namen: 130,
      yTitel: "mögliches nächstes Stück ↓", xTitel: "Wahrscheinlichkeit"
    });
    var malRechts = ZEICHNEN.balken(rechtsRahmen.wurzel, {
      breite: 300, namen: 130,
      yTitel: "mögliches nächstes Stück ↓", xTitel: "Wahrscheinlichkeit"
    });
    balkenlegende(linksRahmen, "Wahrscheinlichkeit im unbeschädigten Modell.");
    balkenlegende(rechtsRahmen, "Dieselbe Größe im beschädigten Modell.");
    var heil = null;

    // Das unbeschaedigte Ergebnis wird gemerkt, damit nicht bei jeder
    // Schaltung zweimal gerechnet wird. Es haengt aber an der STELLE — wird
    // eine andere gewaehlt, ist der Merker ungueltig.
    var heilStelle = null;

    function wirkungLaden(dauer) {
      if (heilStelle !== u.zustand.position) { heil = null; }
      heilStelle = u.zustand.position;

      function rechts() {
        u.senden("/api/durchlauf", {
          text: u.zustand.satz, schicht: 0, position: u.zustand.position,
          eingriffe: u.zustand.eingriffe
        }, function (d) {
          if (d.leer) { return; }
          stellenZiel.innerHTML = "";
          stellenZiel.appendChild(stellenreihe(u, d.token, function () {
            wirkungLaden(360);
          }));
          malRechts(d.beste.slice(0, 8), dauer);
          if (!heil) { return; }
          bezugSetzen(linksRahmen, u, d.token, d.position,
            "unbeschädigtes Modell — bewusst OHNE Ihre Eingriffe", true);
          bezugSetzen(rechtsRahmen, u, d.token, d.position,
            "mit Ihren Eingriffen");
          linksRahmen.setzeAussage(
            "Nach " + JSON.stringify(sichtbar(d.token.stuecke[d.position])) +
            " ohne Eingriff: <b>" +
            JSON.stringify(sichtbar(heil.beste[0].text)) + "</b> mit " +
            pz(heil.beste[0].p, 1) + ".");
          var e = u.zustand.eingriffe;
          var anzahl = e.schichtAus.length + e.attnAus.length +
            e.mlpAus.length + e.kopfAus.length;
          if (!anzahl) {
            rechtsRahmen.setzeAussage(
              "Nach " + JSON.stringify(sichtbar(d.token.stuecke[d.position])) +
              ": <b>zurzeit ist nichts abgeschaltet</b> — beide Seiten " +
              "zeigen dasselbe.");
            wBefund.setzen("Zurzeit ist nichts abgeschaltet — beide Seiten " +
              "zeigen dasselbe. Schalten Sie unten etwas ab.");
            return;
          }
          rechtsRahmen.setzeAussage(
            "Nach " + JSON.stringify(sichtbar(d.token.stuecke[d.position])) +
            " mit " + anzahl + " Eingriff" + (anzahl === 1 ? "" : "en") +
            ": <b>" + JSON.stringify(sichtbar(d.beste[0].text)) + "</b> mit " +
            pz(d.beste[0].p, 1) +
            (heil.beste[0].id === d.beste[0].id
              ? " — <b>dieselbe Antwort</b>, nur anders sicher."
              : " — <b>die Antwort ist gekippt.</b>"));
          var gleich = heil.beste[0].id === d.beste[0].id;
          var vorher = heil.beste[0], jetzt = d.beste[0];
          // Wo ist die ehemals beste Antwort gelandet?
          var rang = -1;
          d.beste.forEach(function (p, i) { if (p.id === vorher.id) { rang = i; } });
          wBefund.setzen(
            "<span class='zahl'>" + anzahl + "</span> Eingriff" +
            (anzahl === 1 ? "" : "e") + " aktiv. " +
            (gleich
              ? "Die beste Antwort ist <b>dieselbe geblieben</b> (" +
                JSON.stringify(sichtbar(jetzt.text)) + "), aber die Sicherheit " +
                "ist von <span class='zahl'>" + pz(vorher.p, 1) + "</span> auf " +
                "<span class='zahl'>" + pz(jetzt.p, 1) + "</span> gegangen."
              : "Die beste Antwort ist von <b>" +
                JSON.stringify(sichtbar(vorher.text)) + "</b> (" + pz(vorher.p, 1) +
                ") auf <b>" + JSON.stringify(sichtbar(jetzt.text)) + "</b> (" +
                pz(jetzt.p, 1) + ") <b>gekippt</b>. Die ursprüngliche Antwort " +
                (rang >= 0 ? "steht jetzt auf Rang " + (rang + 1)
                           : "taucht in den besten acht gar nicht mehr auf") +
                ".") +
            " Wie sich der Schaden über die Schichten aufbaut, zeigt die " +
            "Kachel „Schluss nach jeder Schicht“.");
        });
      }
      if (heil) { rechts(); return; }
      u.senden("/api/durchlauf", {
        text: u.zustand.satz, schicht: 0, position: u.zustand.position,
        eingriffe: { kopfAus: [], schichtAus: [], mlpAus: [], attnAus: [], kopfSkala: [] }
      }, function (d) {
        if (d.leer) { return; }
        heil = d;
        malLinks(d.beste.slice(0, 8), dauer);
        rechts();
      });
    }

    var ziel = el("div");
    b.appendChild(ziel);

    /** Schalten ohne die ganze Kachel neu zu bauen — sonst springt die
     *  Anzeige und die Ueberblendung der Balken geht verloren. */
    function schalte(name, s) {
      var l = u.zustand.eingriffe[name];
      var i = l.indexOf(s);
      if (i >= 0) { l.splice(i, 1); } else { l.push(s); }
      zeichnen();
      wirkungLaden(560);
    }

    function zeichnen() {
      ziel.innerHTML = "";
      var f = feld("Ganze Schichten überspringen");
      var r1 = el("div", "reihe");
      for (var s = 0; s < u.info.schichten; s++) {
        (function (s) {
          var aus = u.zustand.eingriffe.schichtAus.indexOf(s) >= 0;
          r1.appendChild(chip(String(s + 1), aus, function () {
            schalte("schichtAus", s);
          }));
        })(s);
      }
      f.appendChild(r1);
      f.appendChild(hinweis("Der Block wird umgangen — der Zustand geht " +
        "unverändert weiter. Erstaunlich oft merkt man einer einzelnen " +
        "übersprungenen Schicht nichts an; ab einer gewissen Zahl bricht " +
        "die Sprache zusammen."));
      ziel.appendChild(f);

      var g = feld("Nur die Aufmerksamkeit einer Schicht abschalten");
      var r2 = el("div", "reihe");
      for (s = 0; s < u.info.schichten; s++) {
        (function (s) {
          var aus = u.zustand.eingriffe.attnAus.indexOf(s) >= 0;
          r2.appendChild(chip(String(s + 1), aus, function () {
            schalte("attnAus", s);
          }));
        })(s);
      }
      g.appendChild(r2);
      ziel.appendChild(g);

      var m = feld("Nur das Feedforward einer Schicht abschalten");
      var r3 = el("div", "reihe");
      for (s = 0; s < u.info.schichten; s++) {
        (function (s) {
          var aus = u.zustand.eingriffe.mlpAus.indexOf(s) >= 0;
          r3.appendChild(chip(String(s + 1), aus, function () {
            schalte("mlpAus", s);
          }));
        })(s);
      }
      m.appendChild(r3);
      m.appendChild(hinweis("Im Feedforward sitzt der größte Teil des " +
        "gespeicherten Wissens. Ohne es bleibt der Satzbau oft erhalten, " +
        "aber der Inhalt wird beliebig."));
      ziel.appendChild(m);

      var k = feld("Stummgeschaltete Köpfe");
      if (!u.zustand.eingriffe.kopfAus.length) {
        k.appendChild(hinweis("Zurzeit keiner. Köpfe schalten Sie in den " +
          "Kacheln „Aufmerksamkeit“ und „Alle Köpfe“ ab."));
      } else {
        var r4 = el("div", "reihe");
        u.zustand.eingriffe.kopfAus.forEach(function (p) {
          r4.appendChild(chip("Schicht " + (p[0] + 1) + " · Kopf " + (p[1] + 1),
            true, function () {
              var l = u.zustand.eingriffe.kopfAus, i = -1;
              l.forEach(function (q, n) { if (q[0] === p[0] && q[1] === p[1]) { i = n; } });
              if (i >= 0) { l.splice(i, 1); }
              zeichnen(); wirkungLaden(560);
            }));
        });
        k.appendChild(r4);
      }
      ziel.appendChild(k);

      var z = feld("Zurücksetzen");
      z.appendChild(knopf("Alle Eingriffe zurücknehmen", "primaer", function () {
        u.zustand.eingriffe = { kopfAus: [], schichtAus: [], mlpAus: [], attnAus: [], kopfSkala: [] };
        zeichnen(); wirkungLaden(560);
      }));
      ziel.appendChild(z);
    }
    zeichnen();
    wirkungLaden(0);
  }

  function kachelWeiterschreiben(b, u) {
    lead(u, "Wort für Wort weiterschreiben",
      "Ein Sprachmodell kann nur eines: das nächste Stück vorhersagen. Alles " +
      "Weitere ist Wiederholung — das gezogene Stück wird angehängt und der " +
      "ganze Satz erneut durchgerechnet. Ihre Eingriffe wirken auch hier; ein " +
      "beschädigtes Modell schreibt sichtbar schlechter weiter.");

    anleitung(u, "Die zwei Regler — und was sie wirklich tun", [
      "Das Modell liefert eine <b>Verteilung</b> über alle " +
        tausend(u.info.vokabular) + " Stücke. Daraus muss eines gezogen " +
        "werden. Wie, das bestimmen die beiden Regler.",
      "<b>Temperatur</b> verändert die Verteilung, bevor gezogen wird. Nahe " +
        "0: es wird immer das wahrscheinlichste Stück genommen — bei " +
        "gleichem Anfang kommt jedes Mal derselbe Text heraus, meist mit " +
        "Wiederholungen. Über 1: seltene Stücke werden wahrscheinlicher, der " +
        "Text wird abwechslungsreicher und zugleich fehleranfälliger.",
      "<b>Nur die besten k</b> schneidet vorher ab: alles außer den k " +
        "wahrscheinlichsten Stücken wird ausgeschlossen. Das verhindert, " +
        "dass ein sehr unwahrscheinliches Stück den Satz entgleisen lässt.",
      "<b>Für jedes einzelne Stück wird der ganze Satz erneut durchgerechnet</b> " +
        "— einschließlich aller schon gezogenen Stücke. 60 Stücke heißen 60 " +
        "vollständige Durchläufe durch alle " + u.info.schichten + " Schichten.",
      "Gesetzte Eingriffe wirken auch hier. Ein beschädigtes Modell schreibt " +
        "sichtbar schlechter weiter — das ist die anschaulichste Probe auf " +
        "die Kachel „Das Modell beschädigen“."
    ]);

    var f = feld("Fortsetzung");
    f.appendChild(regler("Temperatur", 0.05, 1.6, 0.05, u.zustand.temperatur,
      function (v) { u.zustand.temperatur = v; }));
    f.appendChild(regler("nur die besten k", 1, 200, 1, u.zustand.topK,
      function (v) { u.zustand.topK = v; }));
    var r = el("div", "reihe");
    var ausgabe = el("div", "fortsetzung");
    var schritte = el("div");
    [20, 60, 120].forEach(function (n) {
      r.appendChild(knopf(n + " Stücke", "primaer", function () {
        ausgabe.innerHTML = ""; schritte.innerHTML = "";
        ausgabe.appendChild(laedt("das Modell schreibt"));
        u.senden("/api/erzeugen", {
          text: u.zustand.satz, anzahl: n,
          temperatur: u.zustand.temperatur, top_k: u.zustand.topK,
          eingriffe: u.zustand.eingriffe
        }, function (d) {
          ausgabe.innerHTML = "";
          ausgabe.appendChild(el("span", "vorher", d.vorher));
          ausgabe.appendChild(el("span", "neu", d.neu));
          schritte.innerHTML = "";
          var s = feld("Die ersten Schritte im Einzelnen");
          var tab = el("table", "tab");
          var kopf = el("tr");
          ["#", "gezogen", "Alternativen mit Wahrscheinlichkeit"].forEach(function (x) {
            kopf.appendChild(el("th", null, x));
          });
          tab.appendChild(kopf);
          d.schritte.forEach(function (x, i) {
            var z = el("tr");
            z.appendChild(el("td", "zahl", String(i + 1)));
            var td = el("td", "mono", JSON.stringify(sichtbar(x.gezogen.text)));
            td.style.color = PALETTE.token("--gruen");
            z.appendChild(td);
            var alt = el("td");
            x.alternativen.forEach(function (a) {
              var e = el("span", "minitok",
                sichtbar(a.text) + "  " + pz(a.p, 0));
              if (a.id === x.gezogen.id) { e.style.borderColor = PALETTE.token("--gruen"); }
              alt.appendChild(e);
            });
            z.appendChild(alt);
            tab.appendChild(z);
          });
          s.appendChild(tab);

          // Wie oft nimmt das Ziehen NICHT den Spitzenreiter? Genau das ist
          // der Unterschied zwischen Temperatur und "immer das
          // wahrscheinlichste Stueck".
          var abweichend = 0;
          d.schritte.forEach(function (x) {
            if (x.alternativen.length && x.alternativen[0].id !== x.gezogen.id) {
              abweichend += 1;
            }
          });
          s.appendChild(befund(
            "Von den ersten <span class='zahl'>" + d.schritte.length +
            "</span> Schritten hat das Ziehen <span class='zahl'>" + abweichend +
            "</span> Mal <b>nicht</b> das wahrscheinlichste Stück genommen. " +
            "Genau das tut die Temperatur: bei <span class='zahl'>" +
            zahl(u.zustand.temperatur, 2) + "</span> wird aus der Verteilung " +
            "gezogen, statt immer die Spitze zu nehmen. Bei Temperatur nahe 0 " +
            "wäre diese Zahl 0 und der Text bei gleichem Anfang jedes Mal " +
            "derselbe — und meist ermüdend, weil er in Wiederholungen läuft. " +
            "Für jedes einzelne Stück wird der GANZE Satz erneut " +
            "durchgerechnet, einschließlich aller schon gezogenen Stücke."));
          schritte.appendChild(s);
        });
      }));
    });
    f.appendChild(r);
    f.appendChild(ausgabe);
    b.appendChild(f);
    b.appendChild(schritte);
  }

  function kachelSteckbrief(b, u) {
    lead(u, "Was hier eigentlich läuft",
      "Kein Dienst im Netz, keine Schnittstelle nach außen: das Modell liegt " +
      "als Datei in diesem Verzeichnis und wird auf diesem Rechner gerechnet. " +
      "Ziehen Sie das Netzwerkkabel — es ändert sich nichts.");

    anleitung(u, "Wozu diese Zahlen gut sind", [
      "Ein Sprachmodell ist <b>keine Datenbank und kein Programm</b>, " +
        "sondern eine sehr große Zahl von Gewichten und eine feste " +
        "Rechenvorschrift. Die Zahlen unten sind alles, was es ausmacht.",
      "<b>Parameter</b> sind die gelernten Zahlen. <b>Schichten</b> sind die " +
        "Rechenstufen, die nacheinander durchlaufen werden. <b>Köpfe</b> sind " +
        "die parallelen Leseweisen je Schicht. <b>Modellbreite</b> ist, wie " +
        "viele Zahlen ein einzelnes Wort durch das Modell trägt.",
      "Darunter stehen dieselben Zahlen noch einmal als Rechnung: was sie " +
        "an Speicher und an Rechenarbeit bedeuten. <b>Erst dort werden sie " +
        "greifbar.</b>",
      "Ganz unten steht, warum es zwei verschiedene Parameterzahlen für " +
        "dasselbe Modell gibt — ein Fallstrick bei jedem Modellvergleich."
    ]);

    var f = feld("Steckbrief");
    var tab = el("table", "tab");
    [["Modell", u.info.name],
     ["Parameter", tausend(u.info.parameter)],
     ["Schichten", u.info.schichten],
     ["Köpfe je Schicht", u.info.koepfe + " (davon " + u.info.kv_koepfe + " für Schlüssel und Werte)"],
     ["Modellbreite d", u.info.d],
     ["Kopfdimension", u.info.kopf_dim],
     ["Vokabular", tausend(u.info.vokabular) + " Stücke"],
     ["Attention-Matrizen je Satz", tausend(u.info.schichten * u.info.koepfe)],
     ["Eingabetabelle", tausend(u.info.embedding_parameter || 0) + " Zahlen"],
     ["Ausgabeschicht", u.info.gewichte_gekoppelt
        ? "dieselbe Tabelle (gekoppelt)" : "eigene Matrix"],
     ["rechnet auf", u.info.gpu || u.info.geraet]
    ].forEach(function (z) {
      var r = el("tr");
      r.appendChild(el("td", null, z[0]));
      r.appendChild(el("td", "zahl", String(z[1])));
      tab.appendChild(r);
    });
    f.appendChild(tab);
    b.appendChild(f);

    // Zahlen im Steckbrief bleiben abstrakt, solange niemand sagt, was sie
    // bedeuten. Deshalb dieselben Zahlen noch einmal als Rechnung.
    var r = feld("Was diese Zahlen bedeuten");
    var rt = el("table", "tab");
    var bytes = u.info.parameter * 2;            // float16: 2 Byte je Parameter
    var jeStueck = 2 * u.info.parameter;         // grobe Faustformel
    [["Platz im Speicher",
      zahl(bytes / 1073741824, 2) + " GB",
      "jeder Parameter ist eine Zahl mit 16 Bit = 2 Byte"],
     ["Rechenschritte je Stück",
      zahl(jeStueck / 1e9, 1) + " Milliarden",
      "grob zwei Rechenoperationen je Parameter, für ein einziges Stück"],
     ["für einen Satz aus 15 Stücken",
      zahl(jeStueck * 15 / 1e12, 2) + " Billionen",
      "und das für EINE einzige Vorhersage"],
     ["Attention-Matrizen je Satz",
      tausend(u.info.schichten * u.info.koepfe),
      u.info.schichten + " Schichten × " + u.info.koepfe + " Köpfe"],
     ["Zahlen je Wort im Zustand",
      tausend(u.info.d),
      "so viele Zahlen trägt ein einzelnes Wort durch das Modell"],
     ["Verhältnis zum Kursmodell",
      "rund " + Math.round(u.info.parameter / 1377408) + "-fach",
      "das im Kurs von Grund auf gebaute Modell hat 1.377.408 Parameter"]
    ].forEach(function (z) {
      var q = el("tr");
      q.appendChild(el("td", null, z[0]));
      q.appendChild(el("td", "zahl", z[1]));
      q.appendChild(el("td", "hinweis", z[2]));
      rt.appendChild(q);
    });
    r.appendChild(rt);
    b.appendChild(r);

    if (u.info.parameter_doppelt) {
      var z = feld("Warum zwei verschiedene Parameterzahlen kursieren");
      z.appendChild(hinweis("Beim Nachzählen fällt eine Merkwürdigkeit auf, " +
        "die es wert ist, gezeigt zu werden. Die Tabelle, mit der aus einem " +
        "Stück ein Vektor wird, und die Matrix, mit der am Ende wieder " +
        "Wahrscheinlichkeiten über alle " + tausend(u.info.vokabular) +
        " Stücke entstehen, haben dieselbe Form: " +
        tausend(u.info.vokabular) + " × " + u.info.d + ". Bei diesem Modell " +
        "sind es <b>bitgleich dieselben Zahlen</b> — einmal vorwärts, einmal " +
        "rückwärts gelesen. Auf der Festplatte liegen sie trotzdem zweimal."));
      var zt = el("table", "tab");
      [["verschiedene Parameter", tausend(u.info.parameter),
        "die Größe des Modells — daher der Name „1.7B“"],
       ["Zahlen auf der Festplatte", tausend(u.info.parameter_gespeichert),
        "die doppelt abgelegte Matrix mitgezählt"],
       ["Differenz", tausend(u.info.parameter_doppelt),
        "genau " + tausend(u.info.vokabular) + " × " + u.info.d +
        " — die zweite Kopie"]
      ].forEach(function (q) {
        var w = el("tr");
        w.appendChild(el("td", null, q[0]));
        w.appendChild(el("td", "zahl", q[1]));
        w.appendChild(el("td", "hinweis", q[2]));
        zt.appendChild(w);
      });
      z.appendChild(zt);
      z.appendChild(befund(
        "Beide Zahlen sind richtig — sie beantworten verschiedene Fragen. " +
        "<b>Wie groß ist das Modell?</b> " + tausend(u.info.parameter) +
        " Parameter. <b>Wieviele Zahlen liegen auf der Platte?</b> " +
        tausend(u.info.parameter_gespeichert) + ". Wer eine Parameterzahl " +
        "liest, sollte deshalb wissen, welche der beiden gemeint ist — " +
        "Modellvergleiche gehen genau hier regelmäßig schief. Nachgeprüft " +
        "wurde die Gleichheit der beiden Matrizen Zahl für Zahl beim Laden, " +
        "nicht aus der Konfigurationsdatei geglaubt."));
      b.appendChild(z);
    }

    b.appendChild(befund(
      "Diese Größe ist der Grund, warum hier ein Server läuft und nicht nur " +
      "eine Datei im Browser: <span class='zahl'>" +
      zahl(bytes / 1073741824, 2) + " GB</span> Gewichte trägt kein Browser " +
      "sinnvoll. Der Server hört auf <b>127.0.0.1</b> — das ist dieser " +
      "Rechner und sonst nichts. Es gibt keinen Aufruf ins Netz, weder beim " +
      "Start noch im Betrieb; auch die verwendeten Bibliotheken liegen als " +
      "Dateien daneben. Ziehen Sie das Netzwerkkabel — es ändert sich nichts."));
  }

  // ── Verzeichnis ────────────────────────────────────────────────────────
  //
  // Die Kacheln stehen nicht beziehungslos nebeneinander. Jede trägt bei
  // sich, woran sie anschliesst (baut_auf) und wohin die Frage weitergeht
  // (fuehrt) — mitsamt der Begruendung, WARUM. Der Rahmen macht daraus am
  // Fuss jeder Kachelseite den roten Faden. Ohne diese Angaben waeren es
  // dreizehn Einzelstuecke; mit ihnen ist es ein Weg vom Satz bis zur
  // Vorhersage.

  return [
    // DIE GLIEDERUNG FOLGT DEN STATIONEN DES GROSSEN BILDES.
    //
    // Bis zum 15.08.2026 war sie nach vier Themen geordnet ("Vom Satz zur
    // Zahl", "Was im Modell passiert", "Welche Schluesse es zieht",
    // "Eingreifen"). Die Kacheln standen damit beziehungslos neben der
    // Hauptansicht. Jetzt vergroessert jede Kachel eine STATION des Weges,
    // und die Uebersicht ist nach diesen Stationen gegliedert: wer die
    // Hauptansicht gesehen hat, findet jede Vertiefung dort, wo er sie im
    // Bild gesehen hat.
    //
    // `station` traegt Nummer, Name und Farbfamilie der Station (C-1a) —
    // dieselbe Farbe, die der Streifen im grossen Bild hat. `zeigtAuf`
    // nennt die Station im Bild, zu der die Kopfzeile zurueckfuehrt.
    //
    // `luecke` markiert eine Station, fuer die es NOCH KEINE Kachel gibt.
    // Sie wird als offener Platzhalter gezeigt statt verschwiegen — der Weg
    // hat diese Station, der Demonstrator vertieft sie nur noch nicht.
    { gruppe: "Der ganze Weg", ohneStation: true },

    // DIE HAUPTANSICHT — nach dem Vorbild, das der Anwender gegeben hat
    // (https://poloclub.github.io/transformer-explainer/). Dort ist das
    // Erste, was man sieht, EIN durchgehendes Bild von links nach rechts.
    // Die zwoelf Kacheln danach sind die Vergroesserungen einzelner
    // Stationen daraus.
    { id: "bahn", titel: "Der ganze Weg", satz: true,
      text: "Ein Bild vom Satz bis zur Fortsetzung: Embedding, Query/Key/Value, Aufmerksamkeit, Ausgang, Feedforward, Wahrscheinlichkeiten — alle Stationen aus einem einzigen Durchlauf.",
      bau: kachelBahn,
      fuehrt: [
        { zu: "token", warum: "Ganz links steht die Zerlegung in Stücke — dort wird sie im Einzelnen gezeigt." },
        { zu: "attention", warum: "Die Matrix in der Mitte ist die Aufmerksamkeit eines Kopfes; dort steht, wie sie entsteht." },
        { zu: "vorhersage", warum: "Ganz rechts stehen die Wahrscheinlichkeiten; dort steht, wie aus Zahlen Anteile werden." }
      ] },

    { gruppe: "Station 1 — Ihr Satz", station: "1", stationName: "Ihr Satz",
      farbe: "res", zeigtAuf: "wort" },

    { id: "token", titel: "Zerlegung in Stücke", satz: true,
      text: "Ihren Satz in die Einheiten zerlegen, die das Modell überhaupt kennt — und nachrechnen, was deutsche Fachwörter dabei kosten.",
      bau: kachelToken,
      fuehrt: [
        { zu: "raum", warum: "Jedes dieser Stücke ist ein Punkt in einem Raum mit 2 048 Achsen. Dort liegt der Zustand, mit dem das Modell startet." },
        { zu: "bedeutung", warum: "Was in diesem Raum nahe beieinanderliegt, kam im Training in ähnlichen Zusammenhängen vor." }
      ] },

    { gruppe: "Station 2 — Embedding", station: "2", stationName: "Embedding",
      farbe: "res", zeigtAuf: "emb" },

    { id: "raum", titel: "Der Bedeutungsraum in 3D", satz: true,
      text: "Die echten Vektoren als drehbarer Raum — und daneben ungekürzt alle 2 048 Zahlen des Zustands für jede Stufe.",
      bau: kachelRaum,
      baut_auf: [
        { zu: "token", warum: "Die Punkte hier sind genau die Stücke, in die Ihr Satz dort zerfallen ist." }
      ],
      fuehrt: [
        { zu: "strom", warum: "Dieser Zustand ist erst der Anfang. Jede der 28 Schichten rechnet etwas dazu — dort steht, wieviel." }
      ] },

    { id: "bedeutung", titel: "Nachbarn eines Wortes", satz: true,
      text: "Die nächsten Nachbarn aus der gelernten Tabelle, und die Probe aufs Ganze: mit Bedeutungen rechnen (A − B + C).",
      bau: kachelBedeutung,
      baut_auf: [
        { zu: "raum", warum: "Dieselben Vektoren, hier als Rangliste statt als Raum — mit dem Kosinus als Maß für Nähe." }
      ],
      fuehrt: [
        { zu: "linien", warum: "Bis hierher hat das Modell noch nicht gerechnet. Ab jetzt holt jedes Wort Information bei den anderen." }
      ] },

    { gruppe: "Station 3 — Query · Key · Value", station: "3",
      stationName: "Q · K · V", farbe: "q", zeigtAuf: "qkv",
      luecke: {
        titel: "Noch keine Vergrößerung",
        text: "Wie aus einem Zustand drei Vektoren werden — dieselbe Zahl " +
              "dreimal verschieden befragt: wonach ein Wort sucht (Query), " +
              "womit es sich anbietet (Key), was es weitergibt (Value). Die " +
              "Daten dafür liegen bereit; die Kachel ist noch nicht gebaut." } },

    // `hauptkachel`: wer im grossen Bild auf "Aufmerksamkeit" klickt, hat
    // gerade das Punktraster gesehen und will GENAU das groesser sehen —
    // also die Matrix-Kachel, nicht die erste der Station (die Linien).
    { gruppe: "Station 4 — Aufmerksamkeit", station: "4",
      stationName: "Aufmerksamkeit", farbe: "att", zeigtAuf: "matrix",
      hauptkachel: "attention" },

    { id: "linien", titel: "Woher ein Wort seine Information holt", satz: true,
      text: "Ein Wort anklicken und als Linien sehen, von welchen Wörtern davor es sich wieviel holt — und den Beitrag eines Kopfes stufenlos verstellen.",
      bau: kachelLinien,
      baut_auf: [
        { zu: "bedeutung", warum: "Ein Wort allein bedeutet wenig. Hier beginnt das Modell, den Zusammenhang einzurechnen." }
      ],
      fuehrt: [
        { zu: "attention", warum: "Dieselben Zahlen, aber als eingefärbter Satz und als Matrix — oft leichter zu lesen als die Linien." }
      ] },

    { id: "attention", titel: "Aufmerksamkeit", satz: true,
      text: "Der Satz, eingefärbt nach dem, was ein Wort mitnimmt — und dieselbe Zahl als Matrix für alle Wörter zugleich.",
      bau: kachelAufmerksamkeit,
      baut_auf: [
        { zu: "linien", warum: "Dort dieselbe Information als Linien zwischen den Wörtern." }
      ],
      fuehrt: [
        { zu: "koepfe", warum: "Sie sehen hier EINEN von 448 Köpfen. Dort stehen alle 448 zugleich als Landkarte — nur so findet man den auffälligen." }
      ] },

    { id: "koepfe", titel: "Alle Köpfe einer Schicht", satz: true,
      text: "Die Landkarte aller 448 Köpfe mit fünf umschaltbaren Kennzahlen — welcher Kopf schaut weit zurück, welcher parkt am Satzanfang.",
      bau: kachelKoepfe,
      baut_auf: [
        { zu: "attention", warum: "Dort steht die vollständige Matrix eines einzelnen Kopfes; hier ist jeder Kopf auf fünf Zahlen eingedampft." }
      ],
      fuehrt: [
        { zu: "strom", warum: "Was all diese Köpfe zusammen bewirken, steht dort als Beitrag je Schicht — getrennt von dem, was das Feedforward tut." }
      ] },

    { gruppe: "Station 5 — Ausgang", station: "5", stationName: "Ausgang",
      farbe: "att", zeigtAuf: "aus",
      luecke: {
        titel: "Noch keine Vergrößerung",
        text: "Was ein Kopf tatsächlich weitergibt — die mit der " +
              "Aufmerksamkeit gewichtete Summe der Values — und wie sich die " +
              "16 Köpfe zum Ausgang des Blocks addieren." } },

    { gruppe: "Station 6 — Feedforward", station: "6",
      stationName: "Feedforward", farbe: "ff", zeigtAuf: "ff" },

    { id: "feedforward", titel: "Der Filter mit 6.144 Schaltern", satz: true,
      text: "Zwei Drittel aller Parameter eines Blocks stecken hier. Der Zustand wird von 2.048 auf 6.144 aufgeweitet — und dabei zweimal verschieden befragt: was ein Neuron beitragen würde, und ob es überhaupt durchkommt.",
      bau: kachelFeedforward,
      baut_auf: [
        { zu: "strom", warum: "Dort steht, wieviel das Feedforward einer Schicht insgesamt zum Zustand beiträgt; hier steht, woraus dieser Beitrag entsteht." }
      ],
      fuehrt: [
        { zu: "vorhersage", warum: "Was hier durch die Schalter kommt, landet im Zustand, aus dem am Ende die Verteilung entsteht." }
      ] },

    { gruppe: "Der Residualstrom und die 28 Blöcke", station: "Bogen",
      stationName: "Residual · Kartenstapel", farbe: "res", zeigtAuf: "residual" },

    { id: "strom", titel: "Der Residualstrom", satz: true,
      text: "Welche Schicht überhaupt arbeitet — getrennt nach Aufmerksamkeit und Feedforward, für jede Stelle des Satzes.",
      bau: kachelStrom,
      baut_auf: [
        { zu: "koepfe", warum: "Die Aufmerksamkeit, deren Beitrag hier gemessen wird, ist die Summe aller Köpfe dieser Schicht." }
      ],
      fuehrt: [
        { zu: "schluss", warum: "Wo eine Schicht viel verändert, springt meist auch die Antwort um. Dort steht beides nebeneinander." }
      ] },

    { gruppe: "Station 7 + 8 — Zustand und Wahrscheinlichkeit", station: "7+8",
      stationName: "Zustand → Wahrscheinlichkeit", farbe: "v", zeigtAuf: "kand" },

    { id: "vorhersage", titel: "Was als Nächstes kommt", satz: true,
      text: "Die Verteilung über das nächste Stück — samt der Frage, wie entschieden das Modell an dieser Stelle überhaupt ist.",
      bau: kachelVorhersage,
      baut_auf: [
        { zu: "strom", warum: "Diese Verteilung ist das Ergebnis dessen, was alle 28 Schichten zum Zustand beigetragen haben." }
      ],
      fuehrt: [
        { zu: "schluss", warum: "Dieselbe Frage nach jeder einzelnen Schicht gestellt: wann im Modell entsteht diese Antwort?" },
        { zu: "schreiben", warum: "Aus dieser einen Verteilung wird durch Wiederholung fortlaufender Text." }
      ] },

    { id: "schluss", titel: "Schluss nach jeder Schicht", satz: true,
      text: "Wann im Modell die Antwort entsteht — Stufe für Stufe, mit den Stellen, an denen sie umspringt.",
      bau: kachelSchluss,
      baut_auf: [
        { zu: "vorhersage", warum: "Dort dieselbe Verteilung, aber nur am Ende. Hier nach jeder einzelnen Stufe." }
      ],
      fuehrt: [
        { zu: "gitter", warum: "Dasselbe für jede Position des Satzes zugleich statt nur für die letzte." }
      ] },

    { id: "gitter", titel: "Der ganze Satz auf einen Blick", satz: true,
      text: "Stufe mal Position: an welchen Wörtern das Modell früh sicher ist und an welchen erst spät.",
      bau: kachelGitter,
      baut_auf: [
        { zu: "schluss", warum: "Dort dieselbe Messung, aber nur für die letzte Position — als Kurve statt als Gitter." }
      ],
      fuehrt: [
        { zu: "eingriffe", warum: "Nehmen Sie Schichten weg und sehen Sie zu, wie sich dieses Gitter verändert." }
      ] },

    // Weiterschreiben gehoert zur Station "Wahrscheinlichkeit": jedes Stueck
    // ist eine Ziehung aus genau der Verteilung, die dort steht. Bis zum
    // 15.08. stand es hinter "Das Modell beschaedigen" in der Gruppe
    // "Eingreifen" — das war nach Thema geordnet, nicht nach dem Weg.
    { id: "schreiben", titel: "Weiterschreiben", satz: true,
      text: "Ihren Satz fortsetzen lassen, mit Temperatur, Top-k und allen gesetzten Eingriffen.",
      bau: kachelWeiterschreiben,
      baut_auf: [
        { zu: "vorhersage", warum: "Jedes einzelne Stück hier ist eine Ziehung aus genau der Verteilung, die dort steht." }
      ],
      fuehrt: [
        { zu: "steckbrief", warum: "Was jeder dieser Schritte an Rechenarbeit kostet — und warum das ein Server und keine Datei im Browser ist." }
      ] },

    // Diese beiden vergroessern KEINE Station. "Das Modell beschaedigen"
    // greift in jede ein, "Was hier laeuft" ist der Steckbrief des Modells.
    // Sie stehen bewusst ausserhalb des Weges statt einer Station
    // zugeschlagen zu werden, die sie nicht meinen.
    { gruppe: "Quer durch alle Stationen", ohneStation: true },

    { id: "eingriffe", titel: "Das Modell beschädigen", satz: false,
      text: "Schichten überspringen, Aufmerksamkeit oder Feedforward abschalten — mit der Wirkung direkt daneben, unbeschädigt gegen beschädigt.",
      bau: kachelEingriffe,
      baut_auf: [
        { zu: "strom", warum: "Dort sehen Sie vorher, welche Schichten überhaupt etwas tun — die abzuschalten lohnt sich am ehesten." }
      ],
      fuehrt: [
        { zu: "schreiben", warum: "Alle Eingriffe wirken weiter. Ein beschädigtes Modell schreibt sichtbar schlechter." }
      ] },

    { id: "steckbrief", titel: "Was hier läuft", satz: false,
      text: "Der Steckbrief des Modells, was seine Zahlen praktisch bedeuten, und der Beweis, dass alles auf diesem Rechner bleibt.",
      bau: kachelSteckbrief,
      baut_auf: [
        { zu: "schreiben", warum: "Jedes dort erzeugte Stück hat das gekostet, was hier ausgerechnet steht." }
      ],
      fuehrt: [
        { zu: "token", warum: "Von vorn — mit einem anderen Satz. Der Weg ist derselbe, die Zahlen sind es nie." }
      ] }
  ];
})();
