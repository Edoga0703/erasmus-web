# Markdown profesional e imágenes nativas

## Cambios
- Añadir los cinco avisos GFM con iconos, títulos en español y colores diferenciados en ambos temas, sin comprometer la limpieza del contenido.
- Mejorar tablas e imágenes y conectar sus clics al visor existente, con descarga y cierre.
- Añadir «Crear imagen con IA» al menú del compositor, tamaños cuadrado/panorámico/vertical, modo cancelable y comandos `/imagen` y `/image`.
- Integrar la generación en la conversación: petición, estado de espera, resultado, errores y reintento explícito; conservar historial y conversaciones temporales.
- Incorporar las imágenes generadas a Imágenes y Archivos, incluso cuando no figuren en el listado de archivos del servidor.

## Supuestos
- Se utiliza el servidor Fastify existente y el endpoint que has indicado; no se añade otro proveedor ni Lovable Cloud.
- Los tamaños enviados serán exactamente los solicitados. Las etiquetas 16:9 y 9:16 se conservan, aunque 1792×1024 no es una proporción 16:9 exacta.
- Los errores de cuota o permisos no se reintentan automáticamente. Un reintento manual solo aparece para errores recuperables.

## Detalles técnicos
- Mantener `src/lib/api/client.ts` como único cliente privado; `POST /v1/images/generations` envía la sesión Erasmus existente.
- Gestionar generación y persistencia dentro de `useChat` para compartir el bloqueo de actividad y evitar respuestas que se inserten en otra conversación después de cambiar de chat.
- Procesar los avisos sobre HTML saneado y sanear de nuevo el resultado; validar eventos y URLs antes de abrir imágenes.
- Mantener intacta la SPA estática y la política de aislamiento de artefactos.

## Verificación
- Ejecutar las pruebas existentes y añadir cobertura de avisos, seguridad, modo imagen, contrato de red, persistencia, reintento y colección de imágenes.
- Comprobar presentación e interacciones en escritorio y teléfono.
- La generación real y la lectura posterior del historial requieren una sesión Erasmus válida; si no está disponible, se informará como pendiente, sin simular éxito real.