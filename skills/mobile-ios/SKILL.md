---
name: mobile-ios
description: "iOS app security testing skill. IPA analysis, jailbreak detection bypass, SSL pinning bypass, Keychain inspection, runtime class introspection, and traffic interception using frida, objection, and MobSF. Triggers: 'ios pentest', 'ipa analysis', 'ios security', 'frida ios', 'swift reverse', 'objc reverse', 'jailbreak bypass'."
---

# iOS Application Security Testing

You are performing **iOS application security testing**. Requires a jailbroken device or simulator with Frida gadget injection for dynamic analysis.

## Setup Requirements

- Jailbroken iOS device with Frida installed via Cydia/Sileo
- OR sideloaded IPA with embedded frida-gadget (non-jailbroken)
- SSH access to device over USB (iproxy/usbmux)
- Burp certificate installed as root CA in device settings

```bash
# Forward SSH over USB
iproxy 2222 22 &
ssh -p 2222 root@localhost   # default password: alpine

# Verify frida on device
frida-ps -U   # should list running processes
```

## Workflow

### Phase 1: IPA Acquisition & Unpacking

```bash
# Pull IPA from device (requires jailbreak)
scp -P 2222 root@localhost:/var/containers/Bundle/Application/<GUID>/<App>.app ./
# or use frida-ios-dump:
python3 dump.py -o target.ipa com.target.app

# Unpack IPA
unzip target.ipa -d ./ipa-contents/
ls ./ipa-contents/Payload/*.app/
```

### Phase 2: Static Analysis — Binary

```bash
# Check architecture
file ./ipa-contents/Payload/TargetApp.app/TargetApp
# Should be: Mach-O universal binary with 2 architectures (arm64, armv7)

# Extract strings
strings ./ipa-contents/Payload/TargetApp.app/TargetApp > strings-all.txt
grep -iE "(password|secret|api_key|token|endpoint|http://)" strings-all.txt > strings-interesting.txt

# Check for security flags
otool -hv ./ipa-contents/Payload/TargetApp.app/TargetApp | grep -i "PIE\|ALLOW_STACK_EXEC"
otool -l ./ipa-contents/Payload/TargetApp.app/TargetApp | grep -A5 "LC_ENCRYPTION"
# CRYPTID: 1 = encrypted (need decryption before analysis)
```

### Phase 3: Static Analysis — Entitlements & Info.plist

```bash
# Entitlements (capabilities granted to app)
codesign -dv --entitlements :- ./ipa-contents/Payload/TargetApp.app/TargetApp 2>/dev/null
# or on Linux:
ldid -e ./ipa-contents/Payload/TargetApp.app/TargetApp

# Key entitlements to check:
# com.apple.security.get-task-allow — allows debugger attach (dev-only)
# aps-environment — push notifications
# keychain-access-groups — keychain sharing

# Info.plist analysis
plutil -convert xml1 ./ipa-contents/Payload/TargetApp.app/Info.plist -o Info.xml
cat Info.xml | grep -E "(NSApp|NSBluetooth|NSCamera|NSLocation|NSMicro|NSPhoto|NSFace)"
# Overly broad permissions = privacy risk

# Transport Security
cat Info.xml | grep -A5 "NSAppTransportSecurity"
# NSAllowsArbitraryLoads = true → cleartext HTTP allowed
```

### Phase 4: Keychain Analysis

```bash
# On device (jailbroken) — dump keychain
ssh -p 2222 root@localhost

# Using keychain-dumper
/usr/bin/keychain-dumper > /tmp/keychain.txt
exit
scp -P 2222 root@localhost:/tmp/keychain.txt ./keychain-dump.txt

# Look for stored credentials
grep -iE "(password|token|key|secret)" keychain-dump.txt
```

### Phase 5: Dynamic Analysis — Objection / Frida

```bash
# Jailbreak detection bypass
objection -g com.target.app explore --startup-command "ios jailbreak disable"

# SSL pinning bypass
objection -g com.target.app explore --startup-command "ios sslpinning disable"

# Or combined:
objection -g com.target.app explore --startup-command \
  "ios jailbreak disable; ios sslpinning disable"

# Class dump (Objective-C)
objection -g com.target.app explore
# (inside REPL)
ios hooking list classes | grep -i "auth\|login\|crypto\|key"
ios hooking list methods --class AuthManager

# Hook method
ios hooking watch method "+[AuthManager validateToken:]" --dump-args --dump-return

# Swift class introspection (limited, but works for @objc methods)
ios hooking list classes | grep Target
```

### Phase 6: Frida Scripting (iOS)

```bash
# Dump all NSUserDefaults (may contain sensitive data)
frida -U -f com.target.app --no-pause -e \
  "ObjC.classes.NSUserDefaults.standardUserDefaults().dictionaryRepresentation()"

# Hook NSURLSession for traffic inspection
cat > ios-traffic.js << 'EOF'
Interceptor.attach(ObjC.classes.NSURLSession['- dataTaskWithRequest:completionHandler:'].implementation, {
  onEnter: function(args) {
    var request = new ObjC.Object(args[2]);
    console.log('[*] URL:', request.URL().absoluteString());
    console.log('[*] Method:', request.HTTPMethod());
    var body = request.HTTPBody();
    if (body) console.log('[*] Body:', ObjC.classes.NSString.alloc().initWithData_encoding_(body, 4).toString());
  }
});
EOF
frida -U -f com.target.app -l ios-traffic.js --no-pause
```

### Phase 7: MobSF — IPA Scan

```bash
# Upload IPA
curl -F "file=@target.ipa" http://localhost:8000/api/v1/upload \
  -H "Authorization: <api-key>" | jq '.hash'

# Trigger scan
curl -X POST http://localhost:8000/api/v1/scan \
  -H "Authorization: <api-key>" -d "hash=<hash>"

# Get JSON report
curl http://localhost:8000/api/v1/report_json \
  -H "Authorization: <api-key>" -d "hash=<hash>" | jq '.' > mobsf-ios-report.json
```

## Output Structure

```
engagement/mobile/ios/
├── target.ipa                  # IPA file
├── ipa-contents/               # Unpacked IPA
├── strings-interesting.txt     # Sensitive strings
├── keychain-dump.txt           # Keychain contents
├── Info.xml                    # Converted plist
├── entitlements.xml            # App entitlements
├── frida-hooks/                # Frida scripts used
└── mobsf-ios-report.json       # Automated scan
```

## Next Phase

Pass findings to `mobile-dynamic` for API testing or `mobile-report` for final report.
