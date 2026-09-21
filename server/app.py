"""Der lokale Server des Demonstrators.

Laeuft ausschliesslich auf diesem Rechner (127.0.0.1). Er nimmt keine
Verbindungen von aussen an und ruft nichts im Netz auf - das gesamte
Verzeichnis funktioniert ohne Internet.

Aufruf:  start.cmd
oder:    python -m uvicorn server.app:app --host 127.0.0.1 --port 8100
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .modell import Eingriffe, modell_holen

WURZEL = Path(__file__).resolve().parents[1]
WEB = WURZEL / "web"

app = FastAPI(title="LLM-Demonstrator", docs_url=None, redoc_url=None)


# ---------------------------------------------------------------------------
# Anfragen
# ---------------------------------------------------------------------------

class EingriffModell(BaseModel):
    kopfAus: list[list[int]] = Field(default_factory=list)
    schichtAus: list[int] = Field(default_factory=list)
    mlpAus: list[int] = Field(default_factory=list)
    attnAus: list[int] = Field(default_factory=list)
    kopfSkala: list[list[float]] = Field(default_factory=list)


class TextAnfrage(BaseModel):
    text: str
    schicht: int = 0
    # Die Stelle im Satz, auf die sich alles Stellenabhaengige bezieht.
    # -1 = die letzte Stelle; damit verhaelt sich die Auskunft wie zuvor.
    position: int = -1
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


class ErzeugenAnfrage(BaseModel):
    text: str
    anzahl: int = 60
    temperatur: float = 0.8
    top_k: int = 40
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


class NachbarAnfrage(BaseModel):
    token_id: int
    k: int = 15


class AnalogieAnfrage(BaseModel):
    """Woerter, nicht Stueck-Nummern.

    Vorher nahm diese Schnittstelle drei Token-IDs — das zwang die
    Oberflaeche dazu, von jedem eingegebenen Wort nur das erste Stueck zu
    verwenden. Bei „Königin“ wurde damit mit „Kön“ gerechnet.
    """
    a: str
    b: str
    c: str
    k: int = 10
    nur_ganze: bool = True
    erwartet: str = ""


# ---------------------------------------------------------------------------
# Schnittstelle
# ---------------------------------------------------------------------------

@app.get("/api/info")
def info():
    return modell_holen().info()


@app.post("/api/tokens")
def tokens(a: TextAnfrage):
    return modell_holen().tokenisieren(a.text)


@app.post("/api/durchlauf")
def durchlauf(a: TextAnfrage):
    m = modell_holen()
    return m.durchlauf(a.text, Eingriffe.aus_dict(a.eingriffe.model_dump()),
                       schicht=a.schicht, position=a.position)


@app.post("/api/lens")
def lens(a: TextAnfrage):
    m = modell_holen()
    return m.lens_gitter(a.text, Eingriffe.aus_dict(a.eingriffe.model_dump()))


@app.post("/api/nachbarn")
def nachbarn(a: NachbarAnfrage):
    return modell_holen().nachbarn(a.token_id, a.k)


class RaumAnfrage(BaseModel):
    text: str
    nachbarn_je: int = 8
    hintergrund: int = 400


@app.post("/api/raum")
def raum(a: RaumAnfrage):
    return modell_holen().raum(a.text, a.nachbarn_je, a.hintergrund)


@app.post("/api/analogie")
def analogie(a: AnalogieAnfrage):
    """A minus B plus C in der Embedding-Tabelle, mit ganzen Woertern."""
    return modell_holen().analogie(a.a, a.b, a.c, a.k, a.nur_ganze, a.erwartet)


class StufenAnfrage(BaseModel):
    text: str
    schicht: int = 0
    kopf: int = 0


@app.post("/api/attention_stufen")
def attention_stufen(a: StufenAnfrage):
    """Die Aufmerksamkeit in drei Rechenstufen, als volle Matrizen."""
    return modell_holen().attention_stufen(a.text, a.schicht, a.kopf)


class KetteAnfrage(BaseModel):
    text: str
    position: int = -1
    temperatur: float = 0.8
    top_k: int = 40
    # "top_k" oder "top_p" — feste Anzahl oder feste Menge.
    verfahren: str = "top_k"
    top_p: float = 0.9
    oben: int = 12
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


@app.post("/api/logit_kette")
def logit_kette(a: KetteAnfrage):
    """Vom rohen Logit zur Ziehwahrscheinlichkeit, in vier Stufen."""
    return modell_holen().logit_kette(
        a.text, a.position, a.temperatur, a.top_k, a.oben,
        Eingriffe.aus_dict(a.eingriffe.model_dump()),
        verfahren=a.verfahren, top_p=a.top_p)


class BahnAnfrage(BaseModel):
    """Alle Stationen eines Durchlaufs fuer die Hauptansicht."""
    text: str
    schicht: int = 0
    kopf: int = 0
    position: int = -1
    oben: int = 12
    proben: int = 24
    temperatur: float = 1.0
    verfahren: str = "top_k"
    top_k: int = 0
    top_p: float = 1.0
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


@app.post("/api/bahn")
def bahn(a: BahnAnfrage):
    """Der ganze Weg in einem Bild: Satz -> Embedding -> Q/K/V ->
    Aufmerksamkeit -> Feedforward -> Wahrscheinlichkeiten."""
    return modell_holen().bahn(
        a.text, a.schicht, a.kopf, a.position, a.oben, a.proben,
        a.temperatur, a.verfahren, a.top_k, a.top_p,
        Eingriffe.aus_dict(a.eingriffe.model_dump()))


class FeedforwardAnfrage(BaseModel):
    """Das Feedforward einer Schicht, aufgeschluesselt."""
    text: str
    schicht: int = 0
    position: int = -1
    # Ohne Angabe: das staerkste Neuron an der gewaehlten Stelle.
    neuron: int | None = None
    oben: int = 12
    proben: int = 24
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


@app.post("/api/feedforward")
def feedforward(a: FeedforwardAnfrage):
    """Gate, Up und Produkt der breiten Zwischenschicht — der Filter mit
    6.144 Schaltern, der zwei Drittel der Parameter haelt."""
    return modell_holen().feedforward(
        a.text, a.schicht, a.position, a.neuron, a.oben, a.proben,
        Eingriffe.aus_dict(a.eingriffe.model_dump()))


class BeitragsAnfrage(BaseModel):
    text: str
    position: int = -1
    # Ohne Angabe: das wahrscheinlichste Stueck.
    stueck_id: int | None = None
    oben: int = 14
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


@app.post("/api/logit_beitraege")
def logit_beitraege(a: BeitragsAnfrage):
    """Woher das Logit kommt: Zustand mal Ausgabespalte, Zahl fuer Zahl."""
    return modell_holen().logit_beitraege(
        a.text, a.position, a.stueck_id, a.oben,
        Eingriffe.aus_dict(a.eingriffe.model_dump()))


class NetzAnfrage(BaseModel):
    text: str
    position: int = -1
    oben: int = 8
    # Die Wirkung kostet einen zusaetzlichen Durchlauf JE Satzstueck und wird
    # deshalb nur auf Anforderung gerechnet.
    mit_wirkung: bool = False
    # Dieselben Parameter wie die Tafel derselben Kachel — sonst kann das Netz
    # den Reglern nicht folgen. Voreinstellung = kein Eingriff.
    temperatur: float = 1.0
    verfahren: str = "top_k"
    top_k: int = 0
    top_p: float = 1.0
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


@app.post("/api/netz")
def netz(a: NetzAnfrage):
    """Bezuege vom Satz zur naechsten Fortsetzung (Sankey-Daten)."""
    return modell_holen().netz(a.text, a.position, a.oben,
                               Eingriffe.aus_dict(a.eingriffe.model_dump()),
                               a.mit_wirkung,
                               temperatur=a.temperatur, verfahren=a.verfahren,
                               top_k=a.top_k, top_p=a.top_p)


class AnalogieGanzAnfrage(BaseModel):
    """Dieselbe Frage, aber mit Vektoren GANZER Woerter.

    `schicht` waehlt, wo der Wortvektor abgegriffen wird: 0 ist die
    Embedding-Tabelle (also die alte Rechnung), 28 der Ausgang des Modells.
    """
    a: str
    b: str
    c: str
    k: int = 10
    schicht: int = 14
    erwartet: str = ""


@app.post("/api/analogie_ganz")
def analogie_ganz(a: AnalogieGanzAnfrage):
    """A minus B plus C im Modellraum statt in der Stueck-Tabelle."""
    return modell_holen().analogie_ganz(a.a, a.b, a.c, a.k, a.schicht, a.erwartet)


@app.post("/api/analogie_sprachlich")
def analogie_sprachlich(a: AnalogieAnfrage):
    """Dieselbe Analogie, aber vom ganzen Modell beantwortet."""
    return modell_holen().analogie_sprachlich(a.a, a.b, a.c)


class DimensionAnfrage(BaseModel):
    text: str
    position: int = -1
    eingriffe: EingriffModell = Field(default_factory=EingriffModell)


class DeutungAnfrage(BaseModel):
    dim: int
    k: int = 12


class KontextAnfrage(BaseModel):
    satz_a: str
    satz_b: str
    wort: str


@app.post("/api/kontext")
def kontext(a: KontextAnfrage):
    """Dasselbe Wort in zwei Saetzen — wie seine Zustaende auseinanderlaufen."""
    return modell_holen().kontext(a.satz_a, a.satz_b, a.wort)


class RechenwegAnfrage(BaseModel):
    text: str
    schicht: int = 0
    kopf: int = 0
    zeile: int = -1


@app.post("/api/rechenweg")
def rechenweg(a: RechenwegAnfrage):
    """Wie eine Aufmerksamkeits-Zahl entsteht — Schritt fuer Schritt."""
    m = modell_holen()
    return m.rechenweg(a.text, a.schicht, a.kopf, a.zeile)


@app.post("/api/landkarte")
def landkarte(a: TextAnfrage):
    """Alle Schichten x alle Koepfe auf einmal, fuenf Kennzahlen je Kopf."""
    m = modell_holen()
    return m.landkarte(a.text, Eingriffe.aus_dict(a.eingriffe.model_dump()))


@app.post("/api/dimensionen")
def dimensionen(a: DimensionAnfrage):
    """Alle 2 048 Zahlen des Zustands, fuer jede der 29 Stufen."""
    m = modell_holen()
    return m.dimensionen(a.text, a.position,
                         Eingriffe.aus_dict(a.eingriffe.model_dump()))


@app.post("/api/dimension")
def dimension(a: DeutungAnfrage):
    """Was eine einzelne Dimension im Vokabular auszeichnet."""
    return modell_holen().dimension_deuten(a.dim, a.k)


@app.post("/api/bauteile")
def bauteile(a: TextAnfrage):
    """Beitrag je Schicht, getrennt nach Attention und Feedforward,
    fuer jede Position."""
    m = modell_holen()
    return m.bauteile(a.text, Eingriffe.aus_dict(a.eingriffe.model_dump()))


@app.post("/api/erzeugen")
def erzeugen(a: ErzeugenAnfrage):
    m = modell_holen()
    return m.erzeugen(a.text, a.anzahl, a.temperatur, a.top_k,
                      Eingriffe.aus_dict(a.eingriffe.model_dump()))


@app.get("/api/gesundheit")
def gesundheit():
    try:
        m = modell_holen()
        return {"bereit": True, "modell": m.pfad.name, "geraet": m.geraet}
    except Exception as e:                                    # noqa: BLE001
        return JSONResponse({"bereit": False, "fehler": str(e)}, status_code=503)


# ---------------------------------------------------------------------------
# Oberflaeche
# ---------------------------------------------------------------------------

@app.get("/")
def start():
    return FileResponse(WEB / "index.html")


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
