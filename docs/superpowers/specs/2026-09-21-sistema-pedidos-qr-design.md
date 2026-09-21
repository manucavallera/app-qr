# Sistema de Autogestión y Pedidos QR — Especificación de diseño

**Fecha:** 21 de septiembre de 2026  
**Fuente:** `Propuesta_Sistema_Autogestion_y_Pedidos_QR (1).pdf`  
**Alcance inicial:** un único bar de hamburguesas  
**Evolución prevista:** permitir una futura adaptación a otros comercios sin incluir multiempresa en esta versión

## 1. Objetivo

Construir una aplicación web para que los clientes realicen pedidos individuales desde el QR de su mesa, paguen con Mercado Pago o mediante un medio tradicional, consulten el estado de su pedido y reciban un aviso cuando esté listo.

El personal debe recibir las comandas en tiempo real, administrar su preparación y cobro, mantener la carta y continuar operando desde barra o caja después del horario de corte de los pedidos por QR.

El resultado se considera exitoso cuando un cliente puede completar el recorrido desde el escaneo hasta la entrega sin crear una cuenta, y el personal puede procesar el pedido sin perder información ni preparar comandas que todavía no fueron autorizadas.

## 2. Correcciones y precisiones sobre la propuesta original

La propuesta comercial expresa correctamente la intención general, pero requiere las siguientes precisiones para poder implementarse:

1. **Horario de corte:** antes del corte se admiten pedidos por QR. Después del corte se bloquean solamente los pedidos y pagos nuevos desde el QR; las órdenes ya iniciadas continúan hasta su resolución. La operación nueva pasa a barra o caja.
2. **Pago antes de preparación:** una comanda ingresa a preparación únicamente después de un pago digital confirmado o de la confirmación del personal para un pago tradicional.
3. **Avisos al cliente:** la actualización dentro de la página es parte obligatoria de la primera versión. Las notificaciones push quedan fuera del alcance inicial porque dependen del navegador, del sistema operativo y del permiso del usuario.
4. **Panel de operación:** la expresión “interfaz local” se reemplaza por una aplicación web segura alojada en Internet y accesible desde los dispositivos autorizados del local.
5. **Pedidos individuales:** cada cliente se identifica con un nombre o apodo y conserva su propio pedido, aunque varias personas utilicen el QR de una misma mesa.
6. **Barra y cocina:** el sistema admite estaciones configurables. La instalación inicial utiliza una cola general y puede activar vistas separadas de barra y cocina más adelante.
7. **Productos de retiro:** cada producto puede configurarse para entrega en mesa o retiro en barra.
8. **Plazo comercial:** los 7 a 12 días corridos del documento original se consideran una estimación comercial preliminar. El compromiso técnico se definirá con el plan de implementación y las dependencias de Mercado Pago, infraestructura, contenido de la carta y prueba en el local.

## 3. Alcance funcional de la primera versión

### 3.1 Cliente

- Acceder desde el navegador mediante un QR permanente y no predecible asociado a una mesa.
- Consultar la carta sin instalar una aplicación.
- Ingresar un nombre o apodo, sin registro de cuenta.
- Consultar categorías, productos, precios y disponibilidad.
- Elegir variantes, acompañamientos y extras con sus diferencias de precio.
- Agregar observaciones breves permitidas por el comercio.
- Revisar el carrito y el precio final antes de confirmar.
- Elegir Mercado Pago o pago tradicional.
- Consultar el estado propio del pedido en tiempo real.
- Ver si cada producto se entrega en mesa o se retira en barra.
- Recibir un aviso visual dentro de la página cuando el pedido esté listo y un aviso sonoro cuando el navegador lo permita.

El cliente no puede consultar pedidos, consumos ni datos de otras personas de la mesa.

### 3.2 Personal operativo

- Iniciar sesión como operador.
- Consultar pedidos pendientes de cobro tradicional.
- Confirmar o rechazar un cobro tradicional.
- Crear pedidos recibidos directamente en barra o caja.
- Consultar la cola de comandas autorizadas.
- Cambiar estados de preparación y entrega.
- Filtrar la vista por estación cuando esa separación esté habilitada.
- Marcar temporalmente productos como disponibles o agotados.
- Cerrar sesiones de mesa y cancelar pedidos según las reglas establecidas.
- Pausar y reanudar los pedidos por QR ante una saturación operativa.

### 3.3 Administración

- Administrar categorías, productos, descripciones, imágenes y precios.
- Administrar grupos de opciones, variantes, extras y restricciones de selección.
- Definir el tipo de entrega y la estación de preparación de cada producto.
- Administrar mesas y generar o regenerar sus QR.
- Configurar por día el horario de apertura y corte del QR en la zona `America/Argentina/Buenos_Aires`, incluyendo ventanas que crucen medianoche.
- Forzar manualmente el modo QR abierto o el modo exclusivo de barra/caja.
- Administrar usuarios internos y sus roles.
- Consultar el historial de pedidos, pagos y cambios de estado.

## 4. Fuera del alcance inicial

- Aplicaciones nativas para Android o iOS.
- Publicación en tiendas de aplicaciones.
- Plataforma multiempresa o suscripciones para otros comercios.
- Registro y cuenta permanente para clientes.
- Programa de puntos, promociones complejas o cupones.
- Control de inventario por cantidad o integración con proveedores.
- Integración con impresoras fiscales, facturación electrónica o sistemas contables.
- Delivery, reservas y pedidos programados.
- División de una misma comanda entre varios medios de pago.
- Reembolsos automáticos desde la aplicación.
- Funcionamiento completo sin conexión a Internet.
- Notificaciones push garantizadas con la página cerrada.

## 5. Modos operativos

### 5.1 QR abierto

- El cliente puede ver la carta, crear un carrito, generar un pedido y seleccionar el medio de pago.
- Los productos configurados para mesa son entregados por el personal.
- Los productos configurados para retiro se recogen en barra cuando están listos.

### 5.2 Exclusivo de barra o caja

- El QR continúa mostrando la carta en modo de consulta y explica que los pedidos nuevos se realizan en barra o caja.
- No permite crear un pedido ni iniciar un pago nuevo desde el celular.
- El personal puede registrar pedidos nuevos desde su panel.
- Los pedidos y pagos iniciados antes del corte continúan normalmente.

### 5.3 Pausado

- Bloquea temporalmente pedidos nuevos por QR y explica el motivo al cliente.
- No modifica los pedidos existentes.
- Solamente un administrador u operador autorizado puede pausar o reanudar el servicio.

El servidor determina el modo efectivo combinando la ventana semanal configurada y la anulación manual. Fuera de una ventana habilitada opera en modo exclusivo de barra o caja. La anulación manual prevalece hasta que el personal la retire.

## 6. Sesiones de mesa y clientes

- Cada QR contiene un token opaco asociado a una mesa; no contiene un número secuencial utilizable para descubrir otras mesas.
- Al comenzar, el navegador recibe una sesión anónima de cliente y solicita un nombre o apodo.
- La sesión identifica únicamente los pedidos de ese cliente.
- Una misma mesa puede tener varios clientes y pedidos simultáneos.
- Una sesión sin actividad expira después de cuatro horas.
- El personal puede cerrar manualmente una sesión de mesa.
- El cierre no elimina pedidos ni movimientos históricos.
- Volver a escanear el QR permite iniciar una nueva sesión, pero no concede acceso a sesiones anteriores.

No se exige que el personal abra una mesa antes del primer pedido.

## 7. Carta, variantes y disponibilidad

Cada producto tiene:

- categoría;
- nombre y descripción;
- imagen opcional;
- precio base;
- estado disponible o agotado;
- estación `GENERAL`, `COCINA` o `BARRA`;
- entrega `MESA` o `RETIRO`;
- grupos de opciones.

Un grupo de opciones define si la selección es obligatoria, su cantidad mínima y máxima, y los valores disponibles con su diferencia de precio. Ejemplos: tamaño, punto de cocción, acompañamiento y extras.

Los nombres, precios y opciones elegidos se copian al pedido al confirmarlo. Los cambios posteriores de la carta no alteran el historial.

El servidor vuelve a validar disponibilidad, restricciones y precio al crear el pedido. Si algo cambió, el cliente recibe el detalle y debe revisar el carrito antes de continuar.

## 8. Pedidos y pagos

### 8.1 Estados del pedido

```text
DRAFT -> AWAITING_PAYMENT -> CONFIRMED -> PREPARING -> READY -> DELIVERED
   \---------- estados cancelables por el personal ----------> CANCELLED
```

- `DRAFT`: carrito todavía editable.
- `AWAITING_PAYMENT`: pedido creado, pendiente de Mercado Pago o confirmación del personal.
- `CONFIRMED`: autorizado para ingresar a la cola operativa.
- `PREPARING`: preparación iniciada.
- `READY`: todos sus productos están listos.
- `DELIVERED`: entregado en mesa o retirado en barra.
- `CANCELLED`: cancelado por un usuario interno; requiere motivo.

Un operador puede cancelar pedidos en `AWAITING_PAYMENT` o `CONFIRMED`. Cancelar un pedido en `PREPARING` requiere rol de administrador y un motivo explícito. Los pedidos `READY` o `DELIVERED` no se cancelan: cualquier devolución posterior se registra como una incidencia y un movimiento de pago separado. Cancelar un pedido pagado no lo marca como reembolsado hasta que el reembolso haya sido verificado.

### 8.2 Estados del pago

```text
UNPAID -> PENDING -> APPROVED
                 \-> REJECTED
APPROVED -> REFUNDED | PARTIALLY_REFUNDED
```

El estado del pago y el estado del pedido son independientes. Un cambio de pago no puede marcar por sí solo un pedido como preparado, listo o entregado.

### 8.3 Mercado Pago

- El servidor crea la operación con una referencia externa única y una clave de idempotencia.
- El retorno del navegador muestra el resultado provisional, pero no autoriza la preparación.
- El servidor valida la firma del webhook y consulta el estado de la operación cuando corresponda.
- Solamente un estado aprobado y acreditado mueve el pedido a `CONFIRMED`.
- Los webhooks repetidos producen el mismo resultado sin duplicar pagos, pedidos ni cambios de estado.
- Un pago pendiente mantiene la orden fuera de la cola de preparación y muestra instrucciones al cliente.
- Un pago rechazado permite reintentar con un nuevo intento de pago asociado al mismo pedido.

### 8.4 Pago tradicional

- El pedido queda en `AWAITING_PAYMENT` y `UNPAID`.
- Caja confirma el cobro y selecciona el medio tradicional utilizado.
- Esa confirmación cambia el pago a `APPROVED` y el pedido a `CONFIRMED`.
- El personal puede rechazar el pedido antes de cobrarlo indicando el motivo.

### 8.5 Corte horario y concurrencia

- El servidor usa su propia hora y zona configurada; no confía en el reloj del celular.
- Un carrito no confirmado al llegar el corte no puede generar un pedido nuevo.
- Un pedido creado antes del corte puede terminar su pago y procesamiento después del corte.
- Una notificación tardía de Mercado Pago se procesa según la fecha de creación del pedido.
- Las actualizaciones simultáneas usan control de concurrencia para impedir transiciones incompatibles.

## 9. Comandas y actualización en tiempo real

- El panel recibe únicamente pedidos `CONFIRMED`.
- La instalación inicial muestra una cola `GENERAL` ordenada por antigüedad.
- El modelo conserva la estación de cada producto para activar vistas `COCINA` y `BARRA` sin migrar los pedidos existentes.
- Los cambios se envían en tiempo real al panel y a la pantalla del cliente.
- Después de una desconexión, cada interfaz vuelve a consultar el estado completo antes de continuar.
- Si el canal en tiempo real falla, la interfaz actualiza periódicamente hasta recuperar la conexión.
- Un pedido pasa a `READY` cuando todos sus productos o grupos de preparación están listos.

## 10. Arquitectura

La solución será una aplicación web modular desplegada como una unidad, con límites internos claros:

1. **Aplicación cliente:** carta, carrito, pago y seguimiento.
2. **Panel operativo:** caja, comandas, estados, disponibilidad y pedidos de mostrador.
3. **Administración:** carta, mesas, QR, horarios y usuarios.
4. **Módulo de catálogo:** productos, opciones, precios y disponibilidad.
5. **Módulo de pedidos:** sesiones, carritos, pedidos, estados y comandas.
6. **Módulo de pagos:** intentos de pago, Mercado Pago, webhooks y conciliación.
7. **Módulo de operación:** horario, pausas, estaciones y actualizaciones en tiempo real.
8. **Persistencia PostgreSQL:** datos transaccionales, historial y auditoría.

Las tres interfaces comparten la misma API y reglas de negocio. La separación modular permite extraer servicios en el futuro sin asumir ahora el costo de una arquitectura distribuida.

El despliegue requiere HTTPS público, base de datos con copias de seguridad, almacenamiento de imágenes y un proceso de servidor capaz de recibir webhooks y emitir actualizaciones en tiempo real.

## 11. Modelo conceptual de datos

- `BusinessSettings`: zona horaria y anulación manual.
- `ServiceWindow`: día de apertura, minuto de apertura, minuto de corte y estado; admite un corte posterior a medianoche.
- `StaffUser`: identidad, credenciales, rol y estado.
- `Table`: nombre visible, token QR y estado.
- `CustomerSession`: mesa, nombre o apodo, token y vencimiento.
- `Category`: orden y visibilidad.
- `Product`: datos comerciales, precio, disponibilidad, estación y entrega.
- `OptionGroup` y `OptionValue`: reglas de selección y diferencias de precio.
- `Order`: sesión, mesa, origen, total y estado.
- `OrderItem`: copia del producto, cantidad, precio y configuración elegida.
- `PaymentAttempt`: método, importe, proveedor, referencia, idempotencia y estado.
- `OrderStatusEvent`: estado anterior, nuevo estado, fecha, actor y motivo.

`OrderItem` conserva una instantánea legible de nombres y precios. Los historiales no dependen de que el producto siga publicado.

## 12. Seguridad y privacidad

