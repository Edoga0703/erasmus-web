# Estado público seguro y Política de privacidad

## Objetivo
Hacer que Estado funcione sin controles manuales ni credenciales privadas, y añadir una política de privacidad original y completa para Erasmus.

## Cambios
1. **Estado automático y mínimo**
   - Quitar “Volver a comprobar”.
   - Consultar automáticamente al cargar y actualizar periódicamente sin intervención del visitante.
   - Usar una petición pública dedicada que nunca adjunte código de acceso, sesión ni clave del modelo.
   - Consumir únicamente disponibilidad y latencia; no guardar ni mostrar nombres internos, rutas o detalles del servidor.
   - Mantener los errores genéricos para no revelar información técnica.

2. **Contrato seguro para el servidor**
   - Documentar un estado público reducido y cacheable, alimentado por las comprobaciones automáticas del servidor.
   - Dejar explícito que la protección real, el límite de peticiones y la eliminación de campos internos deben aplicarse en el servidor; el navegador no puede ocultar un JSON que ya recibió.

3. **Política de privacidad**
   - Crear `/privacidad` con un texto original inspirado en la estructura de transparencia de la referencia, sin copiarla literalmente.
   - Cubrir: datos tratados, datos no solicitados, finalidad, almacenamiento, proveedores, seguridad, ausencia de venta/publicidad/entrenamiento, conservación, derechos, menores, cambios y contacto.
   - Indicar Venezuela como jurisdicción, conservación máxima de 30 días y contacto por Telegram como pendiente.
   - Diferenciar claramente las garantías actuales de las medidas que dependen del servidor, evitando promesas técnicas no verificadas.

4. **Acceso y presentación**
   - Añadir “Privacidad” al pie y a la navegación pública móvil, traducida a español, inglés y portugués.
   - Mantener el diseño actual y verificar ordenador y 390 px, navegación, idiomas, ausencia de desbordes y consola limpia.

## Nota legal
El contenido será informativo y específico del funcionamiento conocido de Erasmus, pero no sustituye una revisión profesional antes de vender el servicio.
