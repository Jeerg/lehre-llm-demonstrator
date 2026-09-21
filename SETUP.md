# LLM-Demonstrator - Einrichtung (schlanke Fassung)

Dieses Repo enthaelt nur den **Quellcode**. Die grossen Teile - die Python-Umgebung
mit PyTorch und die Modellgewichte - sind **nicht** dabei und werden einmalig selbst
eingerichtet. Danach laeuft alles lokal, ohne Internet.

## Voraussetzungen

- **Python 3.13** (empfohlen und getestet). Fuer 3.14 gibt es evtl. noch keine
  passenden PyTorch-Wheels; 3.12/3.13 sind der sichere Weg.
- Eine NVIDIA-GPU ist empfehlenswert (das Modell laeuft auch auf CPU, dann langsamer)
- ~5 GB Platz (Modell ~3,8 GB + PyTorch)
- **Windows:** in einen KURZEN Pfad klonen (z.B. `C:\dev\lehre-llm-demonstrator`).
  Sehr lange Pfade brechen die PyTorch/numpy-Installation ab (260-Zeichen-Grenze) -
  entweder kurzer Pfad oder Long-Path-Support aktivieren.

## 1) Virtuelle Umgebung anlegen

```
python -m venv .venv
.venv\Scripts\activate         (Windows)
# source .venv/bin/activate    (Linux/macOS)
```

## 2) Pakete installieren

PyTorch kommt aus dem passenden Index (nicht von PyPI - der Default-Wheel ist unter
Windows CPU-only):

```
# mit NVIDIA-GPU (CUDA 13.0):
pip install torch --index-url https://download.pytorch.org/whl/cu130
# ohne GPU (CPU):
# pip install torch

pip install -r requirements.txt
```

## 3) Modell laden (Qwen3-1.7B)

Das Modell kommt von Hugging Face in den Ordner `models/Qwen3-1.7B/`:

```
pip install "huggingface_hub[cli]"
huggingface-cli download Qwen/Qwen3-1.7B --local-dir models/Qwen3-1.7B
```

Danach muss `models/Qwen3-1.7B/config.json` existieren.

## 4) Starten

```
python -m uvicorn server.app:app --host 127.0.0.1 --port 8100
```

Dann im Browser: <http://127.0.0.1:8100/>

Das Modell wird beim ersten Aufruf geladen (etwa eine halbe Minute). Fenster offen
lassen; zum Beenden schliessen oder Strg+C.

## Was der Demonstrator zeigt

Jede Station eines Transformers wird sichtbar und ist einzeln nachgerechnet -
Tokenisierung, Embedding, Attention (Q/K/V, Kopf fuer Kopf), Feedforward, bis zur
Ausgabe. Eingriffe (Kopf/Schicht/Attention aus- und zuschalten) wirken sich direkt
auf das Ergebnis aus. Der JavaScript-Rechenkern ist auf PyTorch-Paritaet geprueft.

## Verifiziert

Diese Anleitung wurde aus einer frischen, leeren venv durchgespielt (Python 3.13,
`torch 2.14 (CPU)`, `transformers 5.17`): Installation laeuft durch, der Server
startet, `GET /api/gesundheit` meldet `{"bereit":true,"modell":"Qwen3-1.7B"}`, und
ein echter Forward-Pass (`POST /api/durchlauf`) liefert Attention, Logits und die
wahrscheinlichsten Folge-Tokens. Auf GPU ist der einzige Unterschied der Torch-Index
(`cu130` statt `cpu`) - so laeuft die mitgelieferte Referenzumgebung.
