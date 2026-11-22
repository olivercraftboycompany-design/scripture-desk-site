# Bibley inference Worker (prepared; not deployed)

This Worker is a free-tier proxy for the Scripture Desk study UI. It fetches only the requested KJV verses from Bolls.life, then sends that passage and the user's optional question to Groq's OpenAI-compatible `openai/gpt-oss-120b` endpoint. The Groq key is a Cloudflare Worker secret (`GROQ_API_KEY`) and must never be put in this repository or the static site.

## When account access is ready

1. Create/use a Cloudflare Workers Free account without adding a payment method or upgrading.
2. Create a Groq free API key without adding a payment method; save the key securely, then set it with `npx wrangler secret put GROQ_API_KEY` from this folder. Never commit it.
3. From this folder, run `npx wrangler deploy` and verify `GET /api/bibley/status` reports ready.
4. Test one study request from the deployed Worker with the allowed Scripture Desk origin and verify the JSON answer.
5. Only after the Worker works, change `ai-config.json` endpoint from the existing Modal URL to the deployed `workers.dev` URL; then verify status and a real answer from the live website. Keep Modal available for rollback.

Workers AI and Groq quotas are free-tier limits, not uptime guarantees. The rate-limit binding is approximate and location-local; Cloudflare CORS is not authentication. Keep the free plan only; requests past Groq's free quota should fail rather than being upgraded or charged.
