# -*- coding: utf-8 -*-
"""Prueft die Auskuenfte des Servers gegen das echte Modell.

uat.js prueft die Oberflaeche, dieses Skript die Zahlen dahinter: jeder
Endpunkt wird aufgerufen, seine Antwort auf Form und Groesse geprueft und
mit Zeitbedarf ausgewiesen. Was hier durchlaeuft, ist gerechnet worden —
nicht behauptet.

Aufruf (Server muss laufen):
    python\\python.exe pruefe_api.py
"""
from __future__ import annotations

import io
import json
import sys
import time
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                              errors="replace")

WIRT = "http://127.0.0.1:8100"
SATZ = "Die Produktionsplanung in einem Unternehmen mit SAP beginnt damit, dass"
fehler: list[str] = []


def ruf(pfad: str, koerper: dict | None = None):
    t0 = time.time()
    if koerper is None:
        r = urllib.request.urlopen(WIRT + pfad, timeout=180)
    else:
        r = urllib.request.urlopen(urllib.request.Request(
            WIRT + pfad, data=json.dumps(koerper).encode(),
            headers={"Content-Type": "application/json"}), timeout=180)
    return json.loads(r.read()), time.time() - t0


def pruefe(name: str, bedingung: bool, was: str) -> None:
    if not bedingung:
        fehler.append(f"{name}: {was}")


