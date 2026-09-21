// Sucht unlesbare Schrift — Text, der sich zu wenig von seinem Grund abhebt.
//
// Anlass (13.08.2026, Befund des Anwenders): "du hast schwarze schrift auf
// schwarzem grund in den diagrammen". Ein solcher Fehler entsteht lautlos:
// wer ein Element erzeugt, das keine Farbregel trifft, bekommt die
// Vorgabefarbe des Browsers — SCHWARZ — und auf dem dunklen Grund dieses
// Demonstrators ist das unsichtbar. Kein bestehender Pruefer sah das:
// pruefe_diagramme achtet auf Beschriftungen, uat.js auf Fehler und
// Ueberlauf. Beide meldeten gruen, waehrend nichts zu lesen war.
//
// Gemessen wird das TATSAECHLICH GERENDERTE Bild, nicht die CSS-Absicht:
// je Kachel ein Vollbild, daraus der Ausschnitt jedes Textes, darin der
// Kontrast zwischen hellstem und dunkelstem Bildpunkt. Damit faellt auch
// Text auf, der ueber einer eingefaerbten Flaeche steht (SVG-Rechtecke,
// Balken, Farbleisten) — dort hilft kein Blick ins CSS.
//
// SEIT DEM 20.08.2026 ZWEI FASSUNGEN. Der Demonstrator laeuft hell (Hoersaal)
// und dunkel (Bildschirm). Ein Kontrastfehler kann in EINER der beiden
// stecken — genau das ist der wahrscheinliche Fall, weil die Farben je
// Fassung andere sind. Der Pruefer laeuft deshalb standardmaessig ZWEIMAL.
// Wer nur eine sehen will: --fassung hell | --fassung dunkel.
//
// Aufruf:  node pruefe_kontrast.js [--fassung hell|dunkel] [--sichtbar]
//                                  [--puppeteer <pfad>]

const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const args = process.argv.slice(2);
const sichtbar = args.includes("--sichtbar");
const fIdx = args.indexOf("--fassung");
const FASSUNGEN = fIdx >= 0 ? [args[fIdx + 1]] : ["hell", "dunkel"];
const pIdx = args.indexOf("--puppeteer");
const PUPPETEER = pIdx >= 0 ? args[pIdx + 1] : path.join(
  process.env.USERPROFILE || process.env.HOME, "PycharmProjects",
  "tbx_stzrim", "portal", "node_modules", "puppeteer");
const puppeteer = require(PUPPETEER);

const URL = "http://127.0.0.1:8100/";
const AUS = path.join(__dirname, "_sicht_kontrast");
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// WCAG: 3,0 fuer grosse, 4,5 fuer normale Schrift. Unter 3,0 wird Text
// nicht mehr gelesen, sondern erraten — das ist die harte Grenze.
const HART = 3.0;
const WARNUNG = 4.5;

