---
name: tech-frida-hooking
description: "Frida dynamic instrumentation and hooking. Android/iOS SSL pinning bypass, method interception, memory patching, native hook, Java method override, argument/return value modification, runtime analysis. Triggers: 'frida', 'ssl pinning bypass', 'dynamic instrumentation', 'frida hook', 'android hooking', 'ios hooking', 'method interception', 'runtime patching', 'frida android', 'java hooking frida'."
---

# Frida Dynamic Instrumentation

SSL pinning bypass, method hooking, memory patching, argument/return manipulation.

## Install

```bash
pip install frida-tools frida --break-system-packages
# On device: adb push frida-server /data/local/tmp/ && adb shell chmod +x /data/local/tmp/frida-server

# List processes:
frida-ps -U      # USB device
frida-ps -D <device_id>

# Spawn + attach:
frida -U -f com.target.app     # spawn
frida -U -n com.target.app     # attach running
```

---

## Phase 1: Enumerate Target

```bash
# List loaded modules:
frida-ps -U -a   # apps with PID

# Device info:
adb devices
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release

# Frida REPL exploration:
frida -U -n com.target.app
> Process.enumerateModules().forEach(m => console.log(m.name, m.base))
> Process.enumerateRanges('r-x').forEach(r => console.log(r.base, r.size))
> Java.enumerateLoadedClasses({onMatch: n => console.log(n), onComplete: ()=>{}})
```

---

## Phase 2: SSL/TLS Pinning Bypass

```javascript
// script: ssl-bypass.js
Java.perform(function() {
    // OkHttp3 certificate pinner bypass:
    try {
        var CertificatePinner = Java.use("okhttp3.CertificatePinner");
        CertificatePinner.check.overload("java.lang.String", "java.util.List").implementation = function(hostname, certs) {
            console.log("[*] SSL Pinning bypassed for: " + hostname);
            return;
        };
    } catch(e) {}
    
    // TrustManager bypass:
    try {
        var X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
        var SSLContext = Java.use("javax.net.ssl.SSLContext");
        
        var TrustManagerImpl = Java.registerClass({
            name: "com.frida.TrustManager",
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function(chain, authType) {},
                checkServerTrusted: function(chain, authType) {},
                getAcceptedIssuers: function() { return []; }
            }
        });
        
        var SSLCtx = SSLContext.getInstance("TLS");
        SSLCtx.init(null, [TrustManagerImpl.$new()], null);
        SSLContext.getDefault.implementation = function() { return SSLCtx; };
    } catch(e) { console.log(e); }
    
    // Hostname verifier bypass:
    try {
        var HostnameVerifier = Java.use("javax.net.ssl.HttpsURLConnection");
        HostnameVerifier.setDefaultHostnameVerifier.implementation = function(v) {};
    } catch(e) {}
});
```

```bash
# Run SSL bypass:
frida -U -n com.target.app -l ssl-bypass.js --no-pause

# Universal SSL bypass script:
frida -U -n com.target.app --codeshare pcipolloni/universal-android-ssl-pinning-bypass-with-frida
```

---

## Phase 3: Java Method Hooking

```javascript
// Hook a specific Java method to log arguments and return value
Java.perform(function() {
    var TargetClass = Java.use("com.target.app.LoginManager");
    
    // Hook method:
    TargetClass.authenticate.implementation = function(username, password) {
        console.log("[*] authenticate() called");
        console.log("    username: " + username);
        console.log("    password: " + password);
        
        // Call original method:
        var result = this.authenticate(username, password);
        console.log("    result: " + result);
        return result;
    };
    
    // Overload method (multiple signatures):
    TargetClass.encrypt.overload("java.lang.String", "[B").implementation = function(data, key) {
        console.log("[*] encrypt() called with: " + data);
        var result = this.encrypt(data, key);
        console.log("    encrypted: " + result);
        return result;
    };
    
    // Static method:
    var CryptoUtil = Java.use("com.target.util.CryptoUtil");
    CryptoUtil.decrypt.implementation = function(ciphertext) {
        var result = this.decrypt(ciphertext);
        console.log("[*] decrypt() = " + result);  // intercept decrypted value
        return result;
    };
});
```

