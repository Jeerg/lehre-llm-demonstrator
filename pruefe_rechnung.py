# -*- coding: utf-8 -*-
"""Rechnet JEDE Auskunft des Servers unabhaengig nach.

`pruefe_api.py` prueft, ob der Server antwortet und ob die Antworten die
richtige Form haben. Das genuegt nicht: eine falsche Formel liefert
tadellos geformte falsche Zahlen. Hier wird deshalb das Modell ein zweites
Mal geladen und jede Groesse aus den Rohdaten NEU gerechnet — mit einer von
Hand geschriebenen Rechnung, nicht mit derselben Funktion. Verglichen werden
die beiden Ergebnisse.

Aufruf (Server muss laufen):
    ..\\.venv\\Scripts\\python.exe pruefe_rechnung.py
oder mit der mitgelieferten Umgebung:
    python\\python.exe pruefe_rechnung.py
"""
from __future__ import annotations

import io
import json
import math
import sys
import urllib.request
from pathlib import Path

import torch

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                              errors="replace")

HIER = Path(__file__).resolve().parent
WIRT = "http://127.0.0.1:8100"
SATZ = "Die Produktionsplanung in einem Unternehmen mit SAP beginnt damit, dass"

befunde: list[str] = []
geprueft = 0


def ruf(pfad: str, koerper: dict | None = None):
    if koerper is None:
        r = urllib.request.urlopen(WIRT + pfad, timeout=300)
    else:
        r = urllib.request.urlopen(urllib.request.Request(
            WIRT + pfad, data=json.dumps(koerper).encode(),
            headers={"Content-Type": "application/json"}), timeout=300)
    return json.loads(r.read())


def gleich(name: str, a: float, b: float, toleranz: float = 1e-3) -> None:
    """Vergleicht eine Zahl des Servers mit der eigenen Nachrechnung."""
    global geprueft
    geprueft += 1
    if a is None or b is None or not math.isfinite(a) or not math.isfinite(b):
        befunde.append(f"{name}: nicht vergleichbar ({a} / {b})")
        return
    d = abs(a - b)
    bezug = max(1.0, abs(b))
    if d / bezug > toleranz:
        befunde.append(f"{name}: Server {a:.6g}, nachgerechnet {b:.6g} "
                       f"(Abweichung {d:.3g})")


def wahr(name: str, bedingung: bool, was: str) -> None:
    global geprueft
    geprueft += 1
    if not bedingung:
        befunde.append(f"{name}: {was}")


# ---------------------------------------------------------------------------

