# Cotizador Jurídico SQP

El cotizador y la app de financiamiento comparten el proyecto Supabase **Cotizador** (`bcmzhicashtsdzlmqrif`). Para Legal utiliza un proyecto independiente (`fipcnxfxxngdjunrlbat`).

Publica juntos `index.html`, `app.js`, `styles.css` y `logo.svg`. Inicia sesión con tu correo y contraseña de financiamiento; las cuentas y los perfiles `sqp_profiles` son compartidos entre estas dos apps.

Las cotizaciones y clientes vinculados se guardan en `sqp_app_data`. Los buckets comerciales son `clients`, `requests`, `financings`, `audit`, `config`, `counters`, `quotes`, `quote_templates` y `suggestions`. El contador de cotizaciones usa `counters/quote`; financiamiento conserva `counters/default`. El RPC `next_sqp_quote_number` asigna números atómicamente.

`supabase/setup.sql` documenta el esquema y los permisos del proyecto comercial. Nunca publiques usuarios, contraseñas, hashes o respaldos de clientes en el repositorio.

El logo oficial de Daryl se conserva en `logo.svg` y se utiliza en la interfaz, el favicon y los PDF de las cotizaciones. No sustituirlo por letras SQP, iconos ni otro diseño. La conversión a PNG para html2pdf usa ese mismo SVG.
