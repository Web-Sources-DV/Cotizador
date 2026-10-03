# Cotizador Jurídico SQP

El cotizador y la app de financiamiento comparten el proyecto Supabase **Cotizador** (`bcmzhicashtsdzlmqrif`). Para Legal utiliza un proyecto independiente (`fipcnxfxxngdjunrlbat`).

Publica juntos `index.html`, `app.js`, `styles.css` y `logo.svg`. Inicia sesión con tu correo y contraseña de financiamiento; las cuentas y los perfiles `sqp_profiles` son compartidos entre estas dos apps.

Las cotizaciones y clientes vinculados se guardan en `sqp_app_data`. Los buckets comerciales son `clients`, `requests`, `financings`, `audit`, `config`, `counters`, `quotes`, `quote_templates` y `suggestions`. El contador de cotizaciones usa `counters/quote`; financiamiento conserva `counters/default`. El RPC `next_sqp_quote_number` asigna números atómicamente.

`supabase/setup.sql` documenta el esquema y los permisos del proyecto comercial. Nunca publiques usuarios, contraseñas, hashes o respaldos de clientes en el repositorio.

El logo oficial de Daryl se conserva en `logo.svg` y se utiliza en la interfaz, el favicon y los PDF de las cotizaciones. No sustituirlo por letras SQP, iconos ni otro diseño. La conversión a PNG para html2pdf usa ese mismo SVG.

## Uso por ejecutivo

El botón «Uso por ejecutivo» solo aparece cuando el servidor autoriza a la cuenta configurada. No depende del nombre visible, de un rol administrativo genérico ni de datos editables del token. La lista de acceso está en `private.cotizador_usage_access`, protegida por RLS y sin permisos de escritura para clientes. Cada RPC valida el ID autenticado y el perfil activo; las funciones son SECURITY INVOKER y conservan las políticas existentes.

Métrica: número de cotizaciones actualmente guardadas en el bucket `quotes`, atribuidas a su `owner_id`, cuya fecha ISO original `payload.date` cae en el período. Promedio diario = total / días calendario inclusivos, incluidos días sin actividad. Predeterminado: hoy y los 29 días anteriores en America/Panama. Rango ajustable de 1 a 366 días, sin fechas futuras. Se muestran ejecutivos registrados (también los de uso cero), la cuenta autorizada y propietarios de cotizaciones de otros roles. No mide tiempo conectado ni sesiones. Ediciones del mismo registro no suman otra cotización; registros eliminados, sin propietario registrado o sin fecha válida no se incluyen. No se reconstruye ni modifica el historial.

Despliegue: aplicar una sola vez `supabase/usage-report.sql` mediante una migración antes de publicar la interfaz. Un operador de base de datos debe registrar el UUID verificado de la única cuenta autorizada en `private.cotizador_usage_access`; no resolver permisos por nombre desde el navegador ni conceder escritura sobre esa tabla. La configuración de producción se mantiene fuera del repositorio. Publicar también `usage-report.js`. Si el reporte falla o no está instalado, su botón permanece oculto y el flujo de cotización continúa.

Validación: `node --check app.js`, `node --check usage-report.js`, `node --test tests/usage-report.test.cjs`. Ejecutar `tests/usage-report.sql` con una conexión administrativa de pruebas: utiliza fixtures en una transacción y finaliza con ROLLBACK. Comprueba promedios, fechas y rechazo de ejecutivos, otros administradores, usuarios inactivos y visitantes. No requiere paquetes npm ni un build: es una aplicación estática.

Comprobación manual: entrar con la cuenta autorizada, abrir el reporte y cambiar fechas. Entrar con otro usuario y comprobar que no aparece el botón y que invocar `cotizador_usage_report` devuelve permiso denegado. Al cerrar sesión, el reporte y sus resultados se limpian. Para revertir la interfaz, publicar el commit previo; el esquema aditivo puede permanecer sin uso. No ejecutar de nuevo el setup completo ni restablecer usuarios durante el despliegue.

## Gestión de usuarios dentro del Cotizador

Los administradores activos pueden abrir **Usuarios** para crear una cuenta con nombre, correo, contraseña inicial y uno de los roles existentes: ADMIN, SUPERVISOR, EXECUTIVE o VIEWER. También pueden cambiar roles y activar/desactivar perfiles. La interfaz impide desactivar o cambiar el propio rol. La desactivación conserva los registros históricos. Como Cotizador y Score comparten identidad, estos cambios se aplican a ambas aplicaciones.

La creación se ejecuta en la Edge Function `cotizador-users`. Valida el token con Supabase Auth y comprueba el perfil ADMIN activo en cada petición. Usa las variables de servidor SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY; ninguna clave privilegiada llega al navegador. La autenticación se comprueba dentro de la función (`verify_jwt=false`). El trigger existente crea el perfil; los correos duplicados producen un error y no modifican cuentas existentes.

La contraseña inicial de una cuenta nueva requiere 12 a 128 caracteres y puede estar sujeta a requisitos adicionales de Auth. No se guarda en localStorage ni logs y se limpia al finalizar o cerrar. No se envían invitaciones por correo. Las contraseñas y sesiones existentes no se cambian con este despliegue.

Desplegar primero `supabase/functions/cotizador-users/index.ts` junto con `handler.mjs` en el proyecto comercial; después publicar la interfaz. No ejecutar nuevamente setup.sql ni migrar usuarios. Pruebas: `node --test tests/users.test.mjs tests/users-ui.test.cjs`; usan servicios simulados y no crean cuentas reales.
