# Erasmus Web 1.0 beta test

## Cambios
- Avisar cuántos adjuntos se descartan cuando se supera el máximo de 20; conservar desactivado el límite de tamaño acordado para pruebas.
- Retirar Estado y Diagnóstico únicamente de Ajustes; mantener la página pública Estado y su actividad ilustrativa.
- Ampliar Seguridad con información clara sobre conversaciones, archivos, almacenamiento en el navegador y cierre de sesión.
- Añadir «Eliminar cuenta» con una explicación honesta: la eliminación real está pendiente del servidor. No simular borrado ni confundirlo con cerrar sesión.
- Simplificar Acerca de: Erasmus Web 1.0 beta test, modelo Erasmus y fecha de esta actualización.
- Corregir los errores aceptados de la auditoría: regenerar conservando adjuntos, lectura duplicada, resultados antiguos en búsqueda, aviso de copiado persistente y ejecución de código no disponible.
- Ocultar Eliminar conversación mientras no esté disponible y mantener el botón de bajar separado del campo de mensaje. Sin edición de mensajes ni sugerencias.

## Detalles técnicos
- Mantener la aplicación estática y el cliente de red único; no añadir servicios, endpoints inventados ni credenciales.
- Mantener las decisiones de pruebas existentes y no afirmar que el borrado automático a 30 días esté activo sin confirmación.
- Revisar metadatos existentes y señales de errores; verificar los cambios disponibles sin inventar sesiones de usuario.

## Pendiente externo
- El servidor v5.4 no documenta eliminación de cuenta ni conversaciones. El borrado definitivo queda bloqueado hasta disponer de su contrato autenticado.