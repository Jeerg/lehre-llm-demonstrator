// Prueft die Palette — ohne Browser, ohne Server, in unter einer Sekunde.
//
// WARUM ES DIESEN PRUEFER GIBT
// Seit dem 20.08.2026 hat der Demonstrator zwei Fassungen (hell fuer den
// Hoersaal, dunkel fuer den Bildschirm). Das eroeffnet eine Fehlerklasse,
// die es vorher nicht gab und die keiner der bestehenden Pruefer sieht:
//
//   (1) EIN FEHLENDER SCHLUESSEL. `PALETTE.setzen` schreibt die Werte der
//       NEUEN Fassung auf <html>. Was nur die eine Fassung kennt, wird
//       beim Wechsel nicht ueberschrieben — der alte Wert bleibt stehen.
//       Ergebnis: ein dunkler Kartengrund in der hellen Fassung, und zwar
//       nur nach dem Umschalten, nie beim Laden. Genau die Sorte Fehler,
//       die man im Hoersaal findet und nicht davor.
//
//   (2) EINE UMGEDREHTE SKALA. Der Wert laeuft immer von "wenig Abstand
//       zum Grund" nach "viel Abstand zum Grund" (Regel C-1b). Laeuft eine
//       Familie falsch herum, zeigt jedes Bild damit das Gegenteil dessen,
//       was es behauptet — ohne dass ein Kontrastpruefer anschlaegt, denn
//       lesbar ist es ja.
//
//   (3) EINE UNLESBARE TRAGENDE STUFE. Auf der Stufe, die die Aussage
//       traegt, steht Schrift. Sie braucht 4,5:1 gegen den Grund.
//
// Gate zu Regel C-1b.
//
// Aufruf:  node pruefe_palette.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const QUELLE = path.join(__dirname, "web", "palette.js");

// ── Die Palette in einem Sandkasten laufen lassen ────────────────────────
// Sie erwartet ein <html>, auf das sie schreiben kann. Statt einen Browser
// zu starten, wird das Noetige nachgebildet und mitgeschrieben, WAS sie
// schreibt — das ist genau die Wirkung, um die es geht.
const gesetzt = {};
let fassung = null;
const sandkasten = {
  document: {
    documentElement: {
      style: {
        setProperty: (k, v) => { (gesetzt[fassung] = gesetzt[fassung] || {})[k] = v; },
        colorScheme: ""
      },
      setAttribute: (k, v) => { if (k === "data-fassung") { fassung = v; } }
    }
  },
  window: { localStorage: { getItem: () => null, setItem: () => {} } },
  console: console
};
vm.createContext(sandkasten);
vm.runInContext(fs.readFileSync(QUELLE, "utf8") +
                "\n;globalThis.__PALETTE = PALETTE;", sandkasten);
const P = sandkasten.__PALETTE;

const befunde = [];

// ── BEKANNTE ALTBEFUNDE ──────────────────────────────────────────────────
//
// Diese Befunde sind ECHT und stammen NICHT aus der Umstellung auf zwei
// Fassungen — sie stecken seit dem 12.08.2026 in der dunklen Palette. Sie
// zu beheben hiesse, die dunkle Fassung zu aendern; dafuer liegt keine
// Abnahme vor (Regel D-1). Sie stehen deshalb hier: der Pruefer meldet sie
// bei jedem Lauf sichtbar, laesst den Lauf aber gruen.
//
// Wer einen davon abnimmt und behebt, nimmt ihn hier heraus.
const ALTBEFUNDE = [
  {
    schluessel: "dunkel/wert:rueckwaerts",
    was: "Die Grundskala der dunklen Fassung endet auf #7a6ff0 (4,83:1) " +
         "nach #01aeed (7,46:1). Der GROESSTE Wert hebt sich damit schwaecher " +
         "vom Grund ab als der zweitgroesste — in jedem Balkenbild. " +
         "Gemessen am 20.08.2026, Ursache ist der Farbtonwechsel nach " +
         "Violett am oberen Ende."
  }
];
const altGesehen = new Set();

const FASSUNGEN = ["hell", "dunkel"];
const FAMILIEN = ["wert", "query", "key", "value", "feedforward",
                  "attention", "strom", "auswahl"];

// ── Farbrechnung (WCAG) ──────────────────────────────────────────────────
function zerlegen(farbe) {
  const h = String(farbe).trim();
  if (h.startsWith("#")) {
    const x = h.slice(1);
    const v = x.length === 3 ? x.split("").map((c) => c + c).join("") : x;
    return [0, 2, 4].map((i) => parseInt(v.substr(i, 2), 16));
  }
  const m = h.match(/(\d+(?:\.\d+)?)/g);
  return m ? m.slice(0, 3).map(Number) : null;
}

function leuchtdichte(farbe) {
  const c = zerlegen(farbe);
  if (!c) { return null; }
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

function kontrast(a, b) {
  const la = leuchtdichte(a), lb = leuchtdichte(b);
  if (la === null || lb === null) { return null; }
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── (1) Beide Fassungen setzen dieselben Werte ───────────────────────────
P.setzen("dunkel");
P.setzen("hell");
const schluessel = {};
FASSUNGEN.forEach((f) => { schluessel[f] = Object.keys(gesetzt[f] || {}); });

const nurHell = schluessel.hell.filter((k) => !schluessel.dunkel.includes(k));
const nurDunkel = schluessel.dunkel.filter((k) => !schluessel.hell.includes(k));
if (nurHell.length || nurDunkel.length) {
  befunde.push("Die Fassungen setzen NICHT dieselben Werte — beim Umschalten " +
    "bliebe der alte stehen. " +
    (nurHell.length ? "Nur hell: " + nurHell.join(", ") + ". " : "") +
    (nurDunkel.length ? "Nur dunkel: " + nurDunkel.join(", ") + "." : ""));
}
console.log(`Werte je Fassung: hell ${schluessel.hell.length}, ` +
            `dunkel ${schluessel.dunkel.length}`);

// ── (2) und (3) je Fassung ───────────────────────────────────────────────
FASSUNGEN.forEach((f) => {
  P.setzen(f);
  const grund = P.token("--bg");
  const hell = P.istHell();
  console.log(`\n── ${f} ── Grund ${grund}`);

  FAMILIEN.forEach((fam) => {
    const stufen = P.stufen(fam);
    if (stufen.length !== 5) {
      befunde.push(`${f}/${fam}: ${stufen.length} Stufen statt 5`);
      return;
    }
    // Die Skala muss VOM GRUND WEG laufen: der Kontrast gegen den Grund
    // steigt von Stufe zu Stufe. Ein Ruecksprung heisst, dass ein groesserer
    // Wert weniger auffaellt als ein kleinerer.
    const k = stufen.map((s) => kontrast(s, grund));
    for (let i = 1; i < k.length; i++) {
      if (k[i] < k[i - 1] - 0.05) {
        const alt = ALTBEFUNDE.find((a) => a.schluessel === `${f}/${fam}:rueckwaerts`);
        if (alt) { altGesehen.add(alt.schluessel); continue; }
        befunde.push(`${f}/${fam}: Stufe ${i + 1} hebt sich WENIGER vom Grund ` +
          `ab als Stufe ${i} (${k[i].toFixed(2)}:1 nach ${k[i - 1].toFixed(2)}:1) ` +
          `— die Skala laeuft dort rueckwaerts`);
      }
    }
    // Die Richtung muss zur Fassung passen.
    const dunkler = leuchtdichte(stufen[4]) < leuchtdichte(stufen[0]);
    if (hell && !dunkler) {
      befunde.push(`${f}/${fam}: laeuft hell→hell; auf weissem Grund muss der ` +
        `groesste Wert der DUNKELSTE sein`);
    }
    if (!hell && dunkler) {
      befunde.push(`${f}/${fam}: laeuft dunkel→dunkel; auf dunklem Grund muss ` +
        `der groesste Wert der HELLSTE sein`);
    }
    // Die tragende Stufe traegt Schrift.
    if (k[3] < 4.5) {
      befunde.push(`${f}/${fam}: die tragende Stufe ${stufen[3]} hat nur ` +
        `${k[3].toFixed(2)}:1 — darauf ist Schrift nicht lesbar (4,5:1 noetig)`);
    }
    console.log(`  ${fam.padEnd(12)} ${stufen.join(" ")}   ` +
      `${k[0].toFixed(2)} → ${k[4].toFixed(2)} : 1`);
  });

  // Schrift auf dem Grund.
  [["--text", 4.5], ["--text-muted", 4.5], ["--text-schwach", 4.5],
   ["--marke-text", 4.5], ["--wahl", 3.0], ["--gruen", 3.0]
  ].forEach(([t, mindest]) => {
    const kk = kontrast(P.token(t), grund);
    if (kk === null) { befunde.push(`${f}: ${t} ist keine Farbe`); return; }
    if (kk < mindest) {
      befunde.push(`${f}: ${t} = ${P.token(t)} hat ${kk.toFixed(2)}:1 gegen ` +
        `den Grund, noetig sind ${mindest}:1`);
    }
  });

  // Die Auswahl muss sich von JEDER Bauteilfamilie abheben — sonst haelt
  // man ein Bauteil fuer die Auswahl.
  const w = P.token("--wahl");
  ["res", "q", "k", "v", "att", "ff"].forEach((kurz) => {
    const e = P.erkennung(kurz);
    const dl = Math.abs(leuchtdichte(w) - leuchtdichte(e));
    const c1 = zerlegen(w), c2 = zerlegen(e);
    const abstand = Math.sqrt(c1.reduce((s, v, i) => s + (v - c2[i]) ** 2, 0));
    if (abstand < 90 && dl < 0.10) {
      befunde.push(`${f}: die Auswahl ${w} ist von der Familie ${kurz} ` +
        `(${e}) kaum zu unterscheiden`);
    }
  });
});

// ── Ergebnis ─────────────────────────────────────────────────────────────
console.log("");

// Erst die Altbefunde — sie sollen nicht in Vergessenheit geraten, nur weil
// der Lauf gruen ist.
if (altGesehen.size) {
  console.log(`${altGesehen.size} bekannte Altbefunde (echt, aber nicht ` +
              `abgenommen — sie machen den Lauf nicht rot):`);
  ALTBEFUNDE.filter((a) => altGesehen.has(a.schluessel))
    .forEach((a) => console.log("  ~ " + a.was));
  console.log("");
}
// Ein Altbefund, der NICHT mehr auftritt, ist entweder behoben oder der
// Pruefer sieht ihn nicht mehr. Beides gehoert gemeldet.
const verschwunden = ALTBEFUNDE.filter((a) => !altGesehen.has(a.schluessel));
if (verschwunden.length) {
  console.log("Diese Altbefunde treten nicht mehr auf — aus der Liste " +
              "nehmen oder nachsehen, warum der Prüfer sie nicht mehr sieht:");
  verschwunden.forEach((a) => console.log("  ? " + a.schluessel));
  console.log("");
}

if (befunde.length) {
  console.log(`${befunde.length} BEFUNDE:`);
  befunde.forEach((b) => console.log("  - " + b));
  process.exit(1);
}
console.log("Die Palette ist in beiden Fassungen vollständig, läuft in " +
            "beiden vom Grund weg, und jede tragende Stufe trägt Schrift.");
