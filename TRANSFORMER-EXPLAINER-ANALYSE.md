# Transformer Explainer — was er zeigt, Station für Station

> Analyse vom 12.08.2026, gelesen am **Quelltext** des Repos
> `poloclub/transformer-explainer` (Georgia Tech, Svelte + D3 + GSAP), nicht
> an Beschreibungen über ihn. Quelle jeder Aussage ist die genannte Datei.
>
> **Zweck:** Grundlage für die Entscheidung, was davon nachgebaut wird.
> Diese Datei trifft **keine** Entscheidung.

---

## 0 — Das tragende Prinzip

Der ganze Aufbau ist **ein einziger durchgehender Fluss von links nach
rechts**, in Sankey-Bauform: Eingabe → Embedding → QKV → Attention → MLP →
(28 Blöcke) → Linear+Softmax → Wahrscheinlichkeiten → Auswahl. Man scrollt
nicht zwischen Kacheln, man **wandert durch ein Bild**.

Drei Eigenschaften, die jede einzelne Station teilt:

1. **Zusammengeklappt zeigt sie das ERGEBNIS, aufgeklappt die HERLEITUNG.**
   Zwischenschritte sind standardmäßig verborgen — „collapsed by default to
   visualize the significance of the computational result, with the option
   to expand to inspect its derivation through animation sequences". Das
   Aufklappen ist eine **Animation**, keine Umschaltung (GSAP-Zeitleisten,
   0,4–0,5 s, `power2.inOut`).
2. **Jeder Vektor ist als Vektor zu sehen** — als feines Streifenbild, eine
   Zeile je Zahl (`VectorCanvas.svelte`, `lineHeight: 1`, 4-fache
   Pixeldichte). Standardmäßig **unsichtbar** (`opacity: 0`); beim
   Überfahren erscheint er. Farbskala:
   `d3.interpolate(theme.colors[key][100], theme.colors[key][400])` — hell
   nach dunkel **derselben** Farbfamilie.
3. **Jede Station hat eine eigene Farbfamilie.** Query blau, Key rot, Value
   grün, MLP violett/indigo, Attention-Matrix violett. Die Farbe sagt
   *welches Bauteil*, die Helligkeit *welcher Wert*.

---

## 1 — Die Stationen im Einzelnen

### Embedding (`Embedding.svelte`)

**Zugeklappt:** links die Token als Text, rechts der fertige
Embedding-Vektor als farbiger Streifen.

**Aufgeklappt:** die Rechnung in fünf Spalten —
`Token → Token-Embedding → (+) → Positionscodierung → (=) → Embedding`.

Bemerkenswert: die **Positionscodierung** bekommt eine eigene, *zweiseitige*
Farbskala (rot–weiß–blau), weil sie Vorzeichen trägt. Die übrigen Vektoren
sind grau. Beim Überfahren eines Tokens leuchtet sein Vektor auf; ein
Tooltip nennt die Dimension (`vector(768)`).

### Query, Key, Value (`QKV.svelte`)

Zwei Spalten: links der Embedding-Vektor, rechts **drei übereinander
gestapelte Teilvektoren** in einem Block — Q blau, K rot, V grün, jeweils
mit dem Buchstaben beschriftet. Beim Überfahren verschwindet der Buchstabe
und die Zahlen erscheinen als Streifenbild. Der Tooltip nennt beide
Dimensionen: `vector(768)` für das Embedding, `vector(2304)` für Q+K+V
zusammen.

Innerhalb jedes Teilvektors sitzen **Kopf-Markierungen** (`sub-vector
x1-12 head1`) — man sieht, welcher Ausschnitt zu welchem Kopf gehört.

### Attention-Matrix (`AttentionMatrix.svelte`)

**Drei Matrizen nebeneinander**, jede eine eigene Rechenstufe:

| Stufe | Formel | Farbskala | Wertebereich |
|---|---|---|---|
| Skalarprodukt | `Q · Kᵀ` (KaTeX) | weiß → `purple[700]` | aus den echten Daten |
| Skalierung + Maske | | dieselbe | fest `[−3, 3]` |
| Softmax | | `d3.interpolate('white', purple[700])` | `[0,0 … 1,0]` |

Die Zellen sind **Kreise**, nicht Quadrate, mit `rowGap: 3` und `colGap: 3`;
die Zellgröße wird aus der Tokenzahl berechnet. **Jede Matrix trägt ihre
eigene Farbleiste** mit den echten Grenzen — als Balken mit
`linear-gradient(90deg, white 0%, purple.700 100%)` und den Zahlen links und
rechts davon.

