@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    py -3 -m venv .venv
    if errorlevel 1 goto :failed
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto :failed
)
".venv\Scripts\python.exe" -c "import fastapi, uvicorn, httpx, pydantic, dotenv, multipart" >nul 2>nul
if errorlevel 1 (
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto :failed
)
echo.
echo Atlas: http://127.0.0.1:8000
echo Press Ctrl+C to stop. Open the address above in your browser.
".venv\Scripts\python.exe" run.py
if errorlevel 1 goto :failed
exit /b 0
:failed
echo.
echo Atlas could not start. Read the error above and the README troubleshooting section.
pause
exit /b 1
