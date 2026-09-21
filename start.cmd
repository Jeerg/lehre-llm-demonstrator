@echo off
rem ---------------------------------------------------------------------------
rem  LLM-Demonstrator starten.
rem
rem  Dieses Verzeichnis ist vollstaendig: Python-Umgebung, Modellgewichte,
rem  Server und Oberflaeche liegen alle darin. Es braucht kein Internet und
rem  keine Installation - kopieren und diese Datei doppelklicken.
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

rem  Zuerst die mitgelieferte Umgebung (python\python.exe). Das ist eine
rem  eigenstaendige Python-Ausgabe im Verzeichnis - sie ist der Grund, warum
rem  sich der Ordner ueberhaupt mitnehmen laesst.
set PYTHON=%~dp0python\python.exe
if not exist "%PYTHON%" set PYTHON=%~dp0python\Scripts\python.exe
rem  Notnagel fuer den Entwicklungsrechner, auf dem das Projekt daneben liegt.
if not exist "%PYTHON%" set PYTHON=%~dp0..\.venv\Scripts\python.exe
if not exist "%PYTHON%" (
  echo.
  echo   Keine Python-Umgebung gefunden.
  echo   Erwartet:  %~dp0python\python.exe
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0models" (
  echo.
  echo   Kein Modell gefunden. Erwartet wird ein Verzeichnis unter models\.
  echo.
  pause
  exit /b 1
)

echo.
echo   LLM-Demonstrator startet. Das Modell wird geladen, das dauert
echo   etwa eine halbe Minute.
echo.
echo   Dieses Fenster bitte offen lassen. Zum Beenden schliessen.
echo.

start "" http://127.0.0.1:8100/
"%PYTHON%" -m uvicorn server.app:app --host 127.0.0.1 --port 8100 --log-level warning

endlocal