---

## Phase 4: Native Function Hooking

```javascript
// Hook native (C/C++) functions
var base = Module.findBaseAddress("libtarget.so");

// Hook by address:
Interceptor.attach(base.add(0x12345), {
    onEnter: function(args) {
        console.log("[*] Native func called");
        console.log("    arg0: " + args[0]);
        console.log("    arg1: " + Memory.readUtf8String(args[1]));
    },
    onLeave: function(retval) {
        console.log("    return: " + retval);
        retval.replace(1);  // change return value
    }
});

// Hook by export name:
var target_func = Module.findExportByName("libtarget.so", "check_license");
Interceptor.attach(target_func, {
    onEnter: function(args) {
        console.log("[*] check_license called");
    },
    onLeave: function(retval) {
        retval.replace(1);  // always return 1 = success
    }
});
```

---

## Phase 5: Memory Read/Write

```javascript
// Read memory:
var ptr = ptr("0x7fff1234");
console.log(Memory.readByteArray(ptr, 16).toHexString());
console.log(Memory.readUtf8String(ptr));
console.log(Memory.readU32(ptr));

// Write memory (patch value):
Memory.writeU32(ptr, 0x1337);
Memory.writeByteArray(ptr, [0x90, 0x90, 0x90, 0x90]);  // NOP patch

// Allocate + write string:
var newStr = Memory.allocUtf8String("patched_value");
// Pass newStr to function that expects a string pointer
```

---

## Phase 6: Extract Crypto Keys

```javascript
// Hook crypto operations to extract keys at runtime:
Java.perform(function() {
    // Android crypto API:
    var SecretKeySpec = Java.use("javax.crypto.spec.SecretKeySpec");
    SecretKeySpec.$init.overload("[B", "java.lang.String").implementation = function(keyBytes, algo) {
        console.log("[*] Key (" + algo + "): " + keyBytes.toString());
        return this.$init(keyBytes, algo);
    };
    
    // MessageDigest:
    var MessageDigest = Java.use("java.security.MessageDigest");
    MessageDigest.digest.overload("[B").implementation = function(data) {
        console.log("[*] Digest input: " + data.toString());
        var result = this.digest(data);
        console.log("[*] Digest output: " + result.toString());
        return result;
    };
    
    // Cipher.doFinal:
    var Cipher = Java.use("javax.crypto.Cipher");
    Cipher.doFinal.overload("[B").implementation = function(data) {
        console.log("[*] Cipher.doFinal mode: " + this.getOpmode());
        console.log("[*] Input: " + Java.array('byte', data));
        var result = this.doFinal(data);
        console.log("[*] Output: " + Java.array('byte', result));
        return result;
    };
});
```

---

## Phase 7: iOS Hooking

```javascript
// iOS ObjC method hook:
var hook = ObjC.classes.NSURLSession["- dataTaskWithRequest:completionHandler:"];

Interceptor.attach(hook.implementation, {
    onEnter: function(args) {
        var request = ObjC.Object(args[2]);
        console.log("URL: " + request.URL().absoluteString());
        
        var headers = request.allHTTPHeaderFields();
        if (headers) {
            console.log("Headers: " + headers.toString());
        }
    }
});

// Swift function hooking via mangled name:
var swift_func = Module.findExportByName(null, "_TFC7TargetApp7Manager12authenticatefSSS");
if (swift_func) {
    Interceptor.attach(swift_func, {
        onEnter: function(args) {
            console.log("[*] Swift auth called");
        }
    });
}
```

---

## Output

Save to `.omop/engagement/tech/frida/`:
- `intercepts.txt` — logged method calls and values
- `keys.txt` — extracted cryptographic keys
- `bypass-script.js` — working SSL bypass script
- `traffic.txt` — intercepted decrypted traffic

## Next Phase

→ `iot-firmware` for firmware analysis with extracted keys
→ `vuln-oauth` if mobile app uses OAuth