async function lauf(fassung) {
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await puppeteer.launch({
    headless: !sichtbar,
    defaultViewport: { width: 1560, height: 1100 }
  });
  const seite = await browser.newPage();
  const befunde = [];
  const warnungen = [];

  // Die Fassung wird VOR dem ersten Bildaufbau gesetzt, nicht danach
  // umgeschaltet: palette.js liest sie beim Laden, und ein nachtraegliches
  // Umschalten wuerde die erste Messung auf der falschen Fassung machen.
  await seite.evaluateOnNewDocument((f) => {
    window.localStorage.setItem("demonstrator.fassung", f);
  }, fassung);

  console.log("");
  console.log(`══ Fassung: ${fassung} ══`);
  await seite.goto(URL, { waitUntil: "load", timeout: 120000 });
  await seite.waitForSelector(".kachel", { timeout: 180000 });
  const anzahl = await seite.$$eval(".kachel", (k) => k.length);
  const titel = await seite.$$eval(".kachel h3", (k) => k.map((e) => e.textContent));

  for (let i = 0; i < anzahl; i++) {
    const kacheln = await seite.$$(".kachel");
    await kacheln[i].click();
    try {
      await seite.waitForFunction(
        () => document.querySelectorAll(".laedt").length === 0,
        { timeout: 120000 });
    } catch (e) { /* faellt unten als fehlender Text auf */ }
    await warte(1400);

    // Herleitungen aufklappen — sonst bleibt ungeprueft, was zuletzt
    // dazugekommen ist.
    const auf = await seite.evaluate(() => {
      const d = Array.from(document.querySelectorAll("details.herleitung"));
      d.forEach((x) => { if (!x.open) { x.open = true; } });
      return d.length;
    });
    if (auf) {
      try {
        await seite.waitForFunction(
          () => document.querySelectorAll(".laedt").length === 0,
          { timeout: 120000 });
      } catch (e) { /* s.o. */ }
      await warte(1500);
    }

    // ABSCHNITTSWEISE, NICHT ALS VOLLBILD.
    //
    // Die erste Fassung nahm ein `fullPage`-Bild. Das ist falsch: Puppeteer
    // setzt dafuer den Viewport auf die volle Seitenhoehe, und weil dieses
    // Layout an der Fensterhoehe haengt (`html, body { height: 100% }`,
    // flex-Spalte), verschieben sich dabei die Elemente. Gemessen wurde
    // dann NEBEN dem Text — von den 40 gemeldeten "unlesbaren" Stellen war
    // ein Teil in Wahrheit gut lesbar, und einer der abgelegten
    // Ausschnitte war schlicht leer. Ein Pruefer, der falschen Alarm
    // schlaegt, ist schlimmer als keiner.
    //
    // Also: durchscrollen und je Abschnitt den SICHTBAREN Ausschnitt
    // fotografieren. Da bleibt das Layout, wie der Anwender es sieht.
    //
    // GESCROLLT WIRD `main#scroller`, NICHT DAS FENSTER.
    // Diese Seite haengt an der Fensterhoehe (`html, body { height: 100% }`,
    // flex-Spalte) und laesst `main#scroller` scrollen — `window.scrollTo`
    // tut hier schlicht nichts, und `documentElement.scrollHeight` ist die
    // Fensterhoehe. Solange das uebersehen war, hat der Pruefer immer nur
    // den ERSTEN Bildschirm fotografiert und alles darunter an falschen
    // Stellen gemessen: 40 gemeldete "unlesbare" Stellen, deren abgelegte
    // Ausschnitte leer waren.
    // `clientHeight` des Scrollers, NICHT die Fensterhoehe: nur so ist der
    // Schritt so gross wie das, was wirklich zu sehen ist.
    const masse = await seite.evaluate(() => {
      const s = document.querySelector("main#scroller") ||
                document.scrollingElement;
      return { hoehe: s.scrollHeight, fenster: s.clientHeight };
    });
    const schritt = Math.max(200, Math.floor(masse.fenster * 0.85));
    let geprueft = 0;
    const gemessen = new Set();

    for (let oben = 0; oben < masse.hoehe; oben += schritt) {
      await seite.evaluate((y) => {
        const s = document.querySelector("main#scroller") ||
                  document.scrollingElement;
        s.scrollTop = y;
      }, oben);
      await warte(300);

      // ERST die Lagen holen, DANN fotografieren.
      //
      // Andersherum lagen Bild und Koordinaten auseinander, sobald nach dem
      // Foto noch ein Layout-Durchlauf kam — und dann wurde neben dem Text
      // gemessen. `getClientRects()` erzwingt den Durchlauf selbst; was
      // danach fotografiert wird, ist genau der vermessene Zustand.
      const stellen = await seite.evaluate(() => {
        // DER SICHTBARE BEREICH IST `main#scroller`, NICHT DAS FENSTER.
        //
        // Vierte Falle derselben Familie wie das Scrollen (siehe oben):
        // `main#scroller` endet vor dem Fensterrand (darüber liegt der Kopf,
        // darunter kann Rand stehen), und was jenseits seiner Kanten liegt,
        // wird ABGESCHNITTEN — gezeichnet wird dort nichts. Die Rechtecke aus
        // `getClientRects()` gibt es trotzdem, sie liegen nur außerhalb.
        //
        // Gegen `window.innerHeight` geprüft rutschten genau diese Zeilen
        // durch, und gemessen wurde reines Schwarz: 1,00:1 für Text, den es
        // im Bild gar nicht gibt. Nachgemessen am 14.08.2026 — ALLE neun
        // Meldungen der Kachel „Was als Nächstes kommt“ lagen bei y = 1057
        // bis 1094 bei einem Fenster von 1100 und einer Scroller-Unterkante
        // darüber; hell und dunkel waren beide 0,011.
        const sc = document.querySelector("main#scroller");
        const sicht = sc ? sc.getBoundingClientRect()
                         : { top: 0, bottom: window.innerHeight,
                             left: 0, right: window.innerWidth };
        // JEDE TEXTZEILE EINZELN, nicht das Element. Ein <b> mitten im
        // Satz liefert als Element ein Rechteck ueber beide Zeilen, in dem
        // der Text nur an den Raendern steht — darin gemessen kommt Unsinn
        // heraus. `Range.getClientRects()` gibt die echten Zeilenkaesten.
        const ergebnis = [];
        document.querySelectorAll(".diagramm, .feld, .aufklapp-inhalt")
          .forEach((w) => {
            const lauf = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
            let n;
            while ((n = lauf.nextNode())) {
              const text = n.textContent.trim();
              if (!text) { continue; }
              const e = n.parentElement;
              if (!e) { continue; }
              // ZUGEKLAPPTE AUFKLAPP-BEREICHE UEBERSPRINGEN.
              // Chrome behaelt fuer den Inhalt eines geschlossenen
              // <details> das Layout bei (content-visibility) — die
              // Zeilenkaesten sind also da, gezeichnet wird aber nichts.
              // Gemessen ergab das reihenweise 1,00:1 fuer Text, den man
              // gar nicht sehen soll; die abgelegten Ausschnitte waren
              // folgerichtig leer. Das war der Rest des Fehlalarms.
              if (e.closest("details:not([open])")) { continue; }
              const s = getComputedStyle(e);
              if (s.visibility === "hidden" || s.display === "none") { continue; }
              // Blasse Stellen sind Absicht (ausgeschnittene Zeilen der
              // Verwandlungstafel) und sind kein Mangel.
              let o = 1, p = e;
              while (p && p !== document.body) {
                o *= parseFloat(getComputedStyle(p).opacity) || 1;
                p = p.parentElement;
              }
              if (o < 0.6) { continue; }

              const r = document.createRange();
              r.selectNodeContents(n);
              Array.from(r.getClientRects()).forEach((b, nr) => {
                if (b.width < 8 || b.height < 7) { return; }
                // nur, was in DIESEM Abschnitt GANZ IM SCHEIBENFENSTER liegt
                if (b.top < sicht.top + 2 || b.bottom > sicht.bottom - 2) { return; }
                if (b.left < sicht.left || b.right > sicht.right) { return; }
                ergebnis.push({
                  schluessel: (e.getAttribute("class") || e.tagName) + "|" +
                    text.slice(0, 30) + "|" + nr,
                  text: text.slice(0, 44),
                  klasse: (e.getAttribute("class") || e.tagName)
                    .toString().slice(0, 44),
                  x: Math.round(b.left), y: Math.round(b.top),
                  b: Math.round(b.width), h: Math.round(b.height)
                });
              });
            }
          });
        return ergebnis;
      });

      const bild = entpacken(await seite.screenshot({ type: "png" }));
      if (!bild) { continue; }

      for (const s of stellen) {
        if (gemessen.has(s.schluessel)) { continue; }
        gemessen.add(s.schluessel);
        // Einen Punkt Luft nach innen: der aeusserste Rand einer Zeilenbox
        // traegt oft schon den Nachbarn (Balken, Zellrand, Rahmen).
        const v = messen(bild, s.x, s.y + 1, Math.min(s.b, 460),
                         Math.max(4, s.h - 2));
        if (!v) { continue; }
        geprueft += 1;
        const k = kontrast(v.hell, v.dunkel);
        // DIE MESSSTELLE GEHOERT IN DIE MELDUNG. Ohne sie kostet jeder
        // Fehlalarm eine halbe Sitzung: man sucht den Fehler auf der Seite,
        // statt zu sehen, dass der Pruefer neben dem Text gemessen hat.
        const zeile = `${titel[i]} · ${s.klasse} · "${s.text}" → ` +
          `${k.toFixed(2)}:1   [x=${s.x} y=${s.y} ${s.b}×${s.h}]`;
        if (k < HART) {
          befunde.push(zeile);
          ausschnitt(bild, s, path.join(AUS,
            `${fassung}-${String(i + 1).padStart(2, "0")}-${befunde.length}-` +
            `${s.klasse.replace(/[^a-z0-9]/gi, "_").slice(0, 24)}.png`));
        } else if (k < WARNUNG) {
          warnungen.push(zeile);
        }
      }
    }
    // ── UNSICHTBARE LINIEN ───────────────────────────────────────────────
    //
    // Dieselbe Krankheit wie unlesbare Schrift, nur an Strichen: eine Linie
    // unter einem Bildpunkt Breite UND mit niedriger Deckkraft bringt
    // weniger als ein Fuenftel Bildpunkt Farbe auf die Flaeche — der Browser
    // rechnet sie zu einem Grauschleier.
    //
    // Befund des Anwenders, 14.08.2026: "jetzt sind die linien in der grafik
    // weg". Gemessen an der Kachel "Woher ein Wort seine Information holt":
    // 0,7 bis 1,1 px breit bei 15 bis 25 % Deckkraft. Sichtbar war nur die
    // dickste Linie.
    const duenn = await seite.evaluate(() => {
      const schwach = [];
      document.querySelectorAll(".diagramm .bild svg").forEach((svg) => {
        const art = svg.getAttribute("class") || "svg";
        svg.querySelectorAll("path, line").forEach((p) => {
          const sw = parseFloat(p.getAttribute("stroke-width") ||
                                p.style.strokeWidth || "0");
          const so = parseFloat(p.getAttribute("stroke-opacity") ||
                                p.style.strokeOpacity || "1");
          const hatStrich = (p.getAttribute("stroke") || p.style.stroke ||
                             "none") !== "none";
          if (!hatStrich || !sw) { return; }
          // Farbmenge je Laengeneinheit: Breite mal Deckkraft.
          if (sw * so < 0.5) {
            schwach.push(`${art}: ${sw.toFixed(2)} px bei ` +
                         `${Math.round(so * 100)} % = ${(sw * so).toFixed(2)}`);
          }
        });
      });
      return schwach;
    });
    if (duenn.length) {
      // Nur die Sorte melden, nicht jede einzelne Linie.
      const sorten = Array.from(new Set(duenn.map((d) => d.split(":")[0])));
      befunde.push(`${titel[i]}: ${duenn.length} Linien unter 0,5 Bildpunkt ` +
        `Farbmenge (Breite × Deckkraft) in ${sorten.join(", ")} — ` +
        `Beispiel: ${duenn[0]}`);
    }

    await seite.evaluate(() => {
      const s = document.querySelector("main#scroller") ||
                document.scrollingElement;
      s.scrollTop = 0;
    });
    console.log(`  ${String(i + 1).padStart(2, "0")}  ${titel[i].padEnd(32)} ` +
      `${geprueft} Textzeilen` +
      (duenn.length ? `  · ${duenn.length} zu schwache Linien` : ""));
    await seite.click("#home");
    await warte(350);
  }

  console.log("");
  if (warnungen.length) {
    console.log(`${warnungen.length} knapp (3,0–4,5:1 — lesbar, aber schwach):`);
    warnungen.slice(0, 8).forEach((w) => console.log("  ~ " + w));
    if (warnungen.length > 8) { console.log(`  … und ${warnungen.length - 8} weitere`); }
    console.log("");
  }
  if (befunde.length) {
    console.log(`${befunde.length} UNLESBAR (unter 3,0:1):`);
    befunde.forEach((b) => console.log("  - " + b));
    console.log(`\nAusschnitte liegen in ${AUS}`);
  } else {
    console.log("Keine unlesbare Schrift. Jeder Text hebt sich um mindestens " +
      "3,0:1 von seinem Grund ab.");
  }
  await browser.close();
  return { fassung, befunde, warnungen };
}

