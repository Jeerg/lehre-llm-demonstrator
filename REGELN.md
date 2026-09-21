# Heilige Regeln des Demonstrators

> **Status: ENTWURF, 12.08.2026.** Zur Diskussion vorgelegt, noch nicht
> gelockt. Kein Punkt hier ist beschlossen, bevor er nicht besprochen ist.
>
> **Geltung:** verbindlich für jeden, der an diesem Demonstrator arbeitet.
> Diese Datei ist vor jeder Änderung zu lesen.

---

## Wie diese Liste zu lesen ist

| Grad | Bedeutung | Folge bei Verstoß |
|---|---|---|
| 🔴 **HEILIG** | nicht verhandelbar | sofortiger Stopp, Änderung wird nicht ausgeliefert |
| 🟠 **GELOCKT** | festgelegt, nur per ausdrücklichem Re-Lock änderbar | Diskussion vor Abweichung |
| 🟡 **KONVENTION** | etablierte Praxis | Abweichung mit Begründung erlaubt |

Jede Regel trägt, wo vorhanden, ihr **Gate** — das Skript, das ihre
Verletzung meldet. Eine Regel ohne Gate ist eine Absichtserklärung.

---

## A — Was jede Anschauung leisten muss

| ID | Grad | Regel | Gate |
|---|---|---|---|
| **A-1** | 🔴 | **Jede Darstellung trägt eine vollständige Legende.** Jede Farbe, jede Form, jede Strichart, jede Breite ist benannt. Eine Farbfläche trägt zusätzlich eine Farbleiste mit den **echten** Skalengrenzen — nicht mit runden Wunschwerten. | `pruefe_diagramme.js` |
| **A-2** | 🔴 | **Jede Darstellung ist vollständig interaktiv.** Es gibt kein Bild, das man nur ansehen kann. Anklickbar ist mindestens: die Stelle im Satz, das gezeigte Element, und — wo vorhanden — die Zwischenstufe. | `pruefe_diagramme.js` (Stellenwahl) |
| **A-3** | 🔴 | **Alles rechnet live am eingegebenen Beispiel.** Keine vorberechneten Zahlen, keine Beispieldaten, keine Näherung ohne Kennzeichnung. Ändert der Anwender den Satz, ändert sich jede Zahl. | — *(zu bauen)* |
| **A-4** | 🔴 | **Jeder Parameter ist einstellbar, und die Wirkung ist sofort sichtbar.** Temperatur, Top-k, Top-p, Schicht, Kopf, Stelle, Eingriff — was das Modell steuert, gehört als Bedienelement ins Bild, und zwar **über** die Anschauung: das Bedienelement ist die Ursache dessen, was darunter steht. | `pruefe_bedienung.js` *(seit 14.08.2026, bisher nur für die Vorhersage-Kachel)* |
| **A-5** | 🔴 | **Jedes Diagramm sagt selbst, worauf es rechnet** (Bezug), **was zu sehen ist** (Aussage, mit Zahlen aus derselben Antwort) und **wie die Achsen heißen**. | `pruefe_diagramme.js` |
| **A-6** | 🔴 | **Der Klick kommt in JEDEM Bild an.** Wer oben ein Stück wählt, findet es unten markiert — in jeder Anschauung der Seite. | `pruefe_diagramme.js` |
| **A-7** | 🟠 | **Erklärung vor dem Beispiel**, auf jeder Kachelseite. Erklärungen sind aufklappbar — der Anwender hält Vorlesungen und braucht sie, aber nicht dauernd vor Augen. | — |
| **A-8** | 🟠 GELOCKT | **Die Gliederung bleibt bei Kacheln.** Der Demonstrator ist **kein** durchgehender Fluss über eine Seite (wie das Vorbild), sondern bleibt eine Folge eigenständiger Kacheln mit rotem Faden. *(Entscheidung des Anwenders, 12.08.2026.)* | — |
| **A-9** | 🟠 GELOCKT | **Animation, wo sie etwas erklärt.** Zustandswechsel laufen als Bewegung, nicht als Sprung — vor allem beim Aufklappen einer Herleitung und beim Wechsel gezeigter Werte. Maßstab ist das Vorbild: 0,4–0,5 s, weiches Ein- und Auslaufen. **Wo eine Animation nichts erklärt, unterbleibt sie** — Bewegung ist Mittel, nicht Schmuck. *(Entscheidung des Anwenders, 12.08.2026.)* | — |