Die Maskierung wird als **Überblendung** gezeigt: die vorige Stufe blendet
aus, die maskierte blendet ein. Beim Aufklappen läuft eine Kette:
Verbindungspfade zeichnen sich per `stroke-dasharray` (0,5 s), QK-Matrix
blendet ein, die maskierte schiebt sich von links herein (0,5 s), Softmax
folgt (0,4 s).

### Die Köpfe als Kartenstapel (`HeadStack.svelte`)

Alle Köpfe liegen **gleichzeitig** im DOM, als **gestapelte Karten**:
`translate(i·Δx, i·Δy) scale(1 − 0,04·i)`, Deckkraft
`max(0,2, 1 − i·Δ)` — jede Karte kleiner, weiter hinten, blasser.

Blättern über „**Head 3 of 12**" mit Pfeiltasten. Vorwärts nimmt die
vorderste Karte weg und hängt sie **hinten an** (`container.appendChild`) —
ein echter Kartenstapel, animiert in 0,4 s.

### MLP (`Mlp.svelte`)

Die Aufweitung 768 → 3072 → 768 wird **räumlich** gezeigt: ein
Vier-Spalten-Raster, in dem die erste Schicht zwei Spalten belegt und die
mittlere die volle Breite. Man *sieht* die Verbreiterung. Farben: violett →
indigo → blau. Dazwischen eine eigene Station für die Aktivierungsfunktion.
Diese Kachel ist **immer aufgeklappt**.

### Linear + Softmax (`LinearSoftmax.svelte`)

Ein Raster mit fünf Spalten, jede eine Rechenstufe:

1. **Token** (mit Token-ID im Tooltip)
2. **Logits** — die rohen Werte, mit einem Auge-Knopf, der die
   Gewichts-Aufschlüsselung öffnet
3. **Skalierte Logits** — Logits geteilt durch die Temperatur
4. **Auswahl** — top-k gefiltert oder top-p kumulativ; ausgeschlossene
   Token bekommen die Klasse `filtered` und einen violetten Hintergrund;
   beim top-p-Schnitt steht die **kumulative Summe** dabei
5. **Wahrscheinlichkeitsbalken**

Das vorhergesagte Token wird fett hervorgehoben.

### Die Wahrscheinlichkeitsbalken (`ProbabilityBars.svelte`)

Sehr flache Balken — **4 Pixel hoch** —, Breite linear zur
Wahrscheinlichkeit. Farbe grau (`gray[300]`), beim Überfahren violett
(`purple[400]`), das vorhergesagte Token in eigener Farbe.

Die Beschriftung ist präzise gestaffelt: `0 %` bei null, `<0,01 %` unter
einem Hundertstel Prozent, sonst zwei Nachkommastellen. Die Zahlen
**zählen animiert hoch** (`d3.interpolateNumber`), wenn sich etwas ändert.

### Temperatur (`Temperature.svelte`)

Ein Schieber über **18 feste Werte von 0,2 bis 10,0**, Voreinstellung
Index 6 = **0,8**. Der Wert steht als Zahl daneben und wirkt sofort auf die
ganze Kette (Svelte-Reaktivität → Store → alle Spalten).

Bemerkenswert: eine **Schwäche** des Vorbilds — im Quelltext ist die
Hilfe-Erklärung auskommentiert, und es gibt **keine** eigene Darstellung
der Wirkung auf die Verteilung. Man sieht nur die Zahl. Das ist eine Stelle,
an der wir es besser machen können.

### Die 28 Blöcke (`SubsequentBlocks.svelte`)

Die wiederholten Blöcke werden **zusammengefaltet** dargestellt, damit man
das Muster als Muster erkennt statt 28-mal dasselbe zu scrollen.

---

## 2 — Die Machart, technisch

