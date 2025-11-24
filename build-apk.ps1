# Build APK Script for BookMyVendor App
# Prerequisites: Node.js, npm, Android SDK, Java JDK

Write-Host "Building APK for BookMyVendor App..." -ForegroundColor Green

function Load-DotEnv {
    param(
        [string]$Path = ".env"
    )

    if (-not (Test-Path $Path)) {
        return
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) {
            return
        }

        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim().Trim("'`"")
            if (-not [string]::IsNullOrEmpty($key)) {
                if (-not (Get-Item -Path Env:$key -ErrorAction SilentlyContinue)) {
                    Set-Item -Path Env:$key -Value $value | Out-Null
                }
            }
        }
    }
}

Load-DotEnv

if (-not $env:EXPO_PUBLIC_SUPABASE_URL -or -not $env:EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    Write-Host "Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (via .env or current shell) before building." -ForegroundColor Red
    exit 1
}

# Step 1: Install dependencies
Write-Host "`nStep 1: Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 2: Generate native Android project
Write-Host "`nStep 2: Generating native Android project..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate Android project" -ForegroundColor Red
    exit 1
}

# Step 3: Build APK using Gradle
Write-Host "`nStep 3: Building APK with Gradle..." -ForegroundColor Yellow
cd android
.\gradlew.bat assembleRelease
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build APK" -ForegroundColor Red
    cd ..
    exit 1
}

# Step 4: Locate the APK
Write-Host "`nStep 4: APK build completed!" -ForegroundColor Green
$apkPath = "app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    $fullPath = (Resolve-Path $apkPath).Path
    Write-Host "APK location: $fullPath" -ForegroundColor Cyan
    Write-Host "`nAPK file size: $((Get-Item $fullPath).Length / 1MB) MB" -ForegroundColor Cyan
} else {
    Write-Host "APK file not found at expected location: $apkPath" -ForegroundColor Yellow
}

cd ..

