# Auditoría UI — Operación del personal

**Fecha:** 23 de septiembre de 2026  
**Tipo:** revisión estática contra `docs/superpowers/specs/2026-09-22-panel-operativo-y-pagos-design.md`  
**Alcance:** Inicio, Caja, Comandas, Pedidos, Carta, Mesas y QR, Configuración, Usuarios y Auditoría.  
**Nota:** todavía no incluye recorrido visual en dispositivos reales.

## Resultado

| Pilar | Puntaje | Observación |
| --- | ---: | --- |
| Copywriting | 2/4 | Varias pantallas muestran estados técnicos o códigos internos. |
| Visuales | 3/4 | Existe un lenguaje compartido, pero algunas vistas son listas genéricas. |
| Color | 3/4 | El shell y los estados principales son coherentes. |
| Tipografía | 3/4 | Jerarquía consistente en las pantallas principales. |
| Espaciado | 3/4 | Los paneles y controles tienen una base usable; falta validar celular. |
| Experiencia | 1/4 | Hay circuitos internos incompletos y acciones críticas ausentes. |

## Hallazgos priorizados

### P0 — bloquean circuitos definidos

1. **Pedidos no existe como pantalla operativa.** `StaffShell` declara el ítem pero lo enlaza a `/staff/counter`, por lo que `Pedidos` duplica `Caja` y no ofrece historial, detalle ni cancelación. Esto incumple la sección 6 del diseño.
   - Ubicación: `src/components/staff/staff-shell.tsx:20`.
2. **Caja no permite variantes ni observaciones.** Aunque recibe `optionGroups`, agrega el producto directamente con `optionValueIds: []` y solo permite cantidad; el diseño exige variantes, cantidades y observaciones para pedidos de mostrador.
   - Ubicación: `src/app/staff/counter/page.tsx:40-45,66`.

### P1 — incumplen capacidades o comprensión

3. **Usuarios es solo consulta.** No hay crear, editar, activar/desactivar ni asignar roles, aunque el diseño lo exige.
   - Ubicación: `src/app/staff/users/page.tsx:4`.
4. **Auditoría expone códigos internos.** Muestra `event.action` y `event.entityType` sin traducción, incumpliendo la conversión a descripciones legibles.
   - Ubicación: `src/app/staff/audit/page.tsx:4`.
5. **Estados incompletos en Usuarios, Auditoría y Configuración.** Las respuestas fallidas se convierten en listas vacías o se ignoran; no hay carga, error recuperable ni estado vacío explícito.
   - Ubicaciones: `src/app/staff/users/page.tsx:4`, `src/app/staff/audit/page.tsx:4`, `src/app/staff/settings/page.tsx:32-47`.
6. **Caja muestra estados técnicos sin traducir.** La actividad reciente renderiza `order.status` directamente, aunque ya existe `orderStatusLabel`.
   - Ubicación: `src/app/staff/counter/page.tsx:66`; recurso disponible: `src/components/staff/status-copy.ts`.

### P2 — validar y pulir

7. **Navegación móvil pendiente de validación visual.** El menú usa `flex-wrap`; no hay evidencia todavía de que `Caja` y `Comandas` permanezcan visibles y cómodas entre 320 y 390 px.
   - Ubicación: `src/app/globals.css:197-217`.
8. **La configuración parte con rol `ADMIN` antes de cargar la sesión.** Puede mostrar controles administrativos durante la carga inicial; el servidor debe seguir bloqueando, pero la UI debería usar un estado de carga neutral.
   - Ubicación: `src/app/staff/settings/page.tsx:21-23`.

## Lo que sí está alineado

- `StaffShell` centraliza encabezado, cierre de sesión y navegación.
- Inicio muestra contadores de pagos y comandas y accesos a las tareas principales.
- Pagos pendientes tiene acciones explícitas para efectivo, tarjeta, transferencia y rechazo.
- Comandas usa acciones legibles y etiquetas de destino/estación.
- Mesas incluye prueba, copia, impresión, descarga, renovación confirmada y activación.
- Configuración incluye modos operativos, horarios, perfil público y medios de pago.

## Siguiente plan

1. Crear pantalla real de `Pedidos`.
2. Extraer o reutilizar el diálogo de producto para Caja con variantes y observaciones.
3. Completar Usuarios y traducir Auditoría.
4. Normalizar estados de carga, error y vacío.
5. Agregar pruebas puntuales y hacer recorrido visual móvil.

