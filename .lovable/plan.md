# Adaptación de Erasmus Web al servidor v5.4

## Objetivo
Conectar toda la experiencia web al nuevo servidor unificado usando la sesión de cada usuario, retirando las rutas temporales y ajustando archivos, historial, cuenta y cupones al contrato real.

## Cambios
1. **Conexión y sesión**
   - Usar `VITE_API_BASE` como único destino y retirar el modo directo temporal.
   - Corregir el vencimiento ISO del login y validar la sesión con `/api/auth/me`.
   - Enviar `X-Erasmus-Session` en todas las funciones privadas y cerrar la sesión local ante un `401` real.
   - Consultar el estado público mediante `/health`, sin credenciales.

2. **Chat y cuenta**
   - Enviar el streaming a `/v1/chat/completions` con `erasmus-v1`.
   - Mantener razonamiento, uso, continuación, imágenes y compactación actuales.
   - Eliminar la entrada de clave `ms-`: el servidor ya asigna y protege la capacidad de cada cuenta.
   - Mostrar plan, consumo y estado de la cuenta usando los datos reales disponibles.

3. **Historial y archivos**
   - Adaptar `GET /api/workspace/chat` de `{chat}` al formato interno del cliente.
   - Enviar `sync_chat` en el formato plano que acepta v5.4 y conservar tarjetas de actividad.
   - Construir el árbol recorriendo `/api/workspace/list`, ya que `/api/workspace/files` no existe.
   - Ajustar lectura, escritura, descarga y exportación ZIP al método y respuesta reales.
   - Desactivar con una explicación clara las funciones que v5.4 no ofrece, sin fingir resultados.

4. **Cupones**
   - Añadir canje para nuevos usuarios desde Entrar mediante `/api/coupons/claim_new`.
   - Añadir canje para cuentas activas desde Ajustes mediante `/api/coupons/redeem`.
   - Mostrar la clave de acceso creada una sola vez y permitir copiarla antes de entrar.

5. **Seguridad y validación**
   - No guardar claves de acceso ni cupones; conservar solo la sesión en la pestaña.
   - Evitar credenciales en URL y retirar el antiguo token de puente.
   - Probar login, sesión, chat SSE, historial, archivos, ZIP, cupones y cierre de sesión a 1280 px y 390 px.

## Detalles técnicos
- El gateway v5.4 devuelve fechas ISO, `chat` en la apertura, timestamps `created_at/updated_at`, ZIP como descarga directa y listas de directorio como `entries`.
- El endpoint subido de lectura contiene una comprobación contradictoria de directorio/archivo; el cliente se adaptará al contrato y se documentará ese bloqueo concreto para corregirlo en el servidor.
- La API publicada declara CORS abierto. El cliente no puede corregirlo: se documentará la recomendación de limitarlo a los dominios oficiales antes de producción.