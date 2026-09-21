/* Rahmen des Demonstrators: Kachelraster, Home-Button, Satzfeld je Kachel.
 *
 * Der Satz gehoert zur Kachel und steht dort, wo er gebraucht wird. Zwischen
 * den Kacheln bleibt er erhalten, damit man denselben Satz durch alle
 * Stationen verfolgen kann.
 */

(function () {
  "use strict";

  // Die Beispiele decken bewusst verschiedene Laengen ab. Das ist kein
  // Schmuck: eine Attention-Matrix mit vier Stuecken kann man lesen, eine
  // mit zwanzig nicht mehr. Wer den Zusammenhang ueber mehrere Nebensaetze
  // sehen will, braucht dagegen den langen Satz. Deshalb steht bei jedem
  // Beispiel, wieviele Stuecke es sind und wofuer es taugt.
  var BEISPIELE = [
    { text: "Der Motor wird",
      wofuer: "sehr kurz — hier sind Matrix und Linien wirklich lesbar" },
    { text: "Der Engpass in der Fertigung war die Lackiererei, weil",
      wofuer: "mittel — ein Grund folgt, gut für Vorhersage und Schluss" },
    { text: "Die Produktionsplanung in einem Unternehmen mit SAP beginnt damit, dass",
      wofuer: "lang — zeigt Zusammenhang über den ganzen Satz" },
    { text: "Eine Stückliste beschreibt, aus welchen Teilen ein Erzeugnis besteht, und",
      wofuer: "lang — deutsche Fachwörter zerfallen sichtbar in Stücke" },
    { text: "Digitalisierung bedeutet für den Mittelstand vor allem",
      wofuer: "offener Schluss — das Modell hat hier die Wahl" }
  ];
  var beispielLaenge = {};

  var zustand = {
    satz: BEISPIELE[2].text,
    schicht: 0,
    kopf: 0,
    position: -1,
    temperatur: 0.8,
    topK: 40,
    // Welches Schnittverfahren gilt: "top_k" (feste Anzahl) oder "top_p"
    // (feste Menge). Der Wert gilt fuer die ganze Seite — Vorhersage und
    // Weiterschreiben schneiden gleich, sonst zeigte die eine Kachel eine
    // Verteilung, aus der die andere gar nicht zieht.
    verfahren: "top_k",
    topP: 0.9,
    eingriffe: { kopfAus: [], schichtAus: [], mlpAus: [], attnAus: [], kopfSkala: [] }
  };

  var info = null;
  var textPuffer = {};

  var inhalt = document.getElementById("inhalt");
  var scroller = document.getElementById("scroller");
  var titelZeile = document.getElementById("titel");
  var unterZeile = document.getElementById("unter");
  var modellinfo = document.getElementById("modellinfo");
  var homeKnopf = document.getElementById("home");

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) { e.className = klasse; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function tausend(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  // ── Server ─────────────────────────────────────────────────────────────

  function senden(pfad, koerper, dann, fehler) {
    var x = new XMLHttpRequest();
    x.open("POST", pfad, true);
    x.setRequestHeader("Content-Type", "application/json");
    x.onload = function () {
      if (x.status >= 200 && x.status < 300) {
        dann(JSON.parse(x.responseText));
      } else if (fehler) { fehler(x.status, x.responseText); }
    };
    x.onerror = function () { if (fehler) { fehler(0, "keine Verbindung"); } };
    x.send(JSON.stringify(koerper));
  }

  function holen(pfad, dann) {
    var x = new XMLHttpRequest();
    x.open("GET", pfad, true);
    x.onload = function () { dann(JSON.parse(x.responseText)); };
    x.send();
  }

  // ── Übersicht ──────────────────────────────────────────────────────────

  function uebersicht() {
    location.hash = "";
    titelZeile.textContent = "Große Sprachmodelle";
    unterZeile.textContent = "Demonstrator";
    inhalt.innerHTML = "";
    if (scroller) { scroller.scrollTop = 0; }

    var hero = el("div", "hero");
    hero.appendChild(el("div", "eyebrow", "IT-Technologien — Digitalisierung"));
    hero.appendChild(el("h2", null, "Was in einem Sprachmodell wirklich passiert"));
    hero.appendChild(el("div", "lead",
      "Jede Kachel arbeitet an einem Satz, den Sie selbst eingeben, und zeigt, " +
      "was das Modell an dieser Stelle damit macht. Gerechnet wird ein echtes, " +
      "vortrainiertes Sprachmodell — lokal auf diesem Rechner, ohne Internet. " +
      "Keine Zahl ist gesetzt oder nachgestellt."));

    if (info) {
      var kz = el("div", "kennzahlen");
      [[tausend(info.parameter), "Parameter"],
       [info.schichten, "Schichten"],
       [info.koepfe, "Köpfe je Schicht"],
       [tausend(info.vokabular), "Stücke im Vokabular"],
       [info.gpu || info.geraet, "rechnet auf"]
      ].forEach(function (k) {
        var e = el("div", "kennzahl");
        e.appendChild(el("div", "zahl", String(k[0])));
        e.appendChild(el("div", "was", k[1]));
        kz.appendChild(e);
      });
      hero.appendChild(kz);
    }
    inhalt.appendChild(hero);

    var raster = null, nr = 0;
    KACHELN.forEach(function (k) {
      if (k.gruppe) {
        var ue = el("div", "gruppe", k.gruppe);
        if (k.farbe) { ue.style.setProperty("--tf", "var(--fam-" + k.farbe + ")"); }
        if (!k.ohneStation) { ue.className = "gruppe station-gruppe"; }
        inhalt.appendChild(ue);
        raster = el("div", "raster");
        inhalt.appendChild(raster);

        // EINE STATION OHNE KACHEL WIRD GEZEIGT, NICHT VERSCHWIEGEN.
        // Der Weg hat diese Stelle; der Demonstrator vertieft sie nur noch
        // nicht. Sie wegzulassen hiesse zu behaupten, der Weg sei
        // vollstaendig abgedeckt.
        //
        // BEWUSST NICHT die Klasse `kachel`: eine Luecke IST keine Kachel.
        // Beim ersten Bau trug sie `kachel luecke` — die Pruefer zaehlten
        // daraufhin 17 statt 14 Kacheln, klickten die Platzhalter an und
        // meldeten "KEINE Stellenwahl". Eine Attrappe, die wie das Echte
        // heisst, wird auch wie das Echte behandelt.
        if (k.luecke) {
          var lk = el("div", "stationsluecke");
          lk.style.setProperty("--tf", "var(--fam-" + k.farbe + ")");
          lk.appendChild(el("div", "nr", "—"));
          lk.appendChild(el("h3", null, k.luecke.titel));
          lk.appendChild(el("p", null, k.luecke.text));
          var lf = el("div", "fuss");
          lf.appendChild(el("span", null, "diese Station ist im großen Bild zu sehen"));
          lk.appendChild(lf);
          raster.appendChild(lk);
        }
        return;
      }
      nr += 1;
      var kachel = el("div", "kachel");
      kachel.appendChild(el("div", "nr", (nr < 10 ? "0" : "") + nr));
      kachel.appendChild(el("h3", null, k.titel));
      kachel.appendChild(el("p", null, k.text));
      var fuss = el("div", "fuss");
      fuss.appendChild(el("span", null, k.satz ? "arbeitet an Ihrem Satz" : ""));
      fuss.appendChild(el("span", "pfeil", "→"));
      kachel.appendChild(fuss);
      kachel.addEventListener("click", function () { oeffnen(k); });
      raster.appendChild(kachel);
    });
  }

  // ── Kachelseite ────────────────────────────────────────────────────────

  /** Kachel per Kennung finden — fuer die Querverweise zwischen Kacheln. */
  function kachelZu(id) {
    var gefunden = null;
    KACHELN.forEach(function (k) { if (k.id === id) { gefunden = k; } });
    return gefunden;
  }

  /** Die Kacheln in ihrer Reihenfolge, ohne die Gruppenueberschriften. */
  function nurKacheln() {
    return KACHELN.filter(function (k) { return !k.gruppe; });
  }

  /** Welche Station des grossen Bildes vergroessert diese Kachel?
   *
   * Die Registry ist eine flache Liste, in der Gruppenzeilen die
   * nachfolgenden Kacheln anfuehren — die Station einer Kachel ist also die
   * zuletzt davor stehende Gruppe. `ohneStation` markiert die beiden
   * Gruppen, die keine Station meinen (die Hauptansicht selbst und die
   * Kacheln quer durch alle Stationen).
   */
  function stationVon(k) {
    var laufend = null;
    for (var i = 0; i < KACHELN.length; i++) {
      if (KACHELN[i].gruppe) {
        laufend = KACHELN[i].ohneStation ? null : KACHELN[i];
      } else if (KACHELN[i] === k) {
        return laufend;
      }
    }
    return null;
  }

  /** Alle Stationen des Weges, in ihrer Reihenfolge — auch die ohne Kachel. */
  function alleStationen() {
    return KACHELN.filter(function (k) { return k.gruppe && !k.ohneStation; });
  }

  /** Die Kachel, in die eine Station fuehrt (null bei einer Luecke).
   *
   * Standard ist die erste Kachel der Station. Eine Station darf mit
   * `hauptkachel` eine andere benennen — bei "Aufmerksamkeit" ist das die
   * Matrix-Kachel und nicht die Linien-Kachel, weil man im grossen Bild
   * gerade das Punktraster angesehen hat.
   */
  function ersteKachelDerStation(s) {
    var ab = KACHELN.indexOf(s);
    if (ab < 0 || !KACHELN[ab + 1] || KACHELN[ab + 1].gruppe) { return null; }
    if (s.hauptkachel) {
      var z = kachelZu(s.hauptkachel);
      if (z) { return z; }
    }
    return KACHELN[ab + 1];
  }

  /** Die Station zu einem Namen im grossen Bild (`zeigtAuf`). */
  function stationZuBild(name) {
    var t = null;
    alleStationen().forEach(function (s) { if (s.zeigtAuf === name) { t = s; } });
    return t;
  }

  function oeffnen(k) {
    location.hash = k.id;
    titelZeile.textContent = k.titel;
    unterZeile.textContent = "Kachel";
    inhalt.innerHTML = "";
    if (scroller) { scroller.scrollTop = 0; }

    // WELCHE STATION DES GROSSEN BILDES VERGROESSERT DIESE KACHEL?
    //
    // Bis zum 15.08.2026 stand hier "Station 3 von 14" — das zaehlte die
    // KACHELN durch und nannte das Station. Der Begriff war doppelt belegt
    // und sagte nichts darueber, welche Stelle des Weges man gerade ansieht.
    // Jetzt nennt die Zeile die echte Station, faerbt sie wie im Bild und
    // fuehrt mit einem Klick dorthin zurueck.
    var meine = stationVon(k);
    var stationen = alleStationen();
    var leiste = el("div", "station");

    var zurueck = el("span", "zum-weg");
    zurueck.textContent = "← Der ganze Weg";
    zurueck.title = "Zurück in die Hauptansicht" +
      (meine ? " — zur Station " + meine.stationName : "");
    zurueck.addEventListener("click", function () {
      var b = kachelZu("bahn");
      if (b) { oeffnen(b); }
    });
    leiste.appendChild(zurueck);

    if (meine) {
      var was = el("span", "vergroessert");
      was.innerHTML = "vergrößert <b>Station " + meine.station + " — " +
        meine.stationName + "</b>";
      was.style.setProperty("--tf", "var(--fam-" + meine.farbe + ")");
      leiste.appendChild(was);
    } else if (k.id === "bahn") {
      leiste.appendChild(el("span", "vergroessert", "die Hauptansicht — alle Stationen"));
    } else {
      leiste.appendChild(el("span", "vergroessert", "quer durch alle Stationen"));
    }

    // Die Punkte zeigen jetzt die STATIONEN, nicht die Kacheln. Eine
    // Station ohne Kachel bekommt einen offenen Punkt — der Weg hat sie,
    // der Demonstrator vertieft sie nur noch nicht.
    stationen.forEach(function (s) {
      var p = el("span", "punkt" + (s === meine ? " aktiv" : "") +
                          (s.luecke ? " offen" : ""));
      p.title = "Station " + s.station + " — " + s.stationName +
        (s.luecke ? " (noch keine Kachel)" : "");
      p.style.setProperty("--tf", "var(--fam-" + s.farbe + ")");
      if (!s.luecke) {
        p.addEventListener("click", function () {
          var erste = ersteKachelDerStation(s);
          if (erste) { oeffnen(erste); }
        });
      }
      leiste.appendChild(p);
    });
    inhalt.appendChild(leiste);

    // REIHENFOLGE AUF JEDER KACHELSEITE (User-Direktive 14.08.2026):
    //   1. Bedienung   — Satz, Stelle, Parameter. Eine Leiste, ganz oben.
    //   2. Darstellung — so gross, wie sie sein kann. NICHTS davor.
    //   3. Erklaerung  — EINE zugeklappte Zelle, ganz unten.
    //
    // Vorher stand die Erklaerung oben und das Bild darunter: gemessen am
    // 14.08. im Mittel 539 px Text, bevor das erste Bild ueberhaupt anfing
    // (bei "Aufmerksamkeit" 899 px), und 3.519 sichtbare Zeichen je Kachel —
    // rund anderthalb DIN-A4-Seiten. Das Vorbild zeigt auf dem ersten
    // Bildschirm KEINEN Fliesstext; seine Prosa steht als eigener Artikel
    // weit unterhalb des Diagramms.
    var kopf = el("div", "bedienleiste");
    inhalt.appendChild(kopf);

    // ── Die EINE Erklaerzelle ──────────────────────────────────────────
    //
    // HIER GEBAUT, WEIL SCHON DIE BEDIENLEISTE HINEINSCHREIBT (der Text zu
    // den Beispielen). Angehaengt wird sie erst unten, nach dem Koerper —
    // gebaut und eingehaengt sind zwei verschiedene Dinge.
    //
    // Vier feste Abschnitte, damit man auf jeder Kachel weiss, wo was
    // steht. Ein Abschnitt ohne Inhalt wird gar nicht erst gezeigt.
    var erklaerZelle = document.createElement("details");
    erklaerZelle.className = "erklaerzelle";
    var zs = document.createElement("summary");
    zs.innerHTML = "<span class='zeichen'>?</span>" +
      "<span class='wort'>Erklärung, Anleitung und Befund</span>";
    erklaerZelle.appendChild(zs);
    var zi = el("div", "erklaerzelle-inhalt");
    erklaerZelle.appendChild(zi);
    var erklaer = {};
    [["worum", "Worum es geht"],
     ["lesen", "So lesen Sie das Bild"],
     ["zusehen", "Was hier zu sehen ist"],
     ["rechnung", "Wie es gerechnet wird"]].forEach(function (a) {
      var s = el("section", "erklaer-abschnitt");
      s.appendChild(el("h5", null, a[1]));
      var z = el("div", "erklaer-inhalt");
      s.appendChild(z);
      s.style.display = "none";      // erst zeigen, wenn etwas darin steht
      zi.appendChild(s);
      erklaer[a[0]] = z;
      z.__abschnitt = s;
    });

    /** Etwas in einen Abschnitt der Erklaerzelle legen und ihn sichtbar
     *  machen. Alles, was frueher zwischen den Bildern stand, landet hier. */
    function erklaerung(abschnitt, knoten) {
      var z = erklaer[abschnitt] || erklaer.worum;
      z.appendChild(knoten);
      if (z.__abschnitt) { z.__abschnitt.style.display = ""; }
      return knoten;
    }

    var neuLauf = function () { oeffnen(k); };
    if (k.satz) {
      var sf = el("div", "satzfeld");
      sf.appendChild(el("label", null, "Ihr Satz"));
      var zeile = el("div", "zeile");
      var eingabe = document.createElement("input");
      eingabe.type = "text";
      eingabe.value = zustand.satz;
      eingabe.spellcheck = false;
      zeile.appendChild(eingabe);
      var rechnen = el("button", "btn primaer", "Rechnen");
      rechnen.type = "button";
      zeile.appendChild(rechnen);
      sf.appendChild(zeile);

      var bsp = el("div", "beispiele");
      BEISPIELE.forEach(function (bei) {
        var t = bei.text;
        var kurz = t.length > 40 ? t.slice(0, 38) + "…" : t;
        var c = el("button", "chip", kurz);
        c.type = "button";
        // Der Titel nennt den vollen Satz UND wofuer er taugt. Ein Beispiel
        // ohne Angabe, wozu es gut ist, zwingt zum Durchprobieren.
        c.title = t + "\n\n" + bei.wofuer;
        var marke = el("span", "laenge", "");
        c.appendChild(marke);
        if (beispielLaenge[t] !== undefined) {
          marke.textContent = " " + beispielLaenge[t];
        } else {
          senden("/api/tokens", { text: t }, function (d) {
            beispielLaenge[t] = d.ids.length;
            marke.textContent = " " + d.ids.length;
          });
        }
        c.addEventListener("click", function () {
          zustand.satz = t; eingabe.value = t; neuLauf();
        });
        bsp.appendChild(c);
      });
      sf.appendChild(bsp);
      // Der Erklaertext zu den Beispielen stand bisher als vierzeiliger
      // Absatz IN der Bedienleiste. Er erklaert etwas, also gehoert er in
      // die Erklaerzelle — die Leiste bedient nur.
      erklaerung("lesen", el("p", null,
        "Die Zahl hinter jedem Beispiel ist die Anzahl der Stücke, in die es " +
        "zerfällt — sie bestimmt, wie gut die Darstellungen zu lesen sind. " +
        "Kurze Sätze machen Matrix und Linien übersichtlich, lange zeigen " +
        "mehr Zusammenhang. Fahren Sie über ein Beispiel, dann steht dort, " +
        "wofür es sich eignet."));
      kopf.appendChild(sf);

      rechnen.addEventListener("click", function () {
        zustand.satz = eingabe.value; neuLauf();
      });
      eingabe.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { zustand.satz = eingabe.value; neuLauf(); }
      });
    }

    var koerper = el("div");
    inhalt.appendChild(koerper);

    // Jetzt erst einhaengen: die Erklaerung steht GANZ UNTEN, nach allen
    // Darstellungen.
    inhalt.appendChild(erklaerZelle);

    var eingriffZahl = zustand.eingriffe.kopfAus.length +
      zustand.eingriffe.schichtAus.length + zustand.eingriffe.mlpAus.length +
      zustand.eingriffe.attnAus.length;
    if (eingriffZahl) {
      var w = el("div", "warnung",
        eingriffZahl + " Eingriff" + (eingriffZahl === 1 ? "" : "e") +
        " sind gesetzt — alles, was Sie hier sehen, ist die Antwort des " +
        "veränderten Modells.");
      var zurueck = el("button", "btn", "zurücknehmen");
      zurueck.type = "button";
      zurueck.style.marginLeft = "12px";
      zurueck.addEventListener("click", function () {
        zustand.eingriffe = { kopfAus: [], schichtAus: [], mlpAus: [], attnAus: [], kopfSkala: [] };
        neuLauf();
      });
      w.appendChild(zurueck);
      inhalt.appendChild(w);
    }

    // Werkzeugkasten fuer die Kachel
    var u = {
      info: info,
      zustand: zustand,
      neu: neuLauf,
      senden: senden,
      // Alter Name, damit die noch nicht umgestellten Kacheln weiterlaufen:
      // er zeigt jetzt in den ersten Abschnitt der Erklaerzelle.
      erklaerZiel: erklaer.worum,
      // Der neue Weg: erklaerung("lesen", knoten) usw.
      erklaerung: erklaerung,
      // Wohin die Bedienelemente gehoeren: EINE Leiste ganz oben, und alles
      // darin wirkt auf JEDE Darstellung der Kachel.
      bedienleiste: kopf,
      text: function (id) { return textPuffer[id] !== undefined ? textPuffer[id] : "#" + id; },

      /** Satz an den Server schicken (Standard: Tokenisierung). */
      beiSatz: function (dann, pfad) {
        var ziel = el("div");
        koerper.appendChild(ziel);
        ziel.appendChild(el("div", "laedt", "wird gerechnet"));
        senden(pfad || "/api/tokens", { text: zustand.satz }, function (d) {
          ziel.innerHTML = "";
          dann(d);
        }, function (s, t) {
          ziel.innerHTML = "";
          ziel.appendChild(el("div", "warnung", "Server antwortet nicht (" + s + "). " + t));
        });
      },

      /** Vollen Durchlauf holen. */
      beiDurchlauf: function (dann) {
        var ziel = el("div");
        koerper.appendChild(ziel);
        ziel.appendChild(el("div", "laedt", "das Modell rechnet"));
        senden("/api/durchlauf", {
          text: zustand.satz, schicht: zustand.schicht,
          eingriffe: zustand.eingriffe
        }, function (d) {
          ziel.innerHTML = "";
          if (d.leer) {
            ziel.appendChild(el("div", "warnung", "Kein Text eingegeben."));
            return;
          }
          dann(d);
        }, function (s, t) {
          ziel.innerHTML = "";
          ziel.appendChild(el("div", "warnung", "Server antwortet nicht (" + s + "). " + t));
        });
      },

      holen: function (pfad, dann) {
        senden(pfad, { text: zustand.satz, eingriffe: zustand.eingriffe }, dann,
          function (s, t) {
            koerper.appendChild(el("div", "warnung",
              "Server antwortet nicht (" + s + "). " + t));
          });
      },

      /** Zu einer anderen Kachel springen — der Satz und alle Eingriffe
       *  bleiben erhalten, deshalb ist der Sprung ein Weiterlesen und kein
       *  Neuanfang. */
      gehe: function (id) {
        var z = kachelZu(id);
        if (z) { oeffnen(z); }
      },

      /** Von einer Station des grossen Bildes in ihre Vergroesserung.
       *  `name` ist die Kennung, die das Bild vergibt (`zeigtAuf` in der
       *  Registry). Fuehrt eine Station noch zu keiner Kachel, passiert
       *  nichts — der Name im Bild ist dann kein Knopf. */
      zuStation: function (name) {
        var s = stationZuBild(name);
        if (!s) { return; }
        var z = ersteKachelDerStation(s);
        if (z) { oeffnen(z); }
      },
      /** Gibt es zu dieser Station des Bildes ueberhaupt eine Kachel? */
      hatStation: function (name) {
        var s = stationZuBild(name);
        return !!(s && ersteKachelDerStation(s));
      },
      /** Ein anklickbarer Verweis mitten im Text. */
      verweis: function (id, wort) {
        var z = kachelZu(id);
        var e = el("span", "verweis", wort || (z ? z.titel : id));
        e.title = z ? "weiter zu: " + z.titel : id;
        e.addEventListener("click", function () { u.gehe(id); });
        return e;
      },

      istKopfAus: function (s, h) {
        return zustand.eingriffe.kopfAus.some(function (p) {
          return p[0] === s && p[1] === h;
        });
      },
      kopfSchalten: function (s, h) {
        var i = -1;
        zustand.eingriffe.kopfAus.forEach(function (p, n) {
          if (p[0] === s && p[1] === h) { i = n; }
        });
        if (i >= 0) { zustand.eingriffe.kopfAus.splice(i, 1); }
        else { zustand.eingriffe.kopfAus.push([s, h]); }
        neuLauf();
      },
      schichtSchalten: function (s) { u.listeSchalten("schichtAus", s); },
      listeSchalten: function (name, s) {
        var l = zustand.eingriffe[name];
        var i = l.indexOf(s);
        if (i >= 0) { l.splice(i, 1); } else { l.push(s); }
        neuLauf();
      }
    };

    try {
      k.bau(koerper, u);
    } catch (e) {
      koerper.appendChild(el("div", "warnung",
        "Diese Kachel konnte nicht aufgebaut werden: " + e.message));
    }

    // ── Der rote Faden ───────────────────────────────────────────────────
    // Am Fuss jeder Kachel steht, woher die Frage kommt und wohin sie
    // fuehrt. Ohne das sind 13 Kacheln 13 Einzelstuecke; mit ihm sind sie
    // ein Weg. Die Begruendungen stehen im Verzeichnis bei der Kachel,
    // nicht hier — jede Kachel weiss selbst, woran sie anschliesst.
    var faden = el("div", "faden");
    (k.baut_auf || []).forEach(function (v) {
      var z = kachelZu(v.zu);
      if (!z) { return; }
      var s = el("div", "schritt");
      s.appendChild(el("div", "rolle", "davor"));
      s.appendChild(el("div", "was", z.titel));
      s.appendChild(el("div", "warum", v.warum));
      s.addEventListener("click", function () { oeffnen(z); });
      faden.appendChild(s);
    });
    (k.fuehrt || []).forEach(function (v) {
      var z = kachelZu(v.zu);
      if (!z) { return; }
      var s = el("div", "schritt");
      s.appendChild(el("div", "rolle", "danach"));
      s.appendChild(el("div", "was", z.titel));
      s.appendChild(el("div", "warum", v.warum));
      s.addEventListener("click", function () { oeffnen(z); });
      faden.appendChild(s);
    });
    if (faden.childNodes.length) { inhalt.appendChild(faden); }
  }

  // ── Fassung hell / dunkel ──────────────────────────────────────────────
  //
  // Die Farben selbst wechselt palette.js, indem sie die Variablen auf
  // <html> neu schreibt. Was sie NICHT kann: die bereits gezeichneten
  // Diagramme aendern. Die stehen als fertiges SVG in der Seite, mit
  // Farben, die beim Zeichnen eingesetzt wurden — ein neuer Variablenwert
  // erreicht sie nicht mehr.
  //
  // Deshalb wird die offene Ansicht nach dem Wechsel neu aufgebaut. Das ist
  // der ehrliche Weg: jedes Bild rechnet seine Farben neu aus derselben
  // Palette, aus der es beim ersten Mal gerechnet hat. Ein Nachfaerben von
  // aussen muesste jede Zeichenstelle noch einmal nachbilden und liefe
  // frueher oder spaeter auseinander.
  function ansichtNeuAufbauen() {
    var h = location.hash.replace("#", "");
    var k = null;
    KACHELN.forEach(function (x) { if (x.id === h) { k = x; } });
    if (k) { oeffnen(k); } else { uebersicht(); }
  }

  var fassungLeiste = document.getElementById("fassung");
  if (fassungLeiste) {
    fassungLeiste.addEventListener("click", function (e) {
      var knopf = e.target.closest("button[data-fassung]");
      if (knopf) { PALETTE.setzen(knopf.getAttribute("data-fassung")); }
    });
  }
  PALETTE.beiWechsel(function () {
    // Nur neu aufbauen, wenn ueberhaupt schon etwas steht — waehrend das
    // Modell laedt, wuerde der Neuaufbau die Ladeanzeige wegwerfen.
    if (info) { ansichtNeuAufbauen(); }
  });

  // ── Start ──────────────────────────────────────────────────────────────

  homeKnopf.addEventListener("click", uebersicht);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { uebersicht(); }
  });

  inhalt.appendChild(el("div", "laedt", "Modell wird geladen"));
  holen("/api/info", function (d) {
    info = d;
    modellinfo.innerHTML = "<b>" + d.name + "</b><span>" +
      tausend(d.parameter) + " Parameter · " + d.schichten + " Schichten · " +
      d.koepfe + " Köpfe</span>";
    document.getElementById("fusszeile").textContent =
      "läuft lokal auf " + (d.gpu || d.geraet) + " · kein Internet";

    var h = location.hash.replace("#", "");
    var start = null;
    KACHELN.forEach(function (k) { if (k.id === h) { start = k; } });
    if (start) { oeffnen(start); } else { uebersicht(); }
  });
})();
