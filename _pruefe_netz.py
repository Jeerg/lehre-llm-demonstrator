"""Messung der beiden neuen Auskuenfte — ueber HTTP, mit sauberem UTF-8.

Warum als Datei und nicht als Einzeiler in der Konsole: deutsche Umlaute in
einer curl-Kommandozeile kommen unter Windows nicht als UTF-8 an; der Server
antwortet dann mit 400 „error parsing the body“. Das ist ein Fehler des
Testwegs, nicht des Servers — deshalb laeuft die Messung hier durch Python.
"""

import json
import sys
import time
import urllib.request

# Die Windows-Konsole laeuft auf cp1252 und wirft bei jedem Sonderzeichen.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASIS = "http://127.0.0.1:8100"


def hole(pfad: str, last: dict) -> tuple[dict, float]:
    daten = json.dumps(last, ensure_ascii=False).encode("utf-8")
    bitte = urllib.request.Request(
        BASIS + pfad, data=daten,
        headers={"Content-Type": "application/json; charset=utf-8"})
    los = time.perf_counter()
    with urllib.request.urlopen(bitte, timeout=900) as antwort:
        d = json.loads(antwort.read().decode("utf-8"))
    return d, time.perf_counter() - los


def netz_pruefen() -> None:
    satz = "Der Ingenieur prüft die Maschine und stellt fest, dass"
    d, dauer = hole("/api/netz", {"text": satz, "oben": 6})
    print(f"=== /api/netz — {dauer:.2f} s ===")
    print(f"Satz: {satz!r}")
    print(f"Vorhersagestelle: {d['position']} · Blick gemittelt ueber "
          f"{d['schichten_gemittelt']} Schichten\n")
    print("Kandidaten:  " + ",  ".join(
        f"{k['text']!r} {k['p'] * 100:.1f}%" for k in d["kandidaten"]))
    print()
    print(f"{'Satzstueck':<16}{'Blick':>9}   staerkste gemessene Wirkung")
    print("-" * 74)
    for s in d["stellen"]:
        if s["ist_ziel"]:
            print(f"{s['text']!r:<16}{s['blick']:>9.4f}   <- die Vorhersagestelle selbst")
            continue
        w = s["wirkung"]
        j = max(range(len(w)), key=lambda x: abs(w[x]))
        ziel = d["kandidaten"][j]["text"]
        richtung = "stuetzt" if w[j] > 0 else "daempft"
        print(f"{s['text']!r:<16}{s['blick']:>9.4f}   {ziel!r:<12} "
              f"{w[j] * 100:+7.2f} Pp  ({richtung})")

    # Der interessante Punkt: Blick und Wirkung sind NICHT dasselbe.
    stellen = [s for s in d["stellen"] if not s["ist_ziel"]]
    if stellen:
        meist_blick = max(stellen, key=lambda s: s["blick"])
        meist_wirkung = max(stellen,
                            key=lambda s: max(abs(x) for x in s["wirkung"]))
        print()
        print(f"groesster Blick:   {meist_blick['text']!r}")
        print(f"groesste Wirkung:  {meist_wirkung['text']!r}")
        print("→ dasselbe Stueck?  " +
              ("ja" if meist_blick is meist_wirkung else "NEIN — genau das ist sehenswert"))


def analogie_pruefen() -> None:
    faelle = [
        ("Paris", "Frankreich", "Deutschland", "Berlin"),
        ("König", "Königin", "Mätresse", ""),
        ("König", "Mann", "Frau", "Königin"),
    ]
    for schicht in (0, 7, 14, 21, 28):
        print(f"\n=== Wortraum, Schicht {schicht} ===")
        for a, b, c, erwartet in faelle:
            d, dauer = hole("/api/analogie_ganz", {
                "a": a, "b": b, "c": c, "k": 5,
                "schicht": schicht, "erwartet": erwartet})
            treffer = ",  ".join(f"{t['text']}({t['kosinus']:.3f})"
                                 for t in d["treffer"])
            platz = ""
            if "erwartet" in d:
                e = d["erwartet"]
                platz = (f"  [{e['wort']}: Platz {e['platz']}]"
                         if e.get("im_raum") else
                         f"  [{e['wort']}: nicht im Kandidatenraum]")
            print(f"  {a} − {b} + {c}  [{dauer:5.2f}s]{platz}")
            print(f"      {treffer}")


if __name__ == "__main__":
    netz_pruefen()
    analogie_pruefen()
