Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Pushing updates to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if there are changes
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "No changes to commit." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Ask for commit message
$commit_msg = Read-Host "Enter commit message (or press Enter for auto)"
if (-not $commit_msg) {
    $commit_msg = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

# Add, commit, push
git add .
git commit -m $commit_msg
git push -u origin main

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Read-Host "Press Enter to exit"