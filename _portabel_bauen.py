# -*- coding: utf-8 -*-
"""Baut die mitnehmbare Python-Umgebung im Verzeichnis auf.

Der Demonstrator soll sich zwischen Rechnern kopieren lassen und ohne
Internet laufen. Dazu darf er nicht auf die Projekt-.venv zurueckgreifen,
die im uebergeordneten Verzeichnis liegt und dort bleibt.

Verfahren: eine eigenstaendige Python-Ausgabe (embeddable, rund 10 MB) liegt
bereits unter `python\\`. Dieses Skript ermittelt, WELCHE Pakete der Server
tatsaechlich braucht — durch Import und Auswertung von `sys.modules`, nicht
durch Raten — und kopiert genau die hinueber.

Aufruf mit der PROJEKT-Umgebung:
    ..\\.venv\\Scripts\\python.exe _portabel_bauen.py [--nur-messen]
"""
from __future__ import annotations

import importlib
import shutil
import sys
import sysconfig
from pathlib import Path

HIER = Path(__file__).resolve().parent
ZIEL = HIER / "python" / "Lib" / "site-packages"
QUELLE = Path(sysconfig.get_paths()["purelib"])

# Was der Server importiert. Alles Weitere ergibt sich als Abhaengigkeit.
EINSTIEGE = [
    "torch", "transformers", "safetensors", "tokenizers",
    "fastapi", "uvicorn", "pydantic", "starlette", "numpy",
]

# Wird erst zur Laufzeit nachgeladen und taucht beim blossen Import nicht
# in sys.modules auf — nachgetragen, weil der Server sonst erst auf dem
# fremden Rechner scheitert und dort niemand nachinstallieren kann.
NACHZIEHEN = [
    "regex", "requests", "certifi", "charset_normalizer", "idna", "urllib3",
    "filelock", "fsspec", "huggingface_hub", "packaging", "yaml", "tqdm",
    "typing_extensions", "sympy", "mpmath", "networkx", "jinja2", "markupsafe",
    "anyio", "sniffio", "h11", "click", "colorama", "annotated_types",
    "pydantic_core", "typing_inspection", "dotenv", "hf_xet", "hf_transfer",
]

# Nicht mitnehmen: gross und fuer den Server ohne Bedeutung.
NIEMALS = {
    "pandas", "matplotlib", "pyarrow", "scipy", "sklearn", "IPython",
    "notebook", "jupyter", "jupyter_core", "jupyterlab", "nbformat",
    "nbconvert", "pytest", "_pytest", "datasets", "peft", "accelerate",
    "seaborn", "plotly", "sqlalchemy", "PIL", "cv2", "torchvision",
    "torchaudio", "triton", "locust", "gevent",
}


def top_level(modulname: str) -> str:
    return modulname.split(".", 1)[0]


def messen() -> set[str]:
    vorher = set(sys.modules)
    for name in EINSTIEGE:
        try:
            importlib.import_module(name)
        except Exception as e:                                   # noqa: BLE001
            print(f"  ! {name} nicht importierbar: {e}")
    gebraucht: set[str] = set()
    for name, modul in list(sys.modules.items()):
        # NICHT getattr benutzen: transformers laedt Untermodule faul nach und
        # loest bei jedem Attributzugriff Importe aus — beim Messen wuerde so
        # halb torchvision mitgezogen und der Lauf abgebrochen. Der Blick
        # direkt ins Modul-Dict umgeht jedes __getattr__.
        eigen = getattr(modul, "__dict__", None)
        if not isinstance(eigen, dict):
            continue
        datei = eigen.get("__file__") or ""
        pfad = eigen.get("__path__")
        if not datei and pfad:
            try:
                datei = list(pfad)[0]
            except Exception:                                    # noqa: BLE001
                datei = ""
        if not datei:
            continue
        try:
            Path(datei).resolve().relative_to(QUELLE)
        except (ValueError, OSError):
            continue
        gebraucht.add(top_level(name))
    for n in NACHZIEHEN:
        gebraucht.add(n)
    return {g for g in gebraucht if g not in NIEMALS and not g.startswith("_")}


