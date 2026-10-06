# Erasmus Web agent notes

- Frontend: React, TypeScript, TanStack Start, Tailwind and shadcn/ui; output must remain a static SPA.
- Never add a database or third-party backend service from the client.
- `src/lib/api/client.ts` is the single network client. Private requests use `X-Erasmus-Session` from sessionStorage.
- Never expose or accept model keys, server secrets, admin credentials, legacy bridge tokens, or internal model names in the UI.
- Login is server-authoritative through `/api/auth/login`; there is no demo or local-login fallback.
- Browser data must use the `erasmus:<user_id>:*` namespace. Sign-out clears that user's browser data.
- Do not execute code locally. Only call a server tool endpoint when it is present in the documented gateway contract.
- Treat model output as untrusted: sanitize rendered HTML/SVG and isolate HTML previews in sandboxed iframes.
- Public status requests deliberately bypass the private client and must send no session credentials.
- See `INTEGRATION_NOTES.md` for the active v5.4 contract and known server-side gaps.
