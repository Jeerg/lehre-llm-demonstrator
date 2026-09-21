// Prueft, ob JEDES Diagramm sich selbst erklaert.
//
// Die Regel des Anwenders lautet: ein Diagramm braucht Aussage, Achsentitel
// und Legende AM BILD — der Fliesstext daneben hilft nicht. Dieser Pruefer
// geht alle Kacheln durch und meldet jedes Diagramm, dem eines davon fehlt.
//
// Geprueft wird je Diagramm (.diagramm):
//   BEZUG     .bezug sagt, worauf dieses Bild gerade rechnet — ohne ihn
//             bleibt auf einer langen Seite offen, ob das untere Diagramm
//             noch denselben Satz meint wie das Feld oben
//   AUSSAGE   .aussage traegt Text (und keine Rest-Platzhalter)
//   ACHSEN    das Bild traegt Achsentitel — im SVG text.achsentitel,
//             bei der Leinwand des Dimensionsfeldes .dimfeld-x/ytitel
//   LEGENDE   im Fuss steht .legende oder .farbleiste
//   FARBE     wo eine Flaeche eingefaerbt ist (Hitzefeld, Landkarte,
//             Gitter, Positionsfeld, Dimensionsfeld), MUSS eine Farbleiste
//             dabei sein — eine Farbe ohne Skala ist unlesbar
//
// Und danach, ebenso wichtig: ob ein Klick ANKOMMT. Jede Kachel, in der der
// Satz vorkommt, traegt eine Stellenwahl (.stellenreihe). Der Pruefer klickt
// dort ein anderes Stueck an und verlangt zweierlei:
//   ES AENDERT SICH ETWAS  — Aussagen, Markierungen oder Auswahlrahmen
//   ES IST DAS RICHTIGE    — das angeklickte Stueck steht danach im Bild
//                            (in einer Aussage oder als Markierung)
// Ein Bedienelement ohne Wirkung auf das, was darunter steht, ist ein
// Konstruktionsfehler und faellt hier auf, bevor es der Anwender sieht.
//
// Aufruf:  node pruefe_diagramme.js [--sichtbar]
// Voraussetzung: der Server laeuft.

const path = require("path");

const args = process.argv.slice(2);
const sichtbar = args.includes("--sichtbar");
const pIndex = args.indexOf("--puppeteer");
const PUPPETEER = pIndex >= 0 ? args[pIndex + 1] : path.join(
  process.env.USERPROFILE || process.env.HOME, "PycharmProjects",
  "tbx_stzrim", "portal", "node_modules", "puppeteer");
const puppeteer = require(PUPPETEER);

const URL = "http://127.0.0.1:8100/";
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const { warmlauf } = require("./warmlauf");

// Diagramme, deren Flaeche eingefaerbt ist — sie brauchen zwingend eine
// Farbleiste als Skala.
// `verwandlungstafel` stand hier bis zum 14.08.2026. Sie ist herausgenommen,
// weil ihre Balken seither ALLE DIESELBE Farbe tragen (wie in der Vorlage):
// die Länge trägt den Wert, die Farbe trägt nichts. Eine Farbleiste versprä-
// che dort eine Skala, die es nicht gibt. Kommt in der Tafel je wieder eine
// Wertfarbe vor, gehört sie zurück in diese Liste.
const FARBIG = ["d3-feld", "d3-landkarte", "d3-gitter", "d3-posfeld",
                "dimfeld-bild", "d3-kette"];

// Kacheln OHNE Stellenwahl — und warum das dort richtig ist. Wer eine
// Kachel hier eintraegt, muss den Grund mitliefern; ohne Eintrag ist eine
// fehlende Stellenwahl ein Befund.
const OHNE_STELLENWAHL = {
  "Weiterschreiben": "erzeugt neuen Text, es gibt keine Stelle im Satz",
  "Was hier läuft": "zeigt Kennzahlen des Modells, nicht den Satz"
};


/** WARTET, BIS SICH NICHTS MEHR AENDERT — statt auf die Uhr zu warten.
 *
 *  Befund vom 20.08.2026: die Kachel "Was als Naechstes kommt" wurde als
 *  "kein Bezug, keine Aussage" gemeldet, obwohl beides da ist. Nachgemessen:
 *  nach 9 s stand alles, nach den hier veranschlagten 1,5 s noch nicht.
 *
 *  Der Grund ist derselbe wie bei `pruefe_bedienung.js` am 15.08. (Commit
 *  117c0ca): die Ladewache greift nicht. `.laedt` steht nur waehrend des
 *  ERSTEN Seitenaufbaus; die Netzansicht dieser Kachel holt ihre Daten
 *  danach in einem eigenen Aufruf, OHNE die Marke zu setzen. Die Wache
 *  kehrte also sofort zurueck, und was danach kam, war eine Wette auf eine
 *  feste Zahl.
 *
 *  Diese Funktion wartet, bis der Inhalt zweimal hintereinander gleich
 *  aussieht — und meldet erst nach einer echten Frist auf.
 */
