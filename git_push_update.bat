@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Pushing updates to GitHub
echo ========================================
echo.

:: Always run from the folder this script lives in
cd /d "%~dp0"

:: Make sure this is actually a git repo
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ERROR: This folder is not a git repository.
    pause
    exit /b 1
)

:: Check if there are changes
git status --porcelain | findstr . > nul
if errorlevel 1 (
    echo No changes to commit.
    pause
    exit /b 0
)

:: Detect current branch instead of hardcoding "main"
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set branch=%%b
if "%branch%"=="" (
    echo ERROR: Could not detect current branch.
    pause
    exit /b 1
)

:: Ask for commit message
set /p commit_msg="Enter commit message (or press Enter for auto): "
if "%commit_msg%"=="" (
    set commit_msg=Update %date% %time%
)

:: Write message to a temp file so special characters (& ^ | %% " etc.) can't break the commit
set "msgfile=%temp%\commit_msg_%random%.txt"
echo !commit_msg! > "%msgfile%"

:: Add
git add .
if errorlevel 1 (
    echo ERROR: git add failed.
    del "%msgfile%" >nul 2>&1
    pause
    exit /b 1
)

:: Commit
git commit -F "%msgfile%"
if errorlevel 1 (
    echo ERROR: git commit failed ^(nothing staged, or another issue^).
    del "%msgfile%" >nul 2>&1
    pause
    exit /b 1
)
del "%msgfile%" >nul 2>&1

:: Pull latest changes first so push isn't rejected as non-fast-forward
echo.
echo Syncing with origin/%branch% before push...
git fetch origin
git pull --rebase origin %branch%
if errorlevel 1 (
    echo.
    echo ERROR: git pull --rebase hit a conflict or failed.
    echo Resolve the conflict manually in the listed file(s), then run:
    echo    git add .
    echo    git rebase --continue
    echo Then re-run this script to push.
    pause
    exit /b 1
)

:: Push to whatever branch we're actually on
echo.
echo Pushing to branch: %branch%
git push -u origin %branch%
if errorlevel 1 (
    echo ERROR: git push failed. Check your network/remote/auth.
    pause
    exit /b 1
)

echo.
echo Done! Changes pushed to origin/%branch%.
pause
