# Befunde — grundlegende Überarbeitung des Demonstrators

Aufgenommen am 09.08.2026, nach dem Stand `HANDOFF-2026-08-09.md` (13 Kacheln,
Qwen3-1.7B am lokalen Server). Umgesetzt am selben Tag.

---

## Die Befunde

1. Es geht um eine **grundlegende Überarbeitung**, nicht um Nacharbeiten an
   Einzelheiten.
2. **Vieles ist nicht gut erklärt.**
3. Die **Darstellungen sind zu oberflächlich.**
4. Sie sind **langweilig**.
5. Sie **nutzen zu wenige Dimensionen**.
6. **Was gezeigt wird, muss in seiner Logik sofort verstanden werden.**
7. **Portabel machen** — das Verzeichnis muss ohne die Projekt-`.venv` laufen.

## Entschieden (auf Rückfrage)

**Zu Befund 5 — „mehr vom Modell zeigen":** Nicht mehr Achsen je Bild, sondern
mehr vom Modell selbst. Bisher wurde stets ein Ausschnitt gezeigt — 3
PCA-Achsen (5,5 % der Streuung), eine Schicht, ein Kopf. Künftig: die echten
2 048 Dimensionen als Feld, alle 28 Schichten und 16 Köpfe zugleich.

**Zu Befund 1 — Struktur:** Die 13 Kacheln **bleiben**. Jede bekommt **mehr
Tiefe**, und es braucht **besseren Bezug zwischen den Kacheln**.

---

## Was daraus wurde

### Vier neue Auskünfte des Servers

| Endpunkt | Was er liefert | Zeit |
|---|---|---|
| `/api/landkarte` | alle 448 Köpfe zugleich, fünf Kennzahlen je Kopf | 0,20 s |
| `/api/dimensionen` | 29 Stufen × 2 048 Zahlen = 59 392 Werte | 0,31 s |
| `/api/dimension` | was eine einzelne Dimension im Vokabular auszeichnet | 0,02 s |
| `/api/bauteile` | Beitrag je Schicht, getrennt nach Attention und Feedforward, je Position | 0,21 s |