(async () => {
  const ergebnisse = [];
  for (const f of FASSUNGEN) { ergebnisse.push(await lauf(f)); }

  // EINE Zusammenfassung ueber beide Fassungen. Ohne sie muesste man aus
  // zwei Ausgaben selbst zusammenrechnen, ob der Lauf gruen war — und ein
  // Befund in der zweiten Fassung ginge im Text der ersten unter.
  console.log("");
  console.log("══ Zusammen ══");
  let summe = 0;
  ergebnisse.forEach((e) => {
    summe += e.befunde.length;
    console.log(`  ${e.fassung.padEnd(7)} ${e.befunde.length} unlesbar · ` +
      `${e.warnungen.length} knapp`);
  });
  if (!summe) {
    console.log("  Keine unlesbare Schrift — in KEINER der geprüften Fassungen.");
  }
  process.exit(summe ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// --- PNG entpacken, ohne fremde Bibliothek ---------------------------------
// Ein PNG aus Puppeteer ist 8 Bit RGB(A) ohne Palette; zlib bringt Node mit.

function entpacken(puffer) {
  let p = 8, breite = 0, hoehe = 0, tiefe = 0, art = 0;
  const teile = [];
  while (p + 8 <= puffer.length) {
    const laenge = puffer.readUInt32BE(p);
    const typ = puffer.toString("ascii", p + 4, p + 8);
    if (typ === "IHDR") {
      breite = puffer.readUInt32BE(p + 8);
      hoehe = puffer.readUInt32BE(p + 12);
      tiefe = puffer[p + 16];
      art = puffer[p + 17];
    } else if (typ === "IDAT") {
      teile.push(puffer.slice(p + 8, p + 8 + laenge));
    } else if (typ === "IEND") { break; }
    p += laenge + 12;
  }
  if (tiefe !== 8 || (art !== 2 && art !== 6)) { return null; }
  const kanaele = art === 6 ? 4 : 3;
  let roh;
  try { roh = zlib.inflateSync(Buffer.concat(teile)); } catch (e) { return null; }

  const zeile = breite * kanaele;
  const daten = Buffer.alloc(hoehe * zeile);
  let q = 0;
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[q]; q += 1;
    for (let x = 0; x < zeile; x++) {
      const rb = roh[q + x];
      const a = x >= kanaele ? daten[y * zeile + x - kanaele] : 0;
      const b = y > 0 ? daten[(y - 1) * zeile + x] : 0;
      const c = (x >= kanaele && y > 0) ? daten[(y - 1) * zeile + x - kanaele] : 0;
      let w;
      if (filter === 0) { w = rb; }
      else if (filter === 1) { w = rb + a; }
      else if (filter === 2) { w = rb + b; }
      else if (filter === 3) { w = rb + ((a + b) >> 1); }
      else {                                        // Paeth
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        w = rb + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c));
      }
      daten[y * zeile + x] = w & 0xff;
    }
    q += zeile;
  }
  return { breite: breite, hoehe: hoehe, kanaele: kanaele, daten: daten };
}

