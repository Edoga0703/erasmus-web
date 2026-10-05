# ANALYSIS.md — Erasmus Web (Fase 1)

Fuente: `Erasmus_Platform_v4.3.1` (index.html 5 073 líneas, nexia_bridge.py 1 653 líneas). Sólo lectura.

## 1. Sistema de diseño

### Tokens de color (`:root` = `[data-theme="light"]`)

| Variable | Claro | Oscuro (`[data-theme="dark"]`) |
|---|---|---|
| `--bg` | `#f9f9f9` | `#1a1a1a` |
| `--bg2` | `#ffffff` | `#242424` |
| `--bg3` | `#f3f4f6` | `#2e2e2e` |
| `--bg4` | `#e9eaec` | `#383838` |
| `--tx` | `#111111` | `#ececec` |
| `--dim` | `#6b7280` | `#9ca3af` |
| `--line` | `#e5e5e5` | `#3a3a3a` |
| `--acc` | `#000000` | `#ffffff` |
| `--acc2` | `#374151` | `#d1d5db` |
| `--ok` | `#10a37f` | `#34d399` |
| `--err` | `#dc2626` | `#f87171` |
| `--info` | `#2563eb` | `#60a5fa` |
| `--shadow` | `0 4px 16px rgba(0,0,0,.08)` | `0 4px 16px rgba(0,0,0,.4)` |

Overrides puntuales en oscuro: banner de error `#2a1515 / #7f1d1d / #fca5a5`; diff añadido `#86efac` sobre `rgba(22,163,74,.12)`, eliminado `#fca5a5` sobre `rgba(220,38,38,.12)`; foco del composer `rgba(255,255,255,.3)`; toast de error `#2a1515`. La terminal siempre es oscura (`#181a1f / #e6edf3`).

### Tipografía, radios, dimensiones

| Variable / regla | Valor |
|---|---|
| `--sans` | `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif` (en la web: system font stack, por indicación del brief) |
| `--mono` | `'Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace` |
| `--r` | `8px` |
| `--r2` | `12px` (composer, tarjetas) |
| `.icon-btn` | 28×28 px, radio 6px, borde `--line` |
| `--side` | `240px` (ancho de la barra lateral, ajustable; botón "Restablecer 260px") |
| `--art` | `440px` (panel de artifacts) |
| `#top` | alto `48px`, padding `0 18px`, gap `10px`, borde inferior `--line`, fondo `--bg2` |
| `#composer` | padding `10px 16px 12px`; `#row` padding `10px 12px`, radio `--r2`, sombra `0 2px 8px rgba(0,0,0,.06)` |
| Marca sidebar | 14px / 600; subtítulo 10px `--dim` |

Tema por defecto en la web: **oscuro**.

## 2. Inventario de superficies

| Superficie | Qué hace |
|---|---|
| `#side` (sidebar) | Marca, botones de ajustes y cerrar, lista de proyectos y lista de conversaciones (`#convNav`). Colapsable (Ctrl+Shift+S) con botón flotante para reabrir. |
| `#top` (top bar) | Selector de proyecto (`#projDropdown`), medidor de ventana de contexto (`#budget` + `#contextPopover`), chip de estado, etiqueta de modelo (`#modelTag`). |
| `#chat` | Área de mensajes usuario/asistente con Markdown renderizado. |
| `#errBanner` | Banner de error de conexión/gateway sobre el composer. |
| `#composer` | Textarea, selector de comandos `/` (`#slashPicker`), menciones `@` (`#atPicker`), chips de adjuntos, botones de esfuerzo (`#effortBtns`). |
| `#terminalDrawer` | Terminal / registro de trabajo con historial (`#termHistory`). **Fuera de alcance v0.1.** |
| `#artifactsPanel` | Panel derecho: iframe sandbox para HTML, vista de código y editor de artifacts. |
| `#settingsModal` | Ajustes estilo ChatGPT: apariencia, ancho de barra, "Verificar puente" (`#connStatus`), guardar o cancelar. |
| `#memoryModal` | Lista de memorias persistentes. |
| `#promptsModal` | Biblioteca de prompts. |
| `#projModal` | Crear o editar proyecto (workspace). |
| `#missionModal` | Misiones o tareas del agente (`#miList`). |
| `#toastCt` | Contenedor de toasts (ok/err/info). |
| Visor de diff (`#diffCodeView`) | Diff de archivos escritos, con filas add/del. |

