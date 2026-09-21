// Gezielte Sichtkontrolle einzelner Anschauungen.
//
// uat.js fotografiert jede Kachel von oben. Die neuen, tieferen
// Anschauungen liegen weiter unten auf der Seite und waeren so nie im Bild.
// Dieses Skript oeffnet eine Kachel, sucht ein bestimmtes Element und
// fotografiert genau dieses — samt Groessen- und Inhaltspruefung.
//
// Aufruf:  node uat_detail.js [--sichtbar]

const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const sichtbar = args.includes("--sichtbar");
const PUPPETEER = path.join(
  process.env.USERPROFILE || process.env.HOME, "PycharmProjects",
  "tbx_stzrim", "portal", "node_modules", "puppeteer");
const puppeteer = require(PUPPETEER);

const URL = "http://127.0.0.1:8100/";
const AUS = path.join(__dirname, "_sicht_detail");
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Kachel-Kennung, gesuchtes Element, Name des Bildes
const ZIELE = [
  ["raum", ".dimfeld", "dimensionsfeld"],
  ["koepfe", ".d3-landkarte", "landkarte"],
  ["strom", ".d3-posfeld", "positionsfeld"],
  ["strom", ".d3-saeulen", "bauteile"],
  ["eingriffe", ".karten", "eingriff-wirkung"],
  ["token", ".tab", "sprachvergleich"],
  ["bedeutung", ".d3-balken", "analogie"],
  ["steckbrief", ".befund", "parameterzahl"],
  // Die Herleitungen stehen zugeklappt und rechnen erst beim Oeffnen — ohne
  // Aufklappen waere hier nichts zu fotografieren.
  ["attention", ".d3-kette", "attention-drei-stufen"],
  ["vorhersage", ".verwandlungstafel", "logit-kette"]
];

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await puppeteer.launch({
    headless: !sichtbar,
    defaultViewport: { width: 1560, height: 1100 }
  });
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
  seite.on("console", (m) => {
    if (m.type() === "error") { fehler.push("console: " + m.text()); }
  });

  for (const [kachel, wahl, name] of ZIELE) {
    await seite.goto(URL + "#" + kachel, { waitUntil: "load", timeout: 120000 });
    await seite.reload({ waitUntil: "load" });
    try {
      await seite.waitForFunction(
        () => document.querySelectorAll(".laedt").length === 0,
        { timeout: 120000 });
    } catch (e) { fehler.push(`${kachel}: rechnet nicht fertig`); }
    await warte(1600);

    // Zugeklappte Herleitungen oeffnen: ihre Bilder entstehen erst dabei.
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
      } catch (e) { fehler.push(`${kachel}: Herleitung rechnet nicht fertig`); }
      await warte(1400);        // gestaffeltes Einblenden abwarten
    }

    const alle = await seite.$$(wahl);
    if (!alle.length) {
      console.log(`  FEHLT   ${name.padEnd(20)} (${wahl} in Kachel ${kachel})`);
      fehler.push(`${name}: ${wahl} nicht vorhanden`);
      continue;
    }
    // das letzte Vorkommen nehmen: die neuen Anschauungen stehen unten
    const el = alle[alle.length - 1];
    const box = await el.boundingBox();
    if (!box || box.height < 20) {
      console.log(`  LEER    ${name.padEnd(20)} Höhe ${box ? Math.round(box.height) : 0}px`);
      fehler.push(`${name}: Element ist leer oder ohne Höhe`);
      continue;
    }
    await el.screenshot({ path: path.join(AUS, `${name}.png`) });
    console.log(`  ok      ${name.padEnd(20)} ${Math.round(box.width)}×${Math.round(box.height)}px`);
  }

  console.log("");
  console.log(fehler.length ? "BEFUNDE:" : "Keine Befunde.");
  fehler.slice(0, 12).forEach((f) => console.log("  " + f));
  await browser.close();
  process.exit(fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
