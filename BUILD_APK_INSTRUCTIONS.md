# Building APK Locally - Instructions

This guide will help you build an APK file for the BookMyVendor app without using Expo's cloud build services.

## Prerequisites

Before building the APK, ensure you have the following installed:

### 1. Node.js and npm
- Download and install Node.js from [https://nodejs.org/](https://nodejs.org/)
- Version 18.x or higher recommended
- Verify installation:
  ```powershell
  node --version
  npm --version
  ```

### 2. Java Development Kit (JDK)
- Install JDK 17 or higher
- Download from [https://adoptium.net/](https://adoptium.net/) or [Oracle JDK](https://www.oracle.com/java/technologies/downloads/)
- Set JAVA_HOME environment variable:
  ```powershell
  [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Java\jdk-17', 'User')
  ```

### 3. Android Studio and Android SDK
- Download and install Android Studio from [https://developer.android.com/studio](https://developer.android.com/studio)
- Install Android SDK (API level 33 or higher)
- Set ANDROID_HOME environment variable:
  ```powershell
  [System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\YourUsername\AppData\Local\Android\Sdk', 'User')
  ```
- Add to PATH:
  ```powershell
  $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
  ```

### 4. Supabase environment variables
- Create an `.env` file in the project root (use `.env.example` as a guide) and set:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```
- These values are embedded into the release bundle during `npx expo prebuild` and are required for the app to start without crashing.
- Whenever you change the `.env`, rerun `npx expo prebuild --platform android --clean` before building the APK.

## Build Steps

### Option 1: Using the Build Script (Recommended)

1. Open PowerShell in the project directory
2. Ensure the Supabase variables are available in the current shell:
   ```powershell
   $env:EXPO_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
   $env:EXPO_PUBLIC_SUPABASE_ANON_KEY = "your-anon-key"
   ```
   (The script will also attempt to load them from a local `.env` file.)
3. Run the build script:
   ```powershell
   .\build-apk.ps1
   ```

### Option 2: Manual Build Steps

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Generate native Android project:**
   ```powershell
   npx expo prebuild --platform android --clean
   ```

3. **Build the APK:**
   ```powershell
   cd android
   .\gradlew.bat assembleRelease
   ```

4. **Find your APK:**
   The APK will be located at:
   ```
   android\app\build\outputs\apk\release\app-release.apk
   ```

## Signing the APK (Optional)

For production releases, you should sign your APK:

1. Generate a keystore:
   ```powershell
   keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `android/gradle.properties` and add:
   ```
   MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
   MYAPP_RELEASE_KEY_ALIAS=my-key-alias
   MYAPP_RELEASE_STORE_PASSWORD=*****
   MYAPP_RELEASE_KEY_PASSWORD=*****
   ```

3. Update `android/app/build.gradle` to use the keystore for signing.

## Troubleshooting

### Issue: "npx is not recognized"
- Ensure Node.js is installed and added to PATH
- Restart your terminal/PowerShell after installing Node.js

### Issue: "gradlew.bat not found"
- Run `npx expo prebuild --platform android` first to generate the Android project

### Issue: "ANDROID_HOME not set"
- Set the ANDROID_HOME environment variable to your Android SDK path
- Restart your terminal after setting environment variables

### Issue: "JAVA_HOME not set"
- Set the JAVA_HOME environment variable to your JDK installation path
- Restart your terminal after setting environment variables

### Issue: Build fails with Gradle errors
- Ensure you have the correct Android SDK components installed
- Try cleaning the build: `cd android && .\gradlew.bat clean`

## APK Location

After successful build, your APK will be at:
```
android\app\build\outputs\apk\release\app-release.apk
```

This APK can be installed directly on Android devices or uploaded to Google Play Store.