## 3. Catálogo de endpoints (nexia_bridge.py)

Todas las respuestas son JSON, salvo que se indique otra cosa. Los errores tienen la forma `{ok:false, error}`.

### GET
| Ruta | Respuesta |
|---|---|
| `/`, `/app`, `/index.html`, `/favicon.ico`, `/vendor/*` | Estáticos (no aplican a la web). |
| `/v1/models` · `/api/models` | Proxy al VPS: lista de modelos estilo OpenAI (`{data:[{id,...}]}`). |
| `/api/account/me` | Proxy: cuenta y saldo (shape del VPS). |
| `/api/images/{name}` | Proxy: imagen binaria generada. |
| `/api/status` | `{ok, app, status:"ready", gateway_active, brand_model, workspace_name, cwd}` |
| `/api/workspace/files` | `{ok, workspace_name, files:[{name, rel_path, size, modified}]}` (máx. 200, recursivo) |
| `/api/workspace/chats` | **Manifiesto** `{ok, workspace_name, chats:[{id, title, updated, created, messages_count, size?}]}` ordenado por `updated` desc |
| `/api/workspace/chat?id=` | `{ok, chat_data:{id,title,created,updated,messages|allMessages:[{role,text|c,ts}]}}` |
| `/api/fs/download?path=&t=` · `/api/workspace/download` | Archivo binario (descarga) |
| `/api/stop` | 405 (exige POST) |

### POST
| Ruta | Petición | Respuesta |
|---|---|---|
| `/v1/chat/completions` · `/api/chat` | Cuerpo OpenAI `{model, messages, stream, max_tokens?}`; cabeceras opcionales `X-Session-ID`, `X-Compact-Mode`, `X-Work-Mode`, `Authorization` | **SSE** `text/event-stream` (`data: {choices:[{delta:{content}}]}` … `data: [DONE]`) o JSON si `stream:false`. Error: `{error:{message,code}}` (401 si falta API key, 502 `gateway_vps_error`). |
| `/api/exec` | `{cmd|command, cwd?, timeout?=300}` | `{ok, exit_code, stdout, stderr, ...}` (124 = timeout) — **fuera de alcance** |
| `/api/fs/list` | `{path="."}` | `{ok, path, items:[{name,is_dir,size,modified}], total, showing, truncated?, warning?}` (máx. 60) |
| `/api/fs/read` | `{path, full?, start_line?, end_line?}` | `{ok, name, total_lines, content, truncated?, warning?}` |
| `/api/fs/write` | `{path, content, append?}` | `{ok, name, mode:"write"|"append", bytes_written}` |
| `/api/workspace/set` | `{name}` | `{ok, workspace_name, workspace_path}` |
| `/api/workspace/zip` | `{...}` | `{ok, zip_name, size}` |
| `/api/workspace/upload` | `{filename, content_base64|data, subfolder="uploads"}` | `{ok, name, rel_path, abs_path, size}` (413 si se excede el límite) |
| `/api/workspace/sync_chat` | `{id|conv_id, chat_data:{title,created,messages|allMessages}, markdown?}` | `{ok, id, json_path, md_path, size_json, saved_at}` — también sirve para **renombrar** (reenviar con el nuevo `title`) |
| `/api/workspace/get_chat` | `{id}` | igual que GET `/api/workspace/chat` |
| `/api/workspace/save_artifact` | `{filename, content}` | `{ok, name, rel_path:"artifacts/…", abs_path, size}` |
| `/api/open_folder` | `{path}` | Abre el explorador local (no aplica a la web) |
| `/api/stop` | — | `{ok, message}` |

