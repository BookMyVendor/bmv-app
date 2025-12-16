# Clear Expo and Metro bundler cache
Write-Host "Clearing Expo and Metro bundler cache..." -ForegroundColor Yellow

# Clear Metro bundler cache
if (Test-Path "$env:TEMP\metro-*") {
    Remove-Item "$env:TEMP\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Cleared Metro temp cache" -ForegroundColor Green
}

# Clear Expo cache
if (Test-Path "$env:TEMP\expo-*") {
    Remove-Item "$env:TEMP\expo-*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Cleared Expo temp cache" -ForegroundColor Green
}

# Clear node_modules/.cache if it exists
if (Test-Path "node_modules\.cache") {
    Remove-Item "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Cleared node_modules cache" -ForegroundColor Green
}

# Clear .expo folder
if (Test-Path ".expo") {
    Remove-Item ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Cleared .expo folder" -ForegroundColor Green
}

Write-Host "`nCache cleared! Now restart your dev server with:" -ForegroundColor Cyan
Write-Host "  npx expo start --clear" -ForegroundColor White

