# Cotizador Jurídico — SQP Legal Consulting

Aplicación web en español para preparar cotizaciones de trámites jurídicos y migratorios, calcular importes por persona, generar presupuestos en PDF con la identidad de SQP Legal Consulting y llevar un historial local.

**Abrir la aplicación:** [web-sources-dv.github.io/Cotizador](https://web-sources-dv.github.io/Cotizador/)

## ¿Qué permite hacer?

- Registrar nombre, identificación, correo y teléfono del cliente.
- Sugerir el país y el indicativo telefónico, con un selector para números locales.
- Elegir el trámite, los servicios, sus precios y los documentos requeridos.
- Multiplicar el precio de cada servicio por la cantidad de personas, de 1 a 20, y mostrar el total al instante.
- Aplicar un descuento global una sola vez. No se añade IVA adicional al precio ingresado.
- Revisar un resumen antes de confirmar y crear el PDF con cantidades, precios unitarios, subtotales, condiciones y métodos de pago.
- Generar una referencia con consecutivo local e identificador aleatorio seguro para evitar duplicados entre navegadores. Editar conserva el número de la cotización.
- Consultar historial, estados, plantillas y seguimiento de cotizaciones, según el usuario.
- Ver, desde el usuario Lic. Daryl Villa, barras de participación diaria por ejecutivo calculadas sobre las cotizaciones de ese navegador. No miden tiempo de conexión ni reúnen otros dispositivos.
- Preparar el PDF y el mensaje del presupuesto para WhatsApp Web o la aplicación WhatsApp Business.

## Instalación y ejecución local

La aplicación principal es estática: **no necesita `npm install`, compilación, FastAPI, Next.js ni una base de datos de servidor**.

### Requisitos

- Un navegador actualizado, como Chrome, Edge, Firefox o Safari.
- Git para clonar el repositorio, o descargarlo desde **Code → Download ZIP** y descomprimirlo.
- Python 3 para ejecutar el servidor local de este ejemplo.
- Conexión a Internet para cargar la biblioteca de PDF desde cdnjs y abrir WhatsApp.

### Pasos

```sh
git clone https://github.com/Web-Sources-DV/Cotizador.git
cd Cotizador
python3 -m http.server 8000 --bind 127.0.0.1
```

En Windows, si el comando `python3` no existe:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Abrir **http://127.0.0.1:8000** en el navegador. Mantener la terminal abierta mientras se utiliza la aplicación y pulsar `Ctrl+C` para detener el servidor.

Usar el servidor local en lugar de abrir `index.html` mediante doble clic. Así se cargan los recursos desde un mismo origen y las funciones del navegador trabajan en un contexto compatible.

## Cómo crear una cotización

1. Seleccionar un usuario e ingresar. En el primer acceso, los usuarios con contraseña crean la suya en ese navegador; Lic. Daryl Villa está configurado para entrar sin contraseña.
2. Completar los datos del cliente. Escribir el teléfono con indicativo internacional o seleccionar el país para un número local. Panamá (`+507`) es la opción inicial.
3. Elegir el trámite y la cantidad de personas.
4. Marcar los servicios e ingresar el **precio por persona**. El descuento, si se selecciona, se aplica al total una sola vez.
5. Revisar requisitos, observaciones y total. Por ejemplo: tres servicios de $100 para tres personas producen un subtotal de $900; con $25 de descuento, el total es $875.
6. Generar y confirmar el resumen. La aplicación guarda la cotización en el historial local y asigna su referencia.
7. Consultar la vista previa, descargar el PDF o preparar su envío por WhatsApp. El contenido corto cabe en una página; el extenso continúa en las páginas necesarias.

## WhatsApp y envío del PDF

| Botón | Funcionamiento sin Cloud API configurada |
| --- | --- |
| **WhatsApp Web** | Prepara la descarga del PDF y abre el chat web del teléfono del cliente con el mensaje del presupuesto. |
| **WhatsApp Business** | Prepara la descarga del PDF y abre el enlace de WhatsApp asociado por el dispositivo. Si hay varias aplicaciones, se debe elegir Business. |

En estos modos, el ejecutivo debe **adjuntar el PDF descargado y confirmar el envío** en WhatsApp. Un enlace web no permite insertar automáticamente un archivo en el chat ni forzar la aplicación Business instalada. Abrir el chat no marca la cotización como enviada.

El repositorio incluye una integración opcional para enviar el documento y el mensaje automáticamente mediante **WhatsApp Business Cloud API de Meta**. Requiere un servidor, un número de empresa registrado y credenciales guardadas exclusivamente en ese servidor. Tener la aplicación WhatsApp Business instalada no activa esta API.

La configuración publicada mantiene el endpoint vacío: **el envío automático no está activado**. Para habilitarlo, seguir la [guía del servidor de WhatsApp Business](whatsapp-worker/README.md). Los mensajes libres con documentos están sujetos a la ventana de atención de 24 horas de Meta; fuera de ella se necesita una plantilla aprobada, no implementada actualmente. La aceptación de un mensaje por Meta no confirma entrega o lectura.

## Cómo está construido

El programa se construye a partir de una página estática que reúne el formulario, los estilos, el catálogo de servicios, las reglas de cálculo y los componentes de consulta. JavaScript escucha los cambios del formulario, calcula los importes en centavos y guarda el resultado confirmado en el navegador.

Para fabricar el PDF, la aplicación construye una versión HTML del presupuesto con el logotipo de la firma y la renderiza en un documento separado. Esto evita que el desplazamiento de la pantalla o los estilos de la interfaz recorten el archivo. `html2pdf.js` utiliza internamente html2canvas y jsPDF para producir el documento en tamaño carta y gestionar los saltos de página.

Los teléfonos se interpretan y formatean con `libphonenumber-js`, alojado en el repositorio. La numeración usa Web Crypto para el identificador aleatorio y Web Locks, cuando está disponible, para coordinar la creación entre pestañas del mismo origen. El contador también consulta el historial para recuperarse de un valor reiniciado o inválido.

| Tecnología | Uso |
| --- | --- |
| HTML5 y CSS | Formulario, diseño adaptable, modales, identidad visual y modo oscuro. |
| JavaScript del navegador | Cálculos, usuarios locales, historial, plantillas, numeración y acciones de la interfaz. |
| `localStorage` y `sessionStorage` | Datos persistentes del navegador y sesión local. |
| html2pdf.js 0.10.1 | Generación de PDF; se carga desde cdnjs. |
| libphonenumber-js 1.13.15 | Países, indicativos y formato telefónico; incluye su licencia y procedencia en `vendor/`. |
| GitHub Pages | Publicación de la aplicación estática. |
| Cloudflare Workers + Meta Cloud API | Servidor opcional para enviar PDF con mensaje; requiere configuración externa. |
| Node.js y `node:test` | Pruebas de las reglas de negocio y de las integraciones simuladas. |

### Archivos principales

| Archivo o carpeta | Contenido |
| --- | --- |
| [index.html](index.html) | Punto de entrada que se ejecuta en GitHub Pages. Incluye los estilos y la lógica principal activa. |
| [app.js](app.js) y [stilos.css](stilos.css) | Archivos separados de lógica y estilos conservados en el proyecto. El `index.html` actual no los carga directamente; no sustituyen su código embebido. |
| [phone-country.js](phone-country.js) | Selector de país, sugerencias de indicativo y normalización del teléfono. |
| [whatsapp-business.js](whatsapp-business.js) | Preparación del PDF y mensaje para Web/aplicación, y cliente de la integración automática opcional. |
| [whatsapp-business-config.js](whatsapp-business-config.js) | Dirección pública del servidor opcional. No debe contener secretos. |
| [whatsapp-worker/](whatsapp-worker/) | Servidor opcional, configuración de despliegue e instrucciones de activación. |
| [vendor/](vendor/) | Biblioteca telefónica local, licencia y procedencia. |
| [tests/](tests/) | Pruebas de teléfonos, importes, numeración y flujos de WhatsApp. |

## Datos, acceso y alcance

El historial, el contador, los usuarios, las plantillas y las sugerencias se guardan en el navegador. **No hay sincronización central entre ejecutivos o dispositivos.** Cambiar de navegador, usar otro origen —por ejemplo, pasar de la instalación local a GitHub Pages— o borrar sus datos puede dejar un historial diferente o eliminarlo.

El consecutivo es local; el identificador aleatorio adicional distingue las referencias completas generadas en diferentes navegadores. No es una secuencia global centralizada ni garantiza una numeración sin saltos. Las cotizaciones ya emitidas conservan sus números.

El acceso de usuarios y sus roles se comprueban en el cliente. Este mecanismo organiza la interfaz, pero no equivale a autenticación de servidor ni a una base de datos protegida. El servicio opcional de Meta exige su propia clave de envío y mantiene el token de Meta fuera del sitio público.

## Ejecutar las pruebas

Para desarrollo y comprobación, instalar **Node.js 20 o superior**. Desde la carpeta del repositorio:

```sh
node --test tests/*.test.*
```

No es necesario instalar paquetes npm para estas pruebas. Cubren importes por persona, descuentos, países e indicativos, numeración, apertura del chat y validación del servidor de WhatsApp. Las solicitudes a Meta se simulan: las pruebas no envían mensajes reales.

## Publicar en GitHub Pages

1. Subir los cambios a la rama `main` del repositorio.
2. En GitHub, abrir **Settings → Pages** y configurar la publicación desde `main`, carpeta `/ (root)`.
3. Esperar a que termine correctamente el flujo **pages build and deployment** en **Actions**.
4. Abrir la aplicación publicada y recargar la página para usar la nueva versión.

GitHub Pages publica los archivos estáticos; no ejecuta el servidor de Cloud API. Ese componente se despliega por separado siguiendo su [guía de instalación](whatsapp-worker/README.md).
