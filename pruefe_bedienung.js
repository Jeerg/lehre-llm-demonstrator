// Prueft die BEDIENUNG am echten gegriffenen Element — nicht die Zahlen
// dahinter (das tut pruefe_api.py) und nicht die Beschriftung (das tut
// pruefe_diagramme.js), sondern: bewirkt ein Bedienelement das, was es
// verspricht?
//
// ANLASS. Regel A-4 verlangt, dass jeder Parameter einstellbar ist und die
// Wirkung sofort sichtbar wird — und hatte bis heute (14.08.2026) KEIN Gate;
// sie stand im Regelwerk unter "offene Punkte". Ein Regler, der nichts tut,
// faellt keinem der anderen Pruefer auf: die Zahlen stimmen, die Legende
// steht da, es gibt keinen JavaScript-Fehler. Nur der Anwender merkt es.
//
// WAS HIER GEPRUEFT WIRD, an der Kachel "Was als Naechstes kommt":
//   1. Temperaturregler ziehen               -> die Tafel aendert sich
//   2. Verfahren auf top-p umschalten        -> die Tafel aendert sich
//   3. top-p verkleinern                     -> es faellt MEHR heraus
//   4. Zeile anklicken                       -> genau diese Zeile ist gewaehlt
//   5. Auge im Spaltenkopf oeffnen           -> es schluesselt das GEWAEHLTE
//                                               Stueck auf, mit Balken
//
// EINE FALLE, DIE SCHON ZUGESCHLAGEN HAT (14.08.2026): Schritt 3 zuerst bei
// Temperatur 1,80 geprueft — dort ist die Verteilung so flach, dass top-p
// 0,50 bereits 1.022 Stuecke behaelt und der Schnitt gar nicht in die Tafel
// faellt. Der Pruefer meldete einen Fehler, den es nicht gab. Deshalb steht
// vor Schritt 3 die Temperatur ausdruecklich wieder auf 0,80.
//
// Aufruf:  node pruefe_bedienung.js [--sichtbar] [--puppeteer <pfad>]

const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const sichtbar = args.includes("--sichtbar");
const pIdx = args.indexOf("--puppeteer");
const PUPPETEER = pIdx >= 0 ? args[pIdx + 1] : path.join(
  process.env.USERPROFILE || process.env.HOME, "PycharmProjects",
  "tbx_stzrim", "portal", "node_modules", "puppeteer");
const puppeteer = require(PUPPETEER);

const URL = "http://127.0.0.1:8100/";
const AUS = path.join(__dirname, "_sicht_bedienung");
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const { warmlauf } = require("./warmlauf");

/* ══ WARUM DIESER PRUEFER BIS ZUM 15.08.2026 GEFLATTERT HAT ══════════════
 *
 * Er hat auf eine FESTE ZEIT gewartet statt auf die Wirkung. Das Muster
 * stand an sechs Stellen:
 *
 *     await tun();
 *     await seite.waitForFunction(() => keine .laedt mehr);   // wirkungslos
 *     await warte(2200);                                      // Glueckssache
 *     pruefe();
 *
 * Beide Zeilen taugen nicht:
 *
 * 1. DIE LADEWACHE GREIFT NICHT. Gemessen am 15.08. ueber vier Durchgaenge:
 *    beim Ziehen eines Reglers erscheint `.laedt` UEBERHAUPT NIE, und
 *    `waitForFunction` kehrte nach 4 bis 11 ms zurueck — es wartete auf
 *    einen Zustand, der schon galt. Die Wache sichert nur den ERSTEN
 *    Seitenaufbau, wo `.laedt` tatsaechlich erscheint.
 *
 * 2. DIE FESTE ZEIT IST EINE WETTE. Dieselbe Messung: die Wirkung kam in
 *    einem Bild nach 700 ms an, im zweiten mal nach 700, mal erst nach
 *    1.500 ms. Unter Last (mehrere Chrome-Instanzen der uebrigen Pruefer)
 *    reichen 2.200 ms mal und mal nicht — derselbe Code meldete Lauf 1
 *    "Jede Bedienung wirkt", Lauf 2 einen Befund.
 *
 * Ein Pruefer, der falsch anschlaegt, ist schlimmer als keiner: er
 * verdeckt echte Regressionen im Rauschen. Deshalb wartet dieser Pruefer
 * jetzt auf die WIRKUNG statt auf die Uhr — er kehrt zurueck, sobald sie
 * da ist (meist schneller als vorher), und meldet erst nach einer echten
 * Frist. Nur dort, wo eine NICHT-Aenderung geprueft wird, laesst sich
 * nicht auf ein Ereignis warten; dort wird auf RUHE gewartet.
 */

