# Plan — Darstellung neu: Bild statt Textwand, ein Parametersatz je Kachel

**Stand:** 14.08.2026 · **Status: Stufe 1 und 2 GEBAUT** (Gerüst + Kachel 08
als Musterstück). Die Entscheidungen des Anwenders zu §7 sind eingearbeitet:
Kennzahlenzeile statt Satz · Marke + wenige Wörter als Legende · eine Zelle mit
vier Abschnitten · erst ein Musterstück, dann die übrigen zwölf. **Stufe 3
wartet auf sein Urteil** — siehe §8.

Auftrag des Anwenders: *„du suchst jetzt im Detail durch, was ich dir
als Vorlage gegeben habe, dann machst du einen grundsätzlich neuen interaktiven
Plan für die Darstellung, der sich mit Parametern verstellen lässt. Dabei
sorgst du dafür, dass der überladene Text rausfällt oder zugeklappt ist, so
dass die Darstellung lediglich mit Überschrift auf der Webseite zu sehen ist.
Darunter von mir aus eine aufklappbare Texterklärungszelle. Parameter, die ich
auf einer Kachel verstellen kann, müssen in alle Darstellungen der Kachel
wirken.“*

---

## 1 — Was die Vorlage tatsächlich macht (angesehen, nicht gelesen)

Quelle: `_vorbild/bilder/` — 25 Aufnahmen des laufenden Transformer
Explainers. Maßgeblich sind `01-oben.png` / `02-bahn-0.png` (die Hauptansicht)
und `auf-Probabilities.png` (was passiert, wenn man nach unten scrollt).

**Fünf Beobachtungen, jede mit Folge für uns:**

| # | In der Vorlage | Folge für den Demonstrator |
|---|---|---|
| **V-1** | **Auf dem ersten Bildschirm steht KEIN Fließtext.** Nur: Kopfzeile, Prompt-Feld, Regler — und ab da nur noch Bild. Die einzige Prosa ist eine wegklickbare Karte unten rechts. | Der gesamte Erklärtext verlässt die Bildebene. |
| **V-2** | **Die Prosa steht als Artikel WEIT unten**, erst nach dem ganzen Diagramm erreichbar (`auf-Probabilities.png` zeigt sie: normale Fließtext-Spalte mit Abbildungen, ganz eigener Bereich). | Bei uns: eine aufklappbare Zelle unter der Darstellung. Zugeklappt = eine Zeile. |
| **V-3** | **Eine einzige Bedienzeile ganz oben** (Prompt · Generate · Temperature · Sampling Top-k/Top-p) — und sie wirkt auf **alles**, was darunter steht: Embedding, Attention, MLP, Probabilities. Kein zweiter Regler irgendwo im Bild. | Ein Parametersatz je Kachel, an einem Ort, wirkt auf jede Darstellung der Kachel. |
| **V-4** | **Erklärt wird durch Ziffern und ⓘ am Bild**, nicht durch Absätze: `fig-0.png` nummeriert die vier Schritte mit ①②③④ über den Spalten; die Überschriften tragen ein kleines ⓘ, hinter dem der Text steckt. | Legenden schrumpfen auf Marke + wenige Wörter; die Begründung wandert in die Erklärzelle. |
| **V-5** | **Sehr viel Weißraum, dünne Linien, gedeckte Farben.** Das Bild darf groß sein, weil nichts mit ihm um Platz konkurriert. | Wenn der Text weg ist, wird das Bild größer — das ist der eigentliche Gewinn, nicht die Textersparnis. |

---

## 2 — Wie schlimm es bei uns ist (gemessen am 14.08.2026, laufender Stand)

Gemessen im Browser: sichtbare Textzeichen je Kachel (ohne Beschriftung **im**
Bild, ohne zugeklappte Bereiche) und Höhe in Pixeln bis zum ersten Diagramm.

| Kachel | px bis zum 1. Bild | sichtbare Zeichen | schon zugeklappt | Bilder |
|---|---:|---:|---:|---:|
| 01 Zerlegung in Stücke | 588 | 2.929 | 1.463 | 1 |
| 02 Der Bedeutungsraum in 3D | 522 | 4.783 | 2.088 | 3 |
| 03 Nachbarn eines Wortes | 593 | 3.016 | 2.033 | 2 |
| 04 Woher ein Wort seine Information holt | 748 | 2.601 | 849 | 2 |
| **05 Aufmerksamkeit** | **899** | **8.616** | 1.925 | 3 |
| 06 Alle Köpfe einer Schicht | 587 | 2.938 | 1.046 | 2 |
| 07 Der Residualstrom | 738 | 4.235 | 2.667 | 4 |
| **08 Was als Nächstes kommt** | 641 | **5.049** | 2.427 | 2 |
| 09 Schluss nach jeder Schicht | 614 | 3.213 | 1.848 | 1 |
| 10 Der ganze Satz auf einen Blick | 662 | 2.901 | 1.304 | 1 |
| 11 Das Modell beschädigen | 421 | 2.277 | 681 | 2 |
| 12 Weiterschreiben | — | 900 | 1.237 | 0 |
| 13 Was hier läuft | — | 2.294 | 1.257 | 0 |
| **Mittel** | **539** | **3.519** | 1.556 | |

**3.519 sichtbare Zeichen sind rund anderthalb DIN-A4-Seiten Text je Kachel.**
Bei „Aufmerksamkeit“ sind es 8.616 — dreieinhalb Seiten. Und bevor das erste
Bild überhaupt beginnt, stehen im Mittel **539 px** Text, bei „Aufmerksamkeit“
**899 px**: fast ein ganzer Bildschirm, bevor man etwas sieht.

**Woher der Text kommt.** Es sind heute fünf Sorten an fünf Orten:

1. `lead()` — Titel + Vorspann, ganz oben (teils schon aufklappbar)
2. `anleitung()` — „So lesen Sie diese Kachel“, 5–7 Aufzählungspunkte
3. `hinweis()` — ein bis drei Absätze **über** jedem Bild
4. `.aussage` — ein Satz **am** Bild, mit Zahlen aus derselben Antwort
5. `befund()` — ein bis zwei Absätze **unter** jedem Bild
6. dazu die `legende` und das `was` der Farbleiste, beides mehrzeilige Prosa

Fünf Sorten, die alle „erklären“, aber an verschiedenen Stellen stehen und
nirgends gemeinsam weggeklappt werden können.

---

## 3 — Der Verstoß gegen „Parameter wirken auf alles“ ist belegt

Beispiel Kachel 08, am Code nachgeprüft:

* Die Kachel hat **zwei** Darstellungen: das Netz (Sankey, `d3-fluss`) und die
  Vorhersage-Tafel.
* Die Regler (Temperatur, Schnittverfahren, Schnittwert) sitzen über der Tafel
  und wirken **nur auf sie**.
* Das Netz holt seine Zahlen von `/api/netz`. Dessen Anfrage kennt
  (`server/app.py:155-162`) genau vier Felder: `text`, `position`, `oben`,
  `mit_wirkung`, `eingriffe`. **Kein `temperatur`, kein `top_k`, kein
  `top_p`.** Das Netz kann den Regler also gar nicht befolgen.

Dasselbe Muster an anderen Stellen (Code-Fundstellen in `web/kacheln.js`):

| Kachel | Bedienelement | wirkt auf | wirkt NICHT auf |
|---|---|---|---|
| 08 Was als Nächstes kommt | Temperatur / top-k / top-p | Tafel | Netz (Sankey) |
| 06 Alle Köpfe einer Schicht | Kennzahl-Wahl (`:2484`) | Landkarte | Matrix daneben |
| 07 Der Residualstrom | „Zeigen“ (`:4508`) | Positionsfeld | die drei anderen Bilder |
| 02 Der Bedeutungsraum | Schriftgröße / Nachbarn / Hintergrund (`:3932-3937`) | 3D-Feld | Nachbarliste |
| 12 Weiterschreiben | Temperatur / „nur die besten k“ (`:4949-4951`) | eigener Lauf | — *(zweiter Regler für denselben Wert, anderer Bereich: bis 200 statt bis 50)* |