Dazu in `/api/durchlauf` neu: **Unsicherheit** (wieviele Stücke für 50/90/99 %
der Wahrscheinlichkeit, Entropie als „Würfel mit N Seiten").

### Was die neuen Anschauungen zeigen

Alles gemessen am 09.08. am Satz *„Die Produktionsplanung in einem Unternehmen
mit SAP beginnt damit, dass"*:

- **Landkarte aller Köpfe.** Auffällige Köpfe werden benannt statt gesucht:
  Schicht 20 / Kopf 5 schaut am weitesten zurück (6,99 Positionen) **und**
  parkt 99,9 % am Satzanfang; Schicht 7 / Kopf 8 bleibt zu 99,6 % bei sich
  selbst; Schicht 16 / Kopf 4 schaut zu 77,4 % auf das Wort davor.
- **Die zwei Bauteile getrennt.** Schicht 1 baut den Zustand um **718 %** um
  (Aufmerksamkeit). In Schicht 28 sind es nur noch 5,8 % gegen 44,6 %
  Feedforward: **gegen Ende schaut das Modell kaum noch auf andere Wörter und
  rechnet fast nur noch mit dem, was es schon hat.**
- **Alle 2 048 Dimensionen.** Sortiert nach Stärke wird sichtbar, was vorher
  nur behauptet war: das stärkste **1 % der Zahlen trägt 72,8 %** des
  Zustands. Die Marke steht im Bild.
- **Sprachvergleich.** Dass „deutsche Fachwörter teuer sind", war eine
  Behauptung in der Erklärung. Jetzt wird es an drei Satzpaaren nachgerechnet.
- **Eingriffe mit Wirkung.** Die Schalttafel zeigt unbeschädigt gegen
  beschädigt nebeneinander, mit dem Satz, was gekippt ist.
- **Analogie-Rechnung** (A − B + C) — der Endpunkt existierte seit Tag eins
  und wurde nie benutzt.

### Der rote Faden

Jede Kachel trägt jetzt bei sich, **woran sie anschließt** und **wohin die
Frage führt**, mit Begründung (`baut_auf` / `fuehrt` im Verzeichnis in
`web/kacheln.js`). Am Fuß jeder Seite stehen diese Bezüge als anklickbare
Karten; oben zeigt eine Stationsleiste „Station 6 von 13".

### Zwei Fehler, die dabei aufgefallen sind

1. **Die Parameterzahl war falsch.** Der Kopf meldete zeitweise
   2.031.739.904 statt 1.720.574.976 — je nachdem, wie transformers die
   Gewichte gerade lud. Nachgeprüft mit safetensors: `lm_head.weight` und
   `model.embed_tokens.weight` liegen beide in der Datei und sind
   **bitgleich**. Beide Zahlen sind richtig, sie beantworten verschiedene
   Fragen (Größe des Modells / Zahlen auf der Platte). Der Steckbrief zeigt
   jetzt beide, und die Zahl kommt aus dem Tensor-Index der Datei — sie
   springt nicht mehr zwischen zwei Starts.
2. **Ausreißer machten drei Anschauungen blind.** Landkarte, Bauteil-Säulen
   und Positionsfeld skalierten auf den Höchstwert. Ein einziger Ausreißer
   (Schicht 1 mit 718 %) drückte alles andere auf dieselbe Farbe. Jetzt wird
   auf ein oberes Perzentil skaliert; was darüber liegt, ist beschriftet.

### Vom Anwender gefunden: die letzte Zeile des Gitters war falsch

Befund: *„Der ganze Satz auf einen Blick — die letzte Zeile sollte zeigen, wie
es weitergeht, es steht aber nur Unsinn drin."* Das war **kein Anzeige-,
sondern ein Rechenfehler**, und er saß an einer Stelle, die man leicht
übersieht.

`output_hidden_states=True` liefert 29 Stufen, aber sie sind **nicht gleich**:
die Stufen 0 bis 27 sind Rohzustände, der letzte Eintrag ist bereits durch die
Schlussnormierung gelaufen. Der Code behandelte alle 29 gleich und normierte
die letzte damit ein zweites Mal.

Nachgemessen (09.08., Qwen3-1.7B, float32):

| | Abweichung zu den echten Logits | bestes Stück |
|---|---|---|
| `lm_head(h[-1])` | 9,1 · 10⁻⁶ | `' die'` ✓ |
| `lm_head(norm(h[-1]))` | **20,41** | `' der'` ✗ |

Sichtbar war das an Position 14: die letzte Zeile sagte `' das'`, die
tatsächliche Vorhersage des Modells ist `' man'`. Betroffen waren **alle**
Anschauungen mit Logit-Lens: das Gitter, die Kurve „Schluss nach jeder
Schicht", der Beitrag der letzten Schicht im Residualstrom und die unterste
Zeile des Dimensionsfelds.

Behoben durch einen Hook am letzten Block, der dessen Ausgang **vor** der
Schlussnormierung mitschneidet — damit sind alle 29 Stufen im selben Zustand
und die Norm wird einheitlich angewandt (`_hook_letzter_block` /
`_stufen_roh` in `server/modell.py`).

**Regressionstest in `pruefe_api.py`:** die letzte Lens-Stufe und die letzte
Zelle des Gitters müssen mit der echten Vorhersage übereinstimmen — nach Stück
und auf 1 Prozentpunkt genau. Beide grün: `' man'` 28,2 %.

Dazu neu die Leseanleitung der Kachel, die das benennt: **die unterste Zeile
ist die fertige Rechnung**, die Zeilen darüber sind Zwischenstände, und die
erste Spalte sieht immer merkwürdig aus, weil das erste Wort nichts hat,
worauf es zurückschauen könnte.

### Zweiter Befund zum Gitter: es zeigte die falsche Größe

Nach der Korrektur der Schlussnormierung war die Kachel rechnerisch richtig
und **trotzdem unbrauchbar**. Auftrag: *„akribisch prüfen, was los ist, alles
auf Rechenfehler prüfen."*

**Die Rechnung war in Ordnung** — `pruefe_rechnung.py` lädt das Modell ein
zweites Mal und rechnet jede Größe von Hand nach: 238 Einzelprüfungen, kein
Rechenfehler. Das Problem lag woanders: die Kachel zeigte je Stufe das
*wahrscheinlichste Stück*. Für Zwischenschichten ist das mathematisch korrekt
und inhaltlich wertlos — 27 von 29 Zeilen waren Rauschen (`amp`, `生产`,
`XYZ`).

Die Kachel zeigt jetzt eine Größe, die an **jeder** Stufe sinnvoll ist:
**auf welchem Platz das spätere Ergebnis an dieser Stufe schon stand.** Für
die letzte Position des Beispielsatzes:

| Stufe | Platz des späteren Ergebnisses | Wahrscheinlichkeit |
|---|---|---|
| Embedding | 17. | 0,00 % |
| nach Schicht 6 | 123 802. | 0,00 % |
| nach Schicht 18 | 6 004. | 0,00 % |
| nach Schicht 21 | 108. | 0,00 % |
| nach Schicht 24 | 17. | 0,20 % |
| nach Schicht 26 | 2. | 24,25 % |
| nach Schicht 28 | **1.** | 28,22 % |

Das ist die Geschichte, die die Kachel erzählen sollte und die vorher unter
dem Rauschen lag: die Antwort ist bis Schicht 21 abgeschlagen und setzt sich
in den letzten fünf Schichten durch. Ab Platz 1 000 steht in der Zelle nur
noch die Größenordnung (10³, 10⁵) — auf die genaue Stelle kommt es dort nicht
an, und eine sechsstellige Zahl in einer 60 Pixel breiten Zelle sagt niemandem
etwas.

Drei umschaltbare Ansichten: **Platz** (Standard), **Sicherheit in Prozent**,
und die alte Ansicht **welches Stück hier herauskäme** — letztere mit dem
ehrlichen Hinweis, warum sie unlesbar ist. Der Spaltenkopf trägt jetzt zwei
Zeilen: das Wort und darunter das Stück, auf das sich die Zellen beziehen.

### Vom Anwender gefunden: die Analogie ging nicht auf ganze Wörter

Befund: *„Mit Bedeutungen rechnen … geht nicht auf ganze Wörter!"* Zu Recht.
Die Kachel nahm von jedem eingegebenen Wort nur das **erste Stück** — bei
„Königin" rechnete sie also mit „Kön" und lieferte folgerichtig Bruchstücke
als Antwort. Der Satz „das ist die schärfste Probe auf alles, was diese
Kachel behauptet" stand daneben und war damit nicht einlösbar.

Nachgemessen, warum: von 15 typischen Fachwörtern sind nur **7 ein einziges
Stück**. `Königin` = `Kön`+`igin`, `Werkzeug` = `Werk`+`zeug`,
`Lieferant` = `Lie`+`fer`+`ant`. Und von 151 936 Stücken des Vokabulars sind
nur **43 075 ganze Wörter** — der Rest sind Bruchstücke, die als Antwort auf
eine Analogie nichts aussagen.

**Was jetzt anders ist:**

1. Ein Wort aus mehreren Stücken wird als **Summe seiner Stücke** gerechnet,
   nicht mehr als erstes Stück. Das ist als Näherung gekennzeichnet — das
   Modell selbst setzt Stücke nicht durch Addition zusammen.
2. Die Ergebnisliste zeigt **nur ganze Wörter**.
3. Ein Feld für das **erwartete Wort**: der Demonstrator sagt, auf welchem
   Platz es landet — und, wenn es gar kein eigenes Stück ist, dass die
   Rechnung es **prinzipiell nicht finden kann**. Das ist die eigentliche
   Antwort auf den Befund.
4. Daneben dieselbe Frage, **an das ganze Modell gestellt**. Es antwortet
   Stück für Stück und kann deshalb zusammengesetzte Wörter bilden.

Gemessen am 09.08.:

| Analogie | Tabellenrechnung | Modell |
|---|---|---|
| Paris→Frankreich, Berlin→? | `Deutschland` auf Platz 82 von 43 075 | **Deutschland** ✓ |
| Rom→Italien, Madrid→? | `Spanien` ist kein eigenes Stück (`Span`+`ien`) | **Spanien** ✓ |
| Mann→König, Frau→? | `Königin` ist kein eigenes Stück (`Kön`+`igin`) | König ✗ |
| Kunde→Auftrag, Lieferant→? | `Bestellung` ist kein eigenes Stück | **Bestellung** ✓ |

Das ist inhaltlich der interessanteste Fund der ganzen Überarbeitung: **die
berühmte Analogie-Rechnung stammt aus der Zeit der Wort-Embeddings und geht
bei einem heutigen Modell mit Stückvokabular nicht mehr auf** — während das
Modell selbst dieselbe Frage oft mühelos beantwortet. Tabelle und Modell
wissen Verschiedenes, und die Kachel zeigt das jetzt nebeneinander.

Für den sprachlichen Weg wurden vier Satzmuster gemessen; nur eines liefert
brauchbare Ergebnisse (die Liste zweier Wortpaare). Das steht als Muster
sichtbar in der Kachel, damit erkennbar bleibt, worauf das Modell antwortet.

### Verständlichkeit über alle Kacheln

Systematisch geprüft, welche Kachel eine Erklärung, eine Leseanleitung, einen
Befund und Querverweise hat. Vier Kacheln hatten **keine Leseanleitung**
(Was als Nächstes kommt, Schluss nach jeder Schicht, Weiterschreiben, Was hier
läuft), zwei **keinen Befund** (Woher ein Wort seine Information holt, Der
Bedeutungsraum). Beides ergänzt.

Die **Beispielsätze** tragen jetzt ihre Stückzahl (3 bis 19) und im Tooltip,
wofür sie taugen. Das ist keine Verzierung: eine Attention-Matrix mit vier
Stücken kann man lesen, eine mit zwanzig nicht. Wer den Zusammenhang über
mehrere Nebensätze sehen will, braucht dagegen den langen Satz. Neu dabei ist
ein sehr kurzes Beispiel („Der Motor wird", 3 Stücke).

### Der grundsätzliche Befund: der Demonstrator erklärte die Mechanik nicht

Auftrag: *„grundlegend hinterfragen, ich verstehe viele Konzepte nicht … im
Internet recherchieren, wie andere es erklären."*

Recherchiert wurden [Transformer Explainer (Georgia
Tech)](https://poloclub.github.io/transformer-explainer/), [Google Machine
Learning Crash
Course](https://developers.google.com/machine-learning/crash-course/llm/transformers),
[The Illustrated Transformer (Jay
Alammar)](https://jalammar.github.io/illustrated-transformer/) und
[3Blue1Brown](https://www.3blue1brown.com/lessons/attention/).

**Was die guten Erklärungen anders machen:**

1. **Erst das Problem, dann der Mechanismus.** 3Blue1Brown beginnt damit,
   dass ein Embedding kontextlos ist — „mole" bedeutet in *shrew mole*, *mole
   of carbon dioxide* und *biopsy of the mole* Verschiedenes. Attention kommt
   erst danach, als Lösung.
2. **Query/Key/Value bekommen eine Metapher.** Der Transformer Explainer
   nutzt die Suchmaschine: Query = Suchtext, Key = Seitentitel, Value =
   Inhalt.
3. **Ein Beispiel, das den Mechanismus beweist.** Google und Alammar nutzen
   beide *„The animal didn't cross the street because it was too tired"*
   gegen *„…too wide"*.
4. Die Forschung nennt die Barriere: Tutorials überfordern mit Mathematik,
   Visualisierungen zielen auf Experten.

**Der Befund über den eigenen Demonstrator:** Er war ein **Messgerät, kein
Lehrmittel**. Er zeigte, *was* das Modell tut, nie *wie*. Query, Key und
Value — das Herzstück — kamen überhaupt nicht vor. Ebenso wenig: wozu
Attention gut ist, die Positionscodierung, der Softmax, der Gesamtweg, das
Training.

**Entschieden (Rückfrage):** Jede Kachel bekommt zwei Teile — oben „Wie es
rechnet" an einem winzigen Beispiel mit echten Zahlen, darunter „Was Ihr
Modell macht" (die bisherige Messung).

**Umgesetzt in der Kachel „Aufmerksamkeit":**

*Teil 1 — Wozu überhaupt?* Dasselbe Wort in zwei Sätzen, und der Abstand
seiner Zustände über die Schichten gemessen. Bei „Bank" (Park / Innenstadt)
startet er bei **exakt 0** — in der Tabelle ist es derselbe Vektor — und
wächst auf **0,301**. Dieses Auseinanderlaufen *ist* die Bedeutung. Ein
viertes Beispielpaar hat absichtlich einen identischen Satzanfang: dort
bleibt der Abstand bei null, weil ein Wort nur nach links schauen darf. Das
ist der Moment, in dem die kausale Maske begreifbar wird.

*Teil 2 — Wie es rechnet.* Vier nummerierte Schritte an „Der Motor wird":
aus dem Wortzustand werden Query, Key und Value; das Punktprodukt jeder Frage
mit jeder Aufschrift; Teilen durch √128; Maske; Softmax; Mischen der Inhalte.
Alles mit den echten Gewichten, keine erfundenen Beispielzahlen.

**Und die Probe:** Die vorgerechneten Anteile — `Der` 14,28 % · `Motor`
32,70 % · `wird` 53,02 % — werden mit dem verglichen, was das Modell selbst
herausbekommen hat. Abweichung **8,8 · 10⁻⁵**. Damit ist belegt, dass das
Vorgerechnete nicht eine vereinfachte Nacherzählung ist, sondern genau die
Rechnung des Modells. Die Prüfung läuft für Schicht 1, 14 und 28 automatisch
mit.

**Noch offen** (dieselbe Bauform, andere Kacheln): Feedforward, die
Positionscodierung als eigener Schritt, der Softmax in der Vorhersage-Kachel,
wie aus einer Stück-Nummer ein Vektor wird, der Gesamtweg als ein Bild, und
woher die Gewichte kommen.

### Portabel

Der wichtigste offene Punkt aus dem Handoff — mit einer zweiten Ursache, die
dort nicht stand:

- **`python\`** — eine eigenständige Python-Ausgabe 3.13.12 (embeddable) mit
  genau den 46 Paketen, die der Server braucht (3,00 GB, davon torch 2,78 GB
  mit CUDA). Ermittelt durch Import und Auswertung von `sys.modules`, nicht
  geraten. `start.cmd` nimmt sie zuerst.
- **`models\Qwen3-1.7B` war eine Junction** auf `OwnLLM\models\` — die 3,80 GB
  Gewichte lagen **außerhalb** des Verzeichnisses. Beim Kopieren wäre das
  Modell verschwunden. Jetzt liegen die Dateien wirklich hier; das Original
  ist unberührt.
- **`pruefe_portabel.py`** weist das dauerhaft nach: eigene Umgebung, keine
  Verknüpfungen, Modell vollständig, keine Verweise ins Netz, `start.cmd`
  richtig. Verzeichnis insgesamt **6,68 GB**.

---

## Prüfung

```powershell
cd C:\Users\JörgWFischer\PycharmProjects\OwnLLM\demonstrator
start.cmd                        # oder:
python\python.exe -m uvicorn server.app:app --host 127.0.0.1 --port 8100

python\python.exe pruefe_portabel.py   # Mitnehmbarkeit
python\python.exe pruefe_api.py        # die Zahlen hinter der Oberfläche
node uat.js                            # alle 13 Kacheln in echtem Chrome
node uat_detail.js                     # die neuen Anschauungen einzeln
node uat.js --sichtbar                 # mit sichtbarem Browser

..\.venv\Scripts\python.exe pruefe_rechnung.py   # JEDE Zahl nachgerechnet
```

`pruefe_rechnung.py` ist der schärfste der fünf: er lädt das Modell ein
zweites Mal (float32, CPU) und rechnet jede Größe aus den Rohdaten **neu** —
mit einer von Hand geschriebenen Rechnung, nicht mit derselben Funktion.
Geprüft werden Tokenisierung samt Zeichenspannen, alle zwölf Ränge der
Vorhersage, die Unsicherheitsmaße, fünf Lens-Stufen, neun Gitterzellen, alle
Zielstücke und ihre Plätze, Zeilensummen und Maske der Attention, fünf
Kennzahlen der Landkarte an sechs Stellen, die Bauteil-Beiträge samt der Probe
*Zustand + Attention + Feedforward = nächster Zustand*, neun z-Werte, die
Konzentration, fünf Nachbarn — und dass Eingriffe wirken und rückstandsfrei
entfernt werden.

Stand 09.08.2026, alle fünf grün: **238 Einzelprüfungen ohne Rechenfehler**,
13 Kacheln ohne JavaScript-Fehler, kein Element ragt aus dem Fenster, acht
Detailanschauungen vorhanden und gefüllt, alle Endpunkte plausibel, kein
Portabilitäts-Befund.

---

## Offen

- Nachtrainieren auf den Texten des Anwenders (LoRA). Von ihm entschieden,
  noch nicht gemacht. `peft` ist in der Projekt-`.venv`, **nicht** in der
  mitgelieferten Umgebung — für das Training genügt die Projektumgebung.
- Die Beschriftungen im 3D-Raum überlappen bei vielen Punkten.
- Nichts davon ist committet.

## Verbindliche Regeln aus diesen Tagen

1. **Erst fragen, dann bauen.** Umfang, Form und Verortung sind
   Entscheidungen des Anwenders.
2. **Sagt der Anwender, er sammle erst Befunde:** zuhören und mitschreiben.
   Keine Rückfragen, nichts bauen, bis er fertig ist.
3. **Erklärung immer vor dem Beispiel.** Auf jeder Kachelseite.
4. **Keine gesetzten Zahlen.** Was angezeigt wird, kommt aus dem Modell. Wo
   etwas eine Näherung ist, steht das dabei.
5. **Jede Anschauung braucht einen Befund** — einen Satz, der sagt, was in ihr
   zu sehen ist, mit Zahlen aus derselben Antwort. Ein Bild ohne Befund
   überlässt dem Betrachter die Arbeit, die der Demonstrator ihm abnehmen soll.
6. **PowerPoint wird nie automatisiert.** Kein COM, kein `Quit`.
7. **Die Dropbox ist tabu.**
8. Design nach 3-fls.ai; weißer Text nie auf `#01AEED`, sondern auf `#0A6189`.
