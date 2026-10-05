# Corregir fluidez y recuperación del chat

## Cambios
- Agrupar los fragmentos rápidos de la respuesta antes de actualizar la pantalla, evitando un render por cada token.
- Mientras llega una respuesta, no reconstruir ni decorar repetidamente los bloques de código; aplicar resaltado, botones y vista previa al terminar.
- Guardar localmente la conversación activa y restaurarla al recargar cuando el servidor de historial no esté disponible.
- Mantener el guardado actual del servidor como fuente principal y usar la copia local solo como recuperación.

## Verificación
- Probar una respuesta larga con bloque de código y confirmar que texto, código y desplazamiento permanecen estables.
- Recargar la página después de conversar y confirmar que reaparecen título, mensajes y conversación activa.
- Revisar escritorio y teléfono, sin errores en pantalla.

## Detalles técnicos
- Actualizaciones de streaming limitadas a una por frame mediante `requestAnimationFrame`, con vaciado final antes de cerrar el turno.
- Instantánea local versionada y limitada a la conversación activa; no se persisten URLs temporales de adjuntos.
