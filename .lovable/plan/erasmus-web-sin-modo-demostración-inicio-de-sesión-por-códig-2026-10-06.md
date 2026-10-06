# Erasmus Web: sin modo demostración, inicio de sesión por código y página de inicio

## Lo que tomamos de drael.sh
- Página pública sobria: cabecera (logo, Precios, Entrar, Empezar), titular grande, campo "Preguntar" que lleva al login, secciones numeradas (01 Chat, 02 Archivos/Código, 03 Imágenes), tabla de precios Semanal/Mensual/Anual sin renovación automática, mensaje "Sin correo".
- Entrada sin cuenta de correo: solo un código.
- No copiamos OSINT ni "sin censura".

## 1. Eliminar el modo demostración
- Borrar las respuestas simuladas y el interruptor que las activa.
- Si falta conexión o clave, la app muestra un estado claro ("Configura tu clave en Ajustes"), nunca respuestas falsas.
- Actualizar documentos y reglas del proyecto.

## 2. Inicio de sesión por código
- Formato: `erm-XXXX-XXXX-XXXXX-XXXX` (letras y números, mayúsculas y minúsculas).
- Pantalla "Entrar": un solo campo con formato automático de guiones, botón Entrar, enlace "¿No tienes código? Ver planes".
- Los códigos los crea manualmente el administrador por ahora (más adelante el panel de administración y pagos automáticos).
- Tras entrar: el usuario pega su propia clave `ms-` en Ajustes (como hoy).
- Cerrar sesión borra todo lo del usuario en el navegador.

## 3. Separación rigurosa entre usuarios
- La validación del código la hace el servidor de Erasmus (nunca el navegador): sin servidor no hay login seguro.
- El servidor devuelve una sesión corta; todas las peticiones la llevan y el servidor filtra conversaciones, archivos y ZIPs por usuario.
- En el navegador, todo lo guardado (conversación activa, personalización, tema por usuario, clave) va con el identificador del usuario como prefijo; al cerrar sesión o cambiar de código se borra lo del anterior, y nunca se lee lo de otro.
- Las consultas cacheadas se vacían al cambiar de usuario; pestañas abiertas detectan el cambio y cierran sesión.
- Intentos fallidos: espera progresiva en la pantalla y límite en el servidor.

## 4. Página de inicio pública
- Ruta `/` pública con el diseño anterior adaptado a Erasmus (tema claro por defecto, oscuro disponible, perfecto a 390 px).
- Planes mostrados como informativos con botón "Contactar para activar" (compra manual por ahora).
- El chat pasa a `/chat`, protegido: sin sesión redirige a `/entrar`.

## Detalles técnicos
- Endpoints nuevos documentados como PROPUESTOS en INTEGRATION_NOTES.md para el equipo del servidor: `POST /api/auth/login {code}` → `{session, user_id, plan, expires}`, `POST /api/auth/logout`, `GET /api/auth/me`; todas las rutas existentes deben filtrar por `user_id` de la sesión. El código se guarda en el servidor solo como hash.
- `apiFetch` adjunta la sesión (sessionStorage) en una cabecera; 401 → cerrar sesión local y volver a `/entrar`.
- Mientras el servidor no tenga esos endpoints, la pantalla Entrar muestra "Acceso no disponible todavía" y no deja pasar (fallo cerrado). Sin base de datos ni servicios nuevos en este proyecto.
- Almacenamiento local con espacio de nombres `erasmus:<user_id>:*`; migración que limpia claves antiguas sin prefijo.
- Rutas: `index.tsx` (inicio), `entrar.tsx`, `_auth/chat.tsx` con guardia en `beforeLoad`; head() propio en cada una.
- Pruebas: formato del código, aislamiento de almacenamiento entre dos usuarios simulados, Playwright a 1280 y 390 px.
