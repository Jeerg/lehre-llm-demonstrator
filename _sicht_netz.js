/* Ein eigener Blick auf die neue Netz-Anschauung — im echten Browser.
 *
 * Die Pruefer sagen, ob die Regeln eingehalten sind. Sie sagen nicht, ob das
 * Bild etwas taugt. Dieses Skript macht beides sichtbar: es fotografiert die
 * Kachel in beiden Ansichten und liest die tatsaechlich gezeichneten
 * Elemente aus (Baender, Knoten, Beschriftung), damit „sieht gut aus“ nicht
 * behauptet, sondern belegt wird.
 *
 *   node _sicht_netz.js            (unsichtbar, nur Zahlen + Fotos)
 *   node _sicht_netz.js --sichtbar (mit sichtbarem Chrome)
 */

const path = require("path");
const fs = require("fs");

const SICHTBAR = process.argv.includes("--sichtbar");
const PUP = process.argv.includes("--puppeteer")
  ? process.argv[process.argv.indexOf("--puppeteer") + 1]
  : path.join(process.env.USERPROFILE, "PycharmProjects", "tbx_stzrim",
              "portal", "node_modules", "puppeteer");
const puppeteer = require(PUP);

const ZIEL = path.join(__dirname, "_sicht_netz");

async function main() {
  fs.mkdirSync(ZIEL, { recursive: true });
  const browser = await puppeteer.launch({
    headless: !SICHTBAR,
    defaultViewport: { width: 1500, height: 1100 },
    args: ["--window-size=1520,1160"],
  });
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("console", (m) => {
    if (m.type() === "error") { fehler.push("console: " + m.text()); }
  });

  await seite.goto("http://127.0.0.1:8100/",
                   { waitUntil: "load", timeout: 120000 });
  await seite.waitForSelector(".kachel", { timeout: 180000 });

  // Die Kachel ueber ihren Titel greifen — so, wie ein Mensch es tut.
  const kacheln = await seite.$$(".kachel");
  const titel = await seite.$$eval(".kachel h3", (k) => k.map((e) => e.textContent.trim()));
  const i = titel.findIndex((t) => t.includes("Was als Nächstes kommt"));
  if (i < 0) { throw new Error("Kachel nicht gefunden. Vorhanden: " + titel.join(" | ")); }
  await kacheln[i].click();
  try {
    await seite.waitForSelector("#inhalt .baender path", { timeout: 60000 });
  } catch (e) {
    // Nicht mit „Selektor nicht gefunden“ abbrechen — das sagt nichts. Erst
    // ausgeben, WAS im DOM steht und welche Fehler die Seite geworfen hat.
    const lage = await seite.evaluate(() => ({
      inhaltDa: !!document.querySelector("#inhalt"),
      felder: [...document.querySelectorAll("#inhalt .feld h4, #inhalt h4")]
        .map((e) => e.textContent.trim()),
      svgs: document.querySelectorAll("#inhalt svg").length,
      baender: document.querySelectorAll("#inhalt .baender").length,
      knoepfe: [...document.querySelectorAll("#inhalt button")]
        .map((e) => e.textContent.trim()).slice(0, 12),
      anfang: (document.querySelector("#inhalt") || {}).innerHTML
        ? document.querySelector("#inhalt").innerHTML.slice(0, 400) : null,
    }));
    console.log("LAGE IM DOM:", JSON.stringify(lage, null, 2));
    console.log("SEITENFEHLER:", fehler.length ? fehler.join("\n  ") : "(keine)");
    throw e;
  }
  await new Promise((r) => setTimeout(r, 1500));

  async function lies(name) {
    const d = await seite.evaluate(() => {
      const k = document.querySelector("#inhalt");
      const svg = k.querySelector(".baender").closest("svg");
      const bez = k.querySelector(".diagramm .bezug");
      const aus = k.querySelector(".diagramm .aussage");
      return {
        baender: svg.querySelectorAll(".baender path").length,
        knoten: svg.querySelectorAll(".knoten rect").length,
        texte: svg.querySelectorAll(".beschriftung text").length,
        achsentitel: svg.querySelectorAll(".achse .achsentitel").length,
        gestrichelt: [...svg.querySelectorAll(".baender path")]
          .filter((p) => p.getAttribute("stroke-dasharray")).length,
        gelb: [...svg.querySelectorAll(".baender path, .knoten rect")]
          .filter((p) => (p.style.fill || "").includes("255, 192")).length,
        bezug: bez ? bez.textContent.trim().slice(0, 110) : null,
        aussage: aus ? aus.textContent.trim().slice(0, 160) : null,
        hoehe: svg.getBoundingClientRect().height,
        breiteste: Math.max(...[...svg.querySelectorAll(".baender path")]
          .map((p) => p.getBBox().height)).toFixed(1),
      };
    });
    const el = await seite.$("#inhalt .diagramm");
    await el.screenshot({ path: path.join(ZIEL, name + ".png") });
    return d;
  }

  const weg = await lies("1-weg");
  console.log("--- Ansicht „Der Weg“ ---");
  console.log(JSON.stringify(weg, null, 2));

  // Auf „Die Wirkung“ umschalten — ueber den echten Knopf, nicht per Zustand.
  await seite.evaluate(() => {
    const k = [...document.querySelectorAll("#inhalt button")]
      .find((b) => b.textContent.trim() === "Die Wirkung");
    if (!k) { throw new Error("Knopf „Die Wirkung“ nicht gefunden"); }
    k.click();
  });
  // Auf die FERTIGE Wirkungsaussage warten, nicht bloss auf das Verschwinden
  // des Zwischenstands — sonst greift die Probe noch die Weg-Ansicht ab.
  await seite.waitForFunction(
    () => document.querySelector("#inhalt .aussage").textContent
            .includes("Hier zählt nicht der Blick"),
    { timeout: 60000, polling: 200 });
  await new Promise((r) => setTimeout(r, 700));
  const wirkung = await lies("2-wirkung");
  console.log("\n--- Ansicht „Die Wirkung“ ---");
  console.log(JSON.stringify(wirkung, null, 2));

  // Ein Satzstueck anklicken — kommt die Auswahl im Bild an?
  await seite.evaluate(() => {
    const t = document.querySelectorAll("#inhalt .beschriftung text");
    t[3].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 900));
  const gewaehlt = await lies("3-stueck-gewaehlt");
  console.log("\n--- nach Klick auf ein Satzstück ---");
  console.log(JSON.stringify(gewaehlt, null, 2));

  console.log("\n=== Befund ===");
  const probleme = [];
  if (weg.baender < 5) { probleme.push("zu wenige Bänder in „Der Weg“"); }
  if (weg.achsentitel < 3) { probleme.push("Achsentitel fehlen"); }
  if (!weg.bezug) { probleme.push("Bezug fehlt"); }
  if (!weg.aussage) { probleme.push("Aussage fehlt"); }
  if (gewaehlt.gelb < 1) { probleme.push("Klick kommt nicht im Bild an (nichts gelb)"); }
  if (wirkung.baender < 3) { probleme.push("zu wenige Bänder in „Die Wirkung“"); }
  if (fehler.length) { probleme.push("JavaScript-Fehler: " + fehler.join(" | ")); }

  if (probleme.length) {
    console.log("BEFUNDE:\n  - " + probleme.join("\n  - "));
  } else {
    console.log("Kein Befund. Bilder in _sicht_netz\\");
  }
  if (SICHTBAR) { await new Promise((r) => setTimeout(r, 12000)); }
  await browser.close();
  process.exit(probleme.length ? 1 : 0);
}

main().catch((e) => { console.error("ABBRUCH:", e.message); process.exit(2); });
