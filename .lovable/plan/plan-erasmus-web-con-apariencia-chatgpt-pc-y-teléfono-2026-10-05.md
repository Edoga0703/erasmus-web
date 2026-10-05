# Plan: Erasmus Web con apariencia ChatGPT (PC y teléfono)

Objetivo: que Erasmus se vea y se use como ChatGPT web en todo lo posible, sin perder nada del contrato ya aprobado (puente, token, sandbox, herramientas, archivos, historial y ajustes). Tema claro por defecto, oscuro opcional.

## Fase 1 - Base visual (estilo ChatGPT)
- Colores tipo ChatGPT: fondo blanco, barra lateral gris muy claro (#f9f9f9), texto casi negro, bordes suaves; en oscuro, grises #212121 / #171717.
- Tipografía del sistema como ChatGPT (ui-sans-serif, -apple-system, "Segoe UI"); código en monoespaciada.
- Bordes redondeados grandes, botones de icono circulares, sombras muy suaves, iconos de trazo fino.
- Tema claro predeterminado y guardado al cambiarlo (los gráficos y diagramas se redibujan).

## Fase 2 - Paneles laterales (PC y teléfono)
PC:
- Barra lateral izquierda: logo, "Nueva conversación", "Buscar conversaciones", "Archivos", lista por fechas (Hoy, Ayer, 7 días...), menú de cuenta abajo (Ajustes, tema, Acerca de).
- Plegable a una franja de iconos (como ChatGPT) y con ancho ajustable arrastrando el borde; se recuerda el ancho y el estado.
- Panel derecho (Archivos / Artifacts / Actividad) que se abre al lado del chat, también con ancho ajustable arrastrando y botón cerrar.
Teléfono:
- Barra lateral como cajón que se desliza desde la izquierda (botón menú y gesto de cerrar tocando fuera).
- Panel derecho a pantalla completa deslizable desde abajo/derecha con botón cerrar.
- Cabecera fija mínima: menú, título del modelo, nueva conversación.

## Fase 3 - Pantalla de chat
- Inicio vacío: saludo centrado ("¿En qué puedo ayudarte?") con el cuadro de texto en el centro; al enviar, el cuadro baja.
- Cuadro de texto tipo píldora: botón "+" (adjuntar archivo al sandbox), texto que crece, botón negro redondo con flecha para enviar que cambia a cuadrado "detener" durante la respuesta.
- Mensajes del usuario en burbuja gris a la derecha; respuestas del asistente sin burbuja, ancho de lectura cómodo (~768 px).
- Acciones bajo cada respuesta: copiar, regenerar, (me gusta / no me gusta solo visual, sin envío), y en mensajes del usuario: copiar y editar.
- Flecha flotante "bajar al final" cuando se sube en la conversación.
- Indicador de "pensando" y resumen tipo "Trabajó durante 12 s" que se despliega para ver los pasos.

## Fase 4 - Código y herramientas
- Bloques de código estilo ChatGPT: cabecera con nombre del lenguaje, botón "Copiar" (cambia a "Copiado"), resaltado de colores, desplazamiento horizontal, y en móvil sin romper el ancho.
- Botón "Vista previa" en bloques HTML/SVG/Mermaid que abre el panel derecho en modo seguro (mismo aislamiento ya aprobado).
- Tarjetas de herramientas (Python, bash, archivos) compactas y plegables: icono, título, estado, duración; al abrir, código de entrada + salida, con copiar.
- Escrituras de archivo con diff: contadores +N / -N, líneas verdes/rojas, estado "Nuevo".
- Tablas con borde fino, títulos y listas con el espaciado de ChatGPT.

## Fase 5 - Cambios de chat (historial)
- Menú "..." al pasar el ratón (en móvil siempre visible o pulsación larga): Renombrar (en línea, como ChatGPT), Compartir/Archivar ocultos si no hay soporte, Eliminar en rojo deshabilitado con "disponible pronto".
- Buscador de conversaciones en ventana centrada: resultados agrupados por fecha, estado de carga y "sin resultados".
- Conversación activa resaltada; el renombrado se ve al instante.

## Fase 6 - Ajustes
- Ventana como ChatGPT: menú de secciones a la izquierda (General, Puente y conexión, Datos, Seguridad, Acerca de) y contenido a la derecha con filas "etiqueta + descripción + control".
- En teléfono: lista de secciones a pantalla completa y al tocar una se entra con botón "atrás".
- Avisos verdes tipo ChatGPT al guardar o verificar el puente.

## Fase 7 - Archivos y artifacts
- Pestañas Conversaciones / Archivos, filas con icono de color por tipo (PDF rojo, código azul, imagen, CSV verde), ordenar (recientes, antiguos, alfabético) y filtrar, estado "Sin resultados" con "Restablecer".
- Vista de archivo y descarga como hoy, con aspecto de tarjeta ChatGPT.

## Fase 8 - Verificación
- Pruebas en 1280 px y 390 px de todas las pantallas, tema claro y oscuro, escenarios ok / sin token / sin clave / error / desconectado, con cero errores de consola.

## Fuera de alcance (no se inventa)
Micrófono/voz, Apps, Imágenes, Codex, proyectos, compartir y conversaciones temporales: no hay soporte en el puente; no se añaden botones falsos.

## Detalles técnicos
- Tokens en `src/styles.css` (oklch) para claro/oscuro; nada de colores fijos en componentes.
- Paneles redimensionables con `ui/resizable` en escritorio y `Sheet` en móvil; ancho/estado en localStorage.
- Código: resaltado ligero empaquetado (sin CDN), copiar con `navigator.clipboard`; Markdown sigue pasando por `src/lib/markdown.ts`.
- Archivos tocados principalmente: `AppShell`, `ChatList`, `Composer`, `MessageView`, `Markdown`, `ToolCard`, `FilesPanel`, `FilePreview`, `SettingsDialog`. Sin cambios en `apiFetch` ni en el contrato del puente.
