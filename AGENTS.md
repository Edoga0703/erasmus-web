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
- All network I/O goes through `apiFetch` in `src/lib/api/client.ts`, relative to `VITE_API_BASE`; mocks in `src/mocks` are only loaded when `VITE_MOCK=1` — keeps one swap point and never mixes mock/real.
- Model Markdown is rendered only via `src/lib/markdown.ts` (marked + DOMPurify with reference FORBID rules) — security parity with the desktop app.
- No Supabase/DB/new services; production is a static SPA build served by nginx — backend is the existing Erasmus gateway.
- Only endpoints listed in ANALYSIS.md; missing ones go to INTEGRATION_NOTES.md as PROPOSED and the UI degrades — contract with the gateway team.
- Charts are rendered by the in-house SVG renderer (`src/components/chat/Chart.tsx`) and mermaid is bundled from npm — no chart libraries or CDNs, keeps the static build self-contained.
- Workspace panel lives in `src/components/files/`; all reads/downloads go through `api.files`/`api.fsRead`/`api.download` (blob via apiFetch) — keeps the token single-source and makes mock downloads real blobs.
- Assistant messages persist their tool-card state (`tools`) inside chat_data so reopened chats render identical cards; blocks without saved state show as "Del historial" — no re-execution on open.
- The ms- VPS key is attached only in `apiFetch` and only for proxied routes (/v1/*, /api/chat, /api/models, /api/account/*, /api/images/*); stored in sessionStorage unless the user opts into localStorage — local fs/exec routes must never see it.
