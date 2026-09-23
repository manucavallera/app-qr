# Auditoría integral de UX, funcionalidad y aceptación

**Fecha:** 23 de septiembre de 2026  
**Base:** `2026-09-22-panel-operativo-y-pagos-design.md` y `2026-09-22-panel-operativo-y-pagos-plan.md`

## 1. Propósito

Llevar la aplicación desde su estado funcional actual a una versión coherente, verificable y apta para aceptación manual. La revisión abarca la experiencia pública QR, las pantallas internas, la configuración operativa y las pruebas de navegador. No se considerará terminada por compilar: debe poder recorrerse sin errores visibles, datos ficticios ni rutas escritas a mano.

## 2. Estado observado

- El dominio, PostgreSQL, pagos manuales, transferencia, sesiones QR y permisos tienen cobertura unitaria e integral.
- La carta pública tiene una propuesta visual incompleta y se aparta de la referencia compartida.
- El encabezado público usa horarios y enlaces sociales fijos; no representan configuración real del negocio.
- La carga inicial en desarrollo puede superar diez segundos por compilación en frío. Se medirá por separado el tiempo de aplicación una vez caliente.
- La política CSP bloqueaba herramientas y estilos de desarrollo; el ajuste debe conservar `unsafe-eval` exclusivamente fuera de producción.
- Algunas pruebas E2E son recorridos reales y otras son marcadores que delegan la cobertura en integración.
- El plan de septiembre conserva casillas sin marcar aunque gran parte de la implementación existe; la aceptación debe basarse en evidencia actual, no en esas casillas.

## 3. Principios de la revisión

- Ninguna pantalla mostrará horarios, enlaces, estados ni instrucciones inventadas.
- La interfaz del cliente será móvil primero, oscura, simple y cercana a la referencia visual: jerarquía por categorías, productos en filas, fotografías claras y acción `+` inequívoca.
- La interfaz de personal priorizará tareas y acciones; no expondrá enumeraciones técnicas.
- Los cambios visuales no alterarán precios, permisos, idempotencia ni transiciones del dominio.
- Los errores recuperables tendrán mensajes y acciones visibles; la consola del navegador no tendrá errores de aplicación durante los recorridos aceptados.
- Cada fase cerrará con pruebas automáticas y una captura o recorrido manual reproducible.

## 4. Perfil público del local

Se ampliará la configuración existente con datos públicos opcionales:

- nombre visible del local;
- enlace de ubicación;
- enlace de Instagram;
- número o enlace de WhatsApp.

Solo se mostrarán accesos configurados y válidos. Configuración permitirá editarlos a usuarios administradores. El API público de carta devolverá únicamente esos datos públicos y el horario relevante para el día actual. Los secretos y credenciales seguirán fuera de la respuesta.

## 5. Carta QR

La portada mantendrá el ingreso por apodo. Una vez iniciada la sesión mostrará:

1. identidad y accesos reales del local;
2. horario efectivo o un texto honesto cuando esté pausado o en modo solo caja;
3. categorías navegables sin ocupar espacio excesivo;
4. productos en filas con imagen, nombre, descripción breve, precio y botón para agregar;
5. carrito fijo con cantidad, total y siguiente acción.

El diálogo de producto conservará opciones obligatorias, cantidades y notas. El carrito conservará edición de cantidades y detalle de opciones. Checkout y seguimiento usarán la misma identidad visual, sin perder la claridad de pago ni entrega.

La carga tendrá estados diferenciados: comprobando sesión, cargando carta, error recuperable y carta lista. Los botones quedarán deshabilitados mientras exista una petición activa para evitar envíos repetidos.

## 6. Experiencia del personal

Todas las páginas internas compartirán una presentación consistente:

- navegación persistente y sección actual visible;
- encabezados, estados vacíos y mensajes en español;
- botones primarios consistentes;
- tablas o tarjetas adaptables a celular;
- confirmaciones para acciones destructivas o irreversibles;
- indicadores de espera para operaciones de red.

Se revisarán Inicio, Caja, Comandas, pedido de mostrador, Pedidos, Carta, Mesas, Configuración, Usuarios y Auditoría contra el diseño del 22 de septiembre. Las capacidades faltantes se implementarán antes de la aceptación.

## 7. Robustez y rendimiento

- La CSP permitirá el runtime de desarrollo sin habilitar `unsafe-eval` en producción.
- Se agregará un icono de aplicación para eliminar el 404 de favicon.
- Se medirá la carta con el servidor caliente y se separará compilación de desarrollo de latencia de API.
- Las consultas públicas cargarán solo los datos necesarios y mantendrán `Cache-Control: no-store` donde el estado operativo lo requiera.
- Los avisos deprecados de `pg` se rastrearán hasta su llamada concurrente y se corregirán sin alterar el flujo en tiempo real.

## 8. Pruebas y aceptación

Las pruebas de navegador cubrirán recorridos reales, sin casos vacíos que solo contengan comentarios:

1. sesión QR y privacidad entre clientes;
2. efectivo, tarjeta y transferencia hasta confirmación de Caja;
3. Mercado Pago de prueba y webhook repetido;
4. pedido de mostrador;
5. preparación, listo y entrega;
6. modos abierto, pausado y solo caja;
7. horarios;
8. apertura, descarga, impresión y renovación de QR;
9. roles y cierre de sesión;
10. navegación completa en escritorio y móvil.

El cierre exige:

- pruebas unitarias e integrales en verde;
- E2E en verde en los proyectos configurados;
- typecheck, lint y build en verde;
- consola sin errores de aplicación durante los recorridos;
- recorrido manual registrado según `docs/runbooks/local-acceptance.md`.

## 9. Secuencia de trabajo

### Fase 1 — Estabilización

Corregir CSP, favicon, estados de carga, datos fijos y desajustes entre UI y pruebas. Construir un recorrido reproducible de la carta pública.

### Fase 2 — Cliente

Completar perfil público configurable y rehacer carta, producto, carrito, checkout y seguimiento con el lenguaje visual aprobado.

### Fase 3 — Personal

Auditar y completar todas las pantallas internas y sus permisos contra el plan vigente.

### Fase 4 — Automatización

Convertir los marcadores E2E en recorridos reales, reparar selectores y ejecutar la matriz completa.

### Fase 5 — Aceptación

Ejecutar la lista manual en dispositivos, registrar resultados y preparar despliegue, respaldo y rollback.

## 10. Fuera de alcance

- Cambiar las reglas centrales de pagos y pedidos que ya están verificadas.
- Aplicación móvil nativa.
- Conciliación bancaria automática.
- Integraciones sociales distintas de enlaces públicos.
- Nuevas funciones comerciales no incluidas en los diseños vigentes.
