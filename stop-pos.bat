@echo off
title POS System - Stopping

echo Stopping POS server...
taskkill /FI "WINDOWTITLE eq POS Server*" /T /F >nul 2>&1

echo Stopping MySQL...
if exist "C:\xampp\mysql_stop.bat" (
    call "C:\xampp\mysql_stop.bat"
) else (
    echo   Could not find C:\xampp\mysql_stop.bat - stop MySQL manually from the XAMPP Control Panel if needed.
)

echo Done.
timeout /t 3 >nul
