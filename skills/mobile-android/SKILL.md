---
name: mobile-android
description: "Android app security testing skill. APK decompilation, static analysis, sensitive data discovery, manifest analysis, and network traffic interception. Tools: apktool, jadx, adb, frida, mobsf. Triggers: 'android pentest', 'apk analysis', 'android security', 'jadx', 'apktool', 'android app'."
---

# Android Application Security Testing

You are performing **Android application security testing**. This covers static analysis (APK decompilation) and dynamic analysis (runtime behavior).

## Setup Requirements

1. Android device or emulator connected
2. ADB debugging enabled on device
3. frida-server matching device arch pushed to device
4. Burp/mitmproxy certificate installed as system CA (for HTTPS interception)

```bash
# Verify device connection
adb devices
adb shell uname -m   # check arch for frida-server

# Push frida-server
adb push frida-server /data/local/tmp/
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "/data/local/tmp/frida-server &"
```

## Workflow

### Phase 1: APK Acquisition

```bash
# Pull APK from device (if already installed)
adb shell pm list packages | grep -i target
adb shell pm path com.target.app
adb pull /data/app/com.target.app-1.apk ./target.apk

# Or from device storage
adb pull /sdcard/Download/target.apk ./target.apk
```

### Phase 2: Static Analysis — Manifest

```bash
# Decompile APK
apktool d target.apk -o ./decompiled/
# Resources, AndroidManifest.xml, smali code in ./decompiled/

# Analyze AndroidManifest.xml
cat decompiled/AndroidManifest.xml | grep -E \
  "(exported|permission|debuggable|allowBackup|android:networkSecurityConfig)"

# Key checks:
# android:debuggable="true" — debug mode (dangerous in prod)
# android:allowBackup="true" — app data in ADB backups
# exported="true" — component accessible to other apps
# android:usesCleartextTraffic="true" — HTTP allowed
```

### Phase 3: Static Analysis — Decompiled Java (JADX)

```bash
# Decompile to Java source
jadx -d ./jadx-output/ target.apk

# Search for sensitive data
grep -r "password\|passwd\|secret\|api_key\|apikey\|token\|private_key" ./jadx-output/ --include="*.java" -l
grep -r "http://\|ftp://" ./jadx-output/ --include="*.java"   # cleartext URLs
grep -r "AES\|DES\|RC4\|MD5\|SHA1" ./jadx-output/ --include="*.java"  # weak crypto

# Find hardcoded credentials
grep -rE "(\"password\"\s*[:=]\s*\"[^\"]+\")" ./jadx-output/ --include="*.java"
grep -rE "(api[_-]?key|client[_-]?secret|access[_-]?token)" ./jadx-output/ --include="*.java" -i

# Find WebView vulnerabilities
grep -r "setJavaScriptEnabled\|addJavascriptInterface\|WebViewClient\|shouldOverrideUrlLoading" \
  ./jadx-output/ --include="*.java" -l
```

### Phase 4: Sensitive Data in Resources

```bash
# Check strings.xml for hardcoded values
grep -iE "(key|secret|password|token|api|endpoint|url)" decompiled/res/values/strings.xml

# Check shared preferences, databases
find decompiled/ -name "*.db" -o -name "*.sqlite" 2>/dev/null

# Check network security config
cat decompiled/res/xml/network_security_config.xml 2>/dev/null
# Look for: cleartextTrafficPermitted, base-config, trust-anchors
```

### Phase 5: Dynamic Analysis — Device Shell

```bash
# Access device filesystem (root required)
adb shell
# Navigate to app data
cd /data/data/com.target.app/
ls -la
# Check for:
# shared_prefs/*.xml   — preferences (often contains secrets)
# databases/           — SQLite databases
# files/               — app files
# cache/               — cached data

# Pull entire app data directory
adb shell "run-as com.target.app tar cf - /data/data/com.target.app/ 2>/dev/null" | tar xf -
```

### Phase 6: Dynamic Analysis — Frida Instrumentation

```bash
# List installed apps
frida-ps -U -a -i | grep -i target

# SSL pinning bypass (one-liner)
objection -g com.target.app explore --startup-command "android sslpinning disable"

# Or with frida-script
frida -U -f com.target.app -l ssl-bypass.js --no-pause

# Common frida scripts:
# SSL bypass: https://codeshare.frida.re/@pcipolloni/universal-android-ssl-pinning-bypass-with-frida/
# Root bypass: https://codeshare.frida.re/@dzonerzy/fridantiroot/

# Trace all network calls
frida-trace -U -i "SSL_write" -i "SSL_read" com.target.app

# Hook specific method
cat > hook.js << 'EOF'
Java.perform(function() {
  var MainActivity = Java.use('com.target.app.MainActivity');
  MainActivity.login.implementation = function(user, pass) {
    console.log('[*] login called: user=' + user + ' pass=' + pass);
    return this.login(user, pass);
  };
});
EOF
frida -U -f com.target.app -l hook.js
```

### Phase 7: Traffic Interception

```bash
# Set up Burp proxy on host
# Configure Android proxy: Settings > WiFi > Proxy > Manual
# Host: <laptop-ip>, Port: 8080

# For apps with SSL pinning — use objection to bypass
objection -g com.target.app explore
# (inside objection REPL)
android sslpinning disable

# Verify interception
curl -x http://localhost:8080 https://api.target.com/v1/user
```

### Phase 8: MobSF Automated Analysis

```bash
# Start MobSF
cd Mobile-Security-Framework-MobSF/
python manage.py runserver 0.0.0.0:8000

# Upload via REST API
curl -F "file=@target.apk" http://localhost:8000/api/v1/upload \
  -H "Authorization: <api-key>" | jq '.hash'

# Request scan
curl -X POST http://localhost:8000/api/v1/scan \
  -H "Authorization: <api-key>" \
  -d "hash=<hash-from-upload>"

# Download report
curl http://localhost:8000/api/v1/download_pdf \
  -H "Authorization: <api-key>" \
  -d "hash=<hash>" -o mobsf-report.pdf
```

## Output Structure

```
engagement/mobile/android/
├── target.apk                  # Original APK
├── decompiled/                 # apktool output
├── jadx-output/                # Java source
├── strings-sensitive.txt       # Hardcoded secrets
├── manifest-analysis.txt       # Manifest findings
├── app-data/                   # Pulled device data
├── traffic/                    # Captured HTTP(S) traffic
└── mobsf-report.pdf            # Automated scan report
```

## Next Phase

Pass findings to `mobile-dynamic` for deeper runtime testing or `mobile-report` for final report.