def _verteilungen() -> dict[str, list[str]]:
    """Zuordnung Import-Name -> Namen der Distributionen.

    Der Import-Name ist oft NICHT der Paketname: `yaml` kommt aus `PyYAML`,
    `dotenv` aus `python-dotenv`, `PIL` aus `Pillow`. Wer die Metadaten ueber
    Namensmuster sucht, laesst genau diese Faelle liegen — und transformers
    bricht dann auf dem fremden Rechner mit „No package metadata was found
    for pyyaml“ ab, obwohl die Bibliothek selbst laengst dabei ist.
    """
    from importlib import metadata
    try:
        return metadata.packages_distributions()
    except Exception:                                            # noqa: BLE001
        return {}


_VERTEILUNG = _verteilungen()


def eintraege_fuer(paket: str) -> list[Path]:
    """Verzeichnis oder Einzeldatei des Pakets plus seine Metadaten."""
    treffer: list[Path] = []
    d = QUELLE / paket
    if d.is_dir():
        treffer.append(d)
    f = QUELLE / (paket + ".py")
    if f.is_file():
        treffer.append(f)

    muster = {paket + "-*.dist-info", paket + "-*.egg-info",
              paket.replace("_", "-") + "-*.dist-info",
              paket.replace("-", "_") + "-*.dist-info",
              paket + ".libs"}
    for dist in _VERTEILUNG.get(paket, []):
        muster.add(dist + "-*.dist-info")
        muster.add(dist.replace("-", "_") + "-*.dist-info")
        muster.add(dist.replace("_", "-") + "-*.dist-info")
    for m in muster:
        treffer.extend(QUELLE.glob(m))
    return sorted(set(treffer))


def groesse(p: Path) -> int:
    if p.is_file():
        return p.stat().st_size
    return sum(x.stat().st_size for x in p.rglob("*") if x.is_file())


def main() -> None:
    nur_messen = "--nur-messen" in sys.argv
    print(f"Quelle: {QUELLE}")
    print(f"Ziel  : {ZIEL}")
    print("")
    pakete = sorted(messen())
    print(f"{len(pakete)} Pakete gebraucht:")

    gesamt = 0
    fehlend = []
    plan: list[tuple[Path, int]] = []
    for p in pakete:
        eintraege = eintraege_fuer(p)
        if not eintraege:
            fehlend.append(p)
            continue
        g = sum(groesse(e) for e in eintraege)
        gesamt += g
        plan.extend((e, groesse(e)) for e in eintraege)
        if g > 5_000_000:
            print(f"   {p:24s} {g/1048576:8.1f} MB")
    print(f"   {'(uebrige zusammen)':24s} "
          f"{(gesamt - sum(g for _, g in plan if g > 5_000_000))/1048576:8.1f} MB")
    print(f"   {'GESAMT':24s} {gesamt/1073741824:8.2f} GB")
    if fehlend:
        print(f"\n   nicht gefunden (unkritisch, wenn eingebaut): {', '.join(fehlend)}")

    if nur_messen:
        print("\nnur gemessen — nichts kopiert.")
        return

    ZIEL.mkdir(parents=True, exist_ok=True)
    print("\nkopiere …")
    for n, (quelle, _g) in enumerate(plan, 1):
        ziel = ZIEL / quelle.name
        if ziel.exists():
            continue
        if quelle.is_dir():
            shutil.copytree(quelle, ziel,
                            ignore=shutil.ignore_patterns("__pycache__", "*.pyc",
                                                          "test", "tests"))
        else:
            shutil.copy2(quelle, ziel)
        if n % 15 == 0 or n == len(plan):
            print(f"   {n}/{len(plan)}")
    print("fertig.")


if __name__ == "__main__":
    main()