def main() -> None:
    from transformers import AutoModelForCausalLM, AutoTokenizer

    pfad = next(p for p in (HIER / "models").iterdir()
                if (p / "config.json").exists())
    print(f"Modell wird ein zweites Mal geladen: {pfad.name}")
    tok = AutoTokenizer.from_pretrained(pfad)
    # float32 auf der CPU: langsamer, aber frei von den Rundungsfragen, die
    # ein Vergleich in float16 aufwerfen wuerde. Die Pruefung soll den
    # Rechenweg beurteilen, nicht die Zahlendarstellung.
    m = AutoModelForCausalLM.from_pretrained(pfad, dtype=torch.float32,
                                             attn_implementation="eager")
    m.eval()
    print("geladen.\n")

    ids = tok(SATZ, add_special_tokens=False)["input_ids"]
    T = len(ids)
    x = torch.tensor([ids])
    with torch.no_grad():
        aus = m(x, output_attentions=True, output_hidden_states=True,
                use_cache=False)

    L = m.config.num_hidden_layers
    H = m.config.num_attention_heads
    hs = list(aus.hidden_states)

    # ── 0. Die Stufen selbst -------------------------------------------
    # Die letzte Stufe ist bereits normiert. Wer das uebersieht, rechnet
    # ueberall dort falsch, wo die Logit-Lens verwendet wird.
    roh_letzte = None
    speicher = {}

    def haken(_mod, _ein, ausg):
        speicher["roh"] = ausg[0] if isinstance(ausg, tuple) else ausg

    g = m.model.layers[-1].register_forward_hook(haken)
    with torch.no_grad():
        aus2 = m(x, output_hidden_states=True, use_cache=False)
    g.remove()
    roh_letzte = speicher["roh"]

    print("── Stufen ──")
    d = float((m.lm_head(hs[-1][0, -1]) - aus.logits[0, -1]).abs().max())
    print(f"   lm_head(h[-1]) gegen logits: {d:.2e}  "
          f"→ letzte Stufe ist {'bereits normiert' if d < 1e-3 else 'roh'}")
    wahr("stufen", d < 1e-3, "letzte Stufe verhaelt sich unerwartet")
    stufen = hs[:-1] + [roh_letzte]

    # ── 1. Tokenisierung ------------------------------------------------
    s = ruf("/api/tokens", {"text": SATZ})
    print("\n── Tokenisierung ──")
    wahr("tokens", s["ids"] == ids, "andere Stueckfolge als der Tokenizer")
    wahr("tokens", "".join(s["stuecke"]) == SATZ,
         "die Stuecke ergeben zusammengesetzt nicht den Satz")
    gleich("tokens/zeichen_je_token", s["zeichen_je_token"], len(SATZ) / T)
    for i, (a, b) in enumerate(s["spannen"]):
        wahr("tokens/spannen", SATZ[a:b] == s["stuecke"][i],
             f"Spanne {i} zeigt auf {SATZ[a:b]!r}, nicht auf {s['stuecke'][i]!r}")
    print(f"   {T} Stuecke, Spannen und Zusammensetzung geprueft")

    # ── 2. Durchlauf: Vorhersage und Unsicherheit -----------------------
    dl = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0})
    print("\n── Vorhersage ──")
    logits = aus.logits[0, -1].float()
    w = torch.softmax(logits, dim=-1)
    top = torch.topk(w, len(dl["beste"]))
    for k, p in enumerate(dl["beste"]):
        wahr("beste", p["id"] == int(top.indices[k]),
             f"Rang {k}: Server {p['text']!r}, nachgerechnet "
             f"{tok.decode([int(top.indices[k])])!r}")
        gleich(f"beste/p[{k}]", p["p"], float(top.values[k]), 2e-2)
    print(f"   {len(dl['beste'])} Raenge geprueft, bester: "
          f"{dl['beste'][0]['text']!r}")

    un = dl["unsicherheit"]
    sortiert, _ = torch.sort(w, descending=True)
    kum = torch.cumsum(sortiert, 0)
    for marke, name in ((0.50, "n50"), (0.90, "n90"), (0.99, "n99")):
        eigen = int((kum < marke).sum()) + 1
        wahr(f"unsicherheit/{name}",
             abs(un[name] - eigen) <= max(1, eigen // 50),
             f"Server {un[name]}, nachgerechnet {eigen}")
    entropie = float(-(w.clamp(min=1e-12).log() * w).sum())
    gleich("unsicherheit/entropie", un["entropie"], entropie, 2e-2)
    gleich("unsicherheit/wuerfel", un["wuerfel"], math.exp(entropie), 3e-2)
    print(f"   n50={un['n50']} n90={un['n90']} n99={un['n99']}, "
          f"Entropie {un['entropie']:.4f} → Wuerfel {un['wuerfel']:.2f} Seiten")

    # ── 3. Logit-Lens ----------------------------------------------------
    print("\n── Logit-Lens (Schluss nach jeder Stufe) ──")
    norm, kopf = m.model.norm, m.lm_head
    for si in (0, 1, L // 2, L - 1, L):
        eigen_logits = kopf(norm(stufen[si][0, -1]))
        eigen_w = torch.softmax(eigen_logits.float(), dim=-1)
        bestes = int(eigen_w.argmax())
        server = dl["lens"][si]["beste"][0]
        wahr(f"lens/stufe{si}", server["id"] == bestes,
             f"Stufe {si}: Server {server['text']!r}, nachgerechnet "
             f"{tok.decode([bestes])!r}")
        gleich(f"lens/stufe{si}/p", server["p"], float(eigen_w[bestes]), 3e-2)
    letzte = dl["lens"][-1]["beste"][0]
    wahr("lens/schluss", letzte["id"] == dl["beste"][0]["id"],
         "letzte Stufe ist nicht die tatsaechliche Vorhersage")
    print(f"   5 Stufen einzeln nachgerechnet; letzte Stufe = Vorhersage "
          f"({letzte['text']!r})")

    # ── 3b. Die gewaehlte STELLE -----------------------------------------
    # Die Oberflaeche laesst jede Stelle des Satzes waehlen, und alles
    # Stellenabhaengige soll ihr folgen. Das ist nur dann keine Behauptung,
    # wenn die Vorhersage an einer MITTLEREN Stelle wirklich die Vorhersage
    # des Modells an dieser Stelle ist — und nicht die des Satzendes.
    print("\n── Die gewaehlte Stelle ──")
    for pos in (0, T // 2, T - 2):
        dp = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0,
                                    "position": pos})
        wahr(f"stelle{pos}/rueckgabe", dp["position"] == pos,
             f"Server meldet Stelle {dp['position']}, gefragt war {pos}")
        eigen_w = torch.softmax(aus.logits[0, pos].float(), dim=-1)
        bestes = int(eigen_w.argmax())
        wahr(f"stelle{pos}/beste", dp["beste"][0]["id"] == bestes,
             f"Stelle {pos}: Server {dp['beste'][0]['text']!r}, "
             f"nachgerechnet {tok.decode([bestes])!r}")
        gleich(f"stelle{pos}/beste/p", dp["beste"][0]["p"],
               float(eigen_w[bestes]), 2e-2)
        # der Lens muss auf DERSELBEN Stelle stehen
        eigen_lens = torch.softmax(
            kopf(norm(stufen[L][0, pos])).float(), dim=-1)
        wahr(f"stelle{pos}/lens", dp["lens"][-1]["beste"][0]["id"]
             == int(eigen_lens.argmax()),
             f"Stelle {pos}: letzte Lens-Stufe passt nicht zur Stelle")
        # und die Beitraege der Schichten ebenso
        vor = stufen[1][0, pos].float()
        nach = stufen[2][0, pos].float()
        gleich(f"stelle{pos}/beitrag", dp["beitraege"][1]["anteil"],
               float((nach - vor).norm()) / (float(vor.norm()) or 1.0), 2e-2)
        print(f"   Stelle {pos} ({s['stuecke'][pos]!r}): "
              f"{dp['beste'][0]['text']!r} {dp['beste'][0]['p']*100:.1f} %  "
              f"— Vorhersage, Lens und Beitraege stehen auf dieser Stelle")
    dm = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0, "position": -1})
    wahr("stelle-1", dm["position"] == T - 1,
         "-1 muss die letzte Stelle sein (sonst aendert sich das Verhalten "
         "aller Kacheln, die nichts uebergeben)")
    wahr("stelle-1/gleich", dm["beste"][0]["id"] == dl["beste"][0]["id"],
         "-1 liefert etwas anderes als der Aufruf ohne Stelle")
    print(f"   -1 ist die letzte Stelle ({T - 1}) — der Aufruf ohne Angabe "
          f"verhaelt sich unveraendert")

    # ── 4. Gitter --------------------------------------------------------
    print("\n── Gitter (Stufe x Position) ──")
    gi = ruf("/api/lens", {"text": SATZ})
    wahr("gitter", len(gi["zeilen"]) == L + 1, "falsche Stufenzahl")
    for si in (0, L // 2, L):
        eigen_logits = kopf(norm(stufen[si][0]))
        eigen_w = torch.softmax(eigen_logits.float(), dim=-1)
        p, i = torch.max(eigen_w, dim=-1)
        for t in (0, T // 2, T - 1):
            z = gi["zeilen"][si]["zellen"][t]
            wahr(f"gitter/{si},{t}", z["id"] == int(i[t]),
                 f"Stufe {si} Position {t}: Server {z['text']!r}, "
                 f"nachgerechnet {tok.decode([int(i[t])])!r}")
            gleich(f"gitter/{si},{t}/p", z["p"], float(p[t]), 3e-2)
    ecke = gi["zeilen"][-1]["zellen"][-1]
    wahr("gitter/ecke", ecke["id"] == dl["beste"][0]["id"],
         f"unten rechts steht {ecke['text']!r}, die Vorhersage ist "
         f"{dl['beste'][0]['text']!r}")

    # Die neue Hauptansicht: Wahrscheinlichkeit und Platz GENAU des Stuecks,
    # das am Ende gewinnt. Das ist die Zahl, die der Betrachter sieht — sie
    # muss ebenso nachgerechnet werden wie alles andere.
    end_w = torch.softmax(kopf(norm(stufen[-1][0])).float(), dim=-1)
    end_p, end_i = torch.max(end_w, dim=-1)
    for t in range(T):
        wahr(f"gitter/ziel[{t}]", gi["ziel"][t]["id"] == int(end_i[t]),
             f"Ziel an Position {t}: Server {gi['ziel'][t]['text']!r}, "
             f"nachgerechnet {tok.decode([int(end_i[t])])!r}")
    for si in (0, 1, L // 2, L - 1, L):
        w_s = torch.softmax(kopf(norm(stufen[si][0])).float(), dim=-1)
        for t in (0, T // 2, T - 1):
            eigen_p = float(w_s[t, int(end_i[t])])
            eigen_rang = int((w_s[t] > eigen_p).sum()) + 1
            gleich(f"gitter/ziel_p[{si},{t}]", gi["zeilen"][si]["ziel_p"][t],
                   eigen_p, 5e-2)
            # Bei sehr schlechten Plaetzen genuegt die Groessenordnung; dort
            # entscheiden Rundungen in float16 ueber Tausende von Plaetzen.
            server_rang = gi["zeilen"][si]["ziel_rang"][t]
            toleranz = max(2, int(eigen_rang * 0.25))
            wahr(f"gitter/ziel_rang[{si},{t}]",
                 abs(server_rang - eigen_rang) <= toleranz,
                 f"Platz: Server {server_rang}, nachgerechnet {eigen_rang}")
    # letzte Stufe: das Ziel MUSS dort auf Platz 1 stehen — das ist seine
    # Definition. Steht es woanders, stimmt die ganze Ansicht nicht.
    for t in range(T):
        wahr(f"gitter/ziel_rang_schluss[{t}]",
             gi["zeilen"][-1]["ziel_rang"][t] == 1,
             f"Position {t}: Ziel steht in der letzten Stufe auf Platz "
             f"{gi['zeilen'][-1]['ziel_rang'][t]}, nicht auf 1")
        gleich(f"gitter/ziel_p_schluss[{t}]", gi["zeilen"][-1]["ziel_p"][t],
               float(end_p[t]), 5e-2)
    print(f"   9 Zellen, {T} Zielstücke und 15 Platz-/Wahrscheinlichkeitswerte "
          f"nachgerechnet")
    print(f"   unten rechts = Vorhersage ({ecke['text']!r}), Ziel überall auf "
          f"Platz 1 in der letzten Stufe")

    # ── 5. Attention und Landkarte ---------------------------------------
    print("\n── Attention und Landkarte ──")
    A0 = aus.attentions[0][0].float()                       # (H, T, T)
    for h in (0, H // 2, H - 1):
        for i in (1, T - 1):
            gleich(f"attention/zeilensumme[{h},{i}]",
                   float(A0[h, i, :i + 1].sum()), 1.0, 1e-3)
            wahr(f"attention/maske[{h},{i}]",
                 float(A0[h, i, i + 1:].abs().max() if i + 1 < T else 0) < 1e-6,
                 "es wird in die Zukunft geschaut")
    d = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0})
    server_A = torch.tensor(d["attention"])
    gleich("attention/matrix", float((server_A - A0).abs().max()), 0.0, 5e-2)
    print(f"   Zeilensummen, Maske und die volle Matrix von Schicht 1 geprueft")

    lk = ruf("/api/landkarte", {"text": SATZ})
    wo = torch.arange(T)
    abstand = (wo.view(-1, 1) - wo.view(1, -1)).float().clamp(min=0)
    for si in (0, L // 2, L - 1):
        A = aus.attentions[si][0].float()
        for h in (0, H - 1):
            gleich(f"landkarte/rueckblick[{si},{h}]",
                   lk["felder"]["rueckblick"][si][h],
                   float((A[h] * abstand).sum(dim=1).mean()), 2e-2)
            gleich(f"landkarte/selbst[{si},{h}]",
                   lk["felder"]["selbst"][si][h],
                   float(A[h].diagonal().mean()), 2e-2)
            gleich(f"landkarte/anfang[{si},{h}]",
                   lk["felder"]["anfang"][si][h],
                   float(A[h][:, 0].mean()), 2e-2)
            gleich(f"landkarte/vorher[{si},{h}]",
                   lk["felder"]["vorher"][si][h],
                   float(A[h].diagonal(offset=-1).mean()), 2e-2)
            # Entropie: zeilenweise, normiert auf die Zahl sichtbarer Felder
            hs_ = -(A[h].clamp(min=1e-9).log() * A[h]).sum(dim=1)
            maxi = torch.log(torch.arange(1, T + 1).float()).clamp(min=1e-9)
            gleich(f"landkarte/entropie[{si},{h}]",
                   lk["felder"]["entropie"][si][h],
                   float((hs_[1:] / maxi[1:]).mean()), 2e-2)
    print(f"   5 Kennzahlen an 6 Stellen nachgerechnet")

    # ── 6. Bauteile -------------------------------------------------------
    print("\n── Bauteile (Attention gegen Feedforward) ──")
    bt = ruf("/api/bauteile", {"text": SATZ})
    mit = {}

    def merker(topf, s):
        def hk(_mod, _ein, ausg):
            topf[s] = (ausg[0] if isinstance(ausg, tuple) else ausg)[0].float()
        return hk

    attn_o, mlp_o = {}, {}
    griffe = []
    for s in range(L):
        griffe.append(m.model.layers[s].self_attn.register_forward_hook(
            merker(attn_o, s)))
        griffe.append(m.model.layers[s].mlp.register_forward_hook(
            merker(mlp_o, s)))
    with torch.no_grad():
        aus3 = m(x, output_hidden_states=True, use_cache=False)
    for gg in griffe:
        gg.remove()
    zust = list(aus3.hidden_states)

    for s in (0, L // 2, L - 1):
        for t in (0, T - 1):
            vor = float(zust[s][0, t].float().norm())
            a_bei = float(attn_o[s][t].norm()) / max(vor, 1e-9)
            gleich(f"bauteile/attn[{s},{t}]", bt["attn"][s][t], a_bei, 3e-2)
            zwischen = (zust[s][0, t].float() + attn_o[s][t])
            m_bei = float(mlp_o[s][t].norm()) / max(float(zwischen.norm()), 1e-9)
            gleich(f"bauteile/mlp[{s},{t}]", bt["mlp"][s][t], m_bei, 3e-2)
    # Probe aufs Ganze: Attention-Zusatz + MLP-Zusatz muss den Zustand
    # tatsaechlich in den naechsten ueberfuehren.
    for s in (0, L // 2):
        soll = zust[s][0] + attn_o[s] + mlp_o[s]
        ist = zust[s + 1][0].float()
        gleich(f"bauteile/summe[{s}]", float((soll - ist).abs().max()), 0.0, 1e-2)
    print(f"   6 Beitraege nachgerechnet + Probe: Zustand + Attention + "
          f"Feedforward = naechster Zustand")

    # ── 7. Dimensionen ----------------------------------------------------
    print("\n── Dimensionen ──")
    di = ruf("/api/dimensionen", {"text": SATZ})
    pos = di["position"]
    M = torch.stack([h[0, pos].float() for h in stufen])
    Z = (M - M.mean(dim=1, keepdim=True)) / M.std(dim=1, keepdim=True).clamp(min=1e-9)
    for si in (0, L // 2, L):
        for dd in (0, 425, 2047):
            gleich(f"dimensionen/z[{si},{dd}]", di["z"][si][dd],
                   float(Z[si, dd]), 5e-2)
    gleich("dimensionen/laenge", di["laengen"][-1], float(M[-1].norm()), 2e-2)
    letzte_z = Z[-1]
    q = letzte_z ** 2
    sq, _ = torch.sort(q, descending=True)
    eins = max(1, letzte_z.numel() // 100)
    gleich("dimensionen/konzentration", di["konzentration"],
           float(sq[:eins].sum() / q.sum()), 3e-2)
    gross = torch.topk(letzte_z.abs(), 1)
    wahr("dimensionen/groesste", di["groesste"][0]["dim"] == int(gross.indices[0]),
         f"Server {di['groesste'][0]['dim']}, nachgerechnet {int(gross.indices[0])}")
    print(f"   9 z-Werte, Laenge, Konzentration ({di['konzentration']*100:.1f} %) "
          f"und die staerkste Dimension geprueft")

    # ── 8. Nachbarn und Analogie -------------------------------------------
    print("\n── Bedeutungsraum ──")
    E = m.get_input_embeddings().weight.float()
    normen = E.norm(dim=1).clamp(min=1e-9)
    tid = ids[1]
    nb = ruf("/api/nachbarn", {"token_id": tid, "k": 5})
    v = E[tid]
    kos = (E @ v) / (normen * v.norm())
    kos[tid] = -1e9
    besten = torch.topk(kos, 5)
    for k, p in enumerate(nb):
        wahr(f"nachbarn[{k}]", p["id"] == int(besten.indices[k]),
             f"Server {p['text']!r}, nachgerechnet "
             f"{tok.decode([int(besten.indices[k])])!r}")
        gleich(f"nachbarn[{k}]/kosinus", p["kosinus"], float(besten.values[k]), 1e-2)
    print(f"   5 Nachbarn von {tok.decode([tid])!r} nachgerechnet")

    # Analogie: Summe der Stück-Embeddings, Filter auf ganze Wörter, und der
    # Platz des erwarteten Wortes MUSS zu der Liste passen, die angezeigt
    # wird — sonst meldet der Demonstrator einen Platz für ein Wort, das in
    # der Liste gar nicht vorkommt.
    an = ruf("/api/analogie", {"a": " Frankreich", "b": " Paris",
                               "c": " Berlin", "k": 5, "nur_ganze": True,
                               "erwartet": " Deutschland"})
    namen = tok.convert_ids_to_tokens(list(range(E.shape[0])))
    ganz = torch.zeros(E.shape[0], dtype=torch.bool)
    for i2, nm in enumerate(namen):
        if not nm:
            continue
        nm = nm.replace("Ġ", " ")
        if len(nm) > 2 and nm[0] == " " and nm[1:].isalpha():
            ganz[i2] = True
    wahr("analogie/ganze", an["ganze_im_vokabular"] == int(ganz.sum()),
         f"Server {an['ganze_im_vokabular']}, nachgerechnet {int(ganz.sum())}")

    def wv(w):
        ii = tok(w, add_special_tokens=False)["input_ids"]
        return E[ii].sum(0), ii
    va, ia_ = wv(" Frankreich")
    vb, ib_ = wv(" Paris")
    vc, ic_ = wv(" Berlin")
    vv = va - vb + vc
    ss = (E @ vv) / (normen * vv.norm())
    for i2 in set(ia_ + ib_ + ic_):
        ss[i2] = -1e9
    ss_g = torch.where(ganz, ss, torch.full_like(ss, -1e9))
    beste_a = torch.topk(ss_g, 5)
    for k2, tr in enumerate(an["treffer"]):
        wahr(f"analogie/treffer[{k2}]", tr["id"] == int(beste_a.indices[k2]),
             f"Server {tr['text']!r}, nachgerechnet "
             f"{tok.decode([int(beste_a.indices[k2])])!r}")
    zid = tok(" Deutschland", add_special_tokens=False)["input_ids"][0]
    eigen_platz = int((ss_g > ss_g[zid]).sum()) + 1
    wahr("analogie/platz", an["erwartet"]["platz"] == eigen_platz,
         f"Server {an['erwartet']['platz']}, nachgerechnet {eigen_platz}")
    # Der gemeldete Platz muss in derselben Rangfolge stehen wie die Liste
    wahr("analogie/platz_konsistent",
         an["erwartet"]["platz"] >= len(an["treffer"]) or
         any(t2["id"] == zid for t2 in an["treffer"]),
         "gemeldeter Platz liegt im Bereich der Liste, das Wort fehlt dort aber")
    print(f"   Analogie: {an['ganze_im_vokabular']} ganze Wörter, 5 Treffer und "
          f"Platz {an['erwartet']['platz']} nachgerechnet")

    # ── Der vorgerechnete Weg MUSS der echte sein ────────────────────────
    # Die Kachel „Aufmerksamkeit“ rechnet Query, Key, Punktprodukt,
    # Skalierung, Maske und Softmax vor. Wenn diese Vorrechnung vom Modell
    # abweicht, führt der Demonstrator vor, was gerade nicht passiert.
    print("\n── Vorgerechneter Weg gegen echte Rechnung ──")
    for schicht_i, kopf_i in ((0, 0), (13, 5), (27, 15)):
        rw = ruf("/api/rechenweg", {"text": "Der Motor wird",
                                    "schicht": schicht_i, "kopf": kopf_i})
        wahr(f"rechenweg[{schicht_i},{kopf_i}]", rw["stimmt"],
             f"Abweichung {rw['abweichung']}")
        # zusätzlich: die Softmax-Zeile muss sich zu 1 summieren
        summe_g = sum(k["gewicht"] for k in rw["keys"])
        gleich(f"rechenweg/summe[{schicht_i}]", summe_g, 1.0, 1e-3)
        # und die Skalierung muss wirklich durch die Wurzel teilen
        for k in rw["keys"]:
            if k["maskiert"] is not None:
                gleich(f"rechenweg/skalierung[{schicht_i},{k['pos']}]",
                       k["skaliert"], k["punkt"] / (rw["kopf_dim"] ** 0.5), 2e-2)
        print(f"   Schicht {schicht_i+1:>2}, Kopf {kopf_i+1:>2}: Abweichung "
              f"{rw['abweichung']:.1e}, Zeilensumme {summe_g:.6f}")

    # ── Kontextaufnahme ──────────────────────────────────────────────────
    print("\n── Kontextaufnahme ──")
    ko = ruf("/api/kontext", {
        "satz_a": "Im Park stand eine alte Bank aus Holz",
        "satz_b": "In der Innenstadt eröffnete eine Bank für Firmenkunden",
        "wort": " Bank"})
    wahr("kontext/start", abs(ko["stufen"][0]["abstand"]) < 1e-3,
         f"in der Tabelle müssten die Zustände identisch sein, Abstand ist "
         f"{ko['stufen'][0]['abstand']}")
    wahr("kontext/drift", max(x["abstand"] for x in ko["stufen"]) > 0.05,
         "die Zustände laufen gar nicht auseinander")
    # Gegenprobe: identischer Anfang MUSS Abstand null ergeben
    ko2 = ruf("/api/kontext", {
        "satz_a": "Die Maschine steht in der Halle",
        "satz_b": "Die Maschine wurde gestern geliefert",
        "wort": " Maschine"})
    wahr("kontext/kausal", max(x["abstand"] for x in ko2["stufen"]) < 1e-3,
         "bei identischem Satzanfang dürfen die Zustände nicht abweichen — "
         "ein Wort darf nicht nach rechts schauen")
    print(f"   Bank: Start {ko['stufen'][0]['abstand']}, Größt "
          f"{max(x['abstand'] for x in ko['stufen']):.3f}")
    print(f"   Gegenprobe identischer Anfang: max "
          f"{max(x['abstand'] for x in ko2['stufen']):.5f} (muss 0 sein)")

    ra = ruf("/api/raum", {"text": SATZ, "nachbarn_je": 4, "hintergrund": 100})
    summe = sum(ra["erklaerte_streuung"])
    wahr("raum/streuung", 0 < summe < 1,
         f"erklaerte Streuung {summe} liegt ausserhalb von 0..1")
    wahr("raum/dimensionen", ra["dimensionen"] == m.config.hidden_size,
         "falsche Modellbreite")
    print(f"   {len(ra['punkte'])} Punkte, drei Achsen fangen "
          f"{summe*100:.1f} % ein")

    # ── 9. Eingriffe wirken wirklich ---------------------------------------
    print("\n── Eingriffe ──")
    ohne = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0})
    mit_ = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0,
                                  "eingriffe": {"schichtAus": list(range(20, 28))}})
    wahr("eingriffe", ohne["beste"][0]["p"] != mit_["beste"][0]["p"],
         "acht abgeschaltete Schichten aendern die Vorhersage nicht")
    stumm = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0,
                                   "eingriffe": {"kopfAus": [[0, 0]]}})
    wahr("eingriffe/kopf", stumm["attention"] is not None, "keine Antwort")
    zurueck = ruf("/api/durchlauf", {"text": SATZ, "schicht": 0})
    gleich("eingriffe/rueckstandsfrei", zurueck["beste"][0]["p"],
           ohne["beste"][0]["p"], 1e-6)
    print(f"   Wirkung nachgewiesen ({ohne['beste'][0]['p']*100:.1f} % → "
          f"{mit_['beste'][0]['p']*100:.1f} %) und Hooks rueckstandsfrei entfernt")

    # ── Ergebnis ------------------------------------------------------------
    print("")
    print(f"{geprueft} Einzelpruefungen.")
    if befunde:
        print(f"\n{len(befunde)} BEFUND(E):")
        for b in befunde:
            print("  - " + b)
        sys.exit(1)
    print("Kein Rechenfehler gefunden.")


if __name__ == "__main__":
    main()
