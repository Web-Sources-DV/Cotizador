# Cotizador Jurídico — SQP Legal Consulting

Herramienta web para preparar presupuestos de trámites jurídicos y migratorios. Reúne los datos del cliente, los servicios, los requisitos y las condiciones del trámite en una cotización que se puede revisar, descargar en PDF y preparar para enviar por WhatsApp.

El trabajo del ejecutivo se realiza en español. El documento del cliente puede generarse en otro idioma sin cambiar el formulario ni modificar el registro original.

**Desarrollo asistido por IA:** se utilizó OpenAI Codex en la implementación de mejoras, la depuración, las pruebas y la documentación del proyecto.

**Aplicación publicada:** [web-sources-dv.github.io/Cotizador](https://web-sources-dv.github.io/Cotizador/)

[Guía para usuarios nuevos](#guía-de-uso-para-usuarios-nuevos) · [Funciones](#funciones) · [Mejoras](#mejoras-incorporadas) · [Uso de IA](#uso-de-inteligencia-artificial-en-el-desarrollo) · [Instalación local](#instalación-local)

## Alcance del proyecto

El proyecto está centrado en la elaboración de cotizaciones: desde la captura de datos hasta la preparación del documento que recibe el cliente. La aplicación principal funciona en el navegador y se publica como un sitio estático en GitHub Pages.

El historial y la configuración de usuarios son locales a cada navegador. Esta decisión simplifica la instalación, pero también define su alcance: no hay una base de datos compartida, sincronización entre dispositivos ni un sistema de autenticación de servidor. El envío automático mediante WhatsApp Business es un componente opcional que requiere infraestructura y credenciales propias.

## Uso de inteligencia artificial en el desarrollo

Este proyecto se ha desarrollado y mejorado con asistencia de inteligencia artificial, mediante **OpenAI Codex**. La herramienta se utilizó para analizar el código existente, implementar cambios solicitados, corregir errores, preparar y ejecutar verificaciones, y redactar documentación. Los requisitos y las prioridades funcionales se definieron a partir de las indicaciones de la persona responsable del proyecto.

La asistencia de IA durante el desarrollo es distinta del funcionamiento de la aplicación: los precios, descuentos y referencias se resuelven mediante reglas de JavaScript. La traducción del PDF utiliza los motores descritos en su apartado. La participación de Codex en el desarrollo no significa que los datos de los clientes se envíen a OpenAI al utilizar el cotizador.

## Funciones

### Preparación y cálculo

- Registro de nombre, identificación, correo y teléfono del cliente.
- Selector de país y sugerencia del indicativo telefónico. Panamá (`+507`) es el país inicial; los números internacionales se guardan con su indicativo.
- Búsqueda del trámite mediante sugerencias, selección de servicios y autoselección de requisitos según el trámite; las casillas de documentación pueden ajustarse manualmente.
- Cantidad de personas entre 1 y 20, con precios unitarios y recálculo inmediato del presupuesto.
- Servicio **Otros**, con precio por persona, para gastos o documentación que no figuren en las opciones habituales. El detalle puede escribirse en Observaciones.
- Descuento global aplicado una sola vez. El sistema no añade IVA adicional al importe ingresado.
- Resumen de confirmación antes de guardar la cotización.

El cálculo parte de los servicios seleccionados:

```text
Subtotal = suma de los precios por persona × cantidad de personas
Total    = subtotal − descuento global
```

Por ejemplo, Honorarios de $100, Gastos Administrativos de $50 y Otros de $25 suman $175 por persona. Para dos personas, el subtotal es $350. Si se aplica un descuento de $20, el total es $330.

### Documentos e idiomas

El PDF incluye la identidad de la firma, los datos del cliente, el trámite, las cantidades, los precios unitarios, los subtotales, los requisitos, las condiciones y los métodos de pago. La vista previa, la descarga y la preparación del archivo para WhatsApp utilizan la misma ruta de generación. El documento incluye las condiciones fijas de la firma junto con las observaciones añadidas por el ejecutivo; el contenido corto cabe en una página y el extenso continúa según su longitud.

La opción **Traducir** trabaja sobre el documento del cliente. Admite español, inglés, portugués, francés, alemán, italiano, neerlandés, polaco, rumano, ruso, sueco y turco. Los campos de identidad, las marcas, los nombres de bancos, las referencias, las cuentas y los importes conservan sus valores.

### Registro y seguimiento

Cada cotización nueva recibe una referencia formada por el año de Panamá, un consecutivo local y un identificador aleatorio seguro. El contador consulta el historial para recuperarse de un valor reiniciado o inválido. Editar una cotización conserva su número; el doble clic en Confirmar no crea dos registros.

Las herramientas disponibles dependen del usuario y de su rol:

| Herramienta | Funciones disponibles |
| --- | --- |
| Historial administrativo | Consulta de referencias, fechas, ejecutivo, cliente, trámite e importe; filtros por cliente, ejecutivo, trámite y rango de fechas, con opción de limpiar filtros. |
| Estados | Cambio manual entre pendiente, enviada, aprobada, rechazada y convertida. Abrir un chat no demuestra que se haya enviado el presupuesto. |
| Dashboard administrativo | Conteo de cotizaciones asociadas a usuarios con rol ejecutivo, a partir del historial de ese navegador. |
| Uso diario por ejecutivo | Panel exclusivo de Lic. Daryl Villa con fecha seleccionable y barras de participación porcentual por cotizaciones. Usa la zona horaria de Panamá; no mide tiempo de conexión ni reúne otros dispositivos. |
| Plantillas | Guardar los servicios seleccionados con sus precios y trámite, volver a cargarlos y eliminar las plantillas que ya no se utilicen. |
| Seguimiento | Lista de cotizaciones pendientes de más de siete días sin recordatorio gestionado, con antigüedad y enlace para preparar un mensaje de WhatsApp. El registro local marca el recordatorio al abrir el enlace; no confirma su envío ni programa mensajes automáticos. |
| Usuarios | Alta de usuarios, cambio de rol entre ejecutivo y administrador y eliminación de otros usuarios desde el panel administrativo. Estas acciones son locales al navegador. |
| Perfil | Firma utilizada en los mensajes, fotografía optimizada para almacenamiento y cambio de contraseña para las cuentas que la requieren. |
| Ayuda y soporte | Manual breve de uso y enlace al contacto de soporte por WhatsApp. |
| Sugerencias | Formulario con mensaje, nombre y correo opcionales. Se guarda en el navegador; Lic. Daryl Villa puede revisar y borrar las sugerencias locales. No es un envío por correo ni un buzón centralizado. |
| Presentación | Diseño adaptable, modo oscuro y preferencia de tema guardada en el navegador. |

Al recuperar una sesión guardada se comprueba que no hayan pasado más de ocho horas desde el inicio; también puede cerrarse mediante **Salir**. Las contraseñas de las cuentas que las requieren se guardan como un hash con salt en el navegador. El enlace de recuperación muestra indicaciones para contactar al administrador; no implementa un restablecimiento automático por correo. Lic. Daryl Villa mantiene el acceso sin contraseña configurado para ese usuario. Estos controles no sustituyen una autenticación de servidor.

## Qué lo diferencia de un cotizador genérico

La diferencia está en el flujo de trabajo que resuelve y en las reglas que aplica al documento:

- **Está organizado alrededor del trámite.** Servicios, documentación requerida, observaciones y condiciones forman parte del mismo presupuesto. El precio no queda separado de lo que el cliente necesita presentar.
- **Separa el idioma de trabajo del idioma de entrega.** El ejecutivo conserva la interfaz en español y el cliente recibe el PDF en el idioma elegido. La traducción también contempla los textos libres del trámite y las observaciones.
- **Mantiene el cálculo visible.** La cantidad de personas afecta a cada servicio seleccionado. El resumen y el PDF muestran cantidad, precio unitario y subtotal, de modo que el total se puede comprobar.
- **Conserva la referencia al editar.** La cotización mantiene su identidad durante una corrección. La numeración incorpora un componente aleatorio para distinguir documentos creados en navegadores diferentes.
- **Puede ejecutarse como sitio estático.** La aplicación principal no necesita instalar un servidor de aplicación ni una base de datos. Esto facilita su despliegue, a cambio de mantener los datos separados por navegador.

Estas son decisiones de este proyecto, no una comparación de rendimiento o cobertura con productos comerciales. Para una operación con expedientes compartidos, permisos centralizados o facturación integrada habría que incorporar esos componentes.

## Mejoras incorporadas

| Área | Cambio implementado |
| --- | --- |
| Importes | Cálculo en centavos, multiplicación por personas, descuento global y total visible mientras se edita. |
| Servicios | Opción Otros con precio propio y lectura del precio desde la fila correcta al guardar plantillas. |
| PDF | Renderizado en un documento separado para evitar que el desplazamiento o los estilos de la pantalla recorten el contenido; paginación según su extensión. |
| Numeración | Recuperación del contador desde el historial, identificadores aleatorios y coordinación entre pestañas mediante Web Locks cuando el navegador lo permite. |
| Teléfonos | Reconocimiento de indicativos, selector de país y uso del número internacional del cliente al preparar el chat. |
| WhatsApp | Botones separados para Web y Business, descarga del PDF y enlace al destinatario si el navegador bloquea la ventana. |
| Traducción | Idioma independiente para el PDF, términos revisados para encabezados y controles que detienen la generación si una traducción altera cifras. |
| Acceso y seguimiento | Acceso sin contraseña para Lic. Daryl Villa, panel exclusivo de uso diario y documentación del alcance local de usuarios, historial y sugerencias. |
| Validación | Pruebas automatizadas de cálculos, numeración, teléfonos, traducción y solicitudes simuladas a WhatsApp Business Cloud API. |

## Guía de uso para usuarios nuevos

### 1. Abrir la aplicación e ingresar

Abrir la [aplicación publicada](https://web-sources-dv.github.io/Cotizador/) en un navegador actualizado. Para utilizar esta versión no hace falta clonar el repositorio ni instalar Python; la instalación local del siguiente apartado está dirigida a quien quiera ejecutarla en su equipo.

Seleccionar el usuario. Si es su primer acceso en ese navegador, crear la contraseña cuando se solicite. Si ya existe una contraseña local para esa cuenta, utilizar la que se creó anteriormente. Lic. Daryl Villa entra sin contraseña. Al terminar el trabajo, usar **Salir**.

### 2. Completar los datos del cliente

Introducir el nombre del cliente o empresa, identificación, correo y teléfono. Revisar especialmente el número: será el destinatario utilizado por los botones de WhatsApp.

Para un teléfono local de Panamá, dejar el país en Panamá e introducir los ocho dígitos. Para otro país, seleccionarlo o escribir el teléfono completo con `+` e indicativo. La sugerencia muestra el país y el formato reconocido; comprobarlos antes de continuar.

### 3. Elegir el trámite y revisar los requisitos

Escribir o seleccionar el trámite en el campo de búsqueda. La aplicación puede marcar los requisitos asociados a las opciones del catálogo. Revisar esas casillas y ajustar los documentos que correspondan al caso concreto.

### 4. Indicar personas, servicios y precios

Introducir la cantidad de personas. Marcar cada servicio que se va a cobrar y escribir su **precio por persona**. Un precio escrito en una fila sin marcar no se suma al presupuesto.

Usar **Otros** para un gasto o documentación adicional y explicar su concepto en **Observaciones**. Si corresponde un descuento, marcar **Descuento** e introducir su importe global; no se multiplica por personas.

Ejemplo para dos personas:

| Servicio | Precio por persona | Importe para dos personas |
| --- | ---: | ---: |
| Honorarios | $100 | $200 |
| Gastos Administrativos | $50 | $100 |
| Otros | $25 | $50 |
| **Subtotal** | | **$350** |
| Descuento global | | −$20 |
| **Total** | | **$330** |

El total se actualiza mientras se modifican los precios, las casillas o la cantidad de personas. No hay que sumar manualmente un IVA adicional.

### 5. Revisar y confirmar

Pulsar **Generar presupuesto** y revisar el resumen: cliente, trámite, personas, servicios, descuento e importe final. Si hay un dato incorrecto, cancelar el resumen y corregirlo. Si está bien, pulsar **Confirmar**.

La cotización queda guardada en el historial local y recibe su referencia. Usar **Editar** para corregir ese mismo presupuesto sin cambiar su número. Usar **Nuevo** para comenzar una cotización independiente.

### 6. Revisar el PDF y elegir su idioma

Pulsar **Vista previa** para revisar el documento y **Descargar PDF** para guardarlo. Comprobar datos del cliente, importes, requisitos y condiciones antes de entregarlo.

Si el cliente necesita otro idioma:

1. Pulsar **Traducir** al final de la cotización confirmada.
2. Seleccionar el idioma en que se escribieron los textos libres y el idioma que necesita el cliente.
3. Pulsar **Traducir y generar PDF** y esperar a que termine. Si el servicio informa un error o un límite de uso, no se genera un archivo parcialmente traducido.
4. Revisar el archivo descargado. El indicador **PDF del cliente** informa qué versión se usará en las siguientes vistas previas, descargas y archivos preparados para WhatsApp.

El formulario y el registro original mantienen su contenido. Ver español en el panel del ejecutivo después de traducir no significa que haya fallado: comprobar el idioma en el PDF. Para volver al documento de origen, pulsar **Usar PDF español original**.

### 7. Preparar el envío por WhatsApp

Elegir **WhatsApp Web** para abrir el chat web, o **WhatsApp Business** para utilizar el enlace de la aplicación asociada al dispositivo. Ambos preparan la descarga del PDF y el mensaje para el teléfono guardado en la cotización.

En la configuración actual, hay que **adjuntar el PDF descargado y pulsar Enviar dentro de WhatsApp**. Si se tienen varias aplicaciones instaladas, elegir Business cuando corresponda. Si el navegador bloquea la ventana o se cierra antes de abrir el chat, utilizar el enlace al cliente que aparece después de la descarga.

El botón Business solo realiza un envío automático si un administrador ha desplegado y configurado la integración de Cloud API descrita más abajo. La aplicación WhatsApp Business instalada, por sí sola, no activa ese servicio.

### 8. Reutilizar y consultar el trabajo

- **Plantillas:** guardar la selección habitual de servicios y precios, asignarle un nombre y cargarla en presupuestos posteriores. Revisar los valores antes de confirmar cada caso.
- **Historial:** disponible para administradores, permite localizar cotizaciones por cliente, ejecutivo, trámite o fecha y actualizar su estado.
- **Seguimiento:** revisar los pendientes antiguos y preparar recordatorios cuando corresponda; el ejecutivo confirma el envío en WhatsApp.
- **Perfil:** actualizar la firma de los mensajes, la fotografía y la contraseña cuando aplique.
- **Ayuda:** consultar el manual breve, abrir el contacto de soporte o guardar una sugerencia local.

Las opciones administrativas y el panel exclusivo de uso diario no aparecen para todos los usuarios.

### Antes de cerrar el navegador

Conservar los PDF que se necesiten entregar o archivar. El historial de la aplicación pertenece a ese navegador y origen: entrar con el mismo nombre desde otro equipo no recupera esos registros. Borrar los datos del sitio o cerrar una sesión privada puede eliminarlos. Si hay un problema de acceso, contactar al administrador antes de borrar el almacenamiento del navegador.

## Instalación local

### Requisitos

- Navegador actualizado.
- Git para clonar el repositorio, o el ZIP descargado desde **Code → Download ZIP**.
- Python 3 para el servidor HTTP del ejemplo.
- Conexión a Internet para la biblioteca PDF alojada en cdnjs, WhatsApp y la traducción en línea cuando se utilice.

La aplicación principal se sirve directamente desde sus archivos. No requiere instalar paquetes npm ni ejecutar una compilación.

```sh
git clone https://github.com/Web-Sources-DV/Cotizador.git
cd Cotizador
python3 -m http.server 8000 --bind 127.0.0.1
```

En Windows se puede usar el lanzador de Python:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Abrir **http://127.0.0.1:8000**. La terminal debe permanecer abierta mientras se utiliza el servidor; `Ctrl+C` lo detiene. Se recomienda este acceso por HTTP local en lugar de abrir `index.html` mediante doble clic.

## Traducción del PDF

Después de confirmar, pulsar **Traducir** en la parte inferior. Seleccionar el idioma de los textos libres y el idioma del documento final. Los títulos y las opciones del catálogo se traducen desde español, aunque las observaciones estén escritas en otro idioma.

**Traducir y generar PDF** descarga el documento y selecciona esa versión para las siguientes vistas previas, descargas y archivos preparados para WhatsApp. **Usar PDF español original** restaura el documento de origen. Al confirmar cambios, iniciar una cotización nueva o recargar la página se descarta la selección de traducción; los archivos ya descargados permanecen en el dispositivo.

El motor utiliza la [Translator API del navegador](https://developer.chrome.com/docs/ai/translator-api) cuando está disponible. Puede requerir una descarga inicial de modelos. La alternativa es la [API pública de MyMemory](https://mymemory.translated.net/doc/spec.php), sujeta a disponibilidad y límites diarios. En ese modo se envían al proveedor los textos que deben traducirse, incluidas las observaciones; los campos de identidad y contacto marcados como protegidos se excluyen.

Las traducciones se reutilizan en memoria durante la sesión. Si el servicio falla, alcanza su límite o devuelve una traducción que cambia una cifra, se muestra un error y no se descarga un PDF parcialmente traducido. Los encabezados jurídicos más ambiguos cuentan con términos revisados, pero el documento debe revisarse antes de entregarlo al cliente, especialmente las condiciones del trámite.

## WhatsApp: preparación del chat y envío automático

Con la configuración incluida en el repositorio, ambos botones preparan la descarga del PDF y el mensaje para el teléfono de la cotización:

| Opción | Destino |
| --- | --- |
| WhatsApp Web | Chat en `web.whatsapp.com` con el número del cliente y el mensaje del presupuesto. |
| WhatsApp Business | Enlace de WhatsApp que abre la aplicación asociada por el dispositivo. Si hay varias instaladas, se debe elegir Business. |

El ejecutivo debe adjuntar el PDF descargado y confirmar el envío. Un enlace del navegador no permite insertar automáticamente el archivo en el chat ni forzar la aplicación Business instalada. Abrir el chat no marca la cotización como enviada.

La integración opcional con **WhatsApp Business Cloud API** sí prepara una solicitud de documento con el mensaje como texto adjunto, desde el número de empresa registrado en Meta. Requiere desplegar un servidor y configurar sus credenciales. El endpoint incluido está vacío: **el envío automático no está activado**.

La [guía de configuración del servidor](whatsapp-worker/README.md) explica los requisitos. Los documentos con texto libre están sujetos a la ventana de atención de 24 horas de Meta; fuera de ella se requiere una plantilla aprobada, que esta integración no implementa. La aceptación de un mensaje por Meta tampoco confirma su entrega o lectura.

## Arquitectura y organización

La entrada de la aplicación es `index.html`, que contiene el formulario, los estilos y la lógica principal activa. Los módulos separados resuelven teléfonos, traducción y preparación del envío. La generación del PDF construye una representación HTML del presupuesto en un documento aislado y la convierte a tamaño carta con html2pdf.js, que incluye html2canvas y jsPDF.

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| [index.html](index.html) | Interfaz, catálogo, cálculos, historial y generación del presupuesto. |
| [phone-country.js](phone-country.js) | Países, indicativos y formato internacional de teléfonos. |
| [pdf-translation.js](pdf-translation.js) | Traducción del documento y selección de la versión para el cliente. |
| [whatsapp-business.js](whatsapp-business.js) | Preparación del PDF, mensaje y chat; cliente del servidor opcional de envío. |
| [whatsapp-business-config.js](whatsapp-business-config.js) | URL pública del servidor opcional. No debe contener secretos. |
| [whatsapp-worker/](whatsapp-worker/) | Implementación del servidor para Cloud API, configuración e instrucciones de despliegue. |
| [vendor/](vendor/) | libphonenumber-js 1.13.15, su licencia y la procedencia del archivo. |
| [tests/](tests/) | Pruebas con el ejecutor nativo de Node.js. |
| [app.js](app.js), [stilos.css](stilos.css) | Versiones separadas de lógica y estilos conservadas en el proyecto. El punto de entrada actual no las carga directamente. |

Se utilizan HTML, CSS y JavaScript del navegador. Los datos persistentes se guardan en `localStorage`; la sesión utiliza `sessionStorage`. html2pdf.js 0.10.1 se carga desde cdnjs y libphonenumber-js se sirve desde el repositorio. El servidor opcional está preparado para Cloudflare Workers y la API de Meta.

## Pruebas

Se requiere **Node.js 20 o superior**. Desde la raíz del repositorio:

```sh
node --test tests/*.test.*
```

Las pruebas cubren importes por persona, descuentos, selección de países, recuperación del contador, confirmaciones repetidas, traducción y preparación de solicitudes de envío. Las respuestas de traducción y de Meta se simulan; ejecutar la suite no envía mensajes reales ni requiere consultar esos servicios. No es necesario instalar paquetes npm para ejecutarla.

## Publicación

La aplicación está publicada con GitHub Pages desde la rama `main`, carpeta raíz. Para reproducir ese despliegue, configurar **Settings → Pages**, seleccionar esa rama y esperar a que termine correctamente **pages build and deployment** en **Actions**.

GitHub Pages sirve la interfaz estática. El servidor opcional de WhatsApp se despliega por separado y sus tokens deben mantenerse fuera del repositorio y del navegador.

## Límites actuales y siguientes pasos

- **Datos locales.** Cambiar de navegador u origen —por ejemplo, entre la instalación local y GitHub Pages— muestra un almacenamiento distinto. Borrar los datos del sitio puede eliminar el historial local.
- **Acceso comprobado en el cliente.** Los usuarios y sus roles organizan la interfaz; no sustituyen la autenticación ni el control de acceso de un servidor.
- **Numeración local con identificador aleatorio.** El consecutivo no es una secuencia global ni garantiza una numeración sin saltos. Las referencias ya emitidas se conservan.
- **Participación diaria local.** El panel por ejecutivo se calcula con el historial disponible en ese navegador.
- **Servicios externos.** La traducción en línea, la biblioteca PDF remota y el envío mediante Meta dependen de la disponibilidad y condiciones de sus proveedores.

Para pasar a una operación centralizada, los siguientes componentes serían una base de datos compartida, autenticación de servidor y control de acceso por usuario. También queda pendiente configurar Cloud API y, si se necesitan mensajes fuera de la ventana de atención, incorporar plantillas aprobadas y webhooks de estado. Estos puntos describen trabajo pendiente, no funciones disponibles en la versión actual.