def main() -> None:
    d, s = ruf("/api/info")
    print(f"info          {s:5.2f}s  {d['name']}, {d['schichten']} Schichten, "
          f"{d['koepfe']} Koepfe, {d['geraet']}")
    print(f"              Parameter {d['parameter']:,}".replace(",", ".") +
          f"  gespeichert {d['parameter_gespeichert']:,}".replace(",", "."))
    pruefe("info", d["parameter"] < d["parameter_gespeichert"],
           "gespeicherte Zahl muss ueber der Parameterzahl liegen (gekoppelte Gewichte)")
    schichten, koepfe, dim = d["schichten"], d["koepfe"], d["d"]

    d, s = ruf("/api/tokens", {"text": SATZ})
    T = len(d["ids"])
    print(f"tokens        {s:5.2f}s  {T} Stuecke")
    pruefe("tokens", T > 0, "keine Stuecke")

    d, s = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0})
    un = d.get("unsicherheit", {})
    print(f"durchlauf     {s:5.2f}s  beste: {d['beste'][0]['text']!r} "
          f"{d['beste'][0]['p']*100:.1f} %  ·  wie ein Wuerfel mit "
          f"{un.get('wuerfel')} Seiten")
    pruefe("durchlauf", len(d["attention"]) == koepfe, "falsche Kopfzahl")
    pruefe("durchlauf", len(d["lens"]) == schichten + 1, "falsche Stufenzahl")
    pruefe("durchlauf", bool(un), "Unsicherheit fehlt")

    # Die WICHTIGSTE Probe: die letzte Stufe der Logit-Lens ist per
    # Definition die tatsaechliche Ausgabe des Modells. Weicht sie ab, wird
    # der Zustand irgendwo zusaetzlich behandelt — genau so entstand am
    # 09.08. der Unsinn in der letzten Zeile der Gitter-Kachel (die
    # Schlussnormierung wurde ein zweites Mal angewandt).
    letzte_stufe = d["lens"][-1]["beste"][0]
    echt = d["beste"][0]
    print(f"              letzte Lens-Stufe {letzte_stufe['text']!r} "
          f"{letzte_stufe['p']*100:.1f} %  gegen echte Vorhersage "
          f"{echt['text']!r} {echt['p']*100:.1f} %")
    pruefe("lens-schluss", letzte_stufe["id"] == echt["id"],
           f"letzte Stufe {letzte_stufe['text']!r} != Vorhersage {echt['text']!r}")
    pruefe("lens-schluss", abs(letzte_stufe["p"] - echt["p"]) < 0.01,
           "Wahrscheinlichkeit der letzten Stufe weicht ab")

    d, s = ruf("/api/landkarte", {"text": SATZ})
    n = len(d["felder"]["entropie"]) * len(d["felder"]["entropie"][0])
    print(f"landkarte     {s:5.2f}s  {n} Koepfe x 5 Kennzahlen")
    for k, v in d["auffaellig"].items():
        print(f"              staerkster {k:11s} Schicht {v['schicht']+1:>2}, "
              f"Kopf {v['kopf']+1:>2} = {v['wert']}")
    pruefe("landkarte", n == schichten * koepfe, "nicht alle Koepfe erfasst")

    d, s = ruf("/api/dimensionen", {"text": SATZ})
    print(f"dimensionen   {s:5.2f}s  {len(d['z'])} Stufen x {d['d']} Zahlen = "
          f"{len(d['z'])*d['d']} Werte")
    print(f"              staerkstes Prozent traegt {d['konzentration']*100:.1f} %")
    pruefe("dimensionen", d["d"] == dim, "falsche Modellbreite")
    pruefe("dimensionen", len(d["z"]) == schichten + 1, "falsche Stufenzahl")
    pruefe("dimensionen", 0 < d["konzentration"] <= 1, "Konzentration ausserhalb 0..1")

    wo = d["groesste"][0]["dim"]
    d, s = ruf("/api/dimension", {"dim": wo, "k": 6})
    print(f"dimension     {s:5.2f}s  Dimension {wo}: oben "
          f"{[x['text'] for x in d['oben'][:4]]}")
    pruefe("dimension", len(d["oben"]) == 6, "falsche Anzahl")

    d, s = ruf("/api/bauteile", {"text": SATZ})
    letzte = -1
    print(f"bauteile      {s:5.2f}s  {len(d['attn'])} Schichten x "
          f"{len(d['attn'][0])} Positionen")
    for i in (0, schichten // 2, schichten - 1):
        print(f"              Schicht {i+1:>2}: Aufmerksamkeit "
              f"{d['attn'][i][letzte]*100:7.1f} %  Feedforward "
              f"{d['mlp'][i][letzte]*100:6.1f} %")
    pruefe("bauteile", len(d["attn"]) == schichten, "falsche Schichtzahl")

    d, s = ruf("/api/lens", {"text": SATZ})
    schluss = d["zeilen"][-1]["zellen"]
    print(f"lens          {s:5.2f}s  {len(d['zeilen'])} Stufen x "
          f"{len(schluss)} Positionen")
    print(f"              letzte Zeile, letzte Spalte: "
          f"{schluss[-1]['text']!r} {schluss[-1]['p']*100:.1f} %")
    # Dieselbe Probe wie oben, hier fuer das Gitter: die letzte Zelle der
    # letzten Zeile ist die Vorhersage, die das Modell wirklich trifft.
    d2, _ = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0})
    pruefe("gitter-schluss", schluss[-1]["id"] == d2["beste"][0]["id"],
           f"letzte Zelle {schluss[-1]['text']!r} != Vorhersage "
           f"{d2['beste'][0]['text']!r}")

    d, s = ruf("/api/raum", {"text": SATZ, "nachbarn_je": 6, "hintergrund": 300})
    ges = sum(d["erklaerte_streuung"])
    print(f"raum          {s:5.2f}s  {len(d['punkte'])} Punkte, drei Achsen "
          f"fangen {ges*100:.1f} % ein")

    d, s = ruf("/api/erzeugen", {"text": SATZ, "anzahl": 12, "temperatur": 0.8,
                                 "top_k": 40})
    print(f"erzeugen      {s:5.2f}s  {d['neu'][:60]!r}")

    # --- Die beiden Herleitungen ------------------------------------------
    # Beide waren zunaechst NICHT hier eingetragen. Ein Endpunkt, den kein
    # Pruefer aufruft, faellt erst dem Anwender auf.

    d, s = ruf("/api/attention_stufen", {"text": SATZ, "schicht": 13,
                                         "kopf": 2})
    st = d["stufen"]
    print(f"attn_stufen   {s:5.2f}s  {len(st)} Stufen, {T}x{T}, "
          f"Abweichung {d['abweichung']:.1e}")
    for x in st:
        print(f"              {x['name']:22s} {x['min']:9.3f} .. {x['max']:8.3f}")
    pruefe("attention_stufen", len(st) == 3, "es muessen drei Stufen sein")
    # Der eigentliche Beweis: Stufe 3 IST die Matrix des Modells.
    pruefe("attention_stufen", d["abweichung"] < 1e-2,
           f"Stufe 3 weicht um {d['abweichung']} von der Modell-Matrix ab")
    # Stufe 1 ist die einzige OHNE Maske — genau das ist ihre Aussage.
    pruefe("attention_stufen",
           all(v is not None for z in st[0]["matrix"] for v in z),
           "Stufe 1 darf keine gesperrten Felder haben (die Maske kommt erst "
           "in Stufe 2)")
    pruefe("attention_stufen", st[1]["matrix"][0][T - 1] is None,
           "Stufe 2 muss oben rechts gesperrt sein")
    # Jede Zeile des Softmax ergibt 1 — sonst waeren es keine Anteile.
    zeilen_eins = [abs(sum(v for v in z if v is not None) - 1.0)
                   for z in st[2]["matrix"]]
    pruefe("attention_stufen", max(zeilen_eins) < 1e-3,
           f"Softmax-Zeilen ergeben nicht 1 (groesste Abweichung "
           f"{max(zeilen_eins):.2e})")

    d, s = ruf("/api/logit_kette", {"text": SATZ, "temperatur": 0.8,
                                    "top_k": 5, "oben": 12})
    k = d["kandidaten"]
    raus = [c for c in k if not c["drin"]]
    print(f"logit_kette   {s:5.2f}s  {len(k)} Kandidaten, {len(raus)} durch "
          f"top-k={d['top_k']} heraus, Schnitt behaelt {d['behalten']*100:.2f} %")
    print(f"              Platz 1 {k[0]['text']!r}: Logit {k[0]['logit']:.2f} "
          f"-> / T {k[0]['skaliert']:.2f} "
          f"-> nach Schnitt {k[0]['nach_schnitt']:.2f} "
          f"-> Softmax {k[0]['p']*100:.1f} % "
          f"(ohne Temperatur {k[0]['p_ohne_temperatur']*100:.1f} %)")
    print(f"              Probe gegen den Weg von `erzeugen`: {d['probe']:.1e}")
    pruefe("logit_kette", len(raus) > 0,
           "bei top_k=5 und 12 gezeigten muessen 7 herausfallen")
    # Der Schnitt setzt auf minus unendlich — im JSON als null. Wer dort
    # steht, MUSS nach dem Softmax bei null landen.
    pruefe("logit_kette", all(c["nach_schnitt"] is None for c in raus),
           "Ausgeschlossene muessen in der Schnitt-Spalte -inf (null) tragen")
    pruefe("logit_kette", all(c["p"] < 1e-9 for c in raus),
           "wer herausfaellt, muss die Wahrscheinlichkeit null haben")
    # Der Softmax laeuft NACH dem Schnitt ueber die Verbliebenen — sie
    # muessen zusammen genau 1 ergeben.
    summe = sum(c["p"] for c in k if c["drin"])
    pruefe("logit_kette", abs(summe - 1.0) < 1e-3,
           f"die verbliebenen Stuecke ergeben {summe:.4f} statt 1")
    # Die Umstellung auf die Reihenfolge des Vorbilds (Schnitt VOR Softmax)
    # darf die Verteilung nicht veraendern.
    pruefe("logit_kette", d["probe"] < 1e-5,
           f"Schnitt-vor-Softmax weicht um {d['probe']} vom Weg in "
           f"`erzeugen` ab")
    # Temperatur unter 1 macht die Spitze SCHAERFER — sonst waere die
    # Erklaerung in der Kachel falsch.
    pruefe("logit_kette", k[0]["p"] > k[0]["p_ohne_temperatur"],
           "T = 0,8 muss die Spitze anheben")
    # Weder Temperatur noch Schnitt duerfen die Reihenfolge aendern.
    pruefe("logit_kette",
           all(k[i]["p_offen"] >= k[i + 1]["p_offen"] for i in range(len(k) - 1)),
           "die Rangfolge muss monoton fallen")

    d2, _ = ruf("/api/logit_kette", {"text": SATZ, "temperatur": 1.8,
                                     "top_k": 5, "oben": 12})
    print(f"              bei T=1,8 faellt Platz 1 auf "
          f"{d2['kandidaten'][0]['p']*100:.1f} % (von "
          f"{k[0]['p']*100:.1f} % bei T=0,8)")
    pruefe("logit_kette", d2["kandidaten"][0]["p"] < k[0]["p"],
           "hoehere Temperatur muss die Spitze abflachen")

    # ── top-p: die ANZAHL ist das Ergebnis, nicht die Vorgabe ─────────────
    dp, s = ruf("/api/logit_kette", {"text": SATZ, "temperatur": 0.8,
                                     "verfahren": "top_p", "top_p": 0.9,
                                     "oben": 12})
    kp = dp["kandidaten"]
    drin = [c for c in kp if c["drin"]]
    schnitt = [c for c in kp if c["schnitt_hier"]]
    wo = (f"Schnitt bei laufender Summe {schnitt[0]['kumuliert']*100:.2f} %"
          if schnitt else "Schnitt liegt ausserhalb der Tafel")
    print(f"logit_kette   {s:5.2f}s  top-p 0,90: {dp['behalten_anzahl']} "
          f"Stuecke bleiben, {wo}")
    pruefe("logit_kette top-p", dp["verfahren"] == "top_p",
           "das Verfahren muss zurueckgemeldet werden")
    # Die tragende Aussage von top-p: die behaltenen Stuecke ergeben ZUSAMMEN
    # mindestens die geforderte Menge — und ohne das letzte waeren es
    # weniger. Genau das unterscheidet es von top-k.
    pruefe("logit_kette top-p", dp["behalten"] >= dp["top_p"] - 1e-6,
           f"die behaltenen ergeben {dp['behalten']:.4f}, gefordert waren "
           f"{dp['top_p']}")
    if len(drin) >= 2:
        vorletzte = sorted(drin, key=lambda c: c["kumuliert"])[-2]
        pruefe("logit_kette top-p", vorletzte["kumuliert"] < dp["top_p"],
               "ohne das letzte behaltene Stueck muesste die Summe UNTER "
               "der Grenze liegen — sonst wurde eines zuviel behalten")
    pruefe("logit_kette top-p", all(c["p"] < 1e-9 for c in kp if not c["drin"]),
           "wer bei top-p herausfaellt, muss die Wahrscheinlichkeit null haben")
    pruefe("logit_kette top-p", dp["probe"] < 1e-5,
           f"top-p weicht um {dp['probe']} vom Weg in `erzeugen` ab")
    # Eine kleinere Menge darf NIE mehr Stuecke behalten.
    dp2, _ = ruf("/api/logit_kette", {"text": SATZ, "temperatur": 0.8,
                                      "verfahren": "top_p", "top_p": 0.5,
                                      "oben": 12})
    print(f"              top-p 0,50 behaelt {dp2['behalten_anzahl']}, "
          f"top-p 0,90 behaelt {dp['behalten_anzahl']}")
    pruefe("logit_kette top-p",
           dp2["behalten_anzahl"] <= dp["behalten_anzahl"],
           "eine kleinere Menge darf nicht mehr Stuecke behalten")

    # ── Das Netz MUSS denselben Reglern folgen wie die Tafel ──────────────
    #
    # Bis zum 14.08.2026 kannte dieser Endpunkt weder Temperatur noch
    # Schnitt: die Regler der Kachel wirkten auf die Tafel, und das Netz
    # daneben zeigte weiter die rohe Verteilung. Es KONNTE ihnen nicht
    # folgen. Diese Pruefung haelt das offen.
    n_roh, s = ruf("/api/netz", {"text": SATZ, "oben": 6})
    n_kalt, _ = ruf("/api/netz", {"text": SATZ, "oben": 6,
                                  "temperatur": 0.5, "verfahren": "top_k",
                                  "top_k": 40})
    n_heiss, _ = ruf("/api/netz", {"text": SATZ, "oben": 6,
                                   "temperatur": 1.8, "verfahren": "top_k",
                                   "top_k": 40})
    p_roh = n_roh["kandidaten"][0]["p"]
    p_kalt = n_kalt["kandidaten"][0]["p"]
    p_heiss = n_heiss["kandidaten"][0]["p"]
    print(f"netz          {s:5.2f}s  {len(n_roh['stellen'])} Stellen, "
          f"{len(n_roh['kandidaten'])} Kandidaten")
    print(f"              Platz 1 ohne Temperatur {p_roh*100:.1f} %, "
          f"bei T=0,5 {p_kalt*100:.1f} %, bei T=1,8 {p_heiss*100:.1f} %")
    pruefe("netz", p_kalt > p_roh > p_heiss,
           f"das Netz muss der Temperatur folgen — gemessen {p_kalt:.4f} / "
           f"{p_roh:.4f} / {p_heiss:.4f}, erwartet fallend")
    pruefe("netz", abs(n_kalt["temperatur"] - 0.5) < 1e-6,
           "das Netz muss zurueckmelden, womit es gerechnet hat")
    # Und dieselbe Verteilung wie die Tafel bei GLEICHEN Parametern.
    n_gl, _ = ruf("/api/netz", {"text": SATZ, "oben": 6, "temperatur": 0.8,
                                "verfahren": "top_k", "top_k": 40})
    t_gl, _ = ruf("/api/logit_kette", {"text": SATZ, "temperatur": 0.8,
                                       "verfahren": "top_k", "top_k": 40,
                                       "oben": 12})
    d_max = max(abs(n_gl["kandidaten"][i]["p"] - t_gl["kandidaten"][i]["p"])
                for i in range(len(n_gl["kandidaten"])))
    print(f"              Netz gegen Tafel bei gleichen Reglern: "
          f"groesster Unterschied {d_max:.1e}")
    pruefe("netz", d_max < 1e-4,
           f"Netz und Tafel derselben Kachel zeigen verschiedene "
           f"Wahrscheinlichkeiten (bis {d_max:.2e})")

    # ── Woher das Logit kommt: die Aufschluesselung MIT Probe ─────────────
    b, s = ruf("/api/logit_beitraege", {"text": SATZ, "oben": 14})
    print(f"logit_beitraege {s:5.2f}s  {b['stueck']!r}: Summe ueber "
          f"{b['dimensionen']} Produkte = {b['summe']:.4f} gegen Logit "
          f"{b['logit']:.4f}")
    schritt = b["schritt"] or 1e-9
    print(f"              Abweichung {b['abweichung']:.2e} = "
          f"{b['abweichung']/schritt:.2f} Schritte des "
          f"{b['zahlenformat']}-Formats (ein Schritt {b['schritt']:.4g})")
    print(f"              {b['gezeigt']} gezeigte Zahlen tragen "
          f"{b['anteil_betrag']*100:.1f} % des Betrags; dafuer "
          f"{b['positiv']:.1f}, dagegen {b['negativ']:.1f}")
    # DIE PROBE. Sie ist der Grund, warum man dieser Aufschluesselung glauben
    # darf: die Summe der Produkte MUSS das Logit des Modells sein, bis auf
    # die Genauigkeit des Zahlenformats.
    pruefe("logit_beitraege", b["abweichung"] < 2 * schritt,
           f"die Summe weicht um {b['abweichung']:.2e} ab, also mehr als "
           f"zwei Schritte des Zahlenformats ({b['schritt']:.4g}) — dann ist "
           f"es NICHT dieselbe Rechnung")
    pruefe("logit_beitraege", len(b["zahlen"]) == b["gezeigt"],
           "es muessen so viele Zahlen kommen, wie gemeldet werden")
    pruefe("logit_beitraege",
           all(abs(z["h"] * z["w"] - z["beitrag"]) < 0.02 for z in b["zahlen"]),
           "jeder gezeigte Beitrag muss das Produkt seiner beiden Faktoren "
           "sein — sonst zeigt die Tafel eine andere Rechnung als die Zahl")
    pruefe("logit_beitraege", 0 < b["anteil_betrag"] < 1,
           "die Stichprobe muss echt kleiner als das Ganze sein")
    # Ein anderes Stueck muss eine andere Aufschluesselung ergeben.
    b2, _ = ruf("/api/logit_beitraege",
                {"text": SATZ, "stueck_id": k[1]["id"], "oben": 14})
    pruefe("logit_beitraege", b2["stueck_id"] == k[1]["id"],
           "die Aufschluesselung muss das ANGEFRAGTE Stueck betreffen")
    pruefe("logit_beitraege", abs(b2["logit"] - k[1]["logit"]) < 0.02,
           f"das Logit aus der Aufschluesselung ({b2['logit']}) muss dem aus "
           f"der Kette ({k[1]['logit']}) entsprechen")

    print("")
    if fehler:
        print(f"{len(fehler)} BEFUND(E):")
        for f in fehler:
            print("  - " + f)
        sys.exit(1)
    print("Alle Auskuenfte geliefert und plausibel.")


if __name__ == "__main__":
    main()
