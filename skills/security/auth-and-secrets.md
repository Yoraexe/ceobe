# AUTH & SECRETS
1. Never commit `.env` files or hardcode API keys.
2. Hash passwords with bcrypt or Argon2. NEVER store plain text.
3. Keep JWT lifespans short (e.g., 15 mins) and use long-lived Refresh Tokens stored in HttpOnly cookies.