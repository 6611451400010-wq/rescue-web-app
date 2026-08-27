@echo off
echo ============================================
echo   1) Build web-project (Next.js)
echo ============================================
cd /d "%~dp0web-project"
call npm run build
if errorlevel 1 (
  echo.
  echo *** BUILD FAILED - stopping here. Scroll up to see the error. ***
  pause
  exit /b 1
)

echo.
echo ============================================
echo   2) Check M3.png in public/ and out/
echo ============================================
if exist "public\M3.png" (
  echo [FOUND] public\M3.png still exists
) else (
  echo [NOT FOUND] public\M3.png - good, it was removed
)
if exist "out\M3.png" (
  echo [FOUND] out\M3.png still exists - this means old M3.png got copied
) else (
  echo [NOT FOUND] out\M3.png - good
)

echo.
echo ============================================
echo   3) Rebuild worker-capacitor-app/dist
echo ============================================
cd /d "%~dp0worker-capacitor-app"
if exist dist rmdir /s /q dist
xcopy "..\web-project\out" dist /E /I /H /Y
copy /Y dist\worker.html dist\index.html

echo.
if exist "dist\M3.png" (
  echo [FOUND] dist\M3.png still exists
) else (
  echo [NOT FOUND] dist\M3.png - good, cleaned up
)

echo.
echo ============================================
echo   4) cap sync android
echo ============================================
call npx cap sync android

echo.
echo ============================================
echo   DONE. Now open Android Studio and Generate APKs.
echo ============================================
pause
