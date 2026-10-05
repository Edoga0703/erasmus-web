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
- Extensión de `POST /api/exec` con `language`/`code` (ver Herramientas).
- `POST /api/workspace/delete_chat` `{"id"}` → `{"ok":true,"deleted":true}`
- `POST /api/fs/delete` `{"path"}` → `{"ok":true,"name":...}`

Los mocks **no** los implementan, a propósito.

## Herramientas (gramática v-web)
Erasmus Web es un agente en la nube que trabaja sobre un sandbox Linux (Python 3 + bash) en el servidor. No usa PowerShell ni el PC del usuario.

| Bloque | Endpoint |
|---|---|
| `code:python` | `POST /api/exec` `{language:"python", code, cwd, timeout}` |
| `code:bash` | `POST /api/exec` `{language:"bash", code, cwd, timeout}` |
| `file:list RUTA` | `POST /api/fs/list {path}` |
| `file:read RUTA` | `POST /api/fs/read {path}` |
| `file:write RUTA` | `POST /api/fs/write {path, content}` |
| `file:append RUTA` | `POST /api/fs/write {path, content, append:true}` |

**Reglas:** se ejecutan en orden, uno a uno, con un máximo de 30 bloques por turno. A partir del 31 la tarjeta muestra "Límite alcanzado" y el agente se detiene. El timeout es de 60 s por defecto (techo 300 s); stdout y stderr se truncan a 64 KB en el cliente y se registra la duración. Se inyecta al modelo con este formato: `[RESULTADO code:python (exit 0, 1.4s)]` + salida (recortada a 8 000 caracteres).

### Extensión de `POST /api/exec` (contrato exacto; lo prepara el backend)
```json
// petición
{"language":"python"|"bash","code":"<script>","cwd":".","timeout":60}
// respuesta
{"ok":true,"exit_code":0,"stdout":"...","stderr":"...","duration_ms":1400}
```
`exit_code` 124 = tiempo agotado. Si falta `duration_ms`, el cliente mide el tiempo de ida y vuelta.

### Sandbox por conversación
Carpeta propuesta: **`sandbox/<conv_id>/`** dentro del workspace. El cliente la envía como `cwd` en cada `exec`. Todo lo que se crea ahí aparece en el panel de archivos y se descarga con `/api/fs/download?path=...&t=<token>`. Borrar la conversación (`delete_chat`, PROPOSED) debe borrar también su sandbox y limpiar el índice.

### Razonamiento (PROPOSED, passthrough)
Si el SSE incluye `choices[].delta.reasoning_content`, el cliente lo mostrará plegado bajo el indicador "✦ trabajando…" (H2).

### No es del cliente
El exec extendido, el origen web en la allowlist y el prompt del modelo con la gramática v-web los aporta el gateway.

## Mocks (`src/mocks/`)
- `fixtures.ts`: workspace en memoria (README, `src/`, `notas/`, `artifacts/`), dos chats de ejemplo y un guion de análisis de datos. El paso 0 emite `code:bash` y `code:python` (crea `ventas.csv`) y lee el CSV con `code:bash`; el paso 1 devuelve un `chart` de barras, una tabla y un resumen.
- `sandbox.ts`: sandbox simulado con estado persistente.
  - bash: `ls`, `cat`, `echo` (con `>`/`>>`), `pwd`, `mkdir`, `sleep`, `wc -l`, `head`; cualquier otra orden devuelve 127.
  - Python básico: `print` de literales, aritmética y lecturas de archivo; `open().write` / `Path.write_text` con triple comilla; `time.sleep`; `raise` produce un Traceback con exit 1.
  - `sleep`/`time.sleep` por encima del timeout devuelve exit 124.
- `index.ts`: simula todos los endpoints del catálogo, con SSE emitido por intervalo de 28 ms.
- Errores simulados:
  - Sin `X-Erasmus-Token` → `403 {"ok":false,"error":"origin_denied"}`.
  - Escenario forzable con `localStorage["erasmus.mock.scenario"]`:
    - `ok`
    - `no_token` → 403
    - `no_vps_key` → 401 en `/api/chat` y `/api/models`
    - `vps_error` → 502 `gateway_vps_error` en `/api/chat`
    - `offline` → fallo de red
- En modo mock, si no llega `?t=`, se fija un token de demostración (`mock-token`) para que la preview sea navegable. En modo real esto no ocurre.
