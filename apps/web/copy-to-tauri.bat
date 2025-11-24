@echo off
REM Script to copy ProofMesh desktop app files to Tauri project (Windows)
REM Usage: copy-to-tauri.bat C:\path\to\proofmesh-desktop

if "%~1"=="" (
    echo Error: Please provide the path to your Tauri project
    echo Usage: copy-to-tauri.bat C:\path\to\proofmesh-desktop
    exit /b 1
)

set TAURI_PROJECT=%~1

if not exist "%TAURI_PROJECT%" (
    echo Error: Directory %TAURI_PROJECT% does not exist
    exit /b 1
)

echo Copying files to %TAURI_PROJECT%...

REM Create directories if they don't exist
if not exist "%TAURI_PROJECT%\src" mkdir "%TAURI_PROJECT%\src"
if not exist "%TAURI_PROJECT%\src\lib" mkdir "%TAURI_PROJECT%\src\lib"
if not exist "%TAURI_PROJECT%\src\components" mkdir "%TAURI_PROJECT%\src\components"

REM Copy desktop app files
echo + Copying desktop app components...
xcopy /E /I /Y src\desktop-app "%TAURI_PROJECT%\src\desktop-app"

echo + Copying desktop lib modules...
xcopy /E /I /Y src\lib\desktop "%TAURI_PROJECT%\src\lib\desktop"

echo + Copying SDK...
xcopy /E /I /Y src\lib\sdk "%TAURI_PROJECT%\src\lib\sdk"

echo + Copying utilities...
copy /Y src\lib\hash.ts "%TAURI_PROJECT%\src\lib\"
copy /Y src\lib\utils.ts "%TAURI_PROJECT%\src\lib\"

echo + Copying styles...
copy /Y src\index.css "%TAURI_PROJECT%\src\"

echo + Copying config files...
copy /Y tailwind.config.ts "%TAURI_PROJECT%\"
copy /Y vite.config.ts "%TAURI_PROJECT%\"

echo + Copying component library...
xcopy /E /I /Y src\components\ui "%TAURI_PROJECT%\src\components\ui"

echo.
echo All files copied successfully!
echo.
echo Next steps:
echo 1. cd %TAURI_PROJECT%
echo 2. Update package.json scripts (see DESKTOP_SETUP_GUIDE.md)
echo 3. Update index.html to point to src/desktop-app/main.tsx
echo 4. npm run tauri dev
