# Integración Erasmus Web — servidor v5.4

## Configuración

- `VITE_API_BASE`: única base de red. En producción se recomienda `/erasmus-api` detrás de nginx; en desarrollo puede apuntar al origen autorizado.
- No existe modo demostración ni conexión directa alternativa.
- El navegador no acepta claves `ms-`, secretos administrativos ni tokens de infraestructura.

## Autenticación y aislamiento

1. `POST /api/auth/login {code}` devuelve `{ok, session, user_id, plan, expires}`.
2. La sesión opaca se guarda en `sessionStorage` y se envía como `X-Erasmus-Session` en llamadas privadas.
3. `GET /api/auth/me` valida la sesión al abrir el chat; un `401` privado cierra la sesión local.
4. Historial, preferencias y recuperación local usan claves `erasmus:<user_id>:*`.
5. `POST /api/auth/logout` invalida la sesión en el servidor y limpia el espacio local del usuario.

## Modelo

- Catálogo: `GET /v1/models`.
- Chat: `POST /v1/chat/completions`, SSE, modelo de marca `erasmus-v2` y `reasoning_effort` (`none`, `low`, `medium`, `high`).
- Cuenta/uso: `GET /api/account/me`.
- Imágenes generadas: `/api/images/*`.
- La interfaz no muestra nombres internos del motor.

## Conversaciones y archivos

- `GET /api/workspace/chats` devuelve el manifiesto.
- `GET /api/workspace/chat?id=...` devuelve `{ok, chat}`; el cliente lo normaliza internamente.
- `POST /api/workspace/sync_chat` recibe el chat completo en la raíz del JSON, también al renombrar.
- `GET /api/workspace/list?path=...` devuelve `{ok, entries}`; el cliente recorre carpetas para construir el árbol.
- `POST /api/fs/read`, `POST /api/fs/write` y `GET /api/fs/download?path=...` usan la sesión.
- `GET /api/workspace/zip` devuelve directamente el blob ZIP; el cliente descarga ese stream sin esperar un archivo persistente.
- Los archivos de cada conversación se guardan bajo `conversations/<chat_id>/`.

## Cupones

- Visitante: `POST /api/coupons/claim_new {code}` crea una cuenta, inicia sesión y muestra la nueva llave `erm-...` una sola vez para copiarla.
- Usuario autenticado: `POST /api/coupons/redeem {code}` aplica el beneficio a su cuenta desde Ajustes → Datos.

## Capacidades deliberadamente desactivadas

El código v5.4 entregado no expone ejecución remota (`/api/exec`), subida binaria ni append atómico. Por eso:

- Python y bash generados se muestran como código normal y no se ejecutan.
- `file:append` se rechaza; el agente recibe instrucciones para leer y reescribir con `file:write`.
- Texto e imágenes se incluyen en el prompt. PDF y otros binarios necesitan un endpoint de subida/ingesta para poder llegar al modelo.

## Estado público y seguridad

`/estado` consulta `GET /health` con `credentials: omit` y sin `X-Erasmus-Session`. La UI solo usa `ok/status`; cualquier otro dato del payload sigue siendo visible en el navegador.

Pendientes del servidor detectados en la revisión v5.4:

1. Restringir CORS al origen web real; actualmente responde `Access-Control-Allow-Origin: *` y permite cabeceras administrativas/heredadas.
2. Cambiar `/api/fs/read`: la comprobación actual exige que el objetivo sea directorio y rechaza archivos regulares. El cliente usa temporalmente `/api/fs/download` como fallback de lectura.
3. Proteger `/api/images/*` con la misma sesión y autorización del resto de recursos privados.
4. Eliminar valores predeterminados para secretos administrativos y de firma; exigir secretos fuertes al arrancar y rotar los desplegados.
5. Reducir `/health` a una instantánea pública mínima, cacheada y limitada.
6. Publicar un endpoint autenticado de subida/ingesta para PDF y otros binarios si deben formar parte del contexto del modelo.
