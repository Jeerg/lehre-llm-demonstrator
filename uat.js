// Sichtkontrolle des Demonstrators in echtem Chrome.
//
// Oeffnet die laufende Oberflaeche, geht jede Kachel durch, fotografiert sie
// und meldet JavaScript-Fehler sowie Elemente, die aus dem Fenster ragen.
//
// Aufruf:  node uat.js [--sichtbar]
// Voraussetzung: der Server laeuft (start.cmd).

const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const sichtbar = args.includes("--sichtbar");
const pIndex = args.indexOf("--puppeteer");
const PUPPETEER = pIndex >= 0 ? args[pIndex + 1] : path.join(
  process.env.USERPROFILE || process.env.HOME, "PycharmProjects",
  "tbx_stzrim", "portal", "node_modules", "puppeteer");
const puppeteer = require(PUPPETEER);

const URL = "http://127.0.0.1:8100/";
const AUS = path.join(__dirname, "_sicht");

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await puppeteer.launch({
    headless: !sichtbar,
    defaultViewport: { width: 1560, height: 1200 }
  });
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
  seite.on("console", (m) => {
    if (m.type() === "error") { fehler.push("console: " + m.text()); }
  });

  await seite.goto(URL, { waitUntil: "load", timeout: 120000 });
  await seite.waitForSelector(".kachel", { timeout: 180000 });
  await warte(600);

  const anzahl = await seite.$$eval(".kachel", (k) => k.length);
  console.log("Kacheln in der Übersicht: " + anzahl);
  await seite.screenshot({ path: path.join(AUS, "00-uebersicht.png") });

  const titel = await seite.$$eval(".kachel h3", (k) => k.map((e) => e.textContent));

  for (let i = 0; i < anzahl; i++) {
    const kacheln = await seite.$$(".kachel");
    await kacheln[i].click();
    // auf das Ende der Rechnung warten: kein "laedt" mehr auf der Seite
    try {
      await seite.waitForFunction(
        () => document.querySelectorAll(".laedt").length === 0,
        { timeout: 120000 });
    } catch (e) { fehler.push(`Kachel ${i + 1} rechnet nicht fertig`); }
    // die Ueberblendungen laufen 620 ms; erst danach zeigt ein Foto den
    // Endzustand und nicht die Bewegung dorthin
    await warte(1400);
    const name = String(i + 1).padStart(2, "0");
    await seite.screenshot({ path: path.join(AUS, `${name}-${titel[i].replace(/[^\wäöüÄÖÜß]+/g, "-")}.png`) });
    console.log(`  ${name}  ${titel[i]}`);
    await seite.click("#home");
    await warte(350);
  }

  const befunde = await seite.evaluate(() => {
    const raus = [];
    document.querySelectorAll("#inhalt *").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) { return; }
      if (r.right > window.innerWidth + 2) {
        raus.push("ragt hinaus: " + e.className);
      }
    });
    return raus.slice(0, 10);
  });

  console.log("");
  console.log(fehler.length ? "JAVASCRIPT-FEHLER:" : "Keine JavaScript-Fehler.");
  fehler.slice(0, 10).forEach((f) => console.log("  " + f));
  console.log(befunde.length ? "LAYOUT:" : "Kein Element ragt aus dem Fenster.");
  befunde.forEach((f) => console.log("  " + f));

  await browser.close();
  process.exit(fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