| Sache | Wie |
|---|---|
| Bänder | geschlossene Bezierform `M…C…L…C…Z`, Fläche gefüllt |
| Kurvenstärke | `distance > maxDistance ? curve : curve · (distance/maxDistance)` — nahe Elemente bekommen flachere Kurven |
| Farbe der Bänder | `url(#gradientId)` — **linearGradient** mit Farb- *und* Deckkraft-Stopps |
| Zwei Ebenen | `sankey-back` (hinter den Köpfen) und `sankey-top` |
| Hover | D3-Übergang, **100 ms**, Deckkraft ändert sich |
| Aufklappen | GSAP-Zeitleisten, 0,4–0,5 s, `power2.inOut` |
| Formeln | KaTeX (`Q \cdot K^T`) |
| Erklärtexte | `TextbookTooltip` an jeder Beschriftung; dazu ein eigenes „Textbook" mit Karten und Navigation |
| Gewichte | **zwölf** eigene Popovers: Aktivierung, Attention-Gewichte, Dropout, LayerNorm, Logit-Gewichte, MLP-Gewichte (auf/ab), Positionscodierung, QKV-Gewichte, Residual, Softmax |

---

## 3 — Abgleich: was unser Demonstrator hat, was fehlt

| Merkmal des Vorbilds | bei uns |
|---|---|
| durchgehender Fluss statt getrennter Kacheln | **fehlt** — 13 getrennte Kacheln |
| zugeklappt Ergebnis / aufgeklappt Herleitung, animiert | **fehlt** |
| Vektor als Streifenbild an jeder Station | nur an **einer** Stelle (Mitte der Vorhersage-Kachel) |
| Streifenbild erscheint beim Überfahren | **fehlt** |
| Farbfamilie je Bauteil (Q blau, K rot, V grün …) | **fehlt** — eine kalte Skala für alles |
| drei Attention-Stufen nebeneinander (Skalarprodukt → Maske → Softmax) | **fehlt** — wir zeigen nur das Ergebnis |
| Köpfe als Kartenstapel mit Blättern | **fehlt** — wir zeigen eine Landkarte aller 448 Köpfe |
| MLP-Aufweitung räumlich sichtbar | **fehlt** — Feedforward kommt gar nicht vor |
| Logits → skaliert → gefiltert → Wahrscheinlichkeit als Spalten | **fehlt** — wir zeigen nur die Endverteilung |
| Temperatur/top-k als Schieber mit Sofortwirkung | nur im Weiterschreiben, **nicht** in der Vorhersage |
| Formeln als Formeln (KaTeX) | **fehlt** |
| Gewichts-Popovers | **fehlt** |
| Bänder mit Verlauf, Hover-Hervorhebung | **seit heute vorhanden** (eine Kachel) |
| Farbleiste mit echten Grenzen | vorhanden, und zwar strenger als im Vorbild |
| jede Zahl aus dem echten Modell | vorhanden — und bei uns ist das Modell **1,7 Mrd** statt GPT-2 |
| Bezug/Aussage an jedem Bild | vorhanden, im Vorbild **nicht** |

---

## 4 — Was daraus zu entscheiden ist

**Entschieden am 12.08.2026:**

1. ~~Fluss oder Kacheln?~~ → **Kacheln bleiben.** Kein durchgehender Fluss
   über eine Seite. (Regel A-8)
2. ~~Animation überall oder gezielt?~~ → **Animation, wo sie etwas
   erklärt.** (Regel A-9)

3. ~~Farbfamilie je Bauteil?~~ → **Ja, aber alle Familien kalt.** Gelb
   bleibt allein der Auswahl. Damit wird die Vorbild-Palette bewusst NICHT
   übernommen (dort ist Key rot). (Regel C-1/C-1a)
4. ~~Welche Stationen kommen dazu?~~ → **Alle vier:** Attention in drei
   Stufen · Feedforward · Logits→Wahrscheinlichkeit als Kette · Köpfe als
   Kartenstapel.

**Noch offen:**

5. **Reihenfolge.** Vorgeschlagen, weil das Fundament zuerst kommen muss:

   | # | Schritt | warum hier |
   |---|---|---|
   | 0 | **Farbfamilien als geteilter Baustein** | betrifft alle vier Stationen; später eingezogen müsste jede noch einmal angefasst werden |
   | 1 | **Attention in drei Stufen** | größter Lehrwert; die Station, an der man die Mechanik wirklich sieht |
   | 2 | **Logits → Wahrscheinlichkeit als Kette** | baut auf der bestehenden Vorhersage-Kachel auf; bringt Temperatur- und top-k-Schieber (Regel A-4) |
   | 3 | **Feedforward** | ganz neu: eigener Endpunkt und eigene Darstellung |
   | 4 | **Köpfe als Kartenstapel** | Umbau einer Kachel, die heute schon funktioniert — geringstes Risiko, deshalb zuletzt |
