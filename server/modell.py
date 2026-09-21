"""Das Modell hinter dem Demonstrator.

Hier laeuft ein echtes, vortrainiertes Sprachmodell lokal auf diesem Rechner.
Kein Dienst im Netz, keine Schnittstelle nach aussen: die Gewichte liegen im
Verzeichnis `models/`, und alles wird hier gerechnet.

Warum ein Server und nicht mehr alles im Browser: ein Modell, das brauchbares
Deutsch schreibt, hat mehrere Milliarden Gewichte. Das sind Gigabyte, die
kein Browser sinnvoll traegt. Mit einem Server sind zwei Dinge zugleich
moeglich, die sich vorher ausschlossen - echte Sprachqualitaet UND voller
Einblick in jede Schicht, jeden Kopf, jedes Gewicht.

Was dieser Modul liefert:

  * Tokenisierung mit Herkunft jedes Stuecks
  * einen vollstaendigen Durchlauf MIT Mitschrift: Aufmerksamkeit je Kopf,
    Zustaende nach jeder Schicht, und der Schluss, den das Modell nach jeder
    Schicht ziehen wuerde (Logit-Lens)
  * Eingriffe: Kopf stummschalten, Schicht ueberspringen, Feedforward aus -
    umgesetzt ueber Hooks am echten Modell, nicht simuliert
  * Nachbarschaft im Embedding-Raum
  * Weiterschreiben mit Temperatur und Top-k
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path

import torch
import torch.nn.functional as F

WURZEL = Path(__file__).resolve().parents[1]


def _ulp(wert: float, dtype) -> float:
    """Der kleinste Schritt, den das Zahlenformat bei dieser Groesse kennt.

    Gebraucht, um eine Abweichung EINORDNEN zu koennen. "Die Probe weicht um
    0,006 ab" ist fuer sich genommen weder gross noch klein; erst gegen den
    Schritt des Formats gehalten wird daraus eine Aussage. Das Modell rechnet
    in 16 Bit — dort betraegt der Abstand zweier benachbarter darstellbarer
    Zahlen bei einem Wert um 20 bereits 0,0156.
    """
    try:
        bits = torch.finfo(dtype).bits
        mantisse = 10 if bits == 16 and dtype == torch.float16 else (
            7 if bits == 16 else 23)
        a = abs(float(wert))
        if a <= 0:
            return float(torch.finfo(dtype).tiny)
        import math
        return float(2.0 ** (math.floor(math.log2(a)) - mantisse))
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Eingriffe
# ---------------------------------------------------------------------------

@dataclass
class Eingriffe:
    """Was am Modell veraendert werden soll, bevor gerechnet wird.

    Alle Eingriffe sind nicht-zerstoerend: sie haengen sich als Hooks an das
    Modell und werden nach dem Durchlauf wieder entfernt. Der trainierte
    Stand bleibt unberuehrt.
    """
    kopf_aus: list[list[int]] = field(default_factory=list)   # [[schicht, kopf], ...]
    schicht_aus: list[int] = field(default_factory=list)
    mlp_aus: list[int] = field(default_factory=list)
    attn_aus: list[int] = field(default_factory=list)
    # [[schicht, kopf, faktor], ...] — 0 heisst stumm, 1 unveraendert,
    # groesser als 1 verstaerkt diesen Kopf gegenueber den anderen.
    kopf_skala: list[list[float]] = field(default_factory=list)

    @classmethod
    def aus_dict(cls, d: dict | None) -> "Eingriffe":
        d = d or {}
        return cls(
            kopf_aus=[list(map(int, p)) for p in d.get("kopfAus", [])],
            schicht_aus=[int(x) for x in d.get("schichtAus", [])],
            mlp_aus=[int(x) for x in d.get("mlpAus", [])],
            attn_aus=[int(x) for x in d.get("attnAus", [])],
            kopf_skala=[[int(p[0]), int(p[1]), float(p[2])]
                        for p in d.get("kopfSkala", [])],
        )

    def leer(self) -> bool:
        return not (self.kopf_aus or self.schicht_aus or self.mlp_aus
                    or self.attn_aus or self.kopf_skala)


# ---------------------------------------------------------------------------
# Modell
# ---------------------------------------------------------------------------

class Demonstratormodell:
    def __init__(self, pfad: str | Path, geraet: str | None = None) -> None:
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.pfad = Path(pfad)
        self.geraet = geraet or ("cuda" if torch.cuda.is_available() else "cpu")
        self.sperre = threading.Lock()

        self.tok = AutoTokenizer.from_pretrained(self.pfad)
        # eager statt SDPA: nur so gibt das Modell die Attention-Matrizen
        # heraus. Fuer die Vorfuehrung ist das schnell genug; der Zweck ist
        # Sichtbarkeit, nicht Durchsatz.
        self.modell = AutoModelForCausalLM.from_pretrained(
            self.pfad,
            dtype=torch.float16 if self.geraet == "cuda" else torch.float32,
            attn_implementation="eager",
        ).to(self.geraet)
        self.modell.eval()

        k = self.modell.config
        self.n_layer = k.num_hidden_layers
        self.n_head = k.num_attention_heads
        self.n_kv_head = getattr(k, "num_key_value_heads", k.num_attention_heads)
        self.d = k.hidden_size
        self.kopf_dim = getattr(k, "head_dim", k.hidden_size // k.num_attention_heads)
        self.vocab = k.vocab_size

        # Parameter zaehlen — und dabei zwei verschiedene Fragen trennen.
        #
        # Die config traegt `tie_word_embeddings: true`: die Ausgabematrix
        # soll dieselbe sein wie die Embedding-Tabelle. In DIESER Kopie der
        # Gewichte liegt sie aber zweimal auf der Platte (`lm_head.weight`
        # und `model.embed_tokens.weight`, je 151 936 x 2 048) — nachgeprueft
        # mit safetensors: die beiden sind **bitgleich**. Daraus folgen zwei
        # Zahlen, und beide sind richtig, nur auf verschiedene Fragen:
        #
        #   verschiedene Parameter  1 720 574 976  <- die Groesse des Modells
        #   gespeicherte Zahlen     2 031 739 904  <- was auf der Platte liegt
        #
        # Wer nur eine der beiden nennt, sagt etwas Unvollstaendiges. Der
        # Steckbrief zeigt deshalb beide.
        # Die Zahl kommt aus den GEWICHTSDATEIEN, nicht aus dem
        # Arbeitsspeicher. Grund: je nach Ladeweg legt transformers die
        # gekoppelte Matrix einmal oder zweimal ab — `parameters()` liefert
        # dann mal 1.720.574.976, mal 2.031.739.904 fuer dieselben Gewichte.
        # Eine Zahl, die zwischen zwei Starts springt, hat im Steckbrief
        # nichts verloren. Der Tensor-Index der Datei ist eindeutig.
        gespeichert, tensornamen = self._zahlen_in_dateien()
        if not gespeichert:
            gesehen: set[int] = set()
            for p in self.modell.parameters():
                if p.data_ptr() in gesehen:
                    continue
                gesehen.add(p.data_ptr())
                gespeichert += p.numel()

        doppelt = 0
        self.gewichte_gekoppelt = False
        try:
            lm = self.modell.lm_head.weight
            emb = self.modell.get_input_embeddings().weight
            if lm.shape == emb.shape and torch.equal(lm, emb):
                # Inhaltlich EINE Matrix — ob sie ein- oder zweimal im
                # Speicher liegt, aendert an der Groesse des Modells nichts.
                self.gewichte_gekoppelt = True
                # Nur abziehen, wenn die Matrix in der DATEI tatsaechlich ein
                # zweites Mal steht. Geschaetzt wird hier nichts.
                zweimal = any(n.endswith("lm_head.weight") for n in tensornamen) and \
                          any("embed_tokens.weight" in n for n in tensornamen)
                if zweimal:
                    doppelt = emb.numel()
        except AttributeError:
            pass

        self.parameter = gespeichert - doppelt
        self.parameter_gespeichert = gespeichert
        self.parameter_doppelt = doppelt

        self.bloecke = self.modell.model.layers
        self.embedding = self.modell.get_input_embeddings().weight
        self._emb_normen: torch.Tensor | None = None

    def _zahlen_in_dateien(self) -> tuple[int, list[str]]:
        """Wieviele Zahlen liegen in den Gewichtsdateien — und unter welchen Namen.

        Gelesen wird nur der Kopf jeder safetensors-Datei: acht Byte Laenge,
        danach ein JSON mit Name, Form und Datentyp jedes Tensors. Das kostet
        Millisekunden und ist im Gegensatz zur Zaehlung im Arbeitsspeicher
        zwischen zwei Starts stabil.
        """
        import struct

        gesamt = 0
        namen: list[str] = []
        for datei in sorted(self.pfad.glob("*.safetensors")):
            try:
                with open(datei, "rb") as fh:
                    laenge = struct.unpack("<Q", fh.read(8))[0]
                    kopf = json.loads(fh.read(laenge))
            except (OSError, ValueError, struct.error):
                return 0, []
            for name, eintrag in kopf.items():
                if name == "__metadata__":
                    continue
                zahlen = 1
                for x in eintrag.get("shape", []):
                    zahlen *= x
                gesamt += zahlen
                namen.append(name)
        return gesamt, namen

    # -- Auskunft --------------------------------------------------------

    def info(self) -> dict:
        return {
            "name": self.pfad.name,
            "schichten": self.n_layer,
            "koepfe": self.n_head,
            "kv_koepfe": self.n_kv_head,
            "d": self.d,
            "kopf_dim": self.kopf_dim,
            "vokabular": self.vocab,
            "parameter": self.parameter,
            "parameter_gespeichert": self.parameter_gespeichert,
            "parameter_doppelt": self.parameter_doppelt,
            "gewichte_gekoppelt": self.gewichte_gekoppelt,
            "embedding_parameter": self.vocab * self.d,
            "geraet": self.geraet,
            "gpu": torch.cuda.get_device_name(0) if self.geraet == "cuda" else None,
        }

    # -- Tokenisierung ---------------------------------------------------

    def tokenisieren(self, text: str) -> dict:
        kodiert = self.tok(text, return_offsets_mapping=True,
                           add_special_tokens=False)
        ids = kodiert["input_ids"]
        stuecke = [self.tok.decode([i]) for i in ids]
        roh = self.tok.convert_ids_to_tokens(ids)
        return {
            "ids": ids,
            "stuecke": stuecke,
            "roh": roh,
            "spannen": [list(s) for s in kodiert.get("offset_mapping", [])],
            "zeichen": len(text),
            "zeichen_je_token": (len(text) / len(ids)) if ids else 0.0,
        }

    # -- Eingriffe als Hooks ---------------------------------------------

    def _hooks_setzen(self, e: Eingriffe) -> list:
        griffe = []
        kopf_dim = self.kopf_dim

        # Kopf stummschalten: der Ausgang der Attention wird VOR der
        # Ausgangsprojektion je Kopf auf Null gesetzt. Genau das bedeutet
        # "dieser Kopf traegt nichts bei".
        #
        # Stummschalten ist dabei nur der Sonderfall "Faktor 0". Ein Faktor
        # zwischen 0 und 2 macht den Kopf schwaecher oder staerker - damit
        # laesst sich der Beitrag eines einzelnen Kopfes stufenlos regeln und
        # seine Wirkung auf die Wahrscheinlichkeiten ablesen.
        faktoren: dict[int, dict[int, float]] = {}
        for s, h in e.kopf_aus:
            faktoren.setdefault(int(s), {})[int(h)] = 0.0
        for s, h, f in e.kopf_skala:
            faktoren.setdefault(int(s), {})[int(h)] = float(f)

        for s, je_kopf in faktoren.items():
            if not (0 <= s < self.n_layer):
                continue
            o_proj = self.bloecke[s].self_attn.o_proj

            def vor_o_proj(_mod, eingang, je_kopf=dict(je_kopf)):
                x = eingang[0].clone()
                for h, f in je_kopf.items():
                    x[..., h * kopf_dim:(h + 1) * kopf_dim] *= f
                return (x,) + tuple(eingang[1:])

            griffe.append(o_proj.register_forward_pre_hook(vor_o_proj))

        # Ganze Schicht ueberspringen: der Block gibt seinen Eingang
        # unveraendert zurueck.
        for s in e.schicht_aus:
            if not (0 <= s < self.n_layer):
                continue

            def statt_block(_mod, eingang, ausgang):
                if isinstance(ausgang, tuple):
                    return (eingang[0],) + tuple(ausgang[1:])
                return eingang[0]

            griffe.append(self.bloecke[s].register_forward_hook(statt_block))

        # Nur das Feedforward abschalten
        for s in e.mlp_aus:
            if not (0 <= s < self.n_layer):
                continue
            griffe.append(self.bloecke[s].mlp.register_forward_hook(
                lambda _m, ein, aus: torch.zeros_like(aus)))

        # Nur die Aufmerksamkeit abschalten
        for s in e.attn_aus:
            if not (0 <= s < self.n_layer):
                continue

            def attn_null(_m, ein, aus):
                if isinstance(aus, tuple):
                    return (torch.zeros_like(aus[0]),) + tuple(aus[1:])
                return torch.zeros_like(aus)

            griffe.append(self.bloecke[s].self_attn.register_forward_hook(attn_null))

        return griffe

    # -- Zustaende in einer einheitlichen Form ----------------------------

    def _hook_letzter_block(self, speicher: dict) -> list:
        """Schneidet den Ausgang des LETZTEN Blocks mit — vor der Schlussnorm.

        Warum das noetig ist: `output_hidden_states=True` liefert 29 Stufen,
        aber sie sind NICHT gleich. Die Stufen 0 bis 27 sind Rohzustaende;
        der letzte Eintrag ist bereits durch die Schlussnormierung gelaufen.
        Wer alle 29 gleich behandelt und die Norm anwendet, normiert die
        letzte ein zweites Mal — und bekommt fuer die wichtigste Stufe, die
        tatsaechliche Ausgabe des Modells, ein falsches Ergebnis.

        Nachgemessen am 09.08.2026: `lm_head(h[-1])` trifft die echten Logits
        auf 9e-06 genau, `lm_head(norm(h[-1]))` weicht um 20,4 ab und liefert
        ein anderes Wort. Genau das stand vorher in der letzten Zeile der
        Kachel „Der ganze Satz auf einen Blick“.
        """
        def haken(_m, _ein, aus):
            x = aus[0] if isinstance(aus, tuple) else aus
            speicher["roh"] = x
        return [self.bloecke[-1].register_forward_hook(haken)]

    @staticmethod
    def _stufen_roh(aus, speicher: dict) -> list:
        """Alle Stufen im selben Zustand: roh, vor der Schlussnormierung."""
        stufen = list(aus.hidden_states)
        roh = speicher.get("roh")
        if roh is not None:
            stufen[-1] = roh
        return stufen

    # -- Durchlauf mit Mitschrift ----------------------------------------

    @torch.no_grad()
    def durchlauf(self, text: str, eingriffe: Eingriffe | None = None,
                  schicht: int = 0, oben: int = 12,
                  lens_oben: int = 3, position: int = -1) -> dict:
        """Ein vollstaendiger Durchlauf, mit allem, was dabei anfaellt.

        Bewusst wird NICHT alles zurueckgegeben: die Attention-Matrizen aller
        Schichten waeren bei 28 Schichten und 16 Koepfen ein Vielfaches der
        eigentlichen Antwort. Vollstaendig kommt die gewaehlte Schicht, von
        den uebrigen eine Kennzahl je Kopf.

        `position` waehlt die STELLE im Satz, auf die sich alles
        Stellenabhaengige bezieht: die Vorhersage, die Unsicherheit, der
        Logit-Lens und die Beitraege der Schichten. -1 (Voreinstellung) ist
        die letzte Stelle — dort entsteht die eigentliche Fortsetzung, und
        damit verhaelt sich die Auskunft wie zuvor. Jede andere Stelle
        beantwortet dieselben Fragen fuer das dort stehende Wort; die
        Attention-Matrix umfasst ohnehin alle Stellen.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}

        eingabe = torch.tensor([ids], device=self.geraet)

        mitschnitt: dict = {}
        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            griffe += self._hook_letzter_block(mitschnitt)
            try:
                aus = self.modell(eingabe, output_attentions=True,
                                  output_hidden_states=True, use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            stufen_roh = self._stufen_roh(aus, mitschnitt)
            T = len(ids)
            pos = T - 1 if position < 0 or position >= T else int(position)
            logits = aus.logits[0, pos].float()
            wahr = torch.softmax(logits, dim=-1)
            beste = torch.topk(wahr, oben)

            # Wie unsicher ist das Modell hier eigentlich? Die zwoelf besten
            # Stuecke sagen darueber wenig — entscheidend ist, wieviele
            # Stuecke man braucht, bis die Wahrscheinlichkeit aufgebraucht
            # ist, und wie breit die Verteilung insgesamt liegt.
            sortiert, _ = torch.sort(wahr, descending=True)
            kum = torch.cumsum(sortiert, dim=0)
            entropie = float(-(wahr.clamp(min=1e-12).log() * wahr).sum())
            unsicherheit = {
                "n50": int((kum < 0.50).sum()) + 1,
                "n90": int((kum < 0.90).sum()) + 1,
                "n99": int((kum < 0.99).sum()) + 1,
                "entropie": round(entropie, 4),
                # "so unentschieden wie ein gleichmaessiger Wuerfel mit N
                # Seiten" — die anschauliche Lesart der Entropie
                "wuerfel": round(float(torch.exp(torch.tensor(entropie))), 2),
                "vokabular": int(wahr.numel()),
            }

            # Die gewaehlte Schicht vollstaendig
            schicht = max(0, min(schicht, self.n_layer - 1))
            attn = aus.attentions[schicht][0].float().cpu()      # (Koepfe, T, T)

            # Von allen Schichten je Kopf: wie weit wird zurueckgeschaut?
            rueckblick = []
            abstand = (torch.arange(T).view(-1, 1) - torch.arange(T).view(1, -1)).float()
            for s in range(self.n_layer):
                a = aus.attentions[s][0].float().cpu()
                gew = (a * abstand.clamp(min=0)).sum(dim=(1, 2))
                summe = a.sum(dim=(1, 2)).clamp(min=1e-9)
                rueckblick.append((gew / summe).tolist())

            # Logit-Lens: was wuerde nach jeder Schicht herauskommen?
            #
            # Alle Stufen mal allen Positionen durch die Ausgabeprojektion zu
            # schicken kostet bei 29 Stufen und einem Vokabular von 151 936
            # ein Vielfaches des eigentlichen Durchlaufs. Deshalb in einem
            # Rutsch (ein Matrixprodukt statt 29) und nur fuer die letzte
            # Position; das Gitter ueber alle Positionen liefert
            # `lens_gitter()` auf Anforderung.
            norm = self.modell.model.norm
            kopf = self.modell.lm_head
            letzte = torch.stack([h[0, pos] for h in stufen_roh])
            lg = kopf(norm(letzte.to(kopf.weight.dtype))).float()
            w = torch.softmax(lg, dim=-1)
            sp, si = torch.topk(w, lens_oben, dim=-1)
            lens = [{
                "stufe": "Embedding" if s == 0 else f"nach Schicht {s}",
                "beste": [{"id": int(i), "p": float(p), "text": self.tok.decode([int(i)])}
                          for i, p in zip(si[s], sp[s])],
            } for s in range(len(stufen_roh))]

            # Laenge des Residualstroms je Stufe — und, viel aussagekraeftiger,
            # wieviel jede einzelne Schicht ueberhaupt VERAENDERT hat. Die
            # blosse Laenge waechst monoton und sagt fast nichts; der Beitrag
            # je Schicht zeigt, welche Schicht arbeitet und welche fast nur
            # durchreicht.
            laengen = [float(h[0, pos].float().norm()) for h in stufen_roh]
            beitraege = []
            for s in range(1, len(stufen_roh)):
                vor = stufen_roh[s - 1][0, pos].float()
                nach = stufen_roh[s][0, pos].float()
                delta = float((nach - vor).norm())
                bezug = float(vor.norm()) or 1.0
                beitraege.append({
                    "schicht": s,
                    "delta": round(delta, 4),
                    "anteil": round(delta / bezug, 4),
                    "winkel": round(float(torch.nn.functional.cosine_similarity(
                        vor.unsqueeze(0), nach.unsqueeze(0)).item()), 4),
                })

        return {
            "token": t,
            "schicht": schicht,
            "position": pos,
            "attention": attn.tolist(),
            "rueckblick": rueckblick,
            "lens": lens,
            "laengen": laengen,
            "beitraege": beitraege,
            "unsicherheit": unsicherheit,
            "beste": [
                {"id": int(i), "p": float(p), "text": self.tok.decode([int(i)])}
                for i, p in zip(beste.indices, beste.values)
            ],
            "logits_beste": float(logits.max()),
            "eingriffe_aktiv": not eingriffe.leer(),
        }

    @torch.no_grad()
    def lens_gitter(self, text: str, eingriffe: Eingriffe | None = None) -> dict:
        """Was das Modell nach JEDER Stufe an JEDER Position antworten wuerde.

        Das ist die teuerste Auskunft des ganzen Demonstrators und zugleich
        die aufschlussreichste: man sieht, wo im Modell und an welcher Stelle
        des Satzes die Antwort entsteht.
        """
        eingriffe = eingriffe or Eingriffe()
        ids = self.tok(text, add_special_tokens=False)["input_ids"]
        if not ids:
            return {"leer": True}
        eingabe = torch.tensor([ids], device=self.geraet)

        mitschnitt: dict = {}
        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            griffe += self._hook_letzter_block(mitschnitt)
            try:
                aus = self.modell(eingabe, output_hidden_states=True, use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            norm = self.modell.model.norm
            kopf = self.modell.lm_head
            stufen = self._stufen_roh(aus, mitschnitt)

            # Erst die Verteilungen aller Stufen rechnen, dann auswerten.
            # Grund: die zweite, viel aufschlussreichere Frage laesst sich
            # nur beantworten, wenn das ENDERGEBNIS schon bekannt ist.
            verteilungen = []
            for h in stufen:
                lg = kopf(norm(h[0].to(kopf.weight.dtype))).float()
                verteilungen.append(torch.softmax(lg, dim=-1))

            # Das Ziel: was am Ende an jeder Position herauskommt.
            ziel_p, ziel = torch.max(verteilungen[-1], dim=-1)

            zeilen = []
            for s, w in enumerate(verteilungen):
                p, i = torch.max(w, dim=-1)
                # Wahrscheinlichkeit und Rang GENAU des Stuecks, das am Ende
                # gewinnt. Diese Zahl ist an jeder Stufe sinnvoll — anders
                # als „was waere hier das beste Stueck“, das in den mittleren
                # Schichten regelmaessig Unlesbares liefert, weil die
                # Zwischenzustaende nicht dafuer gemacht sind, gelesen zu
                # werden. Hier sieht man stattdessen, WANN sich die spaetere
                # Antwort durchsetzt.
                eigen = w.gather(1, ziel.view(-1, 1)).squeeze(1)
                rang = (w > eigen.view(-1, 1)).sum(dim=1) + 1
                zeilen.append({
                    "stufe": "Embedding" if s == 0 else f"nach Schicht {s}",
                    "zellen": [{"id": int(a), "p": float(b),
                                "text": self.tok.decode([int(a)])}
                               for a, b in zip(i, p)],
                    "ziel_p": [round(float(x), 5) for x in eigen],
                    "ziel_rang": [int(x) for x in rang],
                })

        return {
            "token": self.tokenisieren(text),
            "zeilen": zeilen,
            "ziel": [{"id": int(a), "p": float(b),
                      "text": self.tok.decode([int(a)])}
                     for a, b in zip(ziel, ziel_p)],
            "vokabular": int(verteilungen[-1].shape[-1]),
        }

    # -- Nachbarschaft im Bedeutungsraum ---------------------------------

    @torch.no_grad()
    def nachbarn(self, token_id: int, k: int = 15) -> list[dict]:
        if self._emb_normen is None:
            self._emb_normen = self.embedding.float().norm(dim=1).clamp(min=1e-9)
        v = self.embedding[token_id].float()
        s = (self.embedding.float() @ v) / (self._emb_normen * v.norm().clamp(min=1e-9))
        s[token_id] = -1e9
        werte, wo = torch.topk(s, k)
        return [{"id": int(i), "text": self.tok.decode([int(i)]), "kosinus": float(w)}
                for i, w in zip(wo, werte)]

    @torch.no_grad()
    def raum(self, text: str, nachbarn_je: int = 8, hintergrund: int = 400) -> dict:
        """Die Embedding-Vektoren als drehbarer Raum.

        Der Bedeutungsraum hat 2 048 Achsen. Zeigen laesst er sich nur in
        dreien - also werden die drei Richtungen gesucht, in denen die
        ausgewaehlten Vektoren am staerksten streuen (Hauptkomponenten). Das
        ist keine Verzierung, sondern die uebliche Art, hochdimensionale
        Lagen sichtbar zu machen; was dabei verloren geht, steht als
        erklaerte Streuung mit in der Antwort.

        Ausgewaehlt werden: die Stuecke Ihres Satzes, ihre naechsten Nachbarn
        (damit man Nachbarschaften als Klumpen sieht) und eine Stichprobe
        haeufiger Stuecke als Hintergrund.
        """
        ids = self.tok(text, add_special_tokens=False)["input_ids"]
        if not ids:
            return {"leer": True}

        satz = list(dict.fromkeys(ids))
        gruppen = {i: "satz" for i in satz}

        if self._emb_normen is None:
            self._emb_normen = self.embedding.float().norm(dim=1).clamp(min=1e-9)

        # WESSEN Nachbar ein Punkt ist, muss mitgeliefert werden. Ohne diese
        # Zuordnung laesst sich in der Oberflaeche nicht auf die Nachbarn
        # EINES Wortes filtern — dort stehen sonst 100 gruene Punkte ohne
        # Zugehoerigkeit. Ein Punkt kann Nachbar mehrerer Woerter sein.
        nachbar_von: dict[int, list[int]] = {}
        naehe: dict[int, float] = {}
        # Je Satz-Stueck die Nachbarn IN REIHENFOLGE ihrer Naehe. Damit kann
        # die Oberflaeche „nur die besten k“ zeigen, ohne den Server erneut
        # zu fragen — der teure Teil (eine Matrixmultiplikation gegen alle
        # 151.936 Vektoren je Stueck) haengt ohnehin nicht an k.
        nachbarn_rang: dict[int, list[int]] = {}

        # ALLE Stuecke des Satzes in EINEM Matrixprodukt.
        #
        # Vorher stand `self.embedding.float()` INNERHALB der Schleife: bei
        # 15 Stuecken wurde die ganze Embedding-Matrix (151.936 x 2048)
        # fuenfzehnmal nach float32 kopiert — jedesmal rund 1,2 GB, nur um
        # sie danach wegzuwerfen. Das war der Grund, warum der Raum „ewig“
        # rechnete. Einmal konvertieren, ein Produkt gegen alle Stuecke
        # zugleich, dann topk je Spalte.
        emb = self.embedding.float()
        V = emb[satz]                                     # (n, d)
        aehnlich = (emb @ V.T) / (
            self._emb_normen.unsqueeze(1) * V.norm(dim=1).clamp(min=1e-9))
        for spalte, i in enumerate(satz):
            aehnlich[i, spalte] = -1e9                    # nicht sich selbst
        oben = torch.topk(aehnlich, nachbarn_je, dim=0)
        for spalte, i in enumerate(satz):
            reihe: list[int] = []
            for j, w in zip(oben.indices[:, spalte].tolist(),
                            oben.values[:, spalte].tolist()):
                gruppen.setdefault(int(j), "nachbar")
                nachbar_von.setdefault(int(j), []).append(int(i))
                reihe.append(int(j))
                # bei mehreren Zugehoerigkeiten die staerkste Naehe merken
                if float(w) > naehe.get(int(j), -2.0):
                    naehe[int(j)] = float(w)
            nachbarn_rang[int(i)] = reihe
        del aehnlich, emb

        # Hintergrund: gleichmaessig aus dem vorderen, haeufig benutzten Teil
        # des Vokabulars gezogen (kleine IDs sind bei BPE die haeufigen).
        if hintergrund > 0:
            schritt = max(1, 24000 // hintergrund)
            for j in range(0, min(24000, self.vocab), schritt):
                gruppen.setdefault(int(j), "hintergrund")

        auswahl = sorted(gruppen)
        V = self.embedding[auswahl].float()
        mittel = V.mean(dim=0, keepdim=True)
        Z = V - mittel

        # Hauptkomponenten
        U, S, Vt = torch.pca_lowrank(Z, q=min(6, Z.shape[0] - 1, Z.shape[1]))
        koord = Z @ Vt[:, :3]
        gesamt = float((Z ** 2).sum())
        erklaert = [float((S[i] ** 2) / gesamt) if gesamt > 0 else 0.0
                    for i in range(min(3, S.numel()))]

        # auf einen handlichen Bereich skalieren
        spanne = float(koord.abs().max()) or 1.0
        koord = koord / spanne * 10.0

        punkte = []
        for n, tid in enumerate(auswahl):
            punkte.append({
                "id": int(tid),
                "text": self.tok.decode([int(tid)]),
                "x": round(float(koord[n, 0]), 3),
                "y": round(float(koord[n, 1]), 3),
                "z": round(float(koord[n, 2]), 3),
                "gruppe": gruppen[tid],
                "laenge": round(float(V[n].norm()), 3),
                # Nachbar WESSEN? (Token-IDs aus dem Satz) und wie nah
                "von": nachbar_von.get(int(tid), []),
                "naehe": round(naehe[int(tid)], 4) if int(tid) in naehe else None,
            })

        return {
            "punkte": punkte,
            "satz_ids": satz,
            # je Satz-Stueck die Nachbarn nach Naehe geordnet — erlaubt der
            # Oberflaeche das Filtern ohne neue Anfrage
            "nachbarn": {str(k): v for k, v in nachbarn_rang.items()},
            "nachbarn_je": int(nachbarn_je),
            "erklaerte_streuung": [round(e, 4) for e in erklaert],
            "dimensionen": self.d,
        }

    def _ganze_woerter(self) -> torch.Tensor:
        """Welche Stuecke des Vokabulars sind vollstaendige Woerter?

        Ein Stueck gilt als ganzes Wort, wenn es mit einem Leerzeichen
        beginnt (im Vokabular als Ġ) und danach nur aus Buchstaben besteht.
        Ohne diese Unterscheidung besteht jede Ergebnisliste zur Haelfte aus
        Wortanfaengen wie „Kön“ oder „Produ“ — die als Antwort auf eine
        Analogie niemandem etwas sagen.
        """
        if getattr(self, "_ganz", None) is None:
            namen = self.tok.convert_ids_to_tokens(list(range(self.vocab)))
            maske = torch.zeros(self.vocab, dtype=torch.bool)
            for i, s in enumerate(namen):
                if not s:
                    continue
                s = s.replace("Ġ", " ")
                if len(s) > 2 and s[0] == " " and s[1:].isalpha():
                    maske[i] = True
            # auf dasselbe Geraet wie die Embeddings — sonst scheitert jede
            # Verrechnung mit den Aehnlichkeiten, die auf der GPU liegen
            self._ganz = maske.to(self.embedding.device)
        return self._ganz

    @torch.no_grad()
    def wortvektor(self, wort: str) -> tuple[torch.Tensor, list[int]]:
        """Ein Vektor fuer ein ganzes Wort — auch wenn es in Stuecke zerfaellt.

        Bei einem Stueck ist es dessen Embedding. Bei mehreren wird die Summe
        genommen. Das ist eine NAEHERUNG und keine Wortbedeutung: das Modell
        selbst setzt die Stuecke nicht durch Addition zusammen, sondern
        verrechnet sie ueber die Schichten. Die Naeherung ist trotzdem
        besser als die Alternative, einfach das erste Stueck zu nehmen — dann
        rechnet man mit „Kön“ statt mit „Königin“.
        """
        ids = self.tok(wort, add_special_tokens=False)["input_ids"]
        if not ids:
            return torch.zeros(self.d), []
        return self.embedding[ids].float().sum(dim=0), ids

    @torch.no_grad()
    def analogie(self, a: str, b: str, c: str, k: int = 10,
                 nur_ganze: bool = True, erwartet: str = "") -> dict:
        """A minus B plus C — die klassische Probe, mit ganzen Woertern."""
        va, ia = self.wortvektor(a)
        vb, ib = self.wortvektor(b)
        vc, ic = self.wortvektor(c)
        if not (ia and ib and ic):
            return {"leer": True}
        v = va - vb + vc

        if self._emb_normen is None:
            self._emb_normen = self.embedding.float().norm(dim=1).clamp(min=1e-9)
        s = (self.embedding.float() @ v) / (self._emb_normen * v.norm().clamp(min=1e-9))
        roh = s.clone()
        for i in set(ia + ib + ic):
            s[i] = -1e9
        if nur_ganze:
            s = torch.where(self._ganze_woerter(), s, torch.full_like(s, -1e9))

        werte, wo = torch.topk(s, k)
        antwort = {
            "treffer": [{"id": int(i), "text": self.tok.decode([int(i)]),
                         "kosinus": round(float(w), 4)}
                        for i, w in zip(wo, werte)],
            "stuecke": {"a": len(ia), "b": len(ib), "c": len(ic)},
            "zerlegung": {
                "a": [self.tok.decode([i]) for i in ia],
                "b": [self.tok.decode([i]) for i in ib],
                "c": [self.tok.decode([i]) for i in ic],
            },
            "nur_ganze": nur_ganze,
            "ganze_im_vokabular": int(self._ganze_woerter().sum()),
        }

        # Der ehrlichste Teil: wo landet das Wort, das man erwartet haette?
        #
        # Der Platz MUSS zur angezeigten Liste passen. Wird er gegen die
        # ungefilterte Rangfolge gerechnet, die Liste aber gefiltert
        # angezeigt, meldet der Demonstrator „Platz 3“ fuer ein Wort, das in
        # der Liste gar nicht vorkommt — und widerspricht sich selbst.
        if erwartet.strip():
            _ve, ie = self.wortvektor(erwartet)
            if ie:
                ziel = ie[0]
                ganz = self._ganze_woerter()
                ist_eigenes_wort = len(ie) == 1 and bool(ganz[ziel])
                # dieselbe Rangfolge, die auch die Trefferliste erzeugt
                platz = int((s > s[ziel]).sum()) + 1 if ist_eigenes_wort else None
                antwort["erwartet"] = {
                    "wort": erwartet.strip(),
                    "stuecke": len(ie),
                    "zerlegung": [self.tok.decode([i]) for i in ie],
                    "erstes_stueck": self.tok.decode([ziel]),
                    "kosinus": round(float(roh[ziel]), 4),
                    # Platz in der Liste, die der Betrachter tatsaechlich sieht
                    "platz": platz,
                    # Platz unter ALLEN Stuecken, ohne Filter — zum Vergleich
                    "platz_alle": int((roh > roh[ziel]).sum()) + 1,
                    "ist_eigenes_wort": ist_eigenes_wort,
                }
        return antwort

    # Muster fuer die sprachliche Analogie. Gemessen am 09.08.2026 das
    # einzige der vier geprueften Muster, das ueberhaupt brauchbare
    # Ergebnisse liefert (Paris/Frankreich -> Berlin/Deutschland richtig,
    # Rom/Italien -> Madrid/Spanien richtig).
    ANALOGIE_MUSTER = "Beispiele für Wortpaare:\n{b} – {a}\n{c} –"

    @torch.no_grad()
    def analogie_sprachlich(self, a: str, b: str, c: str,
                            anzahl: int = 6) -> dict:
        """Dieselbe Frage, aber an das MODELL gestellt statt an die Tabelle.

        Der Unterschied ist der Kern der Sache: die Vektorrechnung greift auf
        die Embedding-Tabelle zu — den Zustand VOR der ersten Schicht. Hier
        rechnet das ganze Modell. Und weil es Stueck fuer Stueck erzeugt,
        kann die Antwort ein ganzes Wort sein, auch wenn es in mehrere
        Stuecke zerfaellt.
        """
        text = self.ANALOGIE_MUSTER.format(a=a.strip(), b=b.strip(), c=c.strip())
        ids = self.tok(text, add_special_tokens=False)["input_ids"]
        folge = list(ids)
        with self.sperre:
            for _ in range(anzahl):
                lg = self.modell(torch.tensor([folge], device=self.geraet),
                                 use_cache=False).logits[0, -1]
                folge.append(int(lg.argmax()))
        neu = self.tok.decode(folge[len(ids):])
        # Nur bis zum Zeilenende: das Muster ist eine Liste, danach faengt
        # das Modell an, eigene Beispiele zu erfinden.
        wort = neu.split("\n")[0].strip(" .,;:!?–-")
        return {"muster": text, "roh": neu, "wort": wort,
                "stuecke": len(self.tok(" " + wort,
                                        add_special_tokens=False)["input_ids"])}

    # -- Das Netz: welches Wort im Satz traegt welche Fortsetzung? --------

    @torch.no_grad()
    def netz(self, text: str, position: int = -1, oben: int = 8,
             eingriffe: Eingriffe | None = None,
             mit_wirkung: bool = False,
             temperatur: float = 1.0, verfahren: str = "top_k",
             top_k: int = 0, top_p: float = 1.0) -> dict:
        """Bezuege vom Satz zur naechsten Fortsetzung — zwei echte Groessen.

        Ein Sankey-Bild braucht Bandbreiten, und die duerfen nicht gemalt
        sein. Hier tragen sie zwei verschiedene, jeweils gemessene Groessen:

        LINKS (Satzstueck -> Vorhersagestelle): die **Aufmerksamkeit**, mit
        der die Vorhersagestelle auf dieses Stueck schaut, gemittelt ueber
        alle Schichten und Koepfe. Das ist der Weg, auf dem Information
        ueberhaupt dorthin gelangt.

        RECHTS (Vorhersagestelle -> Kandidat): die **Wahrscheinlichkeit**
        des Kandidaten. Zusammen zeigt das Bild die eigentliche Mechanik:
        der ganze Satz laeuft durch EINEN Zustand zusammen, und aus diesem
        einen Zustand faechert sich die Verteilung wieder auf.

        Und weil Aufmerksamkeit noch keine Wirkung ist, kommt die Wirkung
        getrennt dazu: fuer jedes Satzstueck wird der Satz OHNE dieses
        Stueck noch einmal gerechnet. Die Verschiebung der Wahrscheinlichkeit
        je Kandidat (`wirkung`) ist damit eine Messung am echten Modell und
        keine Auslegung der Attention-Zahlen — die beiden fallen regelmaessig
        auseinander, und genau das ist sehenswert.

        TEMPERATUR UND SCHNITT GEHOEREN HIERHER (14.08.2026, User-Direktive
        „Parameter, die ich auf einer Kachel verstellen kann, muessen in alle
        Darstellungen der Kachel wirken"). Dieser Endpunkt kannte sie bisher
        nicht — die Regler ueber der Tafel wirkten auf die Tafel und liessen
        das Netz derselben Kachel unveraendert stehen. Das Netz KONNTE ihnen
        gar nicht folgen. Jetzt rechnet es dieselbe Verteilung wie die Tafel:
        `logits / T`, Schnitt auf −∞, Softmax. Die Bandbreiten rechts sind
        damit genau die Wahrscheinlichkeiten, mit denen auch gezogen wird.

        Voreinstellung `temperatur = 1.0`, `top_k = 0` (kein Schnitt) —
        damit ein Aufruf ohne diese Angaben sich verhaelt wie bisher.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}
        T = len(ids)
        pos = T - 1 if position < 0 or position >= T else int(position)
        temperatur = max(0.05, min(10.0, float(temperatur)))
        verfahren = "top_p" if str(verfahren) == "top_p" else "top_k"
        top_p = max(0.05, min(1.0, float(top_p)))

        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            speicher: dict = {}
            griffe += self._hook_letzter_block(speicher)
            try:
                aus = self.modell(torch.tensor([ids], device=self.geraet),
                                  output_attentions=True,
                                  output_hidden_states=True, use_cache=False)
                # Der Zustand JE STELLE, damit im Bild an jeder Station der
                # echte Vektor stehen kann und nicht ein leerer Kasten.
                # Vollstaendig waeren das T x 2048 Zahlen; gezeigt wird eine
                # GLEICHMAESSIGE Stichprobe daraus — das steht auch so in der
                # Legende, damit niemand sie fuer den ganzen Vektor haelt.
                stufen = self._stufen_roh(aus, speicher)
                letzte = stufen[-1][0].float().cpu()
                schritt = max(1, self.d // 128)
                proben = letzte[:, ::schritt][:, :128]
                vektoren = [[round(float(x), 4) for x in reihe]
                            for reihe in proben]
                # DIESELBE VERTEILUNG WIE DIE TAFEL — Temperatur, dann
                # Schnitt auf −∞, dann Softmax.
                roh = aus.logits[0, pos].float()
                wahr = self._verteilung(roh, temperatur, verfahren,
                                        top_k, top_p)
                werte, wo = torch.topk(wahr, oben)
                kand = [int(i) for i in wo]

                # Aufmerksamkeit der Vorhersagestelle auf jede Satzstelle,
                # ueber ALLE Schichten und Koepfe gemittelt.
                blick = torch.zeros(T)
                for s in range(self.n_layer):
                    blick += aus.attentions[s][0, :, pos, :].float().mean(dim=0).cpu()
                blick /= max(1, self.n_layer)

                # Wirkung durch Weglassen. Alle Varianten sind gleich lang
                # (T-1), lassen sich also stapeln; in Portionen, damit die
                # Logit-Tensoren bei langen Saetzen nicht ausufern.
                #
                # Nur auf Anforderung: sie kostet T zusaetzliche Durchlaeufe.
                # Die Wegansicht braucht sie nicht, und die Kachel soll beim
                # Oeffnen sofort dastehen — sonst haelt dieser Endpunkt die
                # uebrigen Diagramme derselben Kachel auf (gemessen: das
                # Diagramm-Gate fiel deswegen von 22/22 auf 19/23).
                wirkung = [[0.0] * len(kand) for _ in range(T)]
                varianten = [i for i in range(T) if i != pos] if mit_wirkung else []
                portion = 8
                for anfang in range(0, len(varianten), portion):
                    teil = varianten[anfang:anfang + portion]
                    x = torch.tensor([ids[:i] + ids[i + 1:] for i in teil],
                                     device=self.geraet)
                    a2 = self.modell(x, use_cache=False)
                    for n, i in enumerate(teil):
                        p2 = pos - 1 if i < pos else pos
                        # DIESELBE Verteilung wie oben — sonst vergleicht die
                        # Wirkung eine getemperte Zahl mit einer ungetemperten.
                        w2 = self._verteilung(a2.logits[n, p2].float(),
                                              temperatur, verfahren,
                                              top_k, top_p)
                        for j, kid in enumerate(kand):
                            # positiv = dieses Stueck STUETZT den Kandidaten
                            # (ohne das Stueck faellt die Wahrscheinlichkeit)
                            wirkung[i][j] = round(
                                float(wahr[kid] - w2[kid]), 6)
            finally:
                for g in griffe:
                    g.remove()

        return {
            "token": t,
            "position": pos,
            "stellen": [{
                "index": i,
                "text": self.tok.decode([ids[i]]),
                "blick": round(float(blick[i]), 6),
                "ist_ziel": i == pos,
                "wirkung": wirkung[i],
                "vektor": vektoren[i],
            } for i in range(T)],
            # Wieviele Zahlen der Vektor WIRKLICH hat, und wieviele davon im
            # Bild stehen — sonst haelt man die Stichprobe fuer das Ganze.
            "vektor_gezeigt": len(vektoren[0]) if vektoren else 0,
            "vektor_gesamt": self.d,
            "kandidaten": [{"id": int(i), "text": self.tok.decode([int(i)]),
                            "p": round(float(p), 6)}
                           for i, p in zip(wo, werte)],
            "schichten_gemittelt": self.n_layer,
            "mit_wirkung": bool(mit_wirkung),
            # Womit gerechnet wurde — damit das Bild seinen eigenen Bezug
            # nennen kann und nicht behauptet, es zeige die rohe Verteilung.
            "temperatur": round(temperatur, 3),
            "verfahren": verfahren,
            "top_k": int(top_k),
            "top_p": round(top_p, 3),
            "beschaedigt": not eingriffe.leer(),
        }

    # -- Ganze Woerter: ein Vektor, den das MODELL gebildet hat -----------
    #
    # Warum es diesen zweiten Raum gibt (gemessen 12.08.2026):
    #
    # Die Analogie in der Embedding-Tabelle liefert kein Signal — und zwar
    # AUCH DANN nicht, wenn alle beteiligten Woerter einzelne Stuecke sind.
    # `Paris - Frankreich + Deutschland` setzt „Berlin“ auf Platz 500 von
    # 151 936 (Kosinus 0,0649), obwohl „Berlin“ ein einziges, ganzes Wort
    # ist. Die Zerlegung in Stuecke ist also NICHT die Ursache; die Tabelle
    # selbst ist es. Sie ist die Eingangsschicht eines tiefen Netzes und
    # kein Bedeutungsraum. Die beruehmte Rechnung König − Mann + Frau
    # stammt aus word2vec, wo jeder Vektor unmittelbar auf Bedeutung
    # trainiert wurde. Ein Sprachmodell hat so etwas nicht.
    #
    # Ein Vektor, der wirklich das GANZE WORT meint, entsteht erst, wenn das
    # Wort durch die Schichten gelaufen ist. Genau das passiert hier: jedes
    # Wort wird durch das Modell geschickt, und sein Vektor ist der Zustand
    # am LETZTEN Stueck in einer waehlbaren Schicht. Am letzten deshalb,
    # weil bei kausaler Aufmerksamkeit nur dieses alle vorherigen Stuecke
    # des Wortes gesehen hat: „Königin“ ist dort ein Zustand, der „K“, „ön“
    # und „igin“ zusammen kennt — keine Summe dreier Bruchstuecke.
    #
    # Eingabewoerter und Kandidaten laufen durch DENSELBEN Weg, sonst
    # vergleicht man zwei verschiedene Sorten Vektor miteinander.

    def _wortliste(self) -> tuple[list[int], list[str]]:
        """Die Stuecke, die fuer sich genommen schon ein ganzes Wort sind.

        Gibt Nummern UND Klartext zurueck, beides einmal berechnet. Der
        Klartext muss mit: ein `tok.decode()` je Kandidat kostet Bruchteile
        einer Millisekunde, aber bei 43 075 Kandidaten mal zwei Schleifen
        waren das gemessen ueber 300 s pro Anfrage — der Grund, warum die
        erste Fassung dieser Auskunft „ewig“ rechnete.
        """
        if getattr(self, "_wliste", None) is None:
            maske = self._ganze_woerter().cpu()
            ids = [int(i) for i in torch.nonzero(maske).flatten()]
            namen = self.tok.convert_ids_to_tokens(ids)
            self._wliste = (ids, [s.replace("Ġ", " ").strip() for s in namen])
        return self._wliste

    @torch.no_grad()
    def wortvektor_modell(self, wort: str, schicht: int) -> tuple[torch.Tensor, list[int]]:
        """Ein Wort durch das Modell — Zustand am letzten Stueck der Schicht.

        Schicht 0 ist die Embedding-Tabelle selbst; damit laesst sich der
        Unterschied zwischen Tabelle und Modellraum direkt vergleichen.
        """
        text = " " + wort.strip()
        ids = self.tok(text, add_special_tokens=False)["input_ids"]
        if not ids:
            return torch.zeros(self.d), []
        with self.sperre:
            speicher: dict = {}
            griffe = self._hook_letzter_block(speicher)
            try:
                aus = self.modell(torch.tensor([ids], device=self.geraet),
                                  output_hidden_states=True, use_cache=False)
                stufen = self._stufen_roh(aus, speicher)
            finally:
                for g in griffe:
                    g.remove()
        s = max(0, min(int(schicht), len(stufen) - 1))
        return stufen[s][0, -1].float().cpu(), ids

    @torch.no_grad()
    def wortraum(self, schichten: tuple[int, ...] = (14,),
                 batch: int = 256) -> dict[int, torch.Tensor]:
        """Derselbe Weg fuer den ganzen Wortschatz — einmal, dann gecacht.

        Ein einziger Durchlauf sammelt alle gewuenschten Schichten zugleich;
        fuenf Schichten kosten deshalb nicht fuenfmal so viel wie eine.
        """
        schichten = tuple(sorted({int(s) for s in schichten}))
        if getattr(self, "_wraum", None) is None:
            self._wraum = {}
        fehlt = [s for s in schichten if s not in self._wraum]
        if fehlt:
            ids, _ = self._wortliste()
            pad = self.tok.pad_token_id
            if pad is None:
                pad = self.tok.eos_token_id or 0
            sammler: dict[int, list[torch.Tensor]] = {s: [] for s in fehlt}
            with self.sperre:
                for anfang in range(0, len(ids), batch):
                    teil = ids[anfang:anfang + batch]
                    # Jeder Kandidat ist genau EIN Stueck (so ist die Liste
                    # gebaut) — deshalb reicht eine Spalte, kein Auffuellen.
                    x = torch.tensor([[i] for i in teil], device=self.geraet)
                    speicher: dict = {}
                    griffe = self._hook_letzter_block(speicher)
                    try:
                        aus = self.modell(x, output_hidden_states=True,
                                          use_cache=False)
                        stufen = self._stufen_roh(aus, speicher)
                    finally:
                        for g in griffe:
                            g.remove()
                    for s in fehlt:
                        i = max(0, min(s, len(stufen) - 1))
                        sammler[s].append(stufen[i][:, -1].float().cpu())
            for s in fehlt:
                self._wraum[s] = torch.cat(sammler[s], dim=0)
        return {s: self._wraum[s] for s in schichten}

    @torch.no_grad()
    def analogie_ganz(self, a: str, b: str, c: str, k: int = 10,
                      schicht: int = 14, erwartet: str = "") -> dict:
        """A − B + C, aber mit Vektoren ganzer Woerter statt Stueck-Summen."""
        raum = self.wortraum((schicht,))[schicht]
        va, ia = self.wortvektor_modell(a, schicht)
        vb, ib = self.wortvektor_modell(b, schicht)
        vc, ic = self.wortvektor_modell(c, schicht)
        if not (ia and ib and ic):
            return {"leer": True}
        v = va - vb + vc

        normen = raum.norm(dim=1).clamp(min=1e-9)
        s = (raum @ v) / (normen * v.norm().clamp(min=1e-9))

        ids, namen = self._wortliste()
        # Die drei Eingabewoerter selbst ausschliessen — nach WORT, nicht
        # nach Stueck-Nummer: im Modellraum ist ein Wort ein Wort.
        gesperrt = {w.strip().lower() for w in (a, b, c)}
        for n, name in enumerate(namen):
            if name.lower() in gesperrt:
                s[n] = -1e9

        werte, wo = torch.topk(s, min(k, len(ids)))
        antwort = {
            "raum": "modell",
            "schicht": int(schicht),
            "kandidaten": len(ids),
            "treffer": [{"id": ids[int(n)], "text": namen[int(n)],
                         "kosinus": round(float(w), 4)}
                        for n, w in zip(wo, werte)],
            "zerlegung": {
                "a": [self.tok.decode([i]) for i in ia],
                "b": [self.tok.decode([i]) for i in ib],
                "c": [self.tok.decode([i]) for i in ic],
            },
        }

        if erwartet.strip():
            ziel = erwartet.strip()
            wo_im_raum = None
            for n, name in enumerate(namen):
                if name.lower() == ziel.lower():
                    wo_im_raum = n
                    break
            if wo_im_raum is None:
                antwort["erwartet"] = {
                    "wort": ziel, "im_raum": False,
                    "grund": "ist kein eigenes Stueck im Vokabular — die "
                             "Kandidatenliste besteht aus Einzelstueck-Woertern",
                }
            else:
                antwort["erwartet"] = {
                    "wort": ziel, "im_raum": True,
                    "kosinus": round(float(s[wo_im_raum]), 4),
                    "platz": int((s > s[wo_im_raum]).sum()) + 1,
                }
        return antwort

    # -- Wozu das Ganze: dasselbe Wort, zwei Bedeutungen ------------------

    @torch.no_grad()
    def kontext(self, satz_a: str, satz_b: str, wort: str) -> dict:
        """Warum es Aufmerksamkeit ueberhaupt braucht — messbar gemacht.

        Ein Embedding ist kontextlos. „Bank“ ist als Eintrag in der Tabelle
        genau EIN Vektor, ob im Wald oder in der Innenstadt. Die Bedeutung
        entsteht erst, waehrend das Wort durch die Schichten laeuft und sich
        von den anderen Woertern holt, was es braucht.

        Das laesst sich nachmessen: dasselbe Wort in zwei Saetzen. In der
        Tabelle sind beide Zustaende identisch (Abstand 0). Von Schicht zu
        Schicht laufen sie auseinander — und genau dieses Auseinanderlaufen
        IST die Kontextaufnahme.
        """
        stuecke = self.tok(wort, add_special_tokens=False)["input_ids"]
        if not stuecke:
            return {"leer": True, "grund": "kein Wort angegeben"}

        def stelle(satz: str):
            ids = self.tok(satz, add_special_tokens=False)["input_ids"]
            # letztes Vorkommen des Wortes suchen (dort ist es vollstaendig)
            for start in range(len(ids) - len(stuecke), -1, -1):
                if ids[start:start + len(stuecke)] == stuecke:
                    return ids, start + len(stuecke) - 1
            return ids, None

        ids_a, pos_a = stelle(satz_a)
        ids_b, pos_b = stelle(satz_b)
        if pos_a is None or pos_b is None:
            return {"leer": True,
                    "grund": f"Das Wort {wort!r} kommt nicht in beiden Sätzen vor."}

        mit_a: dict = {}
        mit_b: dict = {}
        with self.sperre:
            g = self._hook_letzter_block(mit_a)
            aus_a = self.modell(torch.tensor([ids_a], device=self.geraet),
                                output_hidden_states=True, use_cache=False)
            for x in g:
                x.remove()
            g = self._hook_letzter_block(mit_b)
            aus_b = self.modell(torch.tensor([ids_b], device=self.geraet),
                                output_hidden_states=True, use_cache=False)
            for x in g:
                x.remove()

            sa = self._stufen_roh(aus_a, mit_a)
            sb = self._stufen_roh(aus_b, mit_b)

            stufen = []
            for s in range(len(sa)):
                va = sa[s][0, pos_a].float()
                vb = sb[s][0, pos_b].float()
                kos = float(torch.nn.functional.cosine_similarity(
                    va.unsqueeze(0), vb.unsqueeze(0)).item())
                stufen.append({
                    "stufe": "Embedding" if s == 0 else f"nach Schicht {s}",
                    "kosinus": round(kos, 4),
                    # Abstand als Gegenstueck: 0 = identisch, 1 = unabhaengig
                    "abstand": round(1.0 - kos, 4),
                })

            # Was sagt das Modell an dieser Stelle jeweils voraus?
            norm, kopf = self.modell.model.norm, self.modell.lm_head
            def beste(stufe, pos):
                lg = kopf(norm(stufe[0, pos].to(kopf.weight.dtype))).float()
                w = torch.softmax(lg, dim=-1)
                p, i = torch.topk(w, 3)
                return [{"text": self.tok.decode([int(x)]), "p": round(float(y), 4)}
                        for x, y in zip(i, p)]

        return {
            "wort": wort,
            "stuecke": len(stuecke),
            "a": {"satz": satz_a, "position": pos_a,
                  "stuecke": [self.tok.decode([i]) for i in ids_a],
                  "weiter": beste(sa[-1], pos_a)},
            "b": {"satz": satz_b, "position": pos_b,
                  "stuecke": [self.tok.decode([i]) for i in ids_b],
                  "weiter": beste(sb[-1], pos_b)},
            "stufen": stufen,
        }

    # -- Der Rechenweg der Aufmerksamkeit, Schritt fuer Schritt -----------

    @torch.no_grad()
    @torch.no_grad()
    def attention_stufen(self, text: str, schicht: int = 0,
                         kopf: int = 0) -> dict:
        """Die Aufmerksamkeit in ihren DREI Rechenstufen, als volle Matrizen.

        Der Demonstrator zeigte bisher nur die fertige Attention-Matrix —
        also das Ergebnis. Wie sie entsteht, blieb unsichtbar. Hier stehen
        die drei Stufen nebeneinander:

          1. Punktprodukt   Q · K^T          roh, beliebige Groesse
          2. Skaliert+Maske / sqrt(d), dann alles nach rechts oben auf -inf
          3. Softmax        je Zeile auf Summe 1 gebracht

        Gerechnet wird mit denselben Gewichten wie in `rechenweg` — inklusive
        Q-/K-Normierung, Positionsdrehung (RoPE) und der Zuordnung von 16
        Frage-Koepfen auf 8 Schluessel-Koepfe. Der Unterschied ist nur, dass
        hier ALLE Zeilen gerechnet werden statt einer.

        Am Ende wird gegen die Matrix verglichen, die das Modell selbst
        ausgegeben hat. `abweichung` ist der groesste Einzelunterschied —
        steht dort eine winzige Zahl, ist bewiesen, dass die drei gezeigten
        Stufen die Rechnung des Modells sind und keine Nacherzaehlung.
        """
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}
        T = len(ids)
        schicht = max(0, min(int(schicht), self.n_layer - 1))
        kopf = max(0, min(int(kopf), self.n_head - 1))

        with self.sperre:
            aus = self.modell(torch.tensor([ids], device=self.geraet),
                              output_attentions=True,
                              output_hidden_states=True, use_cache=False)
            block = self.bloecke[schicht]
            att = block.self_attn
            x = block.input_layernorm(aus.hidden_states[schicht][0])

            kd = self.kopf_dim
            gruppen = self.n_head // self.n_kv_head
            q = att.q_norm(att.q_proj(x).view(T, self.n_head, kd)).transpose(0, 1)
            k = att.k_norm(att.k_proj(x).view(T, self.n_kv_head, kd)).transpose(0, 1)

            from transformers.models.qwen3.modeling_qwen3 import apply_rotary_pos_emb
            stellen = torch.arange(T, device=self.geraet).unsqueeze(0)
            cos, sin = self.modell.model.rotary_emb(x.unsqueeze(0), stellen)
            q_r, k_r = apply_rotary_pos_emb(q.unsqueeze(0), k.unsqueeze(0), cos, sin)

            Q = q_r[0, kopf].float()                    # (T, kd)
            K = k_r[0, kopf // gruppen].float()          # (T, kd)

            punkt = (Q @ K.T)                            # (T, T)
            skaliert = punkt * (kd ** -0.5)
            maske = torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)
            maskiert = skaliert.masked_fill(maske.to(skaliert.device), float("-inf"))
            weich = torch.softmax(maskiert, dim=-1)

            echt = aus.attentions[schicht][0, kopf].float()
            abweichung = float((weich - echt).abs().max())

            punkt = punkt.cpu()
            skaliert = skaliert.cpu()
            weich = weich.cpu()
            maske = maske.cpu()

        def matrix(m, mit_maske):
            # Maskierte Zellen als null: -inf laesst sich nicht als JSON
            # schreiben, und "0" waere eine Luege — dort steht kein Wert,
            # dort ist der Blick VERBOTEN.
            return [[None if (mit_maske and bool(maske[i][j]))
                     else round(float(m[i][j]), 4)
                     for j in range(T)] for i in range(T)]

        sicht = skaliert[~maske]
        return {
            "token": t,
            "schicht": schicht,
            "kopf": kopf,
            "kopf_dim": kd,
            "kv_kopf": kopf // gruppen,
            "stufen": [
                {"name": "Punktprodukt", "formel": "Q · Kᵀ",
                 "was": "Wie gut passt die Frage jedes Wortes zum Schlüssel "
                        "jedes anderen? Noch ohne jede Begrenzung.",
                 "matrix": matrix(punkt, False),
                 "min": round(float(punkt.min()), 3),
                 "max": round(float(punkt.max()), 3)},
                {"name": "Skalierung und Maske",
                 "formel": "(Q · Kᵀ) / √" + str(kd),
                 "was": "Geteilt durch die Wurzel der Kopfdimension, damit "
                        "der Softmax nicht kippt — und alles nach rechts "
                        "oben gesperrt: kein Wort darf sehen, was nach ihm "
                        "kommt.",
                 "matrix": matrix(skaliert, True),
                 "min": round(float(sicht.min()), 3),
                 "max": round(float(sicht.max()), 3)},
                {"name": "Softmax", "formel": "softmax je Zeile",
                 "was": "Jede Zeile auf Summe 1 gebracht. Erst jetzt sind "
                        "es Anteile — das ist die Aufmerksamkeit.",
                 "matrix": matrix(weich, True),
                 "min": 0.0, "max": 1.0},
            ],
            # Der Beweis, dass die drei Stufen die Rechnung des Modells sind
            "abweichung": abweichung,
        }

    def _schnitt(self, logits: "torch.Tensor", temperatur: float,
                 verfahren: str, top_k: int, top_p: float):
        """DIE EINE STELLE, an der Temperatur und Schnitt angewandt werden.

        Jede Darstellung, die eine Verteilung zeigt, muss dieselbe zeigen —
        sonst behauptet die eine Kachelhaelfte etwas anderes als die andere.
        Vorher stand diese Rechnung nur in `logit_kette`; das Netz derselben
        Kachel rechnete ungetempert und ohne Schnitt weiter. Deshalb gibt es
        sie jetzt genau einmal, und alle rufen sie auf.

        Gibt zurueck: (skaliert, w_offen, w, si, anzahl)
          skaliert  logits / T
          w_offen   Softmax OHNE Schnitt — bestimmt die Rangfolge
          w         Softmax NACH dem Schnitt — damit wird gezogen
          si        Kennungen der behaltenen Stuecke (None = kein Schnitt)
          anzahl    wieviele bleiben
        """
        skaliert = logits / max(0.05, float(temperatur))
        w_offen = torch.softmax(skaliert, dim=-1)
        V = int(logits.numel())

        si = None
        if str(verfahren) == "top_p":
            p = min(1.0, max(0.0, float(top_p)))
            if p < 1.0:
                sortiert_p, sortiert_i = torch.sort(w_offen, descending=True)
                kum = torch.cumsum(sortiert_p, dim=-1)
                # einschliesslich des Stuecks, das die Grenze ueberschreitet
                anzahl = int((kum < p).sum().item()) + 1
                si = sortiert_i[:max(1, min(anzahl, V))]
        else:
            k = int(top_k)
            if k > 0:
                _, si = torch.topk(skaliert, max(1, min(k, V)))

        if si is None:                       # kein Schnitt gefordert
            return skaliert, w_offen, w_offen, None, V

        gesperrt = torch.full_like(skaliert, float("-inf"))
        gesperrt[si] = skaliert[si]
        return skaliert, w_offen, torch.softmax(gesperrt, dim=-1), si, \
            int(si.numel())

    def _verteilung(self, logits: "torch.Tensor", temperatur: float,
                    verfahren: str, top_k: int, top_p: float):
        """Nur die fertige Verteilung — fuer alle, die den Rest nicht brauchen."""
        return self._schnitt(logits, temperatur, verfahren, top_k, top_p)[2]

    def logit_kette(self, text: str, position: int = -1,
                    temperatur: float = 0.8, top_k: int = 40,
                    oben: int = 12,
                    eingriffe: "Eingriffe | None" = None,
                    verfahren: str = "top_k", top_p: float = 0.9) -> dict:
        """Wie aus rohen Zahlen eine Wahrscheinlichkeit wird — Stufe fuer Stufe.

        Der Demonstrator zeigte bisher nur die fertige Verteilung. Was davor
        passiert, blieb unsichtbar — dabei entscheidet genau das, was beim
        Weiterschreiben herauskommt:

          1. Logit       roher Wert je Stueck, beliebig gross, auch negativ
          2. / T         geteilt durch die Temperatur
          3. Softmax     ueber ALLE Stuecke des Vokabulars, ergibt 100 %
          4. Schnitt     nur die top_k besten bleiben, danach neu auf 100 %

        DIE REIHENFOLGE IST NICHT FREI GEWAEHLT: sie ist die von `erzeugen`,
        also die Rechnung, die beim Weiterschreiben tatsaechlich laeuft
        (`skaliert = logits / T` -> `softmax` -> `topk` -> `/ sum`). Der
        Softmax kommt VOR dem Schnitt; wer es andersherum zeigt, zeigt eine
        Rechnung, die dieses Programm nirgends ausfuehrt.

        Gezeigt werden die `oben` wahrscheinlichsten Stuecke. Liegt `top_k`
        darunter, faellt der Schnitt mitten in die Tafel und ist zu sehen;
        liegt er darueber, sagt `schnitt_sichtbar` das, statt eine Spalte
        ohne Inhalt zu zeigen.

        ZWEI SCHNITTVERFAHREN, dieselbe Tafel (`verfahren`):

          "top_k"  die k groessten bleiben — eine feste ANZAHL, unabhaengig
                   davon, wie entschieden das Modell gerade ist.
          "top_p"  es bleiben so viele, wie zusammen `top_p` der
                   Wahrscheinlichkeit ausmachen — eine feste MENGE, und
                   damit eine wechselnde Anzahl. Wo das Modell sicher ist,
                   bleiben zwei Stuecke; wo es offen ist, hunderte.

        Das ist genau der Unterschied, den das Vorbild nebeneinanderstellt,
        und der Grund, warum top-p in der Praxis das gebraeuchlichere ist:
        top-k schneidet bei einer unsicheren Stelle zu grob und bei einer
        sicheren zu grosszuegig.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}

        T = len(ids)
        pos = T - 1 if position < 0 or position >= T else int(position)
        temperatur = max(0.05, min(10.0, float(temperatur)))
        oben = max(3, min(40, int(oben)))
        verfahren = "top_p" if str(verfahren) == "top_p" else "top_k"
        top_p = max(0.05, min(1.0, float(top_p)))

        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            try:
                aus = self.modell(torch.tensor([ids], device=self.geraet),
                                  use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            logits = aus.logits[0, pos].float()
            V = int(logits.numel())
            k = max(1, min(int(top_k), V))

            # DIE REIHENFOLGE DES VORBILDS: Logit -> /T -> top-k -> Softmax.
            #
            # Der Schnitt setzt die ausgeschlossenen Logits auf MINUS
            # UNENDLICH, danach laeuft der Softmax ueber alle. Das ergibt
            # rechnerisch genau dasselbe wie `erzeugen` (softmax, dann topk,
            # dann neu auf 1) — nachgerechnet unten in `probe` —, ist aber
            # das, was man sehen will: der Schnitt ist kein Nachtrag zur
            # Wahrscheinlichkeit, er entscheidet sie mit.
            # Temperatur und Schnitt kommen aus DER EINEN Stelle (_schnitt),
            # damit das Netz derselben Kachel dieselbe Verteilung bekommt.
            #
            # Bei top-p ist die ANZAHL das Ergebnis, nicht die Vorgabe:
            # behalten wird, bis die laufende Summe die Grenze ERREICHT —
            # einschliesslich des Stuecks, das sie ueberschreitet. Ohne dieses
            # eine bliebe man unter der geforderten Menge, und bei einem sehr
            # sicheren Modell (p1 = 0,97 > top_p) bliebe gar nichts uebrig.
            # `k` statt `top_k`: hier wird IMMER geschnitten (k ist oben auf
            # mindestens 1 geklemmt), sonst kaeme `si = None` zurueck.
            skaliert, w_offen, w, si, k = self._schnitt(
                logits, temperatur, verfahren, k, top_p)
            behalten = float(w_offen[si].sum())

            # Welche Stuecke zeigen wir? Die `oben` wahrscheinlichsten. Die
            # Rangfolge aendert sich durch Temperatur und Schnitt NICHT —
            # beide sind streng monoton. Das ist selbst eine Aussage: die
            # Temperatur verschiebt die Gewichte, nicht die Reihenfolge.
            zeig_p, zeig_i = torch.topk(w_offen, min(oben, V))
            # Ohne Temperatur — zum Vergleich, damit man sieht, was sie tut.
            w_roh = torch.softmax(logits, dim=-1)

            drin_ids = set(int(x) for x in si.tolist())
            kum = 0.0
            kandidaten = []
            for rang, (p, i) in enumerate(zip(zeig_p.tolist(), zeig_i.tolist())):
                i = int(i)
                drin = i in drin_ids
                kum += p
                kandidaten.append({
                    "id": i,
                    "text": self.tok.decode([i]),
                    "rang": rang + 1,
                    "logit": round(float(logits[i]), 4),
                    "skaliert": round(float(skaliert[i]), 4),
                    "p_ohne_temperatur": round(float(w_roh[i]), 6),
                    # Der Wert NACH dem Schnitt, aber VOR dem Softmax: das
                    # skalierte Logit oder minus unendlich. Genau diese
                    # Spalte zeigt das Vorbild, und sie ist der Grund,
                    # warum man den Schnitt versteht.
                    "nach_schnitt": round(float(skaliert[i]), 4) if drin else None,
                    "drin": drin,
                    # Die Wahrscheinlichkeit ohne Schnitt (Rangfolge) …
                    "p_offen": round(p, 6),
                    # … und die, mit der tatsaechlich gezogen wird.
                    "p": round(float(w[i]), 6),
                    # Die LAUFENDE SUMME — bei top-p ist sie die Groesse, die
                    # den Schnitt bestimmt, und gehoert deshalb in die Spalte.
                    "kumuliert": round(kum, 6),
                    # Genau hier faellt der Schnitt: das letzte behaltene
                    # Stueck. Bei top-p ist das die Zeile, in der die Summe
                    # die Grenze ueberschreitet.
                    "schnitt_hier": rang + 1 == k,
                })

            # Die Probe: der Weg des Vorbilds (Schnitt auf -inf, dann
            # Softmax) muss dasselbe ergeben wie der von `erzeugen`
            # (Softmax, dann topk, dann neu auf 1). Ohne diese Zahl waere
            # die Umstellung eine Behauptung.
            probe = float((w[si] - (w_offen[si] / w_offen[si].sum())).abs().max())

        zeig_logits = [c["logit"] for c in kandidaten]
        zeig_skaliert = [c["skaliert"] for c in kandidaten]
        return {
            "token": t,
            "position": pos,
            "temperatur": round(temperatur, 3),
            "verfahren": verfahren,
            # Bei top-k die Vorgabe, bei top-p das ERGEBNIS: wieviele Stuecke
            # der Schnitt uebrig laesst. Beide Male dieselbe Bedeutung —
            # "so viele bleiben" —, und deshalb dasselbe Feld.
            "top_k": k,
            "top_p": round(top_p, 3),
            "behalten_anzahl": k,
            "vokabular": V,
            "kandidaten": kandidaten,
            # Wieviel Wahrscheinlichkeit der Schnitt uebrig laesst. Steht
            # hier 0,997, dann wirft top_k praktisch nichts weg — und die
            # vierte Spalte sieht aus wie die dritte, zu Recht.
            "behalten": round(behalten, 6),
            "schnitt_sichtbar": k <= len(kandidaten),
            # Beweis, dass die gezeigte Reihenfolge (Schnitt vor Softmax)
            # dieselbe Verteilung ergibt wie die von `erzeugen`.
            "probe": probe,
            "grenzen": {
                "logit": [min(zeig_logits), max(zeig_logits)],
                "skaliert": [min(zeig_skaliert), max(zeig_skaliert)],
                "p": max(c["p"] for c in kandidaten),
            },
        }

    def logit_beitraege(self, text: str, position: int = -1,
                        stueck_id: int | None = None, oben: int = 14,
                        eingriffe: "Eingriffe | None" = None) -> dict:
        """WOHER der Logit kommt — das Auge an der Logit-Spalte.

        Die Verwandlungstafel beginnt mit einer Zahl, die vom Himmel faellt:
        "Logit 20,03". Sie faellt nicht vom Himmel. Am Ende des Modells steht
        EINE Multiplikation: der Zustandsvektor an der betrachteten Stelle,
        Zahl fuer Zahl mal der Spalte, die dieses Stueck im Ausgabe-Wortschatz
        hat. Die Summe dieser Produkte IST das Logit.

            logit_j = sum_d  h[d] * W[j, d]

        Gezeigt werden die `oben` Zahlen mit dem groessten Betrag — die, die
        das Ergebnis tragen. Damit die Stichprobe nicht mehr verspricht, als
        sie zeigt, steht dabei, welchen Anteil am Gesamtbetrag sie ausmacht.

        DIE PROBE steht in `abweichung`: die Summe ueber ALLE Dimensionen
        gegen das Logit, das das Modell selbst ausgegeben hat. Ohne sie waere
        die Aufschluesselung eine Nacherzaehlung; mit ihr ist bewiesen, dass
        es die Rechnung des Modells ist.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}

        T = len(ids)
        pos = T - 1 if position < 0 or position >= T else int(position)
        oben = max(4, min(40, int(oben)))

        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            try:
                aus = self.modell(torch.tensor([ids], device=self.geraet),
                                  use_cache=False, output_hidden_states=True)
            finally:
                for g in griffe:
                    g.remove()

            # Der LETZTE hidden_state ist der nach der Schlussnormierung —
            # genau der Vektor, den die Ausgabematrix zu sehen bekommt. Das
            # ist keine Annahme: stimmte er nicht, ginge die Probe unten nicht
            # auf.
            h = aus.hidden_states[-1][0, pos].float()
            logits = aus.logits[0, pos].float()
            if stueck_id is None:
                stueck_id = int(torch.argmax(logits))
            stueck_id = max(0, min(int(stueck_id), int(logits.numel()) - 1))

            W = self.modell.get_output_embeddings().weight[stueck_id].float()
            beitraege = h * W
            D = int(beitraege.numel())
            betrag = beitraege.abs()
            k = min(oben, D)
            _, idx = torch.topk(betrag, k)

            summe = float(beitraege.sum())
            logit = float(logits[stueck_id])
            gesamt_betrag = float(betrag.sum())
            gezeigt_betrag = float(betrag[idx].sum())

            zahlen = []
            for d in idx.tolist():
                d = int(d)
                zahlen.append({
                    "dim": d,
                    "h": round(float(h[d]), 4),
                    "w": round(float(W[d]), 4),
                    "beitrag": round(float(beitraege[d]), 4),
                })
            positiv = float(beitraege[beitraege > 0].sum())
            negativ = float(beitraege[beitraege < 0].sum())

        return {
            "position": pos,
            "token": t,
            "stueck_id": stueck_id,
            "stueck": self.tok.decode([stueck_id]),
            "logit": round(logit, 4),
            "summe": round(summe, 4),
            # Die Probe. Sie ist die Daseinsberechtigung dieser Auskunft.
            "abweichung": abs(summe - logit),
            # WOGEGEN die Abweichung zu halten ist. Das Modell rechnet in
            # 16 Bit; dessen kleinster Schritt bei einem Wert dieser Groesse
            # ist die Messgenauigkeit, unter der kein Unterschied mehr etwas
            # bedeutet. Ohne diese Zahl waere "0,006" weder gross noch klein.
            "zahlenformat": str(self.modell.dtype).replace("torch.", ""),
            "schritt": _ulp(logit, self.modell.dtype),
            "dimensionen": D,
            "gezeigt": k,
            # Wieviel des Gesamtbetrags die gezeigten Zahlen ausmachen —
            # damit niemand die Stichprobe fuer das Ganze haelt (Regel B-1).
            "anteil_betrag": round(gezeigt_betrag / gesamt_betrag, 4)
            if gesamt_betrag else 0.0,
            "positiv": round(positiv, 4),
            "negativ": round(negativ, 4),
            "zahlen": zahlen,
        }

    def rechenweg(self, text: str, schicht: int = 0, kopf: int = 0,
                  zeile: int = -1, zahlen: int = 6) -> dict:
        """Wie eine Aufmerksamkeits-Zahl tatsaechlich entsteht.

        Der Demonstrator zeigte bisher nur das ERGEBNIS der Aufmerksamkeit —
        die fertige Matrix. Wie sie zustande kommt, blieb offen. Genau das
        ist aber der Kern: Query, Key und Value, das Punktprodukt, die
        Skalierung, die Maske und der Softmax.

        Hier wird dieser Weg fuer eine Position nachgerechnet, mit den
        echten Gewichten dieses Modells, und am Ende mit dem verglichen, was
        das Modell selbst herausbekommen hat. Stimmen beide ueberein, ist
        bewiesen: das Vorgerechnete IST die Rechnung des Modells und keine
        vereinfachte Nacherzaehlung.

        Die Vektoren haben 128 Zahlen; gezeigt werden die ersten paar und
        die Laenge. Alles Weitere waere eine Zahlenwueste.
        """
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}
        T = len(ids)
        schicht = max(0, min(int(schicht), self.n_layer - 1))
        kopf = max(0, min(int(kopf), self.n_head - 1))
        i = T - 1 if zeile < 0 or zeile >= T else int(zeile)

        eingabe = torch.tensor([ids], device=self.geraet)
        with self.sperre:
            aus = self.modell(eingabe, output_attentions=True,
                              output_hidden_states=True, use_cache=False)

            block = self.bloecke[schicht]
            att = block.self_attn
            # Was in den Block hineingeht, durchlaeuft zuerst die
            # Normierung — erst danach beginnt die Aufmerksamkeit.
            roh = aus.hidden_states[schicht][0]                    # (T, d)
            x = block.input_layernorm(roh)

            kd = self.kopf_dim
            n_kv = self.n_kv_head
            gruppen = self.n_head // n_kv           # 16 Koepfe auf 8 Schluessel

            q = att.q_norm(att.q_proj(x).view(T, self.n_head, kd)).transpose(0, 1)
            k = att.k_norm(att.k_proj(x).view(T, n_kv, kd)).transpose(0, 1)
            v = att.v_proj(x).view(T, n_kv, kd).transpose(0, 1)

            # Positionsdrehung (RoPE) — sie ist der Grund, warum das Modell
            # ueberhaupt weiss, in welcher Reihenfolge die Woerter stehen.
            from transformers.models.qwen3.modeling_qwen3 import apply_rotary_pos_emb
            pos = torch.arange(T, device=self.geraet).unsqueeze(0)
            cos, sin = self.modell.model.rotary_emb(x.unsqueeze(0), pos)
            q_r, k_r = apply_rotary_pos_emb(q.unsqueeze(0), k.unsqueeze(0), cos, sin)
            q_r, k_r = q_r[0], k_r[0]

            kv_kopf = kopf // gruppen               # welcher Schluessel-Kopf
            qi = q_r[kopf, i]                       # (kd,)
            K = k_r[kv_kopf]                        # (T, kd)
            V = v[kv_kopf]                          # (T, kd)

            roh_punkt = (K @ qi).float()            # (T,)
            skaliert = roh_punkt * (kd ** -0.5)
            maskiert = skaliert.clone()
            if i + 1 < T:
                maskiert[i + 1:] = float("-inf")
            gewichte = torch.softmax(maskiert, dim=-1)

            echt = aus.attentions[schicht][0, kopf, i].float()
            abweichung = float((gewichte - echt).abs().max())

            ergebnis = (gewichte.unsqueeze(0) @ V.float()).squeeze(0)

            def kurz(vek):
                return [round(float(z), 3) for z in vek[:zahlen]]

        return {
            "token": t,
            "schicht": schicht, "kopf": kopf, "zeile": i,
            "kv_kopf": kv_kopf, "gruppen": gruppen,
            "kopf_dim": kd,
            "wurzel": round(float(kd ** 0.5), 3),
            "zustand": kurz(roh[i]),
            "zustand_norm": kurz(x[i]),
            "query": kurz(q_r[kopf, i]),
            "query_laenge": round(float(q_r[kopf, i].float().norm()), 3),
            "keys": [{"pos": j, "stueck": t["stuecke"][j],
                      "key": kurz(k_r[kv_kopf, j]),
                      "punkt": round(float(roh_punkt[j]), 3),
                      "skaliert": round(float(skaliert[j]), 3),
                      "maskiert": (None if maskiert[j] == float("-inf")
                                   else round(float(maskiert[j]), 3)),
                      "gewicht": round(float(gewichte[j]), 5),
                      "value": kurz(V[j])}
                     for j in range(T)],
            "ergebnis": kurz(ergebnis),
            "ergebnis_laenge": round(float(ergebnis.norm()), 3),
            "echt": [round(float(z), 5) for z in echt],
            "abweichung": abweichung,
            "stimmt": abweichung < 2e-2,
        }

    @torch.no_grad()
    def bahn(self, text: str, schicht: int = 0, kopf: int = 0,
             position: int = -1, oben: int = 12, proben: int = 24,
             temperatur: float = 1.0, verfahren: str = "top_k",
             top_k: int = 0, top_p: float = 1.0,
             eingriffe: "Eingriffe | None" = None) -> dict:
        """DER GANZE WEG IN EINEM BILD — alle Stationen einer Anfrage.

        Das ist die Auskunft fuer die Hauptansicht nach dem Vorbild
        (`_vorbild/bilder/02-bahn-0.png`): links der Satz, dann Embedding,
        Query/Key/Value, die Aufmerksamkeit, der Ausgang, das Feedforward,
        die uebrigen Bloecke, und rechts die Wahrscheinlichkeiten. EIN Bild,
        durch das die Baender durchlaufen — nicht sechs Bilder untereinander.

        Bisher lagen diese Zahlen auf sechs Endpunkte verteilt, jeder mit
        eigenem Durchlauf. Hier laeuft der Satz EINMAL durch das Modell, und
        alle Stationen kommen aus demselben Durchlauf. Das ist nicht nur
        schneller — es ist auch die Voraussetzung dafuer, dass das Bild
        stimmt: sechs Durchlaeufe mit verschiedenen Eingriffen zeigten sonst
        Stationen, die nicht zueinander gehoeren.

        JEDER VEKTOR IST EINE STICHPROBE. Ein Zustand hat 2.048 Zahlen, ein
        Kopf 128, das Feedforward innen 6.144. Gezeigt werden `proben` davon,
        gleichmaessig gegriffen; wieviele es insgesamt sind, steht daneben
        (Regel B-1 — eine Stichprobe wird als Stichprobe beschriftet).
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}

        T = len(ids)
        pos = T - 1 if position < 0 or position >= T else int(position)
        schicht = max(0, min(int(schicht), self.n_layer - 1))
        kopf = max(0, min(int(kopf), self.n_head - 1))
        proben = max(6, min(int(proben), 64))

        def streifen(vek):
            """Eine gleichmaessige Stichprobe aus einem Vektor."""
            v = vek.detach().float().cpu()
            n = int(v.numel())
            schritt = max(1, n // proben)
            return [round(float(x), 4) for x in v[::schritt][:proben]]

        block = self.bloecke[schicht]
        speicher: dict = {}

        # KEINE ZUSAETZLICHEN HAKEN IM DURCHLAUF.
        #
        # Der erste Versuch hing drei Mitschnitt-Haken an self_attn, mlp und
        # up_proj. Das Modell brach mit "expected mat1 and mat2 to have the
        # same dtype: float != Half" ab — sobald ein Modul einen Haken traegt,
        # nimmt PyTorch einen anderen Aufrufpfad, und in Verbindung mit den
        # vorhandenen Eingriffs-Haken lief der Durchlauf aus dem Tritt.
        #
        # Gebraucht werden die Haken auch gar nicht: Attention-Ausgang und
        # Feedforward lassen sich NACH dem Durchlauf aus dem berechnen, was
        # ohnehin vorliegt — und die Rechnung steht dann sichtbar da, statt in
        # einem Mitschnitt zu verschwinden.
        # Der EINGANG des Feedforward-Bauteils laesst sich nicht nachtraeglich
        # ausrechnen (er liegt zwischen Attention und MLP), also wird er
        # mitgeschnitten. Ein VOR-Haken, der nur liest und nichts
        # zurueckgibt, aendert den Aufrufpfad nicht — anders als die drei
        # Mitschnitt-Haken des ersten Versuchs (siehe oben).
        mlp_ein: dict = {}

        def _mlp_eingang(_modul, ein):
            mlp_ein["x"] = (ein[0] if isinstance(ein, tuple) else ein)[0].detach()

        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            griffe += self._hook_letzter_block(speicher)
            griffe.append(block.mlp.register_forward_pre_hook(_mlp_eingang))
            try:
                aus = self.modell(torch.tensor([ids], device=self.geraet),
                                  output_attentions=True,
                                  output_hidden_states=True, use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            stufen = self._stufen_roh(aus, speicher)
            einbettung = stufen[0][0]              # vor dem ersten Block
            eingang = stufen[schicht][0]           # was in DIESEN Block geht
            ausgang = stufen[schicht + 1][0]       # was herauskommt
            letzte = stufen[-1][0]                 # nach allen Bloecken

            # Query, Key, Value fuer die gewaehlte Schicht und den Kopf —
            # dieselbe Rechnung wie in `rechenweg`, nur fuer ALLE Stellen.
            x = block.input_layernorm(eingang)
            att = block.self_attn
            kd = self.kopf_dim
            n_kv = self.n_kv_head
            gruppen = self.n_head // n_kv
            q = att.q_norm(att.q_proj(x).view(T, self.n_head, kd)).transpose(0, 1)
            k = att.k_norm(att.k_proj(x).view(T, n_kv, kd)).transpose(0, 1)
            v = att.v_proj(x).view(T, n_kv, kd).transpose(0, 1)
            from transformers.models.qwen3.modeling_qwen3 import apply_rotary_pos_emb
            stellen_idx = torch.arange(T, device=self.geraet).unsqueeze(0)
            cos, sin = self.modell.model.rotary_emb(x.unsqueeze(0), stellen_idx)
            q_r, k_r = apply_rotary_pos_emb(q.unsqueeze(0), k.unsqueeze(0), cos, sin)
            q_r, k_r = q_r[0], k_r[0]
            kv_kopf = kopf // gruppen

            matrix = aus.attentions[schicht][0, kopf].float().cpu()

            # DER AUSGANG DIESES KOPFES, von Hand: die Aufmerksamkeit ist eine
            # gewichtete Summe der Values. Genau das zeigt das Vorbild als
            # "Out". (Der volle Attention-Ausgang waere die Summe ueber alle
            # 16 Koepfe plus Ausgangsprojektion — hier geht es um den EINEN
            # Kopf, den man oben gewaehlt hat.)
            V = v[kv_kopf].float()                       # (T, kd)
            kopf_aus = matrix.to(V.device) @ V           # (T, kd)

            # DAS FEEDFORWARD, ebenfalls von Hand: was der Block insgesamt zum
            # Zustand beitraegt, ist Ausgang minus Eingang.
            beitrag = (ausgang - eingang).float()

            # DIE BREITE ZWISCHENSCHICHT — hier standen bis zum 17.08.2026
            # ZWEI Fehler, und beide zeigten falsche Zahlen im grossen Bild:
            #
            #   zwischen = block.mlp.up_proj(
            #       block.post_attention_layernorm(ausgang))
            #
            # (1) DAS GATE FEHLTE. Qwen3 rechnet SwiGLU — laut
            #     transformers/models/qwen3/modeling_qwen3.py:82:
            #         down_proj(act_fn(gate_proj(x)) * up_proj(x))
            #     Gezeigt wurde nur `up_proj(x)`, also die halbe Rechnung.
            #     Und ausgerechnet der fehlende Teil ist der wichtige: das
            #     Gate entscheidet, WELCHE der 6.144 Neuronen ueberhaupt
            #     feuern.
            # (2) FALSCHER EINGANG. `ausgang` ist der Zustand NACH dem MLP;
            #     das Bauteil wurde damit auf sein eigenes Ergebnis
            #     angewandt statt auf seinen Eingang.
            #
            # Beides behoben ueber den echten MLP-Eingang, den der
            # Vor-Haken mitschneidet (`mlp_ein`) — das ist genau der
            # Tensor, den das Modell selbst hineingibt, einschliesslich
            # post_attention_layernorm.
            x_ff = mlp_ein.get("x")
            if x_ff is None:
                # Kein Mitschnitt (sollte nicht vorkommen) — dann lieber
                # nichts zeigen als etwas Falsches.
                zwischen = torch.zeros((T, 1), device=self.geraet)
            else:
                zwischen = (block.mlp.act_fn(block.mlp.gate_proj(x_ff))
                            * block.mlp.up_proj(x_ff)).detach()

            # Die Verteilung am Ende — durch dieselbe Stelle wie ueberall.
            logits = aus.logits[0, pos].float()
            w = self._verteilung(logits, temperatur, verfahren, top_k, top_p)
            werte, wo = torch.topk(w, min(int(oben), int(w.numel())))

            stationen = []
            for i in range(T):
                stationen.append({
                    "index": i,
                    "text": t["stuecke"][i],
                    "id": ids[i],
                    "ist_ziel": i == pos,
                    "einbettung": streifen(einbettung[i]),
                    "query": streifen(q_r[kopf, i]),
                    "key": streifen(k_r[kv_kopf, i]),
                    "value": streifen(v[kv_kopf, i]),
                    "attn_aus": streifen(kopf_aus[i]),
                    "ff_innen": streifen(zwischen[i]),
                    "mlp_aus": streifen(beitrag[i]),
                    "ausgang": streifen(ausgang[i]),
                    "letzte": streifen(letzte[i]),
                    # Wieviel Aufmerksamkeit die Zielstelle auf dieses Stueck
                    # richtet — die Bandbreite im Bild.
                    "blick": round(float(matrix[pos, i]), 6),
                })

            kandidaten = [{"id": int(i), "text": self.tok.decode([int(i)]),
                           "p": round(float(p), 6)}
                          for i, p in zip(wo.tolist(), werte.tolist())]

        return {
            "token": t,
            "position": pos,
            "schicht": schicht,
            "kopf": kopf,
            "kv_kopf": kv_kopf,
            "schichten": self.n_layer,
            "koepfe": self.n_head,
            "stationen": stationen,
            "matrix": [[round(float(z), 5) for z in reihe] for reihe in matrix],
            "kandidaten": kandidaten,
            # Wieviele Zahlen ein Streifen WIRKLICH hat — sonst haelt man die
            # Stichprobe fuer das Ganze.
            "gezeigt": proben,
            "breiten": {
                "zustand": self.d,
                "kopf": kd,
                "feedforward": int(zwischen.shape[-1]),
            },
            "temperatur": round(float(temperatur), 3),
            "verfahren": "top_p" if str(verfahren) == "top_p" else "top_k",
            "top_k": int(top_k),
            "top_p": round(float(top_p), 3),
            "beschaedigt": not eingriffe.leer(),
        }

    # -- Feedforward: der Filter mit 6.144 Schaltern ----------------------

    @torch.no_grad()
    def feedforward(self, text: str, schicht: int = 0, position: int = -1,
                    neuron: int | None = None, oben: int = 12,
                    proben: int = 24,
                    eingriffe: "Eingriffe | None" = None) -> dict:
        """DAS FEEDFORWARD EINER SCHICHT, aufgeschluesselt.

        Das Bauteil haelt rund zwei Drittel aller Parameter des Modells und
        kam im Demonstrator bisher gar nicht vor. Es ist kein Rechenschritt,
        sondern ein NACHSCHLAGEWERK MIT SCHALTERN:

            innen = silu(gate_proj(x)) * up_proj(x)      (6.144 Zahlen)
            aus   = down_proj(innen)                     (2.048 Zahlen)

        `up` sagt, WAS ein Neuron beitragen wuerde; `gate` sagt, OB es
        ueberhaupt durchkommt. Steht das Gate auf nahe Null, ist der Beitrag
        weg — gleichgueltig, wie gross `up` ist. Genau das zeigt die Kachel.

        Alles aus EINEM Durchlauf, damit die drei Bilder zueinander gehoeren.

        DIE PROBE: der hier von Hand gerechnete Ausgang wird gegen den
        echten Ausgang des Modul gehalten (`probe_*`). Waeren die Formel
        oder der Eingang falsch, stuenden dort keine winzigen Zahlen —
        genau so ist der Fehler aufgefallen, der bis zum 17.08.2026 in
        `bahn()` stand.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}

        T = len(ids)
        pos = T - 1 if position < 0 or position >= T else int(position)
        schicht = max(0, min(int(schicht), self.n_layer - 1))
        proben = max(6, min(int(proben), 64))
        oben = max(1, min(int(oben), 40))
        block = self.bloecke[schicht]

        def streifen(vek):
            v = vek.detach().float().cpu()
            n = int(v.numel())
            schritt = max(1, n // proben)
            return [round(float(x), 4) for x in v[::schritt][:proben]]

        mit: dict = {}

        def _vor(_m, ein):
            mit["ein"] = (ein[0] if isinstance(ein, tuple) else ein)[0].detach()

        def _nach(_m, _ein, aus):
            mit["aus"] = (aus[0] if isinstance(aus, tuple) else aus)[0].detach()

        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            griffe.append(block.mlp.register_forward_pre_hook(_vor))
            griffe.append(block.mlp.register_forward_hook(_nach))
            try:
                self.modell(torch.tensor([ids], device=self.geraet),
                            use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            x = mit.get("ein")
            if x is None:
                return {"leer": True}

            # Die Rechnung des Bauteils, Schritt fuer Schritt nachgezogen.
            roh_gate = block.mlp.gate_proj(x)
            gate = block.mlp.act_fn(roh_gate)          # silu(gate) — der Schalter
            up = block.mlp.up_proj(x)                  # der Inhalt
            innen = gate * up                          # was durchkommt
            eigen_aus = block.mlp.down_proj(innen)

            # DIE PROBE gegen den echten Modulausgang.
            echt_aus = mit.get("aus")
            if echt_aus is not None:
                d = (eigen_aus.float() - echt_aus.float()).abs()
                probe_max = float(d.max())
                probe_bezug = float(echt_aus.float().abs().max())
            else:
                probe_max, probe_bezug = -1.0, -1.0

            gate_f = gate.float().cpu()
            up_f = up.float().cpu()
            innen_f = innen.float().cpu()
            breite = int(innen_f.shape[-1])

            # WIEVIELE SCHALTER STEHEN OFFEN? "Offen" heisst hier: der
            # Schalter traegt ueberhaupt etwas bei. Die Schwelle ist ein
            # Hundertstel des groessten Betrags DIESER Stelle — eine feste
            # Zahl waere ueber Schichten hinweg willkuerlich.
            stationen = []
            for i in range(T):
                z = innen_f[i]
                gr = float(z.abs().max()) or 1.0
                offen = int((z.abs() > gr * 0.01).sum())
                stationen.append({
                    "index": i,
                    "text": t["stuecke"][i],
                    "ist_ziel": i == pos,
                    "gate": streifen(gate_f[i]),
                    "up": streifen(up_f[i]),
                    "innen": streifen(innen_f[i]),
                    "offen": offen,
                    "offen_anteil": round(offen / breite, 5),
                    "staerkstes": int(z.abs().argmax()),
                })

            # DIE STAERKSTEN NEURONEN AN DER GEWAEHLTEN STELLE.
            z = innen_f[pos]
            werte, wo = torch.topk(z.abs(), min(oben, breite))
            spitzen = [{
                "neuron": int(n),
                "gate": round(float(gate_f[pos, n]), 4),
                "up": round(float(up_f[pos, n]), 4),
                "innen": round(float(innen_f[pos, n]), 4),
            } for n in wo.tolist()]

            # WIE SPAERLICH IST DAS? Anteil der Gesamt-Aktivierung, den die
            # staerksten k Neuronen tragen — der Befund, dass die grosse
            # Mehrheit der 6.144 bei jedem Wort schlaeft.
            sortiert, _ = torch.sort(z.abs(), descending=True)
            summe = float(sortiert.sum()) or 1.0
            lauf = torch.cumsum(sortiert, dim=0)
            kurve = []
            for k in (1, 5, 12, 25, 50, 100, 200, 500, 1000, breite):
                k = min(k, breite)
                kurve.append({"k": k, "anteil": round(float(lauf[k - 1]) / summe, 5)})

            # EIN NEURON UEBER ALLE SATZSTUECKE — das dritte Bild.
            gewaehlt = int(neuron) if neuron is not None else int(z.abs().argmax())
            gewaehlt = max(0, min(gewaehlt, breite - 1))
            verlauf = [{
                "index": i,
                "text": t["stuecke"][i],
                "gate": round(float(gate_f[i, gewaehlt]), 4),
                "up": round(float(up_f[i, gewaehlt]), 4),
                "innen": round(float(innen_f[i, gewaehlt]), 4),
                "ist_ziel": i == pos,
            } for i in range(T)]

        # Wieviele Parameter dieses Bauteil haelt — die Antwort auf "warum
        # ist das Ding so gross". Drei Matrizen d x breite.
        d = self.d
        ff_par = 3 * d * breite
        block_par = ff_par + 4 * d * d      # grob: q,k,v,o der Aufmerksamkeit

        return {
            "token": t,
            "position": pos,
            "schicht": schicht,
            "schichten": self.n_layer,
            "stationen": stationen,
            "spitzen": spitzen,
            "kurve": kurve,
            "neuron": gewaehlt,
            "verlauf": verlauf,
            "gezeigt": proben,
            "breiten": {"zustand": d, "feedforward": breite},
            "parameter": {
                "feedforward": ff_par,
                "block": block_par,
                "anteil": round(ff_par / block_par, 4),
                "modell": self.parameter if hasattr(self, "parameter") else None,
            },
            "probe": {
                "groesste_abweichung": round(probe_max, 8),
                "groesster_wert": round(probe_bezug, 6),
            },
            "beschaedigt": not eingriffe.leer(),
        }

    # -- Landkarte: ALLE Schichten und Koepfe auf einmal ------------------

    @torch.no_grad()
    def landkarte(self, text: str, eingriffe: Eingriffe | None = None) -> dict:
        """Alle 28 x 16 Koepfe zugleich, mit fuenf Kennzahlen je Kopf.

        Der Demonstrator zeigte bisher immer nur EINEN Kopf einer EINEN
        Schicht — einen von 448. Wer so sucht, findet den auffaelligen Kopf
        nie. Hier wird jeder Kopf auf fuenf Zahlen eingedampft, und alle 448
        stehen zugleich im Bild:

          rueckblick  wie weit schaut er im Mittel zurueck (in Positionen)
          entropie    schaut er auf eines oder auf alles (0 = ein Wort,
                      1 = gleichmaessig ueber alles Sichtbare verteilt)
          selbst      wieviel behaelt er bei sich selbst
          anfang      wieviel geht an die erste Position (bekanntes Muster:
                      viele Koepfe "parken" dort ihre ueberschuessige
                      Aufmerksamkeit)
          vorher      wieviel geht genau an das unmittelbar vorangehende Wort

        Das ist nicht dieselbe Information wie die Matrizen — es ist ihre
        Zusammenfassung. Die Matrix eines auffaelligen Kopfes sieht man
        danach gezielt in der Kachel „Aufmerksamkeit“ an.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}
        eingabe = torch.tensor([ids], device=self.geraet)

        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            try:
                aus = self.modell(eingabe, output_attentions=True, use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            T = len(ids)
            wo = torch.arange(T)
            abstand = (wo.view(-1, 1) - wo.view(1, -1)).float().clamp(min=0)
            # je Zeile i sind i+1 Positionen sichtbar; ln davon ist die
            # groesstmoegliche Entropie dieser Zeile
            maximal = torch.log(torch.arange(1, T + 1).float()).clamp(min=1e-9)

            felder: dict[str, list[list[float]]] = {
                k: [] for k in ("rueckblick", "entropie", "selbst", "anfang", "vorher")
            }
            for s in range(self.n_layer):
                a = aus.attentions[s][0].float().cpu()          # (H, T, T)
                felder["rueckblick"].append(
                    (a * abstand).sum(dim=2).mean(dim=1).tolist())
                h = -(a.clamp(min=1e-9).log() * a).sum(dim=2)   # (H, T)
                # Zeile 0 hat nichts zu verteilen — sie wuerde den Mittelwert
                # nur nach unten ziehen und sagt nichts aus.
                felder["entropie"].append(
                    (h[:, 1:] / maximal[1:]).mean(dim=1).tolist() if T > 1
                    else [0.0] * a.shape[0])
                felder["selbst"].append(
                    a.diagonal(dim1=1, dim2=2).mean(dim=1).tolist())
                felder["anfang"].append(a[:, :, 0].mean(dim=1).tolist())
                felder["vorher"].append(
                    a.diagonal(offset=-1, dim1=1, dim2=2).mean(dim=1).tolist()
                    if T > 1 else [0.0] * a.shape[0])

        # Die Auffaelligen benennen — sonst ist eine Landkarte nur bunt.
        auffaellig = {}
        for name, gitter in felder.items():
            beste, wo_s, wo_h = -1e9, 0, 0
            for s, zeile in enumerate(gitter):
                for h, w in enumerate(zeile):
                    if w > beste:
                        beste, wo_s, wo_h = w, s, h
            auffaellig[name] = {"schicht": wo_s, "kopf": wo_h,
                                "wert": round(float(beste), 4)}

        return {
            "token": t,
            "felder": {k: [[round(float(x), 4) for x in z] for z in g]
                       for k, g in felder.items()},
            "auffaellig": auffaellig,
            "schichten": self.n_layer,
            "koepfe": self.n_head,
        }

    # -- Die echten Dimensionen des Zustands -------------------------------

    @torch.no_grad()
    def dimensionen(self, text: str, position: int = -1,
                    eingriffe: Eingriffe | None = None, oben: int = 20) -> dict:
        """Der Zustand als das, was er ist: 2 048 Zahlen, nach jeder Stufe neu.

        Die 3D-Ansicht des Bedeutungsraums zeigt drei Richtungen und faengt
        damit rund 5 % der Streuung ein. Hier wird nichts zusammengedrueckt:
        jede der 2 048 Zahlen steht im Bild, fuer jede der 29 Stufen — das
        volle Feld, 59 392 Werte.

        Damit die Zahlen ueber die Stufen vergleichbar sind, wird jede Stufe
        auf ihre eigene Streuung normiert (z-Wert). Ohne das wuerde das Bild
        nur zeigen, dass der Zustand nach hinten laenger wird — was die
        Kachel „Residualstrom“ bereits sagt.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}
        T = len(ids)
        pos = T - 1 if position < 0 or position >= T else int(position)
        eingabe = torch.tensor([ids], device=self.geraet)

        mitschnitt: dict = {}
        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            griffe += self._hook_letzter_block(mitschnitt)
            try:
                aus = self.modell(eingabe, output_hidden_states=True, use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            # (Stufen, d) fuer die gewaehlte Position — alle Stufen roh, sonst
            # waere die letzte gegenueber den uebrigen bereits normiert und
            # das Feld zeigte in der untersten Zeile eine andere Groessenart.
            M = torch.stack([h[0, pos].float()
                             for h in self._stufen_roh(aus, mitschnitt)]).cpu()
            laengen = M.norm(dim=1)
            mitte = M.mean(dim=1, keepdim=True)
            streu = M.std(dim=1, keepdim=True).clamp(min=1e-9)
            Z = (M - mitte) / streu

            letzte = Z[-1]
            gross = torch.topk(letzte.abs(), min(oben, letzte.numel()))
            wandel = (Z[1:] - Z[:-1]).abs().sum(dim=0)
            bewegt = torch.topk(wandel, min(oben, wandel.numel()))

            # Wieviele Dimensionen tragen ueberhaupt? Anteil der Summe der
            # Quadrate, den die staerksten 1 % ausmachen.
            q = letzte ** 2
            sortiert, _ = torch.sort(q, descending=True)
            eins_prozent = max(1, letzte.numel() // 100)
            konzentration = float(sortiert[:eins_prozent].sum() / q.sum().clamp(min=1e-9))

        return {
            "token": t,
            "position": pos,
            "stufen": ["Embedding" if s == 0 else f"nach Schicht {s}"
                       for s in range(M.shape[0])],
            "d": int(M.shape[1]),
            # gerundet auf 2 Stellen — das ist die Aufloesung, die ein
            # Bildpunkt ohnehin traegt, und haelt die Antwort handlich
            "z": [[round(float(x), 2) for x in zeile] for zeile in Z],
            "laengen": [round(float(x), 3) for x in laengen],
            "groesste": [{"dim": int(i), "z": round(float(letzte[int(i)]), 3)}
                         for i in gross.indices],
            "bewegteste": [{"dim": int(i), "weg": round(float(w), 3)}
                           for i, w in zip(bewegt.indices, bewegt.values)],
            "konzentration": round(konzentration, 4),
        }

    @torch.no_grad()
    def dimension_deuten(self, dim: int, k: int = 12) -> dict:
        """Was eine einzelne Dimension im Vokabular bedeutet.

        Eine Dimension ist keine Bedeutung. Aber man kann fragen, welche
        Stuecke in genau dieser Zahl weit oben und weit unten liegen — und
        daran sieht man, ob sich etwas Benennbares gebildet hat oder nicht.
        Oft sieht man nichts Benennbares; auch das ist eine Auskunft.
        """
        dim = max(0, min(int(dim), self.d - 1))
        spalte = self.embedding[:, dim].float()
        hoch = torch.topk(spalte, k)
        tief = torch.topk(-spalte, k)
        return {
            "dim": dim,
            "oben": [{"id": int(i), "text": self.tok.decode([int(i)]),
                      "wert": round(float(w), 4)}
                     for i, w in zip(hoch.indices, hoch.values)],
            "unten": [{"id": int(i), "text": self.tok.decode([int(i)]),
                       "wert": round(float(-w), 4)}
                      for i, w in zip(tief.indices, tief.values)],
            "streuung": round(float(spalte.std()), 4),
        }

    # -- Wer arbeitet: Aufmerksamkeit oder Feedforward ---------------------

    @torch.no_grad()
    def bauteile(self, text: str, eingriffe: Eingriffe | None = None) -> dict:
        """Der Beitrag jeder Schicht, getrennt nach ihren zwei Bauteilen —
        und fuer JEDE Position, nicht nur fuer die letzte.

        Ein Block besteht aus zwei Teilen, die nacheinander etwas zum Zustand
        dazurechnen: erst die Aufmerksamkeit (holt Information von anderen
        Woertern), dann das Feedforward (rechnet mit dem, was da ist, ohne
        nach links oder rechts zu schauen). Die Kachel „Residualstrom“ hat
        beide zusammengezaehlt und nur die letzte Position gezeigt. Getrennt
        und ueber alle Positionen sieht man, WO im Satz und in WELCHEM der
        beiden Teile gearbeitet wird.

        Gemessen wird mit Hooks an den beiden Bauteilen: ihr Ausgang IST der
        Zusatz, den sie zum Zustand beitragen.
        """
        eingriffe = eingriffe or Eingriffe()
        t = self.tokenisieren(text)
        ids = t["ids"]
        if not ids:
            return {"leer": True}
        eingabe = torch.tensor([ids], device=self.geraet)

        attn_zusatz: dict[int, torch.Tensor] = {}
        mlp_zusatz: dict[int, torch.Tensor] = {}

        def merker(speicher, s):
            def haken(_m, _ein, aus):
                x = aus[0] if isinstance(aus, tuple) else aus
                speicher[s] = x[0].float().detach().cpu()
            return haken

        mitschnitt: dict = {}
        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            griffe += self._hook_letzter_block(mitschnitt)
            for s in range(self.n_layer):
                griffe.append(self.bloecke[s].self_attn.register_forward_hook(
                    merker(attn_zusatz, s)))
                griffe.append(self.bloecke[s].mlp.register_forward_hook(
                    merker(mlp_zusatz, s)))
            try:
                aus = self.modell(eingabe, output_hidden_states=True, use_cache=False)
            finally:
                for g in griffe:
                    g.remove()

            zustaende = [h[0].float().cpu()
                         for h in self._stufen_roh(aus, mitschnitt)]

            attn, mlp = [], []
            for s in range(self.n_layer):
                vor = zustaende[s].norm(dim=1).clamp(min=1e-9)      # (T,)
                a = attn_zusatz.get(s)
                m = mlp_zusatz.get(s)
                attn.append([round(float(x), 4) for x in
                             (a.norm(dim=1) / vor)] if a is not None
                            else [0.0] * len(ids))
                # das Feedforward setzt auf dem Zustand NACH der Attention auf
                zwischen = (zustaende[s] + a) if a is not None else zustaende[s]
                bezug = zwischen.norm(dim=1).clamp(min=1e-9)
                mlp.append([round(float(x), 4) for x in
                            (m.norm(dim=1) / bezug)] if m is not None
                           else [0.0] * len(ids))

        return {
            "token": t,
            "attn": attn,          # (Schichten, Positionen)
            "mlp": mlp,
            "schichten": self.n_layer,
        }

    # -- Weiterschreiben --------------------------------------------------

    @torch.no_grad()
    def erzeugen(self, text: str, anzahl: int = 60, temperatur: float = 0.8,
                 top_k: int = 40, eingriffe: Eingriffe | None = None) -> dict:
        eingriffe = eingriffe or Eingriffe()
        ids = self.tok(text, add_special_tokens=False)["input_ids"]
        folge = list(ids)
        schritte = []

        with self.sperre:
            griffe = self._hooks_setzen(eingriffe)
            try:
                for n in range(anzahl):
                    eingabe = torch.tensor([folge[-2048:]], device=self.geraet)
                    logits = self.modell(eingabe, use_cache=False).logits[0, -1].float()
                    skaliert = logits / max(1e-6, temperatur)
                    w = torch.softmax(skaliert, dim=-1)
                    sp, si = torch.topk(w, min(top_k, w.numel()))
                    sp = sp / sp.sum()
                    gezogen = int(si[torch.multinomial(sp, 1)])
                    folge.append(gezogen)
                    if n < 12:
                        roh = torch.softmax(logits, dim=-1)
                        tp, ti = torch.topk(roh, 4)
                        schritte.append({
                            "gezogen": {"id": gezogen, "text": self.tok.decode([gezogen])},
                            "alternativen": [
                                {"id": int(i), "p": float(p), "text": self.tok.decode([int(i)])}
                                for i, p in zip(ti, tp)],
                        })
            finally:
                for g in griffe:
                    g.remove()

        return {
            "vorher": text,
            "neu": self.tok.decode(folge[len(ids):]),
            "schritte": schritte,
        }


# ---------------------------------------------------------------------------
# Laden
# ---------------------------------------------------------------------------

_modell: Demonstratormodell | None = None

# Das Modell wird beim ERSTEN Aufruf geladen, nicht beim Start des Servers.
# FastAPI fuehrt die synchronen Endpunkte in einem Threadpool aus: es sind
# also mehrere Aufrufe gleichzeitig unterwegs. Ohne diese Sperre sieht jeder
# von ihnen `_modell is None` und beginnt SEINEN EIGENEN Ladevorgang — beim
# Aufruf der Seite reichen dafuer die paar Anfragen, die der Browser
# gleichzeitig schickt. Vier Ladevorgaenge zu 3,8 GB nebeneinander sprengen
# den Speicher, und der Prozess stirbt still waehrend des Ladens.
#
# Am 18.08.2026 gemessen: vier "Loading weights"-Laeufe nebeneinander im
# _server.log, danach ein toter Prozess ohne Traceback. Vermutlich dieselbe
# Ursache wie beim Sturz vom 14.08. (Handoff 14.08. §8.2), der damals den
# offenen Chrome-Prozessen zugeschrieben wurde.
_laden = threading.Lock()


def modell_holen() -> Demonstratormodell:
    global _modell
    # Schnellweg ohne Sperre: sobald das Modell steht, kostet der Aufruf
    # nichts. Die Sperre wird nur auf dem Ladeweg genommen.
    if _modell is not None:
        return _modell
    with _laden:
        # Zweite Pruefung INNERHALB der Sperre: wer hier ansteht, waehrend
        # ein anderer laedt, findet das Modell fertig vor und laedt nicht
        # noch einmal.
        if _modell is None:
            pfad = os.environ.get("DEMO_MODELL")
            if not pfad:
                kandidaten = sorted((WURZEL / "models").glob("*"))
                kandidaten = [k for k in kandidaten if (k / "config.json").exists()]
                if not kandidaten:
                    raise SystemExit(
                        "Kein Modell gefunden. Erwartet wird ein Verzeichnis unter "
                        f"{WURZEL / 'models'} mit einer config.json.")
                pfad = kandidaten[0]
            _modell = Demonstratormodell(pfad)
    return _modell
