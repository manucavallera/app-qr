# Flujo completo de la aplicación

Este documento explica, en lenguaje simple, cómo funciona la plataforma de pedidos QR desde el punto de vista del cliente y del negocio.

## Vista general

```mermaid
flowchart LR
    A[Cliente escanea el QR de la mesa] --> B[Se abre la carta del local]
    B --> C[Cliente elige productos]
    C --> D[Agrega opciones, cantidades y notas]
    D --> E[Revisa el carrito]
    E --> F[Elige forma de pago]

    F -->|Mercado Pago| MP[Se genera el pago online]
    MP --> MP2{Mercado Pago acredita el pago?}
    MP2 -->|Sí| G[Pedido confirmado]
    MP2 -->|No / pendiente| P[Pedido pendiente de pago]

    F -->|Efectivo en caja| M[Pedido pendiente de confirmación]
    F -->|Tarjeta en caja| M
    F -->|Transferencia bancaria| M
    M --> N[El equipo verifica el cobro desde Pagos]
    N -->|Confirma| G
    N -->|Rechaza| R[Pago rechazado]

    G --> H[El pedido aparece en Comandas]
    H --> I[Preparando]
    I --> J[Listo]
    J --> K[Entregado]

    P -->|Cliente completa el pago| G
    P -->|El cliente no paga| P2[El pedido continúa pendiente]

    G -. actualiza .-> S[Seguimiento del cliente]
    I -. actualiza .-> S
    J -. actualiza .-> S
    K -. actualiza .-> S
```

## Recorrido del cliente

```mermaid
flowchart TD
    A[QR de la mesa] --> B{¿La sesión está activa?}
    B -->|No| C[El cliente ingresa su nombre o referencia]
    B -->|Sí| D[Continúa con la sesión existente]
    C --> E[Ve la carta]
    D --> E
    E --> F[Filtra por categoría]
    F --> G[Abre un producto]
    G --> H[Elige cantidad, opciones y notas]
    H --> I[Agrega al carrito]
    I --> J{¿Quiere seguir comprando?}
    J -->|Sí| E
    J -->|No| K[Revisa el pedido]
    K --> L[Elige forma de pago]
    L --> M[Envía el pedido]
    M --> N[Ve la pantalla de seguimiento]
    N --> O[Recibe los cambios de estado]
```

## Formas de pago

```mermaid
flowchart TD
    A[Cliente elige forma de pago] --> B{Método}
    B -->|Mercado Pago| C[Se abre el checkout de Mercado Pago]
    C --> D[Mercado Pago informa el resultado]
    D -->|Aprobado| E[Pedido confirmado automáticamente]
    D -->|Pendiente| F[Se puede volver a intentar el pago]
    D -->|Rechazado| G[Se informa el problema]

    B -->|Efectivo| H[Cliente paga en caja]
    B -->|Tarjeta en caja| I[Cliente paga en caja]
    B -->|Transferencia| J[Cliente ve alias, CBU/CVU e instrucciones]
    H --> K[El equipo confirma desde Pagos]
    I --> K
    J --> K
    K -->|Confirmado| E2[Pedido confirmado]
    K -->|Rechazado| G2[Pago rechazado]
```

## Operación del negocio

```mermaid
flowchart TD
    A[El equipo inicia sesión] --> B[Inicio / resumen del local]
    B --> C{¿Qué necesita hacer?}

    C -->|Preparar pedidos| D[Comandas]
    D --> E[Filtra General, Cocina o Barra]
    E --> F[Comienza preparación]
    F --> G[Marca como listo]
    G --> H[Marca como entregado]

    C -->|Revisar pedidos| I[Pedidos e historial]
    I --> J[Consulta origen, detalle, estado y pago]
    J --> K[Puede cancelar según permisos]

    C -->|Confirmar cobros| L[Pagos pendientes]
    L --> M[Confirma o rechaza efectivo, tarjeta o transferencia]

    C -->|Cargar un pedido| N[Caja]
    N --> O[Selecciona productos y forma de pago]
    O --> P[Genera el pedido]
    P --> Q{¿Pago online?}
    Q -->|Sí| R[Muestra QR de pago]
    Q -->|No| M

    C -->|Administrar carta| S[Catálogo]
    S --> T[Edita categorías y productos]
    T --> U[Actualiza precio, descripción, opciones, disponibilidad e imagen]
```

## Administración y configuración

```mermaid
flowchart TD
    A[Administrador] --> B[Mesas y códigos QR]
    B --> C[Crea o edita mesas]
    C --> D[Prueba, imprime o renueva códigos]

    A --> E[Configuración]
    E --> F[Datos públicos del local]
    E --> G[Horarios de atención]
    E --> H[Modo de pedidos QR]
    H --> H1[Según horario]
    H --> H2[QR abierto]
    H --> H3[Solo caja]
    H --> H4[Pedidos pausados]
    E --> I[Medios de pago]
    I --> I1[Mercado Pago]
    I --> I2[Efectivo]
    I --> I3[Tarjeta]
    I --> I4[Transferencia]

    A --> J[Usuarios]
    J --> K[Crea usuarios]
    J --> L[Asigna roles]
    J --> M[Desactiva accesos]

    A --> N[Auditoría]
    N --> O[Consulta acciones sobre pedidos, pagos y configuración]
```

## Estados principales de un pedido

```mermaid
stateDiagram-v2
    [*] --> AWAITING_PAYMENT: Pedido creado con pago pendiente
    [*] --> RECEIVED: Pago confirmado
    AWAITING_PAYMENT --> RECEIVED: Pago confirmado
    AWAITING_PAYMENT --> CANCELLED: Pago rechazado o pedido cancelado
    RECEIVED --> PREPARING: Comienza la preparación
    PREPARING --> READY: Pedido listo
    READY --> DELIVERED: Pedido entregado
    RECEIVED --> CANCELLED: Cancelación autorizada
    PREPARING --> CANCELLED: Cancelación autorizada
    DELIVERED --> [*]
    CANCELLED --> [*]
```

## Qué incluye la primera versión

- Carta digital accesible desde QR.
- Carrito y envío de pedidos.
- Seguimiento del pedido.
- Mercado Pago, efectivo, tarjeta y transferencia.
- Confirmación manual de pagos que se realizan en el local.
- QR de pago para pedidos cargados desde caja.
- Comandas para organizar la preparación.
- Gestión de productos, categorías e imágenes.
- Gestión de mesas y códigos QR.
- Horarios y modos de operación.
- Usuarios, roles y auditoría.

## Qué se puede personalizar después

- Logo, colores y tipografías.
- Textos y tono de comunicación.
- Fotos definitivas de los productos.
- Diseño visual de la carta y del panel.
- Datos reales del local.
- Reglas particulares de atención y entrega.