async function beruhigt(seite, ruhe = 700, frist = 25000) {
  const t0 = Date.now();
  let vorher = null;
  let seit = Date.now();
  for (;;) {
    const jetzt = await seite.evaluate(() => {
      const w = document.getElementById("inhalt");
      if (!w) { return "0"; }
      // Ein grober Abdruck: Zahl der Knoten, Zahl der SVG-Elemente und die
      // Laenge aller Bezuege und Aussagen. Aendert sich davon nichts mehr,
      // ist das Zeichnen durch.
      let t = 0;
      document.querySelectorAll(".bezug,.aussage").forEach(
        (e) => { t += (e.textContent || "").length; });
      return w.querySelectorAll("*").length + "/" +
             w.querySelectorAll("svg *").length + "/" + t;
    });
    if (jetzt !== vorher) { vorher = jetzt; seit = Date.now(); }
    else if (Date.now() - seit >= ruhe) { return true; }
    if (Date.now() - t0 > frist) { return false; }
    await warte(120);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: !sichtbar,
    defaultViewport: { width: 1560, height: 1200 }
  });
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));

  // Erst warmlaufen lassen, dann messen — sonst trifft die erste Kachel ein
  // Modell, das noch laedt, und meldet leere Bilder als Regression.
  if (!await warmlauf(URL)) {
    console.error("Server wird auch nach 4 min nicht bereit (/api/info) — " +
                  "Lauf abgebrochen, bevor er falsch rot meldet.");
    await browser.close();
    process.exit(2);
  }

  await seite.goto(URL, { waitUntil: "load", timeout: 120000 });
  await seite.waitForSelector(".kachel", { timeout: 180000 });
  await warte(600);

  const titel = await seite.$$eval(".kachel h3", (k) => k.map((e) => e.textContent));
  const befunde = [];
  let gesamt = 0, sauber = 0, klicks = 0, angekommen = 0;

  /** Ein Abdruck dessen, was die Bilder gerade zeigen — Aussagen,
   *  Markierungen und die Lage der Auswahlrahmen. Aendert er sich nach
   *  einem Klick nicht, hatte der Klick keine Wirkung. */
  function abdruck() {
    const teile = [];
    document.querySelectorAll(".diagramm").forEach((d) => {
      const a = d.querySelector(".aussage");
      teile.push(a ? a.textContent.trim() : "");
      d.querySelectorAll(".z.markiert text.wort, text.gewaehlt")
        .forEach((t) => teile.push("M:" + t.textContent));
      d.querySelectorAll("rect.auswahl").forEach((r) => {
        teile.push("R:" + r.getAttribute("x") + "," + r.getAttribute("y") +
                   "," + (r.style.opacity || "1"));
      });
    });
    return teile.join("|");
  }

  for (let i = 0; i < titel.length; i++) {
    const kacheln = await seite.$$(".kachel");
    await kacheln[i].click();
    try {
      await seite.waitForFunction(
        () => document.querySelectorAll(".laedt").length === 0,
        { timeout: 120000 });
    } catch (e) { befunde.push(`${titel[i]}: rechnet nicht fertig`); }
    if (!await beruhigt(seite)) {
      befunde.push(`${titel[i]}: kommt auch nach 25 s nicht zur Ruhe`);
    }

    // HERLEITUNGEN AUFKLAPPEN, BEVOR GEPRUEFT WIRD.
    //
    // Eine Herleitung (details.herleitung) steht zugeklappt ueber ihrem
    // Ergebnis und rechnet erst beim Oeffnen. Zugeklappt sind ihre
    // Diagramme gar nicht im DOM — der Pruefer saehe sie nie und meldete
    // brav "alles gruen", waehrend genau die neuen Bilder ungeprueft
    // blieben. Also: aufklappen, fertig rechnen lassen, dann pruefen.
    const herleitungen = await seite.evaluate(() => {
      // `open = true` loest das toggle-Ereignis von selbst aus; ein
      // zusaetzliches dispatchEvent feuerte es doppelt und schickte zwei
      // Anfragen los.
      const d = Array.from(document.querySelectorAll("details.herleitung"));
      d.forEach((x) => { if (!x.open) { x.open = true; } });
      return d.length;
    });
    if (herleitungen) {
      try {
        await seite.waitForFunction(
          () => document.querySelectorAll(".laedt").length === 0,
          { timeout: 120000 });
      } catch (e) {
        befunde.push(`${titel[i]}: Herleitung rechnet nicht fertig`);
      }
      // Die Stufen blenden gestaffelt ein (bis 0,34 s Verzoegerung plus
      // 0,45 s Bewegung); vorher gemessen waere die Hoehe noch nicht da.
      // Gewartet wird auf die WIRKUNG, nicht auf die Uhr.
      await beruhigt(seite);
    }

    const gefunden = await seite.evaluate((FARBIG) => {
      return Array.from(document.querySelectorAll(".diagramm")).map((d, n) => {
        const bild = d.querySelector(".bild");
        const fuss = d.querySelector(".diagramm-fuss");
        const aussage = d.querySelector(".aussage");
        // Woran erkennt man, WELCHES Diagramm das ist? An der Klasse des
        // gezeichneten Elements — sie sagt zugleich, ob eine Flaeche
        // eingefaerbt ist.
        const gemalt = bild ? bild.querySelector(
          "svg, canvas, .dimfeld-aussen, .dimfeld") : null;
        let art = "?";
        if (gemalt) {
          art = (gemalt.getAttribute("class") || gemalt.tagName).toString();
          const innen = bild.querySelector("svg[class], canvas[class]");
          if (innen) { art = innen.getAttribute("class"); }
        }
        const farbig = FARBIG.some((k) => (bild ? bild.innerHTML : "").indexOf(k) >= 0);
        const bezug = d.querySelector(".bezug");
        const folge = bezug ? bezug.querySelector(".satzfolge") : null;
        return {
          nr: n + 1,
          art: String(art).split(" ")[0],
          bezug: bezug ? bezug.textContent.trim() : "",
          bezugStelle: !!(bezug && bezug.querySelector(".stelle")),
          bezugSatz: folge ? folge.textContent.trim() : null,
          gekuerzt: folge ? folge.textContent.indexOf("…") >= 0 : false,
          aussage: aussage ? aussage.textContent.trim() : "",
          achsen: bild ? (
            bild.querySelectorAll("text.achsentitel").length +
            // Bilder ohne SVG-Achsen (Leinwand, 3D) tragen ihre
            // Achsenbeschriftung als eigenes Element neben dem Bild
            d.querySelectorAll(
              ".dimfeld-xtitel, .dimfeld-ytitel, .achsenzeile").length
          ) : 0,
          legende: !!(fuss && fuss.querySelector(".legende")),
          // Eine Farbleiste zaehlt auch, wenn sie IM Bild steht statt im
          // Fuss: die Attention-Kette setzt je Stufe eine eigene direkt
          // unter ihre Matrix — naeher am Bild als eine gemeinsame unten,
          // und damit besser, nicht schlechter.
          farbleiste: !!((fuss && fuss.querySelector(".farbleiste")) ||
                         (bild && bild.querySelector(".farbleiste"))),
          farbig: farbig,
          hoehe: bild ? Math.round(bild.getBoundingClientRect().height) : 0
        };
      });
    }, FARBIG);

    // Welcher Satz steht gerade oben im Eingabefeld? Der Bezug jedes
    // Diagramms muss ihn wiedergeben — sonst zeigt das Bild einen anderen
    // oder einen alten Stand.
    const satzOben = await seite.evaluate(() => {
      const f = document.querySelector(".satzfeld input");
      return f ? f.value.trim() : "";
    });

    gefunden.forEach((g) => {
      gesamt += 1;
      const mangel = [];
      if (!g.bezug) { mangel.push("kein Bezug (worauf rechnet das Bild?)"); }
      else if (g.bezugStelle === false) {
        mangel.push("Bezug ohne hervorgehobene Stelle/Größe");
      }
      // Trägt der Bezug einen Satz, MUSS es der aus dem Feld oben sein.
      // Sonst zeigt das Bild einen anderen oder einen alten Stand — genau
      // die Unklarheit, für die es die Zeile gibt.
      if (g.bezugSatz && !g.gekuerzt && satzOben) {
        const nackt = (s) => s.replace(/[·…\s]/g, "");
        if (nackt(satzOben).indexOf(nackt(g.bezugSatz)) < 0) {
          mangel.push("Bezug nennt einen ANDEREN Satz als das Feld oben: " +
                      JSON.stringify(g.bezugSatz.slice(0, 50)));
        }
      }
      if (!g.aussage) { mangel.push("keine Aussage"); }
      if (!g.achsen) { mangel.push("keine Achsentitel"); }
      if (!g.legende && !g.farbleiste) { mangel.push("keine Legende"); }
      if (g.farbig && !g.farbleiste) { mangel.push("Farbfläche ohne Farbleiste"); }
      if (!g.hoehe) { mangel.push("Bild ist leer"); }
      if (mangel.length) {
        befunde.push(`${titel[i]} · Diagramm ${g.nr} (${g.art}): ` +
                     mangel.join(", "));
      } else {
        sauber += 1;
        console.log(`  ok    ${titel[i]} · ${g.art}` +
          (g.farbleiste ? "  [Farbleiste]" : "") +
          `  ${g.achsen} Achsentitel`);
      }
    });

    // ── Kommt ein Klick auf ein Stück im Bild an? ────────────────────────
    const reihen = await seite.$$(".stellenreihe");
    if (!reihen.length) {
      if (OHNE_STELLENWAHL[titel[i]]) {
        console.log(`  --    ${titel[i]}: keine Stellenwahl — ` +
                    OHNE_STELLENWAHL[titel[i]]);
      } else {
        befunde.push(`${titel[i]}: KEINE Stellenwahl — in dieser Kachel ` +
                     `kommt der Satz vor, also muss man eine Stelle ` +
                     `anklicken können`);
      }
    } else {
      klicks += 1;
      const vorher = await seite.evaluate(abdruck);
      // ein ANDERES Stück als das gerade gewählte anklicken
      const wahl = await seite.evaluate(() => {
        const r = document.querySelector(".stellenreihe");
        const toks = Array.from(r.querySelectorAll(".tok"));
        const jetzt = toks.findIndex((t) => t.classList.contains("aktiv"));
        const n = jetzt === 0 ? Math.min(1, toks.length - 1) : 0;
        toks[n].scrollIntoView({ block: "center" });
        toks[n].click();
        return { n: n, text: toks[n].querySelector(".stueck").textContent };
      });
      try {
        await seite.waitForFunction(
          () => document.querySelectorAll(".laedt").length === 0,
          { timeout: 60000 });
      } catch (e) { /* die Meldung faellt unten als "nichts geaendert" auf */ }
      // Auf die Wirkung WARTEN, statt eine feste Zeit zu raten: nicht jede
      // Kachel setzt eine „laedt“-Marke, und ein fester Puffer meldet je
      // nach Serverlast mal einen Fehler und mal nicht. Ein Gate, das
      // manchmal falsch anschlägt, ist wertlos.
      let nachher = await seite.evaluate(abdruck);
      for (let v = 0; v < 20 && nachher === vorher; v++) {
        await warte(400);
        nachher = await seite.evaluate(abdruck);
      }
      await warte(700);           // Überblendungen auslaufen lassen
      nachher = await seite.evaluate(abdruck);

      const geaendert = vorher !== nachher;
      const sichtbarImBild = await seite.evaluate((wort) => {
        const treffer = [];
        document.querySelectorAll(".diagramm").forEach((d) => {
          const a = d.querySelector(".aussage");
          if (a && a.textContent.indexOf(wort) >= 0) { treffer.push("aussage"); }
          d.querySelectorAll(".z.markiert text.wort, text.gewaehlt")
            .forEach((t) => {
              if (t.textContent.indexOf(wort) >= 0) { treffer.push("marke"); }
            });
        });
        return treffer;
      }, wahl.text);

      if (!geaendert) {
        befunde.push(`${titel[i]}: Klick auf ${JSON.stringify(wahl.text)} ` +
                     `ändert NICHTS an den Bildern`);
      } else if (!sichtbarImBild.length) {
        befunde.push(`${titel[i]}: Klick auf ${JSON.stringify(wahl.text)} ` +
                     `wirkt, aber das gewählte Stück steht in KEINEM Bild ` +
                     `(weder in einer Aussage noch als Markierung)`);
      } else {
        angekommen += 1;
        console.log(`  ok    ${titel[i]} · Klick auf ` +
                    `${JSON.stringify(wahl.text)} kommt an (` +
                    sichtbarImBild.join(", ") + ")");
      }
    }

    await seite.click("#home");
    await warte(350);
  }

  console.log("");
  console.log(`${sauber} von ${gesamt} Diagrammen erklären sich selbst.`);
  console.log(`${angekommen} von ${klicks} Stellenwahlen kommen im Bild an.`);
  if (befunde.length) {
    console.log("BEFUNDE:");
    befunde.forEach((f) => console.log("  " + f));
  }
  if (fehler.length) {
    console.log("JAVASCRIPT-FEHLER:");
    fehler.slice(0, 10).forEach((f) => console.log("  " + f));
  }

  await browser.close();
  process.exit(befunde.length || fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
