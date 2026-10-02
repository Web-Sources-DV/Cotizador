# Cotizador Jurídico SQP

Aplicación estática del cotizador jurídico. Publica estos archivos juntos desde la raíz del repositorio:

- `index.html`
- `app.js`
- `styles.css`

## Datos y acceso

El cotizador se integra con el proyecto Supabase compartido de SQP y reutiliza `sqp_profiles` y `sqp_app_data`. La sesión se valida con Supabase Auth; los permisos efectivos dependen del perfil activo y de las políticas RLS ya aplicadas en la base.

Cotizaciones, clientes vinculados, plantillas, preferencias del perfil y sugerencias se guardan en la base de datos. El almacenamiento local solo mantiene una caché para lectura y se actualiza después de aceptar una escritura Supabase. Los precios de servicios adicionales y los descuentos se calculan por persona.

El número de cotización se obtiene del RPC `next_sqp_quote_number`. No se requiere una migración adicional para este cambio.

## PDF

El documento generado incluye las observaciones y, justo debajo, las condiciones del trámite indicadas por SQP.
