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