/** Hellster und dunkelster Bildpunkt in einem Ausschnitt. Bei einer
 *  Textzeile ist das die Schrift gegen ihren Grund. */
function messen(bild, x, y, b, h) {
  x = Math.max(0, x); y = Math.max(0, y);
  b = Math.min(b, bild.breite - x); h = Math.min(h, bild.hoehe - y);
  if (b < 4 || h < 4) { return null; }
  const zeile = bild.breite * bild.kanaele;
  let hell = -1, dunkel = 2;
  for (let j = y; j < y + h; j++) {
    for (let k = x; k < x + b; k++) {
      const o = j * zeile + k * bild.kanaele;
      const l = leuchtdichte(bild.daten[o], bild.daten[o + 1], bild.daten[o + 2]);
      if (l > hell) { hell = l; }
      if (l < dunkel) { dunkel = l; }
    }
  }
  return { hell: hell, dunkel: dunkel };
}

/** Den beanstandeten Ausschnitt als PNG ablegen — damit man nachsehen kann,
 *  statt der Zahl glauben zu muessen. */
function ausschnitt(bild, s, ziel) {
  const b = Math.min(Math.min(s.b, 460), bild.breite - s.x);
  const h = Math.min(s.h, bild.hoehe - s.y);
  if (b < 1 || h < 1) { return; }
  const zeile = bild.breite * bild.kanaele;
  const roh = Buffer.alloc(h * (1 + b * 3));
  let q = 0;
  for (let j = 0; j < h; j++) {
    roh[q] = 0; q += 1;                                  // Filter "keiner"
    for (let k = 0; k < b; k++) {
      const o = (s.y + j) * zeile + (s.x + k) * bild.kanaele;
      roh[q] = bild.daten[o]; roh[q + 1] = bild.daten[o + 1];
      roh[q + 2] = bild.daten[o + 2];
      q += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(b, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(ziel, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    brocken("IHDR", ihdr), brocken("IDAT", zlib.deflateSync(roh)),
    brocken("IEND", Buffer.alloc(0))]));
}

function brocken(typ, daten) {
  const l = Buffer.alloc(4); l.writeUInt32BE(daten.length, 0);
  const inhalt = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(inhalt) >>> 0, 0);
  return Buffer.concat([l, inhalt, c]);
}

let _crcTabelle = null;
function crc(puffer) {
  if (!_crcTabelle) {
    _crcTabelle = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) { c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); }
      _crcTabelle[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < puffer.length; i++) {
    c = _crcTabelle[(c ^ puffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function leuchtdichte(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function kontrast(hell, dunkel) {
  return (hell + 0.05) / (dunkel + 0.05);
}