/** Wieviel Zeit eine Wirkung hoechstens haben darf, bevor sie als
 *  ausgeblieben gilt. Grosszuegig, weil ein Fehlalarm teurer ist als ein
 *  langsamer Lauf — erreicht wird die Frist nur im echten Fehlerfall. */
const FRIST = 20000;
const TAKT = 120;

/** Wartet, BIS `pruef` im Browser wahr meldet. Gibt die gebrauchte Zeit in
 *  Millisekunden zurueck, oder -1, wenn die Frist verstrichen ist. */
async function bisWahr(seite, pruef, args = [], frist = FRIST) {
  const t0 = Date.now();
  for (;;) {
    let da = false;
    try { da = await seite.evaluate(pruef, ...args); } catch (e) { da = false; }
    if (da) { return Date.now() - t0; }
    if (Date.now() - t0 >= frist) { return -1; }
    await warte(TAKT);
  }
}

/** Wartet, BIS `leser` etwas anderes liefert als `alt`. Gibt die
 *  gebrauchte Zeit zurueck, oder -1, wenn die Frist verstrichen ist —
 *  DANN erst ist erwiesen, dass die Bedienung nichts bewirkt. */
async function bisAnders(seite, leser, alt, frist = FRIST) {
  const t0 = Date.now();
  const alsText = JSON.stringify(alt);
  for (;;) {
    let jetzt;
    try { jetzt = JSON.stringify(await seite.evaluate(leser)); }
    catch (e) { jetzt = alsText; }
    if (jetzt !== alsText) { return Date.now() - t0; }
    if (Date.now() - t0 >= frist) { return -1; }
    await warte(TAKT);
  }
}

/** Wartet, bis sich `leser` eine Weile nicht mehr aendert — das System ist
 *  zur Ruhe gekommen. Noetig VOR einer Messung, damit der Ausgangswert
 *  nicht mitten in einer noch laufenden Aenderung genommen wird, und
 *  ueberall dort, wo eine NICHT-Aenderung nachzuweisen ist. */
async function beruhigt(seite, leser, ruhe = 600, frist = FRIST) {
  const t0 = Date.now();
  let letzt = JSON.stringify(await seite.evaluate(leser));
  let seit = Date.now();
  for (;;) {
    await warte(TAKT);
    let jetzt;
    try { jetzt = JSON.stringify(await seite.evaluate(leser)); }
    catch (e) { jetzt = letzt; }
    if (jetzt !== letzt) { letzt = jetzt; seit = Date.now(); }
    else if (Date.now() - seit >= ruhe) { return Date.now() - t0; }
    if (Date.now() - t0 >= frist) { return -1; }
  }
}

/** Ein Abdruck JEDER Darstellung der Kachel, einzeln.
 *
 *  Die Regel lautet: ein Parameter der Kachel wirkt auf ALLE ihre
 *  Darstellungen. Ein gemeinsamer Abdruck koennte das nicht pruefen — er
 *  aenderte sich schon, wenn EIN Bild reagiert, und genau das war der
 *  Fehler (die Regler wirkten auf die Tafel, das Netz derselben Kachel
 *  blieb stehen, weil `/api/netz` Temperatur und Schnitt gar nicht kannte).
 */
function abdruck() {
  const teile = [];
  document.querySelectorAll(".diagramm").forEach((d, i) => {
    const bild = d.querySelector(".bild");
    const aussage = d.querySelector(".aussage");
    teile.push({
      nr: i,
      art: bild && bild.querySelector("svg[class]")
        ? bild.querySelector("svg[class]").getAttribute("class")
        : (bild && bild.querySelector(".verwandlungstafel") ? "tafel" : "?"),
      inhalt: ((aussage ? aussage.textContent : "") +
               (bild ? bild.textContent : "")).replace(/\s+/g, " ").slice(0, 600)
    });
  });
  return teile;
}

