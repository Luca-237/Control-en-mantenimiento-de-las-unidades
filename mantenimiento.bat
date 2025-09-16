@echo off
:: Inicia Git Bash
start "" "C:\Program Files\Git\bin\bash.exe"

:: Espera 20 segundos
timeout /t 7 /nobreak >nul

:: Ejecuta los comandos en Git Bash, se debe ubicar los directorios deseados

start "" "C:\Program Files\Git\bin\bash.exe" -c "cd ~/Desktop/programa\ mantenimiento/ && node servidor.js"
