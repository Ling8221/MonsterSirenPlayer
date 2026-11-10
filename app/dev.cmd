@echo off
rem Load the Visual Studio C++ environment, then start Tauri dev.
rem Keep this file ASCII-only: cmd.exe reads batch files with the OEM code page,
rem and UTF-8 Chinese text inside .cmd breaks command parsing.
setlocal EnableExtensions
set "ROOT=%~dp0"
pushd "%ROOT%" || exit /b 1

set "VSPATH="
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" for /f "delims=" %%i in ('"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath') do set "VSPATH=%%i"
if not defined VSPATH if exist "%VSWHERE%" for /f "delims=" %%i in ('"%VSWHERE%" -latest -products * -property installationPath') do set "VSPATH=%%i"

if not defined VSPATH goto :novs
if not exist "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" goto :novs

echo [dev.cmd] Visual Studio: %VSPATH%
call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 goto :novs

call npm run tauri dev
set "CODE=%ERRORLEVEL%"
popd
exit /b %CODE%

:novs
echo [dev.cmd] Visual Studio C++ tools were not found.
echo           Install the "Desktop development with C++" workload, or run
echo           npm run tauri dev from "Developer PowerShell for VS 2022".
popd
exit /b 1