---

## 4 — Der Vorschlag: EIN Aufbau für ALLE dreizehn Kacheln

```
┌───────────────────────────────────────────────────────────────────┐
│  KOPFZEILE (klebt beim Scrollen oben)                             │
│  ‹ Übersicht    Was als Nächstes kommt        Station 8 von 13    │
├───────────────────────────────────────────────────────────────────┤
│  SATZ    [Die Produktionsplanung in einem Unternehmen …   ] [↻]   │
│  STELLE  Die·Produktions·planung·…·dass        ← anklickbar        │
│  REGLER  Temperatur ▬▬●▬▬ 0,80   Schnitt (top-k|top-p) ▬●▬ 40     │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│                    D I E   D A R S T E L L U N G                  │
│                     (so groß, wie sie sein kann)                  │
│                                                                   │
│  ▸ Legende: ▬ Wahrscheinlichkeit  ▬ bleibt  ✕ ausgeschnitten      │
├───────────────────────────────────────────────────────────────────┤
│  ⌄  Erklärung, Anleitung und Befund                    (1 Zeile)  │
└───────────────────────────────────────────────────────────────────┘
```

**Sichtbar bleibt: Überschrift, Bedienung, Bild, eine Legendenzeile, eine
zugeklappte Zeile.** Geschätzt 200–300 Zeichen statt 3.519.

### 4.1 Die Erklärzelle

**Eine** aufklappbare Zelle unter der Darstellung, mit fester Gliederung —
damit man auf jeder Kachel weiß, wo was steht:

1. **Worum es geht** (heute: `lead`)
2. **So lesen Sie das Bild** (heute: `anleitung` + `hinweis`)
3. **Was hier zu sehen ist** (heute: `befund`)
4. **Wie es gerechnet wird** (heute: die Herleitungen, die Proben)

Sie ist **zugeklappt voreingestellt**. Beim Vortrag klappt man sie auf und hat
alles an einem Ort statt über die Seite verteilt.

### 4.2 Was NICHT in die Zelle wandert — und warum das zu entscheiden ist

Die **Aussage am Bild** (`.aussage`) ist kein Erklärtext: sie ist ein
Messergebnis, das sich mit jedem Reglerzug ändert („*Nach „·dass“ ist das
wahrscheinlichste Stück „·man“: Logit 20,03 … nach dem Softmax 35,7 %*“). Sie
gehört zu den Zahlen, nicht zur Erklärung.

**Drei Möglichkeiten — das ist die erste Frage an Sie (siehe §7).**

### 4.3 Der Parameter-Vertrag

Jede Kachel bekommt **einen deklarierten Parametersatz**:

```js
parameter: {
  satz:       { art: "text"                                  },
  stelle:     { art: "stelle"                                },
  temperatur: { art: "zahl", von: 0.05, bis: 2.0, schritt: .05 },
  schnitt:    { art: "wahl", werte: ["top-k", "top-p"]       },
  schnittwert:{ art: "zahl", abhängig_von: "schnitt"         }
}
```

**Die Regel:** jede Darstellung der Kachel wird bei **jeder** Änderung dieses
Satzes neu gerechnet. Kein Bild darf einen Parameter ignorieren, der auf seiner
Kachel steht.

Das erzwingt drei Nacharbeiten im Backend — sonst ist die Regel eine
Absichtserklärung:

* `/api/netz` bekommt `temperatur`, `verfahren`, `top_p`, `top_k` und
  schneidet die Kandidatenliste danach ab. **Ohne diese Änderung kann Kachel 08
  die Regel nicht erfüllen.**
* `/api/durchlauf` (Kachel 07, 09, 10) ebenso, wo es Verteilungen zeigt.
* Kachel 12 „Weiterschreiben“ verliert ihre eigenen Regler und nimmt die der
  Kopfzeile — ein Wert, ein Regler, ein Bereich.

**Das Gate dazu ist schon da:** `pruefe_bedienung.js` (gebaut heute) prüft
bisher eine Kachel. Es wird auf alle dreizehn erweitert und prüft dann je
Kachel: *jeder deklarierte Parameter verstellt → JEDES Bild der Kachel ändert
sich.* Ein Bild, das sich nicht rührt, ist dann ein Befund.

### 4.4 Legenden

Heute mehrzeilige Prosa unter jedem Bild („*die ersten drei Spalten sind reine
Zahlen — sie liegen dicht beieinander, ein Balken zeigte dort nichts*“). Neu:

* **Am Bild:** Marke + höchstens vier Wörter (`▬ bleibt`, `✕ ausgeschnitten`).
* **Die Begründung** wandert in die Erklärzelle, Abschnitt 2.
* Die Farbleiste behält ihre Skalengrenzen (die sind Messwerte), verliert aber
  den `was`-Absatz.

---

## 5 — Reihenfolge des Baus

| Stufe | Inhalt | Ergebnis |
|---|---|---|
| **0** | *(dieser Plan)* | abgestimmt oder korrigiert |
| **1** | Gerüst: `kachelRahmen()` mit Kopfzeile, Parameterleiste, Bildbereich, Erklärzelle. Die vier Texthelfer (`lead`, `anleitung`, `hinweis`, `befund`) schreiben nicht mehr an ihren Ort, sondern in die Zelle. | ein Bauteil, noch ohne Wirkung |
| **2** | **Kachel 08 als Musterstück** vollständig darauf umgestellt, inkl. `/api/netz` mit Temperatur und Schnitt. | **Sie sehen die neue Form an einer Kachel und entscheiden, ob sie stimmt** |
| **3** | Erst nach Ihrem Ja: die übrigen zwölf. | einheitlich |
| **4** | `pruefe_bedienung.js` auf alle Kacheln; neuer Prüfer `pruefe_textlast.js` (bricht ab, wenn eine Kachel mehr als N sichtbare Zeichen außerhalb der Erklärzelle hat). | die Regel hält von selbst |

Stufe 2 ist der Punkt, an dem wieder Sie entscheiden. Ich baue nicht alle
dreizehn Kacheln um, um dann zu hören, dass die Form nicht stimmt — das ist der
Fehler des 13.08.

---

## 6 — Was dieser Plan NICHT ändert

* **Die Zahlen.** Kein Wert wird anders gerechnet; die Proben bleiben.
* **Die Kachel-Gliederung** (Regel A-8, Ihre Entscheidung vom 12.08.): der
  Demonstrator bleibt eine Folge eigenständiger Kacheln und wird **nicht** zum
  durchgehenden Fluss wie die Vorlage.
* **Das dunkle 3-fls-Design.**
* **Die Prüfer-Batterie**, außer dass zwei dazukommen.

---

## 7 — Was ich von Ihnen brauche, bevor ich anfange

**Frage 1 — die Aussage am Bild.**
Der eine Satz mit den aktuellen Zahlen („*… nach dem Softmax 35,7 %*“): bleibt
er sichtbar am Bild, wandert er in die Erklärzelle, oder wird er auf eine
Kennzahlenzeile eingedampft (`·man 35,7 % · 4 von 151.936 bleiben`)?

**Frage 2 — Legende am Bild oder ganz weg?**
Marke + wenige Wörter am Bild (Vorschlag), oder auch die Legende in die Zelle
und am Bild gar nichts?

**Frage 3 — eine Zelle oder zwei?**
Eine Zelle „Erklärung“ mit vier Abschnitten (Vorschlag), oder getrennt
„Erklärung“ und „Wie es gerechnet wird“, damit man im Vortrag nur eines
aufklappt?

**Frage 4 — Umfang.**
Musterstück an Kachel 08 und dann Ihr Urteil (Vorschlag), oder sollen alle
dreizehn in einem Zug?

---

## 8 — Was daraus gebaut wurde (Stufe 1 und 2, gemessen am 14.08.2026)

### 8.1 Die Textlast

