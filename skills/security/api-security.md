# API SECURITY
1. **Rate Limiting:** Protect all endpoints, especially login/OTP, against brute-forcing (e.g., max 5 requests/min).
2. **CORS:** Strictly configure CORS origins. Never use `Access-Control-Allow-Origin: *` in production with credentials.