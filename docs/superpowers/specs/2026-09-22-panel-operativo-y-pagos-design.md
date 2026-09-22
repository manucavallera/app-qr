# Panel operativo, navegación y medios de pago

**Fecha:** 22 de septiembre de 2026  
**Base funcional:** `2026-09-21-sistema-pedidos-qr-design.md`  
**Fuente comercial:** `Propuesta_Sistema_Autogestion_y_Pedidos_QR (1).pdf`

## 1. Propósito

Completar la primera versión con una experiencia guiada que pueda usar el personal del bar sin conocer direcciones internas, estados técnicos ni procedimientos del sistema.

La mejora conserva las reglas de negocio existentes y agrega las pantallas, navegación y acciones que faltan para operar el circuito completo desde la interfaz. El resultado debe permitir que cliente, caja, cocina y administración sepan qué acción corresponde en cada momento.

## 2. Decisiones aprobadas

- El panel interno tendrá una portada con accesos grandes, tareas pendientes y navegación persistente.
- Todas las acciones y estados visibles estarán expresados en español.
- El cliente podrá elegir Mercado Pago, efectivo en caja, tarjeta en caja o transferencia bancaria.
- La transferencia será manual: se mostrarán los datos configurados del comercio y Caja verificará la acreditación antes de confirmar el pedido.
- No se cargará un comprobante de transferencia en esta primera versión.
- Los QR seguirán siendo permanentes, aleatorios y asociados a una mesa.
- La administración podrá probar, copiar, descargar, imprimir o renovar el QR de cada mesa.
- Se reutilizarán los módulos y API existentes. Los cambios de backend se limitarán a las capacidades que todavía no existen, especialmente transferencia, configuración y datos resumidos para el panel.

## 3. Navegación del personal

Después de iniciar sesión, el personal ingresará a `/staff`, no directamente al catálogo. Esa portada mostrará:

- `Pagos pendientes`, con cantidad de pedidos por confirmar;
- `Comandas`, con cantidad de pedidos confirmados o en preparación;
- `Nuevo pedido en caja`;
- `Pedidos`, para consultar el historial operativo reciente;
- `Carta`;
- `Mesas y QR`;
- `Configuración`;
- accesos administrativos a usuarios y auditoría cuando el rol lo permita.

Todas las pantallas internas compartirán un encabezado o menú lateral adaptable con `Inicio`, `Caja`, `Comandas`, `Carta`, `Mesas`, `Configuración` y `Cerrar sesión`. En celular podrá convertirse en una barra compacta o menú desplegable, pero las tareas críticas `Caja` y `Comandas` permanecerán visibles.

Las páginas indicarán la ubicación actual y ofrecerán una acción principal inequívoca. No será necesario escribir rutas manualmente.

## 4. Flujo del cliente

El recorrido tendrá cuatro pasos visibles:

1. `Carta`: elegir productos, opciones, cantidad y observaciones.
2. `Tu pedido`: revisar artículos, modificar cantidades o volver a la carta.
3. `Forma de pago`: elegir uno de los medios habilitados.
4. `Seguimiento`: ver el número de pedido, pago, preparación y forma de entrega.

El carrito mostrará nombres reales, opciones y precios; no textos genéricos como “producto”. Los botones principales indicarán el resultado, por ejemplo `Pagar con Mercado Pago` o `Enviar pedido y pagar en caja`.

La página del pedido explicará el siguiente paso:

- pago tradicional: “Acercate a Caja para abonar. Cocina recibirá el pedido después de la confirmación”;
- transferencia: datos bancarios, importe exacto y aviso de verificación por Caja;
- Mercado Pago pendiente: “Estamos verificando tu pago”;
- confirmado: “El pago fue confirmado y enviamos el pedido a preparación”;
- listo para mesa: “Tu pedido está listo y será llevado a la mesa”;
- listo para retiro: “Tu pedido está listo para retirar en barra”.

Los cambios se recibirán por el canal en tiempo real existente y se mantendrá la actualización periódica como respaldo.

## 5. Medios de pago

### 5.1 Mercado Pago

El cliente selecciona `Mercado Pago`, se crea el pedido y luego un intento de pago. El navegador se redirige al checkout provisto por Mercado Pago. La vuelta del navegador es informativa: solamente el webhook validado puede aprobar el pago y confirmar el pedido.

Si Mercado Pago rechaza el pago, la pantalla permitirá reintentar sin duplicar el pedido. Si está pendiente, el pedido permanece fuera de la comandera.

La opción se mostrará únicamente cuando la integración esté habilitada y configurada. En desarrollo podrá utilizarse el proveedor de pruebas existente.

### 5.2 Efectivo y tarjeta en caja

Ambas opciones crean un pedido en espera. Caja ve el medio elegido, cobra mediante efectivo o posnet y presiona `Confirmar cobro`. Recién entonces el pedido pasa a la comandera.

Caja también podrá `Rechazar pedido`, con un motivo obligatorio, antes de confirmar el cobro.

### 5.3 Transferencia bancaria

Se agregará `BANK_TRANSFER` como método de pago explícito, evitando registrar la operación como un método genérico.

La configuración administrativa incluirá:

- transferencia habilitada o deshabilitada;
- alias;
- CBU/CVU opcional;
- titular o nombre de referencia opcional;
- instrucción breve opcional.

Al seleccionar transferencia, el pedido queda en `AWAITING_PAYMENT`. El cliente ve los datos, el importe exacto y puede copiar el alias o CBU/CVU. Caja compara el movimiento con la cuenta del comercio y presiona `Confirmar transferencia`. No se confía en una declaración del cliente para autorizar cocina.

### 5.4 Reglas comunes

- Cocina recibe únicamente pedidos con pago `APPROVED`.
- El importe se calcula y valida en el servidor.
- Cada intento usa idempotencia para evitar cobros o pedidos duplicados.
- La interfaz deshabilita botones durante el envío y comunica errores recuperables.
- Los métodos manuales pueden habilitarse o deshabilitarse desde Configuración.

## 6. Caja y pedidos de mostrador

`Pagos pendientes` mostrará tarjetas legibles con número, mesa, cliente, hora, método e importe. Cada tarjeta tendrá acciones explícitas según su medio:

- `Confirmar efectivo`;
- `Confirmar tarjeta`;
- `Confirmar transferencia`;
- `Rechazar pedido`.

`Nuevo pedido en caja` reutilizará el catálogo para seleccionar productos, variantes, cantidades y observaciones. Permitirá asignar una mesa o marcarlo como pedido de mostrador. Como el cobro ocurre frente al personal, solamente admitirá efectivo o tarjeta en caja y quedará confirmado al finalizar.

La vista `Pedidos` mostrará estados en español, medio y estado de pago, origen, mesa, cliente, total y acceso al detalle. Las cancelaciones respetarán las reglas ya definidas.

## 7. Comandas

La comandera mantendrá las vistas `General`, `Cocina` y `Barra`, con actualización en tiempo real. Los botones técnicos se reemplazarán por acciones:

- `Comenzar preparación`;
- `Marcar como listo`;
- `Marcar como entregado`.

Cada tarjeta mostrará mesa, número, antigüedad, cliente, artículos, opciones, observaciones y destino `Mesa` o `Retiro en barra`. Los colores complementarán el texto, pero no serán la única señal de estado.

## 8. Configuración operativa

La pantalla dejará de ser de solo lectura. Incluirá controles grandes para:

- `Según horario`;
- `Abrir pedidos QR ahora`;
- `Solo pedidos en caja`;
- `Pausar pedidos QR`.

También permitirá editar la zona horaria, los horarios de cada día, los medios de pago manuales habilitados y los datos de transferencia. Antes de guardar se validarán formatos y ventanas horarias. Después de guardar se mostrará el modo efectivo y una confirmación clara.

## 9. Mesas y códigos QR

Cada mesa conservará un token no predecible. Su tarjeta ofrecerá:

- `Abrir carta de prueba`;
- `Copiar enlace`;
- `Descargar QR`;
- `Imprimir`;
- `Renovar QR`.

La renovación exigirá confirmación y explicará que el QR anterior dejará de funcionar. La pantalla permitirá activar o desactivar una mesa. Fuera del horario o durante una pausa, el QR seguirá mostrando la carta, pero bloqueará pedidos nuevos y explicará dónde pedir.

## 10. Catálogo, usuarios y auditoría

El catálogo mantendrá la edición existente y sumará navegación coherente, mensajes de guardado visibles y acciones fáciles de reconocer para disponibilidad, edición y ocultamiento.

Usuarios permitirá crear, editar, activar o desactivar personal y asignar roles. No mostrará contraseñas existentes; un administrador podrá establecer una contraseña inicial o restablecerla.

Auditoría seguirá siendo de consulta y traducirá las acciones técnicas más frecuentes a descripciones legibles.

## 11. Cambios de datos e interfaces

- Añadir `BANK_TRANSFER` al enum `PaymentMethod` mediante migración.
- Crear una entidad `PaymentSettings` de una sola fila para separar la configuración de cobros de los horarios. Contendrá `mercadoPagoEnabled`, `cashEnabled`, `cardAtCounterEnabled`, `bankTransferEnabled`, `bankAlias`, `bankCbuCvu`, `bankAccountHolder` y `bankInstructions`.
- Extender los contratos de creación y confirmación de pedidos para aceptar transferencia.
- Incorporar un resumen autenticado para los contadores de la portada, o calcularlos mediante las consultas existentes si no agrega latencia significativa.
- Mantener los endpoints actuales y extenderlos de forma compatible siempre que sea posible.

Los secretos de Mercado Pago continuarán exclusivamente en variables de entorno. Alias, CBU/CVU y titular no son secretos de acceso, pero solamente podrán modificarlos usuarios autorizados.

## 12. Errores y estados vacíos

- Cada pantalla ofrecerá una salida clara cuando no haya tareas, por ejemplo `No hay pagos esperando confirmación` y un botón para volver al inicio.
- Una respuesta incierta no habilitará reintentos ciegos; se consultará el estado mediante la clave idempotente.
- Si un pedido cambia mientras un operador lo procesa, se actualizará la tarjeta y se explicará el cambio.
- Si Mercado Pago no está configurado, la opción no aparecerá al cliente y Configuración indicará qué falta.
- Si los datos de transferencia están incompletos, el método quedará deshabilitado.
- Una falla del canal en tiempo real activará la consulta periódica ya prevista.

## 13. Seguridad y permisos

- Todas las rutas internas seguirán requiriendo sesión y rol.
- Solo administración podrá modificar usuarios, integración de pagos, horarios estructurales y datos bancarios.
- Operación podrá confirmar cobros, preparar pedidos y aplicar una pausa temporal según las reglas vigentes.
- Ningún precio, total, estado ni aprobación enviados por el navegador se aceptará sin validación del servidor.
- Los cambios de configuración, QR, usuarios, pagos y pedidos quedarán registrados en auditoría.

## 14. Verificación y aceptación

Se agregarán pruebas unitarias e integrales para transferencia, configuración, permisos y transiciones. Las pruebas de navegador cubrirán como mínimo:

1. pedido QR con efectivo, confirmación en Caja y ciclo completo de cocina;
2. pedido QR con tarjeta en caja;
3. pedido QR con transferencia, copia de alias y confirmación manual;
4. pedido QR con Mercado Pago de prueba y confirmación por webhook;
5. creación de pedido desde Caja;
6. cambio entre abierto, pausado y solo caja;
7. edición de horarios;
8. descarga, apertura y renovación de QR;
9. navegación completa sin escribir URLs;
10. permisos de administración y cierre de sesión.

La mejora se considera terminada cuando una persona nueva puede completar cada circuito usando únicamente los botones visibles y todos los pedidos llegan a cocina solo después de un pago confirmado.

## 15. Fuera de alcance

- Carga y validación automática de comprobantes bancarios.
- Conciliación bancaria automática.
- División de un pedido entre varios medios de pago.
- Reembolsos automáticos.
- Integración con terminales físicas o impresoras fiscales.
- Nuevos medios externos distintos de Mercado Pago durante esta etapa.