/** Ein FEINER Abdruck: nicht nur Text, sondern auch Markierungen,
 *  Klassenwechsel, Balkenbreiten und Sichtbarkeiten.
 *
 *  Der Abdruck oben taugt fuer die Frage „hat sich die RECHNUNG geaendert",
 *  aber nicht fuer „hat der Klick irgendetwas bewirkt": eine Zeilenauswahl
 *  aendert keinen Text, nur eine Klasse. Mit dem groben Abdruck gemessen
 *  meldete der Suchlauf am 14.08. sieben tote Klicks, die alle wirkten —
 *  ein Pruefer, der falsch anschlaegt, ist schlimmer als keiner. */
function abdruckFein() {
  const t = [];
  document.querySelectorAll(".diagramm").forEach((d) => {
    t.push((d.querySelector(".aussage") || {}).textContent || "");
    const bild = d.querySelector(".bild");
    if (!bild) { return; }
    t.push(bild.textContent);
    t.push(getComputedStyle(d.parentElement || d).display);
    bild.querySelectorAll("[class]").forEach((e) => {
      t.push(String(e.className.baseVal !== undefined
        ? e.className.baseVal : e.className));
    });
    bild.querySelectorAll("path").forEach((p) => {
      t.push((p.getAttribute("opacity") || "") + "|" + (p.style.opacity || "") +
             "|" + (p.style.fill || ""));
    });
    bild.querySelectorAll("rect").forEach((r) => {
      t.push((r.getAttribute("width") || "") + "," + (r.style.fill || "") +
             "," + (r.style.opacity || ""));
    });
    bild.querySelectorAll(".tafel-zelle .balken").forEach((b) => {
      t.push(b.style.width + "|" + b.style.background);
    });
  });
  // Auch, ob die Aufschluesselung offen ist — sie liegt ausserhalb von .bild
  const auge = document.querySelector(".auge-ziel");
  t.push(auge ? auge.style.display : "-");
  return t.join("~");
}

/** Einen Regler des Stellwerks auf einen Wert stellen — wie ein Zug mit der
 *  Maus: `input` waehrend des Ziehens, `change` beim Loslassen. */
