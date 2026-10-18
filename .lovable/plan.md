# Auditoría Erasmus Web — hallazgos y plan de solución

Revisión solo de lectura. 12 problemas confirmados en el código (no se reprodujeron en vivo; varios dependen del momento exacto).

## Prioridad alta

1. **Un turno antiguo puede guardarse en otra conversación** — `src/hooks/use-chat.ts` (318-340, 489-494, 591-605, 647-650).
   Causa: al cambiar de chat, el `finally` del turno anterior limpia `busy`/controlador y llama a `persist` con el `chatId` viejo, pero con los mensajes actuales.
   Impacto: historial mezclado y el botón Detener deja de controlar el turno nuevo.
   Solución: un token de generación por turno; solo el turno vigente cambia el estado y guarda, usando una copia propia de sus mensajes.

2. **Los adjuntos pueden enviarse a otra conversación** — `src/components/shell/AppShell.tsx` (195-273, `sendWithFiles`).
   Causa: mientras se extraen o suben los archivos, el usuario puede abrir otro chat; después se llama a `chat.send` sin comprobar el chat.
   Solución: guardar el id del chat al empezar, cancelar la preparación al navegar y no enviar si el chat cambió.

3. **El tiempo límite no funciona si se pasa una señal propia** — `src/lib/api/client.ts` (113-136).
   Causa: `fetch` recibe `signal ?? ctrl.signal`; el temporizador aborta `ctrl`, que entonces no está conectado.
   Impacto: la creación de imágenes puede quedarse colgada más de 60 s.
   Solución: pasar siempre `ctrl.signal` y reenviar la señal del llamador (o `AbortSignal.any`).

4. **La lectura del cuerpo JSON no tiene tiempo límite** — `client.ts` (121-131).
   Causa: el temporizador se limpia al llegar las cabeceras, antes de `res.json()`.
   Solución: mantenerlo hasta consumir el cuerpo; limpiar en un `finally` externo.

5. **Detener no cancela las herramientas de archivos** — `use-chat.ts` (195-231, 451-466, 589).
   Causa: `runBlock` no recibe la señal de cancelación.
   Solución: pasar la señal a `runBlock` y a las llamadas de lectura/escritura; comprobarla entre lectura y escritura.

6. **Abrir chats rápido puede mostrar el equivocado** — `use-chat.ts` (647-695, `open`).
   Causa: no se cancela ni se identifica la carga anterior.
   Solución: número de secuencia por apertura; aplicar solo la última respuesta.

## Prioridad media

7. **El stream no se cierra al terminar o fallar** — `client.ts` (334-375). Al recibir `[DONE]` o un error no se cancela el lector. Solución: `reader.cancel()` + `releaseLock()` en `finally`.
8. **Un corte limpio del stream se toma como éxito** — `client.ts` (350-376), `use-chat.ts` (441-447). Solución: exigir `[DONE]` o motivo de fin; si no llega, marcar «interrumpido» con Reintentar.
9. **El aviso 429 dice «esperando» pero no espera ni ofrece Reintentar** — `client.ts:92`, `use-chat.ts:480-488`, `MessageView.tsx:72`. Solución: tratar 429 como reintentable, espera breve cancelable respetando `Retry-After`, y texto acorde.
10. **Ajustes no gestiona el foco como ventana modal** — `SettingsDialog.tsx` (73-118). Escape funciona, pero el foco puede quedar detrás. Solución: usar el `Dialog` de shadcn/Radix (foco inicial, atrapado y restaurado; clic fuera).

## Prioridad baja

11. **El buscador del chat no muestra el foco** — `InChatSearch.tsx` (72-77): `outline-none` sin reemplazo. Solución: anillo `focus-within` en el contenedor.
12. **El medidor de uso puede quedar desactualizado** — `UsageMeter.tsx` (18-47): el límite de 10 s descarta la última actualización. Solución: programar una actualización final y limpiarla al desmontar.

## Revisado sin problema confirmado

- Eventos `erasmus:*`: todos se limpian (AppShell, Composer, FilesPanel, UsageMeter).
- Almacenamiento: `JSON.parse` y errores de cuota protegidos.
- Composer: Enter/Shift+Enter, composición IME, pegado de capturas y aviso al superar 20 archivos funcionan.
- Móvil: el chat ya usa `h-dvh`.
- Artefactos: `postMessage("*")` va a un iframe de origen opaco y el wrapper valida `event.source`; aceptable.
- Botones de icono: con `aria-label` en los controles revisados.
- Resaltado de código: el chat usa highlight.js, no Shiki (Shiki solo está en un componente de AI Elements sin uso en el chat). No es un error; se puede retirar si no se usa.

## Orden de ejecución propuesto

1. Puntos 3, 4, 7 (cliente de red) con pruebas de tiempo límite y cierre.
2. Puntos 1, 5, 6, 8, 9 (`use-chat`) con pruebas de cambio de chat y cancelación.
3. Punto 2 (AppShell).
4. Puntos 10, 11, 12 (interfaz) y comprobación en escritorio y 390 px.

Cada paso con `vitest` y sin cambiar textos ni diseño salvo lo indicado.
