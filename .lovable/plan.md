# Pulido del chat: actividad, acciones y estados

## Objetivo
Acercar Erasmus a las interfaces modernas de ChatGPT, Claude y Gemini sin recargar la pantalla. Se mantienen fuera del alcance la edición de mensajes y las sugerencias iniciales.

## Cambios propuestos

### 1. Actividad compacta por respuesta
- Sustituir la separación actual entre razonamiento y tarjetas por un resumen único, plegable y cerrado al terminar.
- Mientras Erasmus trabaja, mostrar solo el paso activo y el tiempo transcurrido.
- Al terminar, resumir duración total, cantidad de pasos y archivos afectados; al desplegar, conservar las tarjetas existentes sin duplicarlas.
- Mantener la compactación de contexto como un evento independiente y visible.

### 2. Panel derecho con Actividad y Archivos
- Reutilizar el panel lateral actual y añadir pestañas `Actividad`, `Archivos` y `Resultados`.
- En ordenador seguirá siendo redimensionable; en teléfono ocupará la pantalla con un regreso claro al chat.
- Abrir automáticamente la pestaña apropiada al seleccionar un paso, archivo o resultado, pero nunca interrumpir la escritura del usuario.

### 3. Código y cambios más legibles
- Añadir números de línea opcionales y estables a bloques terminados.
- Mantener `Copiar` y `Vista previa`; durante la respuesta no se decorará el código para conservar la fluidez actual.
- Presentar cambios por archivo con contador, líneas añadidas/eliminadas y vista unificada. En escritorio se podrá alternar a lado a lado cuando haya ancho suficiente; en teléfono siempre será unificada.

### 4. Acciones de respuesta ordenadas
- Dejar visibles solo las acciones principales: copiar y valoración.
- Mover regenerar, leer en voz alta y ramificar a un menú `…`; en móvil será accesible sin depender del hover.
- `Leer en voz alta` usará la voz del navegador y tendrá detener/reanudar.
- `Ramificar` creará una conversación nueva desde el punto elegido usando el historial ya disponible; no modifica la conversación original.
- No se añadirá edición de mensajes.

### 5. Búsqueda enriquecida
- Mantener búsqueda por título inmediata.
- Cuando el contenido de una conversación esté disponible, mostrar fragmento coincidente, término resaltado y fecha.
- No descargar todas las conversaciones al abrir el buscador: cargar contenido de forma gradual para evitar lentitud y exceso de peticiones.

### 6. Conversación temporal
- Añadir el modo desde el menú del título/modelo, con indicador persistente en la cabecera.
- Una conversación temporal no se sincroniza con el historial ni reemplaza la recuperación de una conversación normal.
- Al salir o iniciar otra conversación, avisar una sola vez de que el contenido temporal desaparecerá.

### 7. Cabecera y fallos más limpios
- Ocultar el texto y punto `Conectado` cuando todo funciona.
- Mostrar estado únicamente al conectar, degradarse o perder conexión.
- Asociar cada fallo al turno afectado con `Reintentar`; conservar el aviso general solo para fallos que bloqueen toda la aplicación.
- Añadir un estado de carga estable al abrir conversaciones, sin reconstruir el hilo ni mover el compositor.

## Orden de implementación
1. Modelo de estado por turno, actividad y fallos.
2. Panel unificado Actividad/Archivos/Resultados.
3. Acciones de respuesta, voz y ramificación.
4. Código, números de línea y diffs.
5. Búsqueda enriquecida y conversación temporal.
6. Simplificación de cabecera y estados de carga.
7. Pruebas completas a 1280 px y 390 px, teclado/tacto, tema claro/oscuro, recarga, streaming y cero errores de consola.

## Límites y dependencias
- No se crean servicios ni endpoints nuevos.
- Actividad, voz, conversación temporal y ramificación pueden resolverse en el cliente con la información existente.
- La búsqueda de contenido se degradará a títulos cuando el historial remoto no esté disponible.
- Los tiempos representan la actividad real observada en el cliente; no se inventarán pasos ni métricas.
- Las tarjetas guardadas seguirán reabriendo igual desde el historial.

## Criterio visual
La vista normal seguirá siendo tranquila: respuesta, contenido y pocas acciones. Actividad, archivos, cambios y opciones secundarias aparecerán solo cuando el usuario los solicite. Ningún control debe desplazar la cabecera, el compositor o los botones vecinos, y no habrá desbordes a 390 px.
