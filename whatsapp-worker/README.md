# Envío de cotizaciones con WhatsApp Business Cloud API

GitHub Pages sirve la interfaz estática y no puede custodiar tokens de Meta. Este Worker recibe un PDF y su mensaje, sube el documento a Meta y envía un mensaje de tipo `document` con el texto como `caption` al teléfono internacional exacto del cliente. El remitente es el número de la empresa registrado en Meta, no el WhatsApp personal del ejecutivo.

## Requisitos pendientes

La aplicación WhatsApp Business instalada no es suficiente. El administrador debe:

1. Configurar una cuenta de WhatsApp Business Platform / Cloud API en Meta y registrar el número de la empresa. Comprobar con Meta la elegibilidad y los pasos de migración o coexistencia antes de cambiar un número en uso.
2. Obtener un Phone Number ID y un token de servidor con permisos `whatsapp_business_messaging` y acceso a ese número. No compartir el token en chats ni guardarlo en GitHub o en el navegador.
3. Crear una cuenta de Cloudflare Workers o adaptar `handleRequest` a otro servidor compatible con Request/Response/FormData. El Worker aún no está desplegado.

## Desplegar en Cloudflare Workers

Desde `whatsapp-worker/`, usando Wrangler oficial y autenticación propia de Cloudflare:

```sh
npx wrangler login
```

Completar `META_PHONE_NUMBER_ID` en `wrangler.toml` y comprobar `ALLOWED_ORIGIN`. El origen permitido de producción es `https://web-sources-dv.github.io` (sin ruta). Crear los secretos mediante las entradas seguras de Cloudflare o los prompts de Wrangler:

```sh
npx wrangler secret put META_ACCESS_TOKEN
npx wrangler secret put API_SHARED_KEY
npx wrangler deploy
```

`API_SHARED_KEY` debe ser una clave aleatoria larga distinta del token de Meta. Solo los ejecutivos autorizados deben conocerla; el navegador la pide al enviar y no la conserva. Quien posea esa clave puede usar el número de empresa para enviar documentos: debe revocarse y sustituirse si se divulga. No escribir valores secretos en archivos, capturas, argumentos de comandos o chat. La validación de usuarios actual de la página es local y no constituye autenticación de servidor; por eso el Worker exige una clave adicional y valida el origen.

Después del despliegue, establecer únicamente la URL pública `https://<worker>/send-quote` en `whatsapp-business-config.js`. Este archivo no debe contener tokens ni claves. Publicar la configuración de GitHub Pages. Mientras `endpoint` esté vacío, el botón Business descarga el PDF y abre el enlace de WhatsApp asociado por el dispositivo; el ejecutivo debe adjuntarlo y confirmar el envío. Al configurar el endpoint, Business utiliza Cloud API para el envío automático. El botón WhatsApp Web conserva la descarga del PDF y la apertura del chat web para adjuntarlo manualmente. Un enlace del navegador no puede forzar la aplicación Business si el dispositivo tiene otra aplicación asociada.

## Restricciones reales de Meta

- Para enviar un documento con texto libre, el cliente debe haber abierto una conversación válida dentro de la ventana de atención de 24 horas. Fuera de esa ventana se necesita una plantilla aprobada de Meta; esta integración no incorpora plantillas ni inicia automáticamente conversaciones fuera de la ventana. Se informa del rechazo de Meta y no se presenta como enviado.
- En modo de prueba de Meta, el destinatario debe figurar entre los números autorizados.
- El mensaje con firma admite hasta 1024 caracteres y el PDF hasta 5 MB en esta integración.
- Un ID de mensaje indica aceptación por Meta, no entrega ni lectura. Para confirmar entrega hacen falta webhooks adicionales; no están implementados.
- Si hay un fallo de red tras la solicitud, revisar el estado antes de reintentar para evitar mensajes duplicados.
- Configurar permisos, límites de uso y facturación apropiados en Meta/Cloudflare antes de habilitar producción. No hay envíos reales verificados ni credenciales disponibles en este repositorio.

## Pruebas

Desde el checkout:

```sh
node --test tests/quote-pricing.test.cjs tests/whatsapp-worker.test.mjs tests/phone-country.test.cjs
```

Las pruebas sustituyen las respuestas de Meta. No envían mensajes ni requieren secretos.
