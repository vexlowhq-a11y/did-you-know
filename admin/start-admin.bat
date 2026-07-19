@echo off
cd /d "%~dp0"
echo Iniciando el panel de administracion de Did You Know?...
start "" http://localhost:4321
node server.js
pause
