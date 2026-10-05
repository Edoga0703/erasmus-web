# Compactación automática del contexto

## Qué verá el usuario
- No habrá medidor. Todo pasará solo, sin que el usuario tenga que hacer nada.
- Cuando la conversación se acerque al límite de memoria del modelo, aparecerá en el chat una línea **"Compactando conversación… 4 s"**, con un contador que avanza mientras dura.
- Al terminar, la línea cambia a **"Conversación compactada en 6 s"**. Tras una pausa corta, de alrededor de 1 s, se envía el mensaje del usuario.
- Si el servidor rechaza el mensaje por falta de espacio aunque se haya compactado antes, se compacta otra vez y se reintenta **una sola vez**.
- Si vuelve a fallar, aparece el aviso: **"Esta conversación alcanzó su límite y no puede continuar. Inicia una conversación nueva para seguir."** junto al botón **Nueva conversación**. La conversación anterior se queda guardada y se puede leer.

## Archivos grandes (otro caso)
Compactar el historial no sirve cuando el problema es un archivo demasiado grande. Por eso los archivos tienen su propia regla:
- **Antes de enviar**, se calcula el tamaño del archivo. Si ocupa más del 50 % de la memoria del modelo, no se envía y se avisa: **"El archivo es demasiado grande para analizarlo de una vez. Divídelo en partes más pequeñas."**
- **Si el archivo cabe pero, sumado al historial, se pasa del límite**, primero se compacta el historial (el archivo nuevo no se resume) y después se envía.
- **Si aun así el servidor lo rechaza**, se muestra el mismo aviso de archivo demasiado grande, no el de conversación nueva. Así el usuario sabe que el problema es el archivo.

## Cómo funciona la compactación
- Se resumen los mensajes más antiguos y los últimos 6 se mantienen intactos.
- El resumen conserva cifras, nombres, fechas, decisiones y tareas pendientes.
- El resumen se guarda dentro de la conversación (oculto) y se reutiliza. Los mensajes originales siguen visibles en pantalla, pero no se vuelven a enviar al modelo.
- Mientras se compacta, el botón Detener cancela la operación.

## Detalles técnicos
- La memoria del modelo (`context_length`) se lee de `/v1/models` y se guarda en caché. Si no está disponible, se usa un valor por defecto de 200k.
- El tamaño se estima a partir de los caracteres (unos 4 caracteres por token). Las imágenes cuentan como un tamaño fijo. Se compacta al llegar al 80 % y se reserva espacio para la respuesta.
- El resumen se pide con una llamada en streaming al mismo `/api/chat` mediante `apiFetch`, con el razonamiento en "bajo" y un prompt que pide conservar la información.
- El error `context_overflow` se detecta en `ApiError` (por código o por mensaje) y no entra en el reintento genérico. Se reintenta una vez como máximo. El segundo fallo es terminal: si hay un adjunto grande en el último mensaje, muestra el aviso de archivo; si no, muestra el de conversación nueva.
- `UIMessage` recibe estos campos nuevos:
  - `kind: "compaction"` con `status`, `startedAt` y `ms`, para la línea con contador.
  - `summaryOf`, que marca hasta qué mensaje cubre el resumen.
- Se persisten en `chat_data` y en la copia local.
- El historial que se envía queda así: system + resumen + mensajes posteriores al corte.
- Se elimina el interruptor "Modo compacto" de Ajustes, porque no está claro qué hace en el servidor.
- Archivos afectados:
  - `src/hooks/use-chat.ts`
  - `src/lib/api/client.ts`
  - `src/lib/context.ts` (nuevo)
  - `src/components/chat/MessageView.tsx`
  - `src/components/chat/Compaction.tsx` (nuevo)
  - `ModelSettings.tsx`
- Pruebas: se forzará un límite de contexto pequeño para comprobar la compactación, el reintento único, el aviso final y un archivo demasiado grande. Se probará a 1280px y a 390px.
