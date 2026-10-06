# Erasmus Web

SPA de Erasmus Platform conectada al gateway v5.4 mediante una única base (`VITE_API_BASE`).

## Desarrollo

```bash
bun install
bun run dev
```

`.env.development` apunta al gateway de desarrollo. En producción conviene usar `VITE_API_BASE=/erasmus-api` y servir el build estático tras nginx con fallback SPA.

## Acceso

No existe modo demostración. El usuario entra con una llave `erm-XXXX-XXXX-XXXXX-XXXX`; la sesión resultante vive en `sessionStorage`, y los datos locales quedan separados por `user_id`.

Consulta `INTEGRATION_NOTES.md` para el contrato de red, capacidades y pendientes detectados en el servidor.
