# Sistema de autogestión y pedidos QR — propuesta corregida

## Alcance

PWA responsive para un solo bar y un solo local. Cada mesa tiene un QR que abre la carta y permite crear pedidos individuales dentro de la ventana horaria configurada. Cada cliente usa un nombre o apodo, sin crear una cuenta.

La carta sigue visible fuera del horario. Los pedidos nuevos después del corte se gestionan en barra o caja; los pedidos ya creados continúan su ciclo normal. Ningún pedido entra a preparación sin pago digital confirmado o confirmación del personal.

## Operación

- Personal administra categorías, productos, opciones, disponibilidad, imágenes, mesas y regeneración de QR.
- Caja confirma efectivo o tarjeta en mostrador.
- Mercado Pago procesa el pago digital mediante Orders API y webhook firmado.
- Cocina y barra trabajan desde una comandera filtrada por estación.
- El cliente ve el estado dentro de la página; las notificaciones push quedan para una mejora posterior.

## Entregas y tiempos

1. Prototipo demostrable: 7–12 días calendario, con flujo principal y pagos de prueba.
2. Implementación productiva: 4–6 semanas con un ingeniero full-stack, incluyendo seguridad, backups, aceptación y correcciones en el local.
3. Aceptación en sitio: 2–4 días adicionales según feedback y dispositivos disponibles.

El contenido de la carta, cuenta de Mercado Pago, dominio y feedback del bar deben estar disponibles para cumplir el cronograma.

## Costos separados

El desarrollo se cotiza aparte de hosting, dominio, comisiones de Mercado Pago, almacenamiento de imágenes y soporte/mantenimiento mensual. Esos servicios se presupuestan según proveedor y consumo real.
