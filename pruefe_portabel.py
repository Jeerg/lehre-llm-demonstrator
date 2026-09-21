# -*- coding: utf-8 -*-
"""Prueft, ob sich dieses Verzeichnis wirklich mitnehmen laesst.

„Portabel“ ist keine Eigenschaft, die man behaupten kann — sie geht auf
genau die Weise verloren, die man beim Bauen nicht bemerkt: ein Verweis auf
eine Umgebung nebenan, ein Link statt einer Datei, eine Bibliothek aus dem
Netz. Dieses Skript sucht nach solchen Verweisen und meldet jeden.

Aufruf mit der MITGELIEFERTEN Umgebung:
    python\\python.exe pruefe_portabel.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
befunde: list[str] = []
zeilen: list[str] = []


def sagt(zeichen: str, text: str) -> None:
    zeilen.append(f"  {zeichen}  {text}")


def pruefe_umgebung() -> None:
    """Laeuft der Server aus dem Verzeichnis oder aus einer Umgebung daneben?"""
    py = HIER / "python" / "python.exe"
    if not py.exists():
        befunde.append("Die mitgelieferte Python-Umgebung fehlt (python\\python.exe).")
        sagt("FEHLT", "python\\python.exe")
        return
    sagt("ok", f"eigene Python-Umgebung vorhanden ({py.name})")

    if Path(sys.executable).resolve() != py.resolve():
        sagt("Hinweis", "gepruefft wird mit " + sys.executable +
             " — fuer den vollen Nachweis mit python\\python.exe aufrufen")
        return

    fremd = [p for p in sys.path if ".venv" in p.replace("/", "\\")]
    if fremd:
        befunde.append("Der Suchpfad zeigt in eine fremde Umgebung: " + "; ".join(fremd))
        sagt("FEHLER", "Suchpfad zeigt auf .venv")
    else:
        sagt("ok", "kein Verweis auf eine Umgebung ausserhalb des Verzeichnisses")

    basis = Path(sys.base_prefix).resolve()
    if HIER not in basis.parents and basis != (HIER / "python").resolve():
        befunde.append(f"Die Python-Basis liegt ausserhalb: {basis}")
        sagt("FEHLER", f"Python-Basis ausserhalb: {basis}")
    else:
        sagt("ok", "Python-Basis liegt im Verzeichnis")


def pruefe_verknuepfungen() -> None:
    """Ein Link zeigt woanders hin — beim Kopieren bleibt der Inhalt zurueck."""
    gefunden = []
    for wurzel, verzeichnisse, dateien in os.walk(HIER):
        for name in list(verzeichnisse) + dateien:
            p = Path(wurzel) / name
            try:
                if p.is_symlink() or (os.path.isdir(p) and
                                      os.readlink(p) if hasattr(os, "readlink") else False):
                    gefunden.append(p)
            except OSError:
                # readlink wirft, wenn es KEIN Link ist — genau der Normalfall
                pass
    # zusaetzlich der zuverlaessige Weg ueber die Windows-Attribute
    for wurzel, verzeichnisse, _dateien in os.walk(HIER):
        for name in verzeichnisse:
            p = Path(wurzel) / name
            try:
                if os.lstat(p).st_file_attributes & 0x400:      # REPARSE_POINT
                    gefunden.append(p)
            except (OSError, AttributeError):
                pass
    gefunden = sorted(set(gefunden))
    if gefunden:
        for p in gefunden[:8]:
            befunde.append(f"Verknuepfung statt echter Daten: {p.relative_to(HIER)}")
            sagt("FEHLER", f"Link: {p.relative_to(HIER)}")
    else:
        sagt("ok", "keine Verknuepfungen — alle Daten liegen wirklich hier")


def pruefe_modell() -> None:
    m = HIER / "models"
    if not m.is_dir():
        befunde.append("Kein models-Verzeichnis.")
        sagt("FEHLT", "models\\")
        return
    kandidaten = [k for k in m.iterdir() if (k / "config.json").exists()]
    if not kandidaten:
        befunde.append("Kein Modell mit config.json unter models\\.")
        sagt("FEHLT", "Modell unter models\\")
        return
    for k in kandidaten:
        gewichte = list(k.glob("*.safetensors")) + list(k.glob("*.bin"))
        summe = sum(g.stat().st_size for g in gewichte)
        if summe < 100_000_000:
            befunde.append(f"Die Gewichte von {k.name} wirken unvollstaendig "
                           f"({summe/1e6:.0f} MB).")
            sagt("FEHLER", f"{k.name}: nur {summe/1e6:.0f} MB Gewichte")
        else:
            sagt("ok", f"Modell {k.name}: {len(gewichte)} Dateien, "
                       f"{summe/1073741824:.2f} GB")


def pruefe_netzbezug() -> None:
    """Eine Oberflaeche, die eine Bibliothek nachlaedt, braucht Internet."""
    muster = re.compile(r"""(?:src|href)\s*=\s*["'](https?:)?//""", re.I)
    treffer = []
    for p in (HIER / "web").rglob("*"):
        if p.suffix.lower() not in (".html", ".js", ".css") or not p.is_file():
            continue
        if "vendor" in p.parts:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        for m in muster.finditer(text):
            treffer.append(f"{p.relative_to(HIER)}: {text[m.start():m.start()+60]!r}")
    if treffer:
        for t in treffer[:6]:
            befunde.append("Verweis ins Netz: " + t)
            sagt("FEHLER", "Netzverweis in " + t.split(":")[0])
    else:
        sagt("ok", "keine Verweise ins Netz in der Oberflaeche")

    vendor = HIER / "web" / "vendor"
    if vendor.is_dir():
        n = len(list(vendor.glob("*")))
        sagt("ok", f"{n} Bibliotheken liegen lokal unter web\\vendor")
    else:
        befunde.append("web\\vendor fehlt — die Bibliotheken werden nachgeladen.")
        sagt("FEHLER", "web\\vendor fehlt")


def pruefe_start() -> None:
    s = HIER / "start.cmd"
    if not s.exists():
        befunde.append("start.cmd fehlt.")
        sagt("FEHLT", "start.cmd")
        return
    text = s.read_text(encoding="utf-8", errors="ignore")
    erste = None
    for zeile in text.splitlines():
        if zeile.strip().lower().startswith("set python="):
            erste = zeile.strip()
            break
    if erste and "python\\python.exe" in erste:
        sagt("ok", "start.cmd nimmt zuerst die mitgelieferte Umgebung")
    else:
        befunde.append("start.cmd greift nicht zuerst auf python\\python.exe zu: "
                       + str(erste))
        sagt("FEHLER", "start.cmd nimmt zuerst: " + str(erste))


def groesse() -> None:
    summe = 0
    for p in HIER.rglob("*"):
        if p.is_file():
            try:
                summe += p.stat().st_size
            except OSError:
                pass
    sagt("Info", f"Verzeichnis insgesamt: {summe/1073741824:.2f} GB")


def main() -> None:
    print("Pruefung der Mitnehmbarkeit")
    print("Verzeichnis: " + str(HIER))
    print("")
    pruefe_umgebung()
    pruefe_verknuepfungen()
    pruefe_modell()
    pruefe_netzbezug()
    pruefe_start()
    groesse()
    print("\n".join(zeilen))
    print("")
    if befunde:
        print(f"{len(befunde)} BEFUND(E) — das Verzeichnis ist so NICHT mitnehmbar:")
        for b in befunde:
            print("  - " + b)
        sys.exit(1)
    print("Kein Befund. Das Verzeichnis laesst sich kopieren und laeuft ohne Internet.")


if __name__ == "__main__":
    main()