## B — Was gezeigt wird

| ID | Grad | Regel | Gate |
|---|---|---|---|
| **B-1** | 🔴 | **Keine gesetzten Zahlen.** Jede Zahl kommt aus dem Modell oder aus einer Messung. Näherungen werden als solche benannt. Eine Stichprobe wird als Stichprobe beschriftet („128 von 2.048 Zahlen gezeigt"). | `pruefe_rechnung.py` |
| **B-2** | 🔴 | **Ein beschädigtes Modell steht an JEDEM Bild, das damit gerechnet hat.** Sonst hält man die Zahlen für die echten. | `pruefe_diagramme.js` |
| **B-3** | 🟠 | **Ein Satz für die ganze Seite, eine Stelle für die ganze Seite.** Kein Bedienelement ohne Wirkung auf das, was darunter steht. | `pruefe_diagramme.js` |
| **B-4** | 🟠 | **Jede Anschauung braucht einen Befund** — einen Satz, der sagt, was zu sehen ist, mit Zahlen aus derselben Antwort. | — |

## C — Wie es aussieht

| ID | Grad | Regel | Gate |
|---|---|---|---|
| **C-1** | 🔴 GELOCKT | **Farbe sagt das BAUTEIL, Helligkeit sagt den WERT — und alle Bauteilfamilien sind kalt.** Jedes Bauteil des Modells hat seine eigene Farbfamilie; innerhalb der Familie trägt die Helligkeit den Messwert. **Die Auswahl ist die einzige warme Farbe** und kommt in keiner Wertekennlinie vor. Deshalb sind alle Familien kalt — das Vorbild färbt Key **rot**, was bei uns mit der Auswahl kollidieren würde. *(Entscheidung des Anwenders, 12.08.2026, gegen die Vorbild-Palette; re-gelockt am 20.08.2026 — siehe C-1b.)* | — *(zu bauen)* |
| **C-1a** | 🟠 | **Die Familien**: Query **indigo** · Key **teal** · Value **cyan** · Feedforward **violett** · Aufmerksamkeit **blau** · Embedding/Residualstrom **schiefergrau**. Jede Familie ist ein Verlauf, keine Einzelfarbe. | — |
| **C-1b** | 🟠 GELOCKT | **Die Richtung des Verlaufs und der Farbwert der Auswahl hängen an der FASSUNG, nicht am Bauteil.** Es gibt zwei Fassungen: **hell** (Hörsaal, Standard) und **dunkel** (Bildschirm). Der Verlauf läuft immer von *wenig Abstand zum Grund* nach *viel Abstand zum Grund* — auf dunklem Grund also dunkel→hell, auf hellem hell→dunkel. Die Auswahl ist auf dunklem Grund **Gelb `#ffc000`** (11,5:1), auf hellem **Bernstein `#b45309`** (5,02:1); dasselbe Gelb hätte auf Weiß 1,64:1 und wäre unlesbar. **Alle Farbwerte beider Fassungen stehen in `web/palette.js` und nirgends sonst** — ein fester Farbwert in einer Zeichendatei wirkt nur in einer Fassung und ist damit ein Fehler. *(Entscheidung des Anwenders, 19./20.08.2026.)* | `pruefe_kontrast.js` *(prüft beide Fassungen)* |
| **C-2** | 🟠 | Design nach 3-fls.ai. **Weißer Text nie auf `#01AEED`, sondern auf `#0A6189`.** Umgekehrt gilt: `#01AEED` ist auf **hellem** Grund keine Schriftfarbe (2,54:1) — dort trägt `--marke-text` = `#0A6189`. Als Fläche, Rand und Reglerfarbe bleibt das Cyan in beiden Fassungen. | `pruefe_kontrast.js` |
| **C-3** | 🟠 | **Keine nativen Browser-Dialoge.** | — |

## D — Wie gearbeitet wird

| ID | Grad | Regel | Folge |
|---|---|---|---|
| **D-1** | 🔴 | **Erst fragen und diskutieren, dann bauen.** Umfang, Form und Verortung sind Entscheidungen des Anwenders, nicht Auslegungssache. **Am 12.08.2026 dreimal in Folge gebrochen** — es entstanden drei verschiedene Darstellungen, von denen zwei nicht gewollt waren. | sofortiger Stopp |
| **D-2** | 🔴 | **Alles ist versioniert.** Kein Umbau ohne Commit davor. Ein Fehlversuch kostet ein `git checkout`, nicht eine Sitzung. *(Seit Commit `16797b8` erfüllt; die 13 Runden davor lagen ungesichert.)* | sofortiger Stopp |
| **D-3** | 🔴 | **Ein punktueller Befund meint die Klasse, nicht die Stelle.** Erst bestimmen, wo dasselbe noch gilt, dann überall beheben, dann ein Gate bauen. | — |
| **D-4** | 🔴 | **Vor jeder Rückmeldung laufen die betroffenen Prüfer**, und ihr Ergebnis wird genannt. Bei Änderungen an der Oberfläche zusätzlich selbst im Browser nachsehen. | — |
| **D-5** | 🔴 | **Sammelt der Anwender Befunde** („erstmal sammeln"): zuhören und mitschreiben, keine Rückfragen, nichts bauen, bis er fertig ist. | — |
| **D-6** | 🔴 | **PowerPoint wird nie automatisiert. Die Dropbox ist tabu.** | sofortiger Stopp |

---

## Offene Punkte dieses Entwurfs

1. **A-3 hat kein Gate.** „Alles rechnet live am eingegebenen Beispiel" ist
   bisher Absicht, nicht geprüft. Ein Gate müsste je Kachel feststellen:
   ändert sich bei geändertem Satz jede Zahl?
2. **A-4 hat seit dem 14.08.2026 ein Gate, aber nur für EINE Kachel.**
   `pruefe_bedienung.js` prüft die Vorhersage-Kachel (Temperaturregler,
   Verfahrenswahl, top-p-Regler, Zeilenwahl, Auge). Die übrigen Kacheln —
   Schicht- und Kopfwahl, Eingriffe, Weiterschreiben — sind noch ungeprüft.
3. **C-1 hat kein Gate.** Eine warme Farbe in einer Wertekennlinie fiele
   heute niemandem auf. *(C-1b hat seit dem 20.08.2026 eines:
   `pruefe_kontrast.js` läuft über beide Fassungen. Es prüft aber den
   KONTRAST, nicht die Farbfamilie — eine warme Farbe in einer Kennlinie
   käme immer noch durch.)*
5. **Query und Feedforward sind in der DUNKLEN Fassung kaum zu
   unterscheiden.** Gemessen am 20.08.2026 als Abstand im CIE-Lab-Raum:
   ΔE 11,3 zwischen den beiden Erkennungsfarben (`#818cf8` gegen `#a78bfa`).
   Unter ΔE 20 wird es im Bild schwierig. Die helle Fassung erreicht an
   ihrer engsten Stelle ΔE 21,2. Die dunkle Fassung wurde bei der
   Umstellung **bewusst nicht angefasst**, weil dafür keine Abnahme
   vorliegt — offen zur Entscheidung.
4. ~~**Welche Parameter gehören in welche Kachel?**~~ *Für die Vorhersage
   entschieden (14.08.2026): Temperatur, Schnittverfahren und Schnittwert
   stehen dort über der Tafel und schreiben in denselben Zustand wie das
   Weiterschreiben — ein Parameter, ein Wert, zwei Orte, an denen man ihn
   verstellen kann. Für die übrigen Kacheln weiterhin offen.*
