# Pendientes de aceptación

Última actualización: 24 de septiembre de 2026

## Base verificada

- QR de Mesa 1, sesión por nombre o apodo y carta pública.
- Categorías, producto con opciones, carrito y checkout.
- Pago manual con efectivo o tarjeta en Caja.
- Confirmación desde Staff y recorrido de Comandas hasta `Entregado`.
- Seguimiento del cliente con cinco etapas, incluida la entrega.
- Proyecto ejecutándose desde el filesystem Linux de WSL en `~/projects/App-qr`.

## Correcciones pendientes

- Unificar el fondo oscuro en pedido, carrito, checkout y seguimiento; eliminar el fondo blanco que aparece durante el pedido.
- Corregir el `Failed to fetch` del seguimiento y manejar correctamente las reconexiones SSE para no dejar `unhandledRejection` en la consola.
- Mejorar la explicación de medios de pago no configurados: Mercado Pago y transferencia deben indicar por qué no aparecen o figurar como no disponibles.
- Terminar el pulido visual del panel Staff.
- Medir la velocidad con el proyecto ya ubicado dentro del filesystem de WSL.
- Configurar y probar Mercado Pago.

## Validar con las transcripciones

- Confirmar el comportamiento de horario QR abierto, modo solo barra/caja y modo pausado.
- Confirmar si el modelo operativo es autoabastecimiento, atención de moza o una combinación según horario.
- Definir cuándo se cierra una sesión o una mesa; no confundirlo con marcar un pedido como `Entregado`.
- Confirmar el recorrido esperado de pedidos iniciados antes del corte horario.

## Próxima prueba

Completar un segundo pedido desde la misma mesa después de entregar el primero y verificar que el QR siga operativo mientras la sesión o mesa continúe abierta.
