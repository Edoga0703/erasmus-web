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
- Unsupported execution fences render as ordinary Markdown, never tool tasks — the documented gateway has no execution endpoint.
- Account deletion stays informational until an authenticated deletion contract exists — clearing browser data is not server-side account deletion.
- Chat deletion uses DELETE /api/workspace/chat?id= (server-confirmed); PDF/Excel text is extracted client-side (lazy-loaded pdfjs-dist/xlsx) and capped at 150k chars — the server has no binary ingest.
- Artifact previews use a shared browser-safe event contract and opaque-origin sandboxed iframes, including blob-tab wrappers, so model-authored scripts cannot access the app's session or storage.
- The artifact canvas loads a static, sandboxed preview wrapper and sends only document content via postMessage; this keeps Tailwind CDN inside the preview without relaxing the app's production CSP.
- In-chat search uses browser CSS Highlight ranges rather than rewriting React-owned text; streaming and sanitized markup stay intact.
- Initial splash waits for local chat recovery and the initial connection check to settle, including failure, so connection errors remain accessible.
- File gallery reads workspace data through the authenticated API client and merges current local image attachments; scope follows conversation paths, attachment paths, and referenced artifact paths because the gateway has no ownership metadata per conversation.
