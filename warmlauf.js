// warmlauf.js — ein Pruefer misst erst, wenn das Modell steht.
//
// WARUM ES DIESES MODUL GIBT
// Der Server laedt das Modell (mehrere GB) beim ERSTEN Aufruf, nicht beim
// Start. Ein browserbasierter Pruefer, der sofort losmisst, trifft eine
// Seite, deren rechenintensive Kacheln noch leere Daten bekommen — und
// meldet eine Regression, die keine ist. So geschehen am 03.09.2026:
// pruefe_diagramme war am KALTEN Server rot (19/28), am warmen gruen
// (28/28), ohne dass sich eine Zeile Web-Code geaendert hatte. Der
// modell.py-Lock verhindert den ABSTURZ des Servers unter gleichzeitigen
// Ladeanfragen — nicht das falsche Rot eines zu frueh messenden Pruefers.
//
// DIE BEDINGUNG, AUF DIE GEWARTET WIRD
// `/api/info` ruft `modell_holen()`. Dieser Aufruf kehrt erst zurueck, wenn
// das Modell geladen ist — die Sperre in modell.py haelt jeden Ansteher so
// lange auf. Ein einziger erfolgreicher Aufruf ist damit das Startsignal:
// keine Uhr, sondern die WIRKUNG.
//
// Aufruf:  await warmlauf("http://127.0.0.1:8100/");
//          -> true, sobald der Server bereit antwortet; false nach `frist`.

const http = require("http");

function warmlauf(basis, frist = 240000) {
  const t0 = Date.now();
  return new Promise((fertig) => {
    const erneut = () => {
      if (Date.now() - t0 > frist) { fertig(false); }
      else { setTimeout(versuch, 1000); }
    };
    const versuch = () => {
      const req = http.get(basis + "api/info", (res) => {
        res.resume(); // Koerper verwerfen, nur der Status zaehlt
        if (res.statusCode === 200) { fertig(true); }
        else { erneut(); }
      });
      req.on("error", erneut);
      // Der ERSTE Aufruf traegt den ganzen Ladevorgang; grosszuegig warten.
      req.setTimeout(220000, () => { req.destroy(); erneut(); });
    };
    versuch();
  });
}

module.exports = { warmlauf };