| Kachel 08 | vorher | nachher |
|---|---:|---:|
| **sichtbare Prosa** (Absätze, Listen, Hinweise, Befunde) | 2.427 | **0** |
| Prosa in der zugeklappten Erklärzelle | — | 4.308 |
| sichtbare Zeichen insgesamt | 5.049 | 2.103 |
| davon Bezugszeilen (Beleg, worauf das Bild rechnet) | | 285 |
| davon Kennzahlenzeilen | | 242 |
| davon Legenden | | 150 |
| Rest: Zahlen der Tafel, Satzstücke, Knöpfe | | ~1.400 |
| Seitenhöhe | 2.896 px | **1.879 px** |
| px bis zum ersten Bild | 641 | 421 *(jetzt Bedienleiste, kein Text)* |

**Null sichtbare Prosa.** Was außerhalb der Bilder stehen bleibt, ist
Bedienung, Beleg und Messwert — kein erklärender Satz.

Die übrigen zwölf Kacheln haben durch das Gerüst allein schon abgenommen
(Mittel 3.519 → 2.962 sichtbare Zeichen, 539 → 342 px vor dem ersten Bild),
weil Vorspann und Anleitung jetzt in die Zelle wandern. Ihre Hinweise und
Befunde stehen aber weiter zwischen den Bildern — das ist Stufe 3.

### 8.2 Der Parameter-Vertrag

`/api/netz` nimmt jetzt `temperatur`, `verfahren`, `top_k`, `top_p` und rechnet
seine Verteilung durch **dieselbe** Stelle wie die Tafel (`Modell._schnitt`,
eine Quelle statt zweier). Gemessen: Netz gegen Tafel bei gleichen Reglern —
**größter Unterschied 0,0e+00**. Vorher zeigte das Netz 28,2 % für „·man“,
während die Tafel daneben 35,7 % zeigte.

`pruefe_bedienung.js` prüft das jetzt fest: er bildet **je Darstellung einen
eigenen Abdruck** und verlangt, dass nach jeder Parameteränderung **jede** von
ihnen anders aussieht. Ein gemeinsamer Abdruck hätte genau den Fehler nicht
gefunden, um den es geht — er wäre schon grün geworden, wenn ein Bild reagiert.

### 8.3 Eine Auslegung, die zur Korrektur steht

Der Schalter „Der Weg / Die Wirkung“ betrifft nur das Netz — die Tafel hat
keine Wirkung zu zeigen. Ich habe ihn deshalb **am Bild** gelassen und nur die
**Modell**-Parameter (Satz, Stelle, Temperatur, Schnitt, weggenommene
Schichten) in die Leiste gelegt. Das ist meine Auslegung Ihrer Direktive, nicht
Ihre Anweisung.

### 8.4 Prüfer nach dem Umbau

| Prüfer | Ergebnis |
|---|---|
| `pruefe_api.py` | grün, inkl. neuer Netz-gegen-Tafel-Prüfung (0,0e+00) |
| `pruefe_rechnung.py` | grün — 281 Einzelprüfungen |
| `pruefe_diagramme.js` | 24 von 24 · 11 von 11 |
| `pruefe_bedienung.js` | 9 von 9, jetzt „alle 2 Darstellungen folgen“ |
| `pruefe_kontrast.js` | 0 unlesbar, 8 knapp |
| `uat.js` · `uat_detail.js` | grün |

### 8.5 Offen für Stufe 3

* Die übrigen zwölf Kacheln auf die Form umstellen.
* Ihre Parametersätze deklarieren und ihre Bilder daran hängen — heute wirkt
  auf Kachel 06 die Kennzahlwahl nur auf die Landkarte, auf Kachel 07 die
  „Zeigen“-Wahl nur auf eins von vier Bildern, auf Kachel 12 gibt es einen
  zweiten Temperaturregler mit anderem Bereich.
* `pruefe_bedienung.js` von einer auf dreizehn Kacheln erweitern.
* Ein Prüfer `pruefe_textlast.js`, der abbricht, sobald eine Kachel wieder
  sichtbare Prosa außerhalb der Erklärzelle trägt.