function reglerStellen(name, wert) {
  // `.stellwerk` ohne `.oben`: die Regler stehen seit dem 14.08. in der
  // Bedienleiste der Kachel, nicht mehr ueber der Tafel.
  const r = Array.from(document.querySelectorAll(".stellwerk .regler"))
    .find((x) => x.textContent.indexOf(name) === 0);
  if (!r) { return false; }
  const i = r.querySelector("input");
  i.value = String(wert);
  i.dispatchEvent(new Event("input", { bubbles: true }));
  i.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await puppeteer.launch({
    headless: !sichtbar,
    defaultViewport: { width: 1560, height: 1100 }
  });
  const seite = await browser.newPage();
  const fehler = [];
  const befunde = [];
  seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
  seite.on("console", (m) => {
    if (m.type() === "error") { fehler.push("console: " + m.text()); }
  });

  // Erst warmlaufen lassen, dann messen — sonst trifft die erste Bedienung
  // ein Modell, das noch laedt, und meldet Wirkungslosigkeit, wo nur die
  // Daten noch fehlen.
  if (!await warmlauf(URL)) {
    console.error("Server wird auch nach 4 min nicht bereit (/api/info) — " +
                  "Lauf abgebrochen, bevor er falsch rot meldet.");
    await browser.close();
    process.exit(2);
  }

  await seite.goto(URL + "#vorhersage", { waitUntil: "load", timeout: 120000 });
  await seite.reload({ waitUntil: "load" });
  await seite.waitForFunction(
    () => document.querySelectorAll(".laedt").length === 0, { timeout: 120000 });
  // HIER greift die Ladewache wirklich — beim Seitenaufbau erscheint
  // `.laedt` tatsaechlich. Danach aber nicht auf Verdacht warten, sondern
  // bis die Kachel fertig gerechnet hat und still steht; sonst misst der
  // erste Vergleich gegen einen halben Zustand.
  await bisWahr(seite, () => document.querySelectorAll(".diagramm").length >= 2);
  await beruhigt(seite, abdruck);
  await seite.evaluate(() => {
    const t = document.querySelector(".verwandlungstafel");
    if (t) { t.scrollIntoView({ block: "center" }); }
  });
  await warte(600);

  // Wieviele Darstellungen hat die Kachel ueberhaupt? Steht die Zahl nicht
  // fest, koennte der Pruefer gruen melden, weil er gar nichts gefunden hat.
  const bilder = await seite.evaluate(() => document.querySelectorAll(".diagramm").length);
  console.log(`  Kachel hat ${bilder} Darstellung(en).`);
  if (bilder < 2) {
    befunde.push(`nur ${bilder} Darstellung gefunden — die Regel "ein ` +
                 `Parameter wirkt auf ALLE" laesst sich daran nicht pruefen`);
  }

  /** Eine Bedienung ausfuehren und verlangen, dass JEDE Darstellung der
   *  Kachel danach anders aussieht — nicht nur irgendeine.
   *
   *  `nurEines` nennt (fuer Ansichts-Schalter, die nur ein Bild betreffen)
   *  die Art des Bildes, das sich aendern MUSS; alle anderen duerfen dann
   *  stehenbleiben. */
  async function wirkt(name, tun, nurEines) {
    // Erst zur Ruhe kommen lassen: sonst wird der Ausgangswert mitten in
    // der noch laufenden Wirkung des VORIGEN Schrittes genommen, und der
    // Vergleich misst zwei Aenderungen gegeneinander.
    await beruhigt(seite, abdruck);
    const vorher = await seite.evaluate(abdruck);
    await tun();

    // Auf die WIRKUNG warten, nicht auf die Uhr (siehe Kopf der Datei):
    // zurueck, sobald jede geforderte Darstellung anders ist — und erst
    // nach der vollen Frist als ausgeblieben melden.
    let nachher = [], stumm = [], gebraucht = -1;
    const t0 = Date.now();
    for (;;) {
      nachher = await seite.evaluate(abdruck);
      stumm = [];
      vorher.forEach((v, i) => {
        const n = nachher[i];
        if (!n) { return; }
        if (nurEines && n.art !== nurEines) { return; }
        if (v.inhalt === n.inhalt) { stumm.push(`${n.art} (Bild ${i + 1})`); }
      });
      if (stumm.length === 0 && nachher.length > 0) {
        gebraucht = Date.now() - t0;
        break;
      }
      if (Date.now() - t0 >= FRIST) { break; }
      await warte(TAKT);
    }

    const ok = gebraucht >= 0;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}` +
      (ok ? `  —  alle ${nachher.length} Darstellungen folgen (${gebraucht} ms)`
          : `  —  nach ${Math.round(FRIST / 1000)} s ohne Wirkung`));
    if (!ok) {
      befunde.push(`${name}: diese Darstellung(en) aendern sich NICHT — ` +
                   stumm.join(", ") + ` (auch nach ${Math.round(FRIST / 1000)} ` +
                   `s nicht; ein Parameter der Kachel muss auf ALLE ihre ` +
                   `Darstellungen wirken)`);
    }
  }

  await wirkt("Temperatur auf 1,80 gezogen",
    () => seite.evaluate(reglerStellen, "Temperatur", 1.8));

  await wirkt("Verfahren auf top-p umgeschaltet", () => seite.evaluate(() => {
    const c = Array.from(document.querySelectorAll(".verfahrenwahl .chip"))
      .find((x) => x.textContent.indexOf("top-p") >= 0);
    if (c) { c.click(); }
  }));

  // Siehe Kopf: bei 1,80 liegt der top-p-Schnitt ausserhalb der Tafel.
  await wirkt("Temperatur zurueck auf 0,80",
    () => seite.evaluate(reglerStellen, "Temperatur", 0.8));

  const vorRaus = await seite.evaluate(
    () => document.querySelectorAll(".tafel-zeile.raus").length);
  await wirkt("top-p auf 0,50 gezogen",
    () => seite.evaluate(reglerStellen, "top-p", 0.5));
  const nachRaus = await seite.evaluate(
    () => document.querySelectorAll(".tafel-zeile.raus").length);
  const mehr = nachRaus > vorRaus;
  console.log(`  ${mehr ? "ok  " : "FAIL"}  kleineres top-p schneidet mehr ` +
    `weg (${vorRaus} -> ${nachRaus} Zeilen heraus)`);
  if (!mehr) {
    befunde.push(`top-p 0,50 schneidet nicht mehr weg als 0,90 ` +
                 `(${vorRaus} -> ${nachRaus})`);
  }

  // ── Die Tafel aufklappen ─────────────────────────────────────────────
  //
  // Voreingestellt ist KNAPP (Wort, Balken, Prozent) — wie im Vorbild.
  // Die Zahlenspalten und mit ihnen das Auge erscheinen erst hier.
  const vorSpalten = await seite.evaluate(
    () => document.querySelectorAll(".tafel-zeile .tafel-zelle").length &&
      getComputedStyle(document.querySelector(".tafel-zelle.sp0")).display);
  await seite.evaluate(() => {
    const l = document.querySelector(".tafel-lupe");
    if (l) { l.click(); }
  });
  // Warten, BIS die Zahlenspalten da sind — nicht 1.200 ms auf Verdacht.
  await bisWahr(seite, () => {
    const z = document.querySelector(".tafel-zelle.sp0");
    return !!z && getComputedStyle(z).display !== "none";
  });
  const nachSpalten = await seite.evaluate(
    () => getComputedStyle(document.querySelector(".tafel-zelle.sp0")).display);
  const klappt = vorSpalten === "none" && nachSpalten !== "none";
  console.log(`  ${klappt ? "ok  " : "FAIL"}  Tafel startet knapp und klappt ` +
    `auf (Zahlenspalten: ${vorSpalten} -> ${nachSpalten})`);
  if (!klappt) {
    befunde.push(`die Tafel startet nicht knapp oder klappt nicht auf ` +
                 `(${vorSpalten} -> ${nachSpalten})`);
  }

  // ── Zeilenwahl ───────────────────────────────────────────────────────
  const geklickt = await seite.evaluate(() => {
    const z = Array.from(document.querySelectorAll(".tafel-zeile"));
    if (z.length < 3) { return null; }
    z[2].scrollIntoView({ block: "center" });
    z[2].click();
    return z[2].querySelector(".tafel-name").textContent;
  });
  // Warten, BIS die geklickte Zeile als gewaehlt markiert ist.
  await bisWahr(seite, (name) => {
    const g = document.querySelector(".tafel-zeile.gewaehlt");
    return !!g && g.querySelector(".tafel-name").textContent === name;
  }, [geklickt]);
  const gewaehlt = await seite.evaluate(() => {
    const g = document.querySelector(".tafel-zeile.gewaehlt");
    return g ? g.querySelector(".tafel-name").textContent : null;
  });
  const trifft = geklickt !== null && geklickt === gewaehlt;
  console.log(`  ${trifft ? "ok  " : "FAIL"}  Klick auf Zeile ` +
    `${JSON.stringify(geklickt)} waehlt sie (gewaehlt: ` +
    `${JSON.stringify(gewaehlt)})`);
  if (!trifft) {
    befunde.push(`Zeilenklick auf ${JSON.stringify(geklickt)} waehlt ` +
                 `${JSON.stringify(gewaehlt)}`);
  }

  // KEIN TOTER KLICK: ein zweiter Klick auf DIESELBE Zeile darf die Wahl
  // nicht zuruecknehmen — sie faellt dann auf das wahrscheinlichste Stueck
  // zurueck, und bei Zeile 1 waere das dasselbe. Gemessen am 14.08.: genau
  // dieser Klick war tot ("man kann was anklicken im bild es bewirkt aber
  // nichts").
  await seite.evaluate(() => {
    const g = document.querySelector(".tafel-zeile.gewaehlt");
    if (g) { g.click(); }
  });
  // HIER wird eine NICHT-Aenderung nachgewiesen — auf ein Ereignis laesst
  // sich dabei nicht warten. Also auf RUHE warten: erst wenn sich die
  // Markierung eine Weile nicht mehr bewegt, steht fest, was gilt. Eine
  // feste Wartezeit haette denselben Fehler wie oben.
  await beruhigt(seite, () => {
    const g = document.querySelector(".tafel-zeile.gewaehlt");
    return g ? g.querySelector(".tafel-name").textContent : null;
  });
  const nochGewaehlt = await seite.evaluate(() => {
    const g = document.querySelector(".tafel-zeile.gewaehlt");
    return g ? g.querySelector(".tafel-name").textContent : null;
  });
  const bleibt = nochGewaehlt === gewaehlt;
  console.log(`  ${bleibt ? "ok  " : "FAIL"}  zweiter Klick auf dieselbe ` +
    `Zeile nimmt die Wahl NICHT zurueck (${JSON.stringify(nochGewaehlt)})`);
  if (!bleibt) {
    befunde.push(`zweiter Klick auf die gewaehlte Zeile setzt sie auf ` +
                 `${JSON.stringify(nochGewaehlt)} zurueck — ein Klick, der ` +
                 `nichts bewirkt`);
  }

  // ── Das Auge im Spaltenkopf ──────────────────────────────────────────
  await seite.evaluate(() => {
    const k = document.querySelector(".spaltenknopf");
    if (k) { k.click(); }
  });
  // Warten, BIS das Auge sichtbar ist und seine Aussage traegt.
  await bisWahr(seite, () => {
    const z = document.querySelector(".auge-ziel");
    if (!z || z.style.display === "none") { return false; }
    const a = z.querySelector(".aussage");
    return !!a && a.textContent.trim().length > 0;
  });
  const auge = await seite.evaluate(() => {
    const z = document.querySelector(".auge-ziel");
    if (!z || z.style.display === "none") { return null; }
    const a = z.querySelector(".aussage");
    const b = z.querySelector(".bezug");
    return {
      aussage: a ? a.textContent.trim() : "",
      bezug: b ? b.textContent.replace(/\s+/g, " ") : "",
      balken: z.querySelectorAll("rect.bar").length
    };
  });
  if (!auge) {
    befunde.push("das Auge im Spaltenkopf oeffnet nichts");
    console.log("  FAIL  Auge oeffnet nichts");
  } else {
    const hatBalken = auge.balken > 0;
    // Das Auge MUSS das gewaehlte Stueck aufschluesseln, nicht irgendeines.
    const nackt = String(gewaehlt || "").replace(/·/g, " ").trim();
    const passt = nackt ? auge.bezug.indexOf(nackt) >= 0 : true;
    // Und die Probe MUSS darin stehen — ohne sie ist die Aufschluesselung
    // eine Behauptung.
    const probe = auge.aussage.indexOf("Unterschied") >= 0 &&
                  auge.aussage.indexOf("Schritte") >= 0;
    console.log(`  ${hatBalken ? "ok  " : "FAIL"}  Auge zeigt ${auge.balken} Balken`);
    console.log(`  ${passt ? "ok  " : "FAIL"}  Auge schluesselt das gewaehlte ` +
      `Stueck ${JSON.stringify(gewaehlt)} auf`);
    console.log(`  ${probe ? "ok  " : "FAIL"}  Auge nennt die Probe gegen das ` +
      `Logit des Modells`);
    if (!hatBalken) { befunde.push("das Auge zeigt keine Balken"); }
    if (!passt) {
      befunde.push(`das Auge zeigt nicht das gewaehlte Stueck ` +
                   `${JSON.stringify(gewaehlt)}: ${auge.bezug.slice(-70)}`);
    }
    if (!probe) { befunde.push("dem Auge fehlt die Probe gegen das Logit"); }
  }

  // ── KEIN TOTER KLICK IRGENDWO IM BILD ────────────────────────────────
  //
  // Befund des Anwenders, 14.08.2026: "man kann was anklicken im bild es
  // bewirkt aber nichts". Deshalb hier zum Schluss ein Suchlauf ueber ALLE
  // anklickbaren Dinge in den Bildern der Kachel: jedes einmal anfassen und
  // verlangen, dass sich danach irgendetwas geaendert hat. Was aussieht wie
  // ein Bedienelement, MUSS eines sein.
  const sorten = await seite.evaluate(() => {
    const gesehen = new Set(), liste = [];
    document.querySelectorAll(".diagramm .bild").forEach((bild, bi) => {
      bild.querySelectorAll("*").forEach((e) => {
        if (getComputedStyle(e).cursor !== "pointer") { return; }
        if (e.parentElement &&
            getComputedStyle(e.parentElement).cursor === "pointer") { return; }
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) { return; }
        const k = String(e.className.baseVal !== undefined
          ? e.className.baseVal : e.className).slice(0, 40);
        const kennung = bi + "|" + k + "|" + e.tagName;
        if (gesehen.has(kennung)) { return; }
        gesehen.add(kennung);
        liste.push({ bild: bi, klasse: k, tag: e.tagName,
                     text: (e.textContent || "").trim().slice(0, 24) });
      });
    });
    return liste;
  });
  console.log(`  ${sorten.length} Sorten anklickbarer Elemente in den Bildern:`);
  for (const s of sorten) {
    const vorher = await seite.evaluate(abdruckFein);
    const da = await seite.evaluate((bi, klasse, tag) => {
      const bild = document.querySelectorAll(".diagramm .bild")[bi];
      if (!bild) { return false; }
      const treffer = Array.from(bild.querySelectorAll("*")).filter((e) => {
        const c = String(e.className.baseVal !== undefined
          ? e.className.baseVal : e.className).slice(0, 40);
        return c === klasse && e.tagName === tag &&
               getComputedStyle(e).cursor === "pointer";
      });
      if (!treffer.length) { return false; }
      const el = treffer[Math.min(1, treffer.length - 1)];
      el.scrollIntoView({ block: "center" });
      el.dispatchEvent(new MouseEvent("click",
        { bubbles: true, cancelable: true, view: window }));
      return true;
    }, s.bild, s.klasse, s.tag);
    if (!da) { continue; }
    // Warten, BIS sich etwas geruehrt hat — erst nach der vollen Frist gilt
    // ein Element als tot. Mit den alten 1.300 ms auf Verdacht wurde jeder
    // langsame Klick als "TOT" gemeldet; genau solche Fehlalarme meint der
    // Kommentar an `abdruckFein` ("ein Pruefer, der falsch anschlaegt, ist
    // schlimmer als keiner").
    // Kuerzere Frist als sonst: hier wird JEDES anklickbare Element einmal
    // angefasst, und die volle Frist mal ihrer Zahl waere ein sehr langer
    // Lauf. Ein Klick, der nach sechs Sekunden nichts bewirkt hat, ist tot.
    const gebrauchtKlick = await bisAnders(seite, abdruckFein, vorher, 6000);
    const nachher = await seite.evaluate(abdruckFein);
    const wirkt = gebrauchtKlick >= 0;
    console.log(`    ${wirkt ? "ok  " : "TOT "} Bild ${s.bild + 1} · ` +
      `<${s.tag}> .${s.klasse || "(ohne Klasse)"} ${JSON.stringify(s.text)}`);
    if (!wirkt) {
      befunde.push(`toter Klick: <${s.tag}> .${s.klasse} in Bild ` +
                   `${s.bild + 1} sieht anklickbar aus, bewirkt aber nichts`);
    }
  }

  await seite.evaluate(() => {
    const t = document.querySelector(".tafelblock");
    if (t) { t.scrollIntoView({ block: "start" }); }
  });
  await warte(500);
  await seite.screenshot({ path: path.join(AUS, "vorhersage-bedienung.png") });

  console.log("");
  console.log(befunde.length ? "BEFUNDE:" : "Jede Bedienung wirkt.");
  befunde.forEach((b) => console.log("  - " + b));
  if (fehler.length) {
    console.log("JAVASCRIPT-FEHLER:");
    fehler.slice(0, 8).forEach((f) => console.log("  " + f));
  }
  await browser.close();
  process.exit(befunde.length || fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
