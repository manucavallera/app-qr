# Pendientes de aceptación

Última actualización: 2 de octubre de 2026

## Base verificada

- QR de Mesa 1, sesión por nombre o apodo y carta pública.
- Categorías, producto con opciones, carrito y checkout.
- Pago manual con efectivo o tarjeta en Caja.
- Confirmación desde Staff y recorrido de Comandas hasta `Entregado`.
- Seguimiento del cliente, que ahora se actualiza solo cuando Staff cambia el estado.
- Hamburguesas sin punto de cocción, con medallón extra con costo y casillas para sacar ingredientes.
- Notas del cliente visibles en Comandas.
- Llamador: número grande, vibración y aviso sonoro en el seguimiento, y pantalla `/pantalla` para el televisor.
- Carrito con contador arriba a la derecha, controles en una fila y "Vaciar pedido" al final.
- Pedidos sin pagar cancelados automáticamente por el cron (30 minutos, o 2 horas con pago online en curso).
- Navegación de Staff en 360 px de ancho.
- Stock por producto: cantidad opcional (vacío = sin límite), se descuenta al crear el pedido y vuelve si el pedido se rechaza, vence o se cancela. En 0 el producto figura "Agotado"; con 5 o menos la carta muestra "Últimas N" y el inicio de Staff avisa "Stock bajo". Se repone desde Staff > Carta.
- Reportes (solo administradores, `/staff/reports`): cierre de caja por rango de fechas con total, pedidos, ticket promedio, cancelados, desglose por medio de pago y ventas por producto. Se puede imprimir.

Verificación del 2 de octubre: typecheck, lint, 91 tests unitarios, 30 de integración y la suite e2e completa (18 pasan, 12 se saltean por diseño según el proyecto). El e2e de Mercado Pago usa el proveedor falso, no el servicio real.

## Bloqueantes para producción

1. **Build de producción.** Las dependencias ya están actualizadas (Next 16.3.8, sin el paquete `mercadopago`). Falta confirmar que `npm run build` termina bien. No ejecutar `npm audit fix --force`: baja Prisma a la versión 6. Los avisos restantes son de `vitest` y del CLI de Prisma, que no corren en la app. Usar Node 24 (`nvm use`).
2. **Imágenes.** Con `IMAGE_STORAGE_DRIVER=local` la subida falla en el contenedor (`/app` es de root y el proceso corre como `appuser`) y las fotos se pierden en cada redeploy. Crear una cuenta en Cloudflare R2 o Cloudinary, pasar las credenciales y adaptar el driver. Luego cargar las fotos reales: hoy todos los productos muestran el placeholder.
3. **Mercado Pago.** Probar en sandbox con credenciales de prueba. Confirmar la firma del webhook: `validateMercadoPagoSignature` usa `data.id` tal cual llega y Mercado Pago lo pide en minúsculas cuando es alfanumérico. Agregar timeout al `fetch` de `MercadoPagoGateway`.
4. **Migración de stock.** El stock agrega la migración `20261002_product_stock`. Ejecutar `npm run db:deploy` en producción antes de iniciar la nueva versión.
5. **Cron y secreto interno.** Definir `INTERNAL_SECRET` en producción y programar el cron de `docs/runbooks/deployment.md`. Sin eso no corren el corte nocturno ni el vencimiento de pedidos sin pagar.
6. **Merge.** Llevar la rama `work/pedidos-qr` a `main`. `next-env.d.ts` no se commitea: lo modifica `next dev`.

## Seguridad y operación

- Límite de intentos de login: la clave usa email más el primer valor de `x-forwarded-for`. Confirmar que el proxy de EasyPanel pisa ese header y sumar un límite por email solo.
- CSRF: `assertAllowedOrigin` existe pero ninguna ruta lo usa; hoy solo protege `sameSite: lax`.
- CSP: `script-src` permite `'unsafe-inline'` en producción.
- Páginas `/staff/*` sin chequeo de sesión en el servidor; las APIs sí lo tienen.
- Cambiar la contraseña de un usuario no cierra sus sesiones abiertas.
- `RateLimitBucket` y `StaffSession` crecen sin purga.
- Backups: automatizar el backup diario y probar una restauración; el runbook solo lo describe.
- Pago aprobado sobre un pedido ya cancelado: queda registrado en Auditoría como "Pago aprobado sobre pedido cancelado", pero no hay aviso en pantalla ni reembolso automático.
- CI: sumar e2e, `npm audit` y build de Docker.
- Imagen Docker: copia `node_modules` completo; las migraciones son manuales.
- `tests/integration/realtime-reconnect.test.ts`, `command-concurrency.test.ts`, `mercado-pago-webhook.test.ts` y `admin-authorization.test.ts` corren en 3 ms y conviene revisar qué cubren; el primero compara un literal consigo mismo.
- El test de límite de sesiones por QR puede superar los 5 segundos con la máquina cargada.

## Diseño

- Variables de color: la paleta central ya está en `:root` (35 variables). Quedan unos 190 colores sueltos de uso único en `globals.css`.
- Pedidos (Staff) en celular: el nombre del producto y el precio quedan apretados en la misma fila.
- El seguimiento muestra cuatro etapas en una grilla de cuatro columnas aunque el componente define cinco (falta ver dónde queda "Entregado").
- Reportes, Usuarios y Auditoría solo aparecen en el menú desde Inicio y desde sus propias pantallas; las demás pantallas de Staff no reciben el rol.
- Caja sigue listando los productos sin stock; el servidor rechaza el pedido con un mensaje claro.
- Tailwind está importado y casi no se usa.

## Decisiones del cliente

- **Autoservicio.** Las hamburguesas están configuradas como "Entrega en mesa", así que el aviso dice "Te lo llevamos a Mesa 1". Para autoservicio hay que pasarlas a "Retiro" desde Staff > Carta.
- Precio real del medallón extra (hoy $2.500) y lista definitiva de ingredientes para sacar. Se editan desde Staff > Carta.
- Tiempos de vencimiento de pedidos sin pagar (30 minutos y 2 horas).
- Stock: confirmar que alcanza con unidades por producto (no insumos ni recetas) y el umbral de aviso de stock bajo (5 unidades).
- Reportes: hoy solo los ve el rol Administrador. Definir si Caja también debe verlos.
- Stock y reportes quedaron fuera del alcance original: cotizarlos aparte.
- La pantalla `/pantalla` es pública y muestra solo números de pedido. Definir si alcanza o si debe mostrar el nombre.
- Los QR impresos dependen de `APP_URL`: imprimirlos con el dominio definitivo ya configurado.

## Validar con las transcripciones

- Confirmar el comportamiento de horario QR abierto, modo solo barra/caja y modo pausado.
- Confirmar si el modelo operativo es autoabastecimiento, atención de moza o una combinación según horario.
- Definir cuándo se cierra una sesión o una mesa; no confundirlo con marcar un pedido como `Entregado`.
- Confirmar el recorrido esperado de pedidos iniciados antes del corte horario.

## Entorno de desarrollo

- Trabajar desde el filesystem de WSL (`~/projects/App-qr`) y no desde `/mnt/c`: en `/mnt/c` los tests tardan varias veces más y `next dev` no detecta los cambios de archivos, así que hay que reiniciarlo a mano.
- Medir la velocidad de la app una vez ubicada ahí.

## Próxima prueba

Completar un segundo pedido desde la misma mesa después de entregar el primero y verificar que el QR siga operativo mientras la sesión o mesa continúe abierta.