**No existen:** borrar archivo, borrar o renombrar chat de forma dedicada, ni listar artifacts (se derivan de `/api/workspace/files` filtrando `artifacts/`). Se declararán como PROPOSED en INTEGRATION_NOTES.md.

**SSE:** sólo `/v1/chat/completions` y `/api/chat`.

## 4. Gramática de bloques

Son bloques de código Markdown cercados con etiqueta `tipo:acción`:

| Bloque | Sintaxis | Comportamiento en la referencia |
|---|---|---|
| `powershell:run` (alias `pwsh:run`, `ps:run`) | ` ```powershell:run\n<script>``` ` | Pueden venir varios por turno. Se ejecuta vía `/api/exec`; límite de 30 pasos del agente. |
| `file:list` | ` ```file:list\n<ruta>``` ` | `/api/fs/list`; el resultado vuelve al modelo como `[CONTENIDO DEL DIRECTORIO …]`. |
| `file:read` | ` ```file:read\n<ruta>``` ` | `/api/fs/read`; vuelve recortado a 8 000 caracteres como `[CONTENIDO DE …]`. |
| `file:write <ruta>` | ` ```file:write ruta\n<contenido>``` ` | `/api/fs/write`; muestra diff. Si el bloque no se cierra, guarda lo recibido y pide `file:append`. |
| `file:append <ruta>` | ` ```file:append ruta\n<contenido>``` ` | `/api/fs/write` con `append:true`. |

Presentación: el bloque se elimina del texto del asistente (`cleanToolFromAsst`). Mientras se ejecuta aparece "⚡ Ejecutando herramientas en segundo plano..." en cursiva y color `--dim`. Al terminar: "*(Herramientas ejecutadas con éxito · Ver registro de trabajo)*". El detalle va al registro de trabajo o terminal y al diff (filas add/del). En la web, cada bloque se mostrará como una **tarjeta** (icono, tipo, ruta o comando, cuerpo colapsable, estado). La web **no ejecutará** `powershell:run` (la terminal está fuera de alcance): la tarjeta lo mostrará como "no ejecutado".

## 5. Reglas de seguridad

- **Markdown:** `marked` y después `DOMPurify.sanitize(html, {FORBID_TAGS:["iframe","object","embed","script","form","noscript"], FORBID_ATTR:["srcdoc"]})` (index.html:1768). Resaltado con highlight.js (temas github / github-dark).
- **Token:** se lee de `?t=` en la URL, se guarda en `sessionStorage["erasmus_bridge_token"]` y se limpia de la URL con `history.replaceState`. Se envía como cabecera `X-Erasmus-Token` (también se acepta `X-Bridge-Token`). En descargas, como `&t=` en la query.
- **Gate de origen:** si hay `Origin`, debe coincidir con `^(https?://(127.0.0.1|localhost)(:port)?|null)$` **y** llevar un token válido (comparación en tiempo constante). Sin token configurado se rechaza cualquier petición con Origin. **Implicación web:** detrás de nginx en otro dominio, el Origin real no pasará el regex. Hace falta que nginx lo reescriba/elimine, o un cambio de backend (ver INTEGRATION_NOTES).
- **CORS / framing:** `X-Frame-Options: SAMEORIGIN`, `CSP frame-ancestors 'self'`.
- **Iframes de artifacts:** `sandbox="allow-scripts allow-popups"` (sin `allow-same-origin`).
- **Errores:** los mensajes del VPS pasan por `sanitize_error_msg` y la identidad se reescribe a Erasmus (`rewrite_sse_line`).
- **Límites:** cuerpo de 32 MB, semáforo de streams concurrentes, máx. 200 archivos, 60 entradas por listado, lectura truncada por líneas.
