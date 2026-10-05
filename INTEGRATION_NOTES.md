# INTEGRATION_NOTES.md — Erasmus Web

## Variables de entorno
| Variable | Defecto | Uso |
|---|---|---|
| `VITE_API_BASE` | `/erasmus-api` | Única URL base; todo `fetch` es relativo a ella (`src/lib/api/config.ts`). |
| `VITE_MOCK` | vacío (`.env.development` = `1`) | `1` = todas las llamadas las sirve `/src/mocks` y nunca se toca la red. |

No hay secretos en el cliente. El token llega por `?t=<token>`, se guarda en `sessionStorage["erasmus_bridge_token"]`, se borra de la URL y viaja como `X-Erasmus-Token` en **todas** las llamadas.

## Despliegue (build estático)
Se usa el modo SPA de TanStack Start (`spa.enabled`): el build genera un shell `index.html` y assets estáticos. No hay SSR con estado.

```nginx
location / { try_files $uri $uri/ /index.html; }
location /erasmus-api/ {
  proxy_pass http://127.0.0.1:5005/;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;          # SSE token a token
  proxy_cache off;
  proxy_read_timeout 600s;
  add_header X-Accel-Buffering no;
  # NO borrar ni reescribir Origin (decisión D1)
}
```

## D1 — Gate de origen: cambio de backend esperado
Lo aplica el equipo de backend antes de la integración real. El origen web se trata igual que el local: **solo se acepta con un token válido**.
```diff
 ALLOWED_ORIGIN_REGEX = re.compile(
-    r"^(?:https?://(?:127\.0\.0\.1|localhost)(?::\d+)?|null)$",
+    r"^(?:https?://(?:127\.0\.0\.1|localhost)(?::\d+)?|null"
+    r"|" + re.escape(CFG.get("web_origin", "https://erasmus.example.com")) + r")$",
     re.IGNORECASE
 )
```
(`_origin_ok` sigue exigiendo el token con `compare_digest`; `do_OPTIONS` reutiliza el mismo regex.)

## Endpoints usados
`GET /api/status`, `GET /api/models`, `POST /api/chat` (SSE), `POST /api/fs/list`, `POST /api/fs/read`, `POST /api/fs/write`, `GET /api/workspace/chats`, `GET /api/workspace/chat?id=`, `POST /api/workspace/sync_chat` (también para renombrar), `GET /api/workspace/files` (artifacts = `rel_path` que empieza por `artifacts/`), `POST /api/workspace/upload`, `GET /api/fs/download`.

## PROPOSED (no existen todavía; la UI muestra el botón deshabilitado con la nota "disponible pronto")
- `POST /api/workspace/delete_chat` `{"id"}` → `{"ok":true,"deleted":true}`
- `POST /api/fs/delete` `{"path"}` → `{"ok":true,"name":...}`

Los mocks **no** los implementan, a propósito.

## Bloques de herramienta
`file:list`, `file:read`, `file:write` y `file:append` se ejecutan automáticamente contra `/api/fs/*` y su resultado se devuelve al modelo (límite: 30 pasos). `powershell:run` aparece como una tarjeta "No ejecutado".
**Trabajo futuro (no bloqueante):** ejecutar `powershell:run` requerirá PowerShell 7 en el servidor, o un selector de shell por plataforma en el backend.

## Mocks (`src/mocks/`)
- `fixtures.ts`: workspace en memoria (README, `src/`, `notas/`, `artifacts/`), dos chats de ejemplo y respuestas guionizadas. El primer turno emite `file:list`, `file:read`, `file:write` y `powershell:run`; el seguimiento devuelve un resumen.
- `index.ts`: simula todos los endpoints del catálogo, con SSE emitido por intervalo de 28 ms.
- Errores simulados:
  - Sin `X-Erasmus-Token` → `403 {"ok":false,"error":"origin_denied"}`.
  - Escenario forzable con `localStorage["erasmus.mock.scenario"]`:
    - `ok`
    - `no_token` → 403
    - `no_vps_key` → 401 en `/api/chat` y `/api/models`
    - `offline` → fallo de red
- En modo mock, si no llega `?t=`, se fija un token de demostración (`mock-token`) para que la preview sea navegable. En modo real esto no ocurre.
