# Erasmus Web v0.1.0

Cliente web (SPA estática) de Erasmus Platform. Se conecta al puente existente tras nginx (`/erasmus-api/` → `127.0.0.1:4001`).

- `VITE_API_BASE` (defecto `/erasmus-api`). No existe modo demostración. Inicio de sesión por código `erm-…` (ver INTEGRATION_NOTES.md).
- `npm i && npm run build` → build estático con fallback SPA.
- Contratos, despliegue, endpoints PROPOSED: ver `INTEGRATION_NOTES.md`. Análisis: `ANALYSIS.md`.
