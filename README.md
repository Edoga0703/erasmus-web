# Erasmus Web v0.1.0

Cliente web (SPA estática) de Erasmus Platform. Se conecta al puente existente tras nginx (`/erasmus-api/` → `127.0.0.1:4001`).

- `VITE_API_BASE` (defecto `/erasmus-api`) y `VITE_MOCK=1` para la demo sin red.
- `npm i && npm run build` → build estático con fallback SPA.
- Contratos, despliegue, endpoints PROPOSED y el delta mock vs. backend real: ver `INTEGRATION_NOTES.md`. Análisis: `ANALYSIS.md`.
