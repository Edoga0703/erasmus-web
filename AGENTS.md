<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All network I/O goes through `apiFetch` in `src/lib/api/client.ts`, relative to `VITE_API_BASE`; there is no demo/mock mode — one swap point, never fake answers.
- Model Markdown is rendered only via `src/lib/markdown.ts` (marked + DOMPurify with reference FORBID rules) — security parity with the desktop app.
- No Supabase/DB/new services; production is a static SPA build served by nginx — backend is the existing Erasmus gateway.
- Only endpoints listed in ANALYSIS.md; missing ones go to INTEGRATION_NOTES.md as PROPOSED and the UI degrades — contract with the gateway team.
- Charts are rendered by the in-house SVG renderer (`src/components/chat/Chart.tsx`) and mermaid is bundled from npm — no chart libraries or CDNs, keeps the static build self-contained.
- Workspace panel lives in `src/components/files/`; all reads/downloads go through `api.files`/`api.fsRead`/`api.download` (blob via apiFetch) — keeps the token single-source and makes mock downloads real blobs.
- Assistant messages persist their tool-card state (`tools`) inside chat_data so reopened chats render identical cards; blocks without saved state show as "Del historial" — no re-execution on open.
- The ms- VPS key is attached only in `apiFetch` and only for proxied routes (/v1/*, /api/chat, /api/models, /api/account/*, /api/images/*); stored only in sessionStorage and shown masked (last 4 chars) — local fs/exec routes must never see it.
- Direct-to-model mode (`VITE_MODEL_BASE` set, `VITE_MOCK` off) is a temporary path inside `apiFetch` while the bridge is not deployed: chat/models/account/status go to the model server with only its CORS-allowed branded headers (X-Session-ID, X-Compact-Mode); bridge routes return a local 503 — keeps one swap point and the token off foreign origins.
- The active conversation has a versioned localStorage recovery snapshot while server sync remains authoritative — direct-model sessions survive reloads without introducing a database.
- Context management is client-side in `src/lib/context.ts` + `use-chat`: proactive summary at 80 % of `/v1/models` context_length, one compaction+retry on `context_overflow`, then a terminal "new conversation" notice; summaries live in `kind:"compaction"` messages inside chat_data — the server never compacts on its own.

- Production builds ship a CSP <meta> from `src/routes/__root.tsx` (scripts/connect only self + model origin); frame-ancestors/HSTS belong to nginx — meta CSP cannot set them.

- Login is by server-validated `erm-` access code (`src/lib/auth.ts`, `src/lib/session.ts`); session token in sessionStorage, sent as X-Erasmus-Session only to bridge routes; all per-user browser data uses `userKey()` (`erasmus:<user_id>:*`) and is wiped on logout/user switch — server is the only authority, browser isolation is defense in depth.
- Routes: `/` public landing, `/entrar` login, protected pages under `src/routes/_auth/` (client-only gate) — session lives in sessionStorage, which SSR cannot read.
- Dev builds only (`import.meta.env.DEV`) fall back to a local per-code session when /api/auth/login is missing; production fails closed.
- Public status checks bypass `apiFetch` and carry no session, bridge, or model credentials; the production endpoint must return only a cached availability snapshot — prevents public routes from leaking private headers or infrastructure details.