- Todo el tráfico utiliza HTTPS.
- Las credenciales y secretos de Mercado Pago existen únicamente en el servidor.
- Las contraseñas del personal se almacenan con hash resistente y nunca en texto plano.
- Las rutas internas requieren autenticación y autorización por rol.
- Los tokens de cliente y QR son aleatorios, suficientemente extensos y revocables.
- El servidor calcula totales y valida transiciones; no acepta precios ni estados decididos por el navegador.
- Los webhooks se validan antes de cambiar datos.
- Se limita la frecuencia de intentos en acceso, creación de pedidos y pagos.
- Los registros evitan guardar credenciales, tokens completos o datos sensibles de pago.
- La primera versión almacena solamente el nombre o apodo elegido por el cliente y los datos necesarios del pedido.

## 13. Manejo de errores

- **Sin conexión:** conservar el carrito localmente, impedir confirmaciones ambiguas y mostrar el estado de conexión.
- **Respuesta incierta al crear un pedido:** consultar por la clave idempotente antes de reintentar.
- **Pago pendiente:** mantener el pedido fuera de cocina e informar al cliente.
- **Pago rechazado:** permitir otro intento sin duplicar el pedido.
- **Producto agotado o precio modificado:** devolver los cambios concretos y exigir una nueva confirmación.
- **Corte durante el carrito:** conservar la selección como referencia, bloquear el pago e indicar que debe dirigirse a barra o caja.
- **Webhook inválido:** rechazarlo sin modificar el pedido y registrar el incidente.
- **Actualización de estado inválida:** conservar el estado anterior y explicar el conflicto al operador.
- **Cancelación:** restringirla al personal, exigir motivo y conservar el historial.
- **Reembolso:** realizarlo en Mercado Pago durante la primera versión y registrar manualmente el resultado en el sistema.

## 14. Criterios de aceptación

1. Dos clientes de una misma mesa pueden pedir por separado y cada uno ve solamente su pedido.
2. Un pedido de Mercado Pago no aparece en la cola hasta recibir una confirmación válida del pago.
3. Repetir el webhook o la solicitud de creación no duplica el cobro ni la comanda.
4. Un pedido tradicional no aparece en preparación hasta que caja confirma el cobro.
5. Un producto agotado no puede comprarse aunque permanezca en un carrito antiguo.
6. Las variantes obligatorias y sus límites se validan en el servidor.
7. Al llegar el corte, un carrito abierto no puede crear un pedido, pero una orden existente puede finalizar.
8. El personal puede crear y procesar un pedido nuevo de barra después del corte.
9. Los cambios `CONFIRMED`, `PREPARING`, `READY` y `DELIVERED` llegan al cliente sin recargar manualmente.
10. Una reconexión recupera el estado real sin retroceder ni duplicar eventos.
11. Un operador no puede modificar usuarios ni configuraciones reservadas al administrador.
12. Cada cancelación y cambio operativo queda asociado a un actor y una fecha.
13. El cambio manual de modo prevalece sobre el horario hasta ser retirado.
14. Un QR regenerado invalida el token anterior.

## 15. Estrategia de verificación

- Pruebas unitarias de precios, opciones, corte horario y transiciones de estado.
- Pruebas de integración con PostgreSQL para pedidos, pagos e historial.
- Pruebas de contrato para creación de pagos y recepción de webhooks.
- Pruebas de duplicación, reordenamiento y demora de notificaciones.
- Pruebas de extremo a extremo del cliente, pago tradicional, panel operativo y administración.
- Pruebas responsivas en celulares, tableta y computadora.
- Prueba de aceptación en el local con credenciales de prueba de Mercado Pago.
- Prueba controlada en producción con importes mínimos antes de habilitar el servicio completo.

## 16. Puesta en marcha

1. Cargar la configuración del comercio, mesas y usuarios internos.
2. Cargar y revisar la carta inicial.
3. Configurar Mercado Pago con credenciales de prueba.
4. Ejecutar los recorridos de aceptación.
5. Imprimir y validar cada QR en su mesa correspondiente.
6. Capacitar brevemente a caja, barra, cocina y atención.
7. Cambiar a credenciales productivas y realizar una prueba controlada.
8. Activar el servicio por QR y supervisar la primera jornada.

## 17. Decisiones adoptadas para la primera versión

- Una sola empresa y un solo local.
- Aplicación web responsive, sin aplicación nativa.
- QR permanente por mesa, sin apertura manual previa.
- Clientes anónimos identificados por nombre o apodo.
- Una cola general de comandas con preparación para separar estaciones.
- Pago confirmado antes de preparación.
- Mercado Pago y pago tradicional sin combinación dentro de un pedido.
- Carta visible pero pedidos QR bloqueados después del corte.
- Actualización dentro de la página; push diferido.
- Reembolsos gestionados fuera de la aplicación y registrados en ella.
- Disponibilidad simple por producto; inventario cuantitativo diferido.
