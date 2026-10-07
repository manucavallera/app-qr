# Pendientes de aceptación

Última actualización: 7 de octubre de 2026

## Estado al 7 de octubre

Todo lo de abajo está mergeado en `main` (PR #6 y #10 a #16) y desplegado. La última migración es `20261006180000_tab_payment_refund`.

**Probado de punta a punta en producción** (con la mesa de prueba y credenciales de prueba de Mercado Pago):

- Cuenta compartida por mesa: dos clientes piden a la cuenta, "Pedir la cuenta", cobro por persona y de la mesa entera, efectivo con confirmación en Caja, Comandas, seguimiento en vivo y pantalla del televisor, rechazo de pago, permisos (401 sin sesión, 404 al leer pedidos de otra mesa).
- Pago de la cuenta con Mercado Pago: la app crea el pago con el monto correcto, el comprador de prueba paga y Mercado Pago lo acredita. Con un aviso (webhook) válido, la app cobra el pedido, cierra la parte del cliente y deja la mesa abierta para el resto.
- También probado en local: pedido del mozo en Caja a la cuenta de una mesa, extras y notas, stock agotado, devoluciones, accesibilidad (0 problemas en cuatro pantallas) y carga en celular (primer contenido a los 2,9 s con 4G lento).

**Arreglado en esta tanda:** el login revelaba qué emails existen por el tiempo de respuesta; el cliente veía un error genérico cuando un producto se agotaba antes de enviar el pedido; los avisos de devolución de pagos de cuenta (nuevo bloque "Devolver pagos de cuenta" en Inicio); doble pago al tocar dos veces "Pagar con Mercado Pago"; textos de la cuenta y de la carta; `scripts/backup-db.sh` dejaba un archivo vacío si `pg_dump` fallaba; `APP_URL` con barra final armaba la URL del webhook con `//`.

**Abierto: el aviso real de Mercado Pago no se aplica solo.** Con una simulación desde el panel de Mercado Pago (pago real `181773804841`), la app cobró el pedido, así que el camino funciona y la firma es válida con la clave cargada. Pero con tres pagos reales aprobados (Ana, Beto y Caro) el aviso real nunca se aplicó, ni 200 segundos después. El webhook ahora deja una línea por aviso en los registros del servidor, con `route: "mercado-pago-webhook"` y un `code` (`PROCESSED`, `IGNORED_<tipo>` o `INVALID_WEBHOOK_SIGNATURE`). Hipótesis a confirmar con esos registros: los pagos vienen con `live_mode: true`, y Mercado Pago firma con una clave secreta distinta en modo Pruebas y en modo Productivo. Si es así, `MERCADOPAGO_WEBHOOK_SECRET` tiene que ser la del modo Productivo, y el webhook también hay que configurarlo ahí.

**Estado de la mesa de prueba en producción** (limpiar antes de abrir):

- "Pagar al final" está prendido y la mesa "Mesa prueba" está activa, con los pedidos #10 y #11 abiertos. Los dos tienen el pago aprobado en Mercado Pago y siguen sin cobrar en la app, a propósito, para depurar el aviso.
- El pedido #6 (entregado) dejó $ 2.800 de efectivo de prueba en las ventas del 6 de octubre.
- Desactivar el usuario `prueba@test.local` en Usuarios.
- El modo de pedidos QR sigue en "forzado abierto" (`FORCE_QR_OPEN`): cargar los horarios y volver a "Según horario" antes de abrir.

**Infraestructura:**

- Backup diario en EasyPanel (Copias de seguridad), base `appqr-db1`, 7:00 UTC, guardado en el disco del propio servidor. Falta un segundo destino fuera del servidor (R2), fijar la retención en 30 y **probar una restauración**. `scripts/backup-db.sh` necesita un `pg_dump` de la misma versión mayor que el servidor (PostgreSQL 18).
- Mercado Pago de prueba cargado en producción. Para cobrar de verdad hace falta el token de producción y la clave secreta del webhook de modo Productivo.
- Horario provisorio del dueño, a confirmar: martes cerrado, apertura a las 19, y quizá pasar a "solo caja" únicamente los fines de semana. La configuración ya permite un horario distinto por día.

## Estado al 5 de octubre

Desplegado en producción (`manu-appqr.gygo4l.easypanel.host`), con las migraciones `supplies`, `product_cost`, `table_tab` y `table_tab_entity` aplicadas:

- Dashboard del dueño, stock de insumos, costo y ganancia por producto, exportación CSV del cierre de caja.
- `INTERNAL_SECRET` cargado y cron de `session-cleanup` cada minuto desde cron-job.org (EasyPanel no tiene cron propio; el contenedor no trae `curl`, se usa `node -e fetch`).
- Límite de intentos de login: la IP se lee del último valor de `x-forwarded-for`. Verificado en producción: el sexto intento con IP falsa da 429.
- Cuenta por mesa (modo restaurante, hasta el cierre del QR): medio "Pagar al final", pantalla "Mi cuenta" del cliente con "Pedir la cuenta", pantalla Cuentas de staff con cobro por persona o de la mesa entera, pedidos del mozo a la cuenta desde Caja, aviso "Cuentas sin cobrar" en Inicio, "Por cobrar en mesas" en reportes. Al cerrar el horario del QR las cuentas abiertas pasan solas a "pidió la cuenta". Apagado por defecto: se prende con la casilla "Pagar al final" en Configuración.

Modelo confirmado por el dueño: hasta la 1 am cada QR es una mesa y se paga al final (efectivo al mozo o caja, o billetera); después, modo boliche: se paga en caja y se retira en barra. La comida la retira el cliente con un llamador.

Pendiente, en orden:

1. Probar la cuenta por mesa en producción con dos celulares: cierre del QR a la 1:00, prender "Pagar al final", pasar las hamburguesas a "Retiro".
2. Comprobante de la cuenta entera.
3. Pago de la cuenta con Mercado Pago: ver "Abierto" en el estado del 7 de octubre.
4. Imágenes con R2 desde el contenedor.
5. Mercado Pago real con la cuenta del cliente.
6. Backup diario automático con restauración probada (`scripts/backup-db.sh` sigue sin probarse; hoy los backups son `pg_dump` manuales antes de cada migración).
7. Días y horario de apertura: falta la respuesta del dueño.
8. Noche de prueba supervisada.

Lo que sigue más abajo es el historial anterior; los puntos de "Bloqueantes para producción" sobre migraciones, cron, merge y `x-forwarded-for` ya están resueltos.

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

- Carta del cliente: foto grande al tocar un producto, fila "Recomendados" (casilla "Destacado" en Staff > Carta), categorías que siguen el scroll, carrito en la barra fija de arriba y carga con siluetas.
- Seguimiento con las cinco etapas, extras, ingredientes sacados y notas, y botones "Ver comprobante" y "Pedir algo más".
- Comprobante no fiscal ("Documento no válido como factura") para el cliente y para imprimir desde Staff > Pedidos en formato ticket de 80 mm.
- Imágenes en Cloudflare R2 (bucket `pedidosqr`) probadas desde la máquina local. Ver `docs/runbooks/deployment.md`.
- `npm run build` termina bien con Next 16.3.8.

## Próxima sesión

1. Reemplazar la foto de prueba de "Hamburguesa clásica" (es una carta astral) por una real. Se cambia desde Staff > Carta.
2. Hacer la noche de prueba supervisada (ver más abajo) una vez desplegado y migrado.

## Bloqueantes para producción

1. **Build de producción.** (Verificado el 4 de octubre: `npm run build` termina bien tras el rediseño del cliente.) Las dependencias ya están actualizadas (Next 16.3.8, sin el paquete `mercadopago`). Falta confirmar que `npm run build` termina bien. No ejecutar `npm audit fix --force`: baja Prisma a la versión 6. Los avisos restantes son de `vitest` y del CLI de Prisma, que no corren en la app. Usar Node 24 (`nvm use`).
2. **Imágenes.** Con `IMAGE_STORAGE_DRIVER=local` la subida falla en el contenedor (`/app` es de root y el proceso corre como `appuser`) y las fotos se pierden en cada redeploy. Crear una cuenta en Cloudflare R2 o Cloudinary, pasar las credenciales y adaptar el driver. Luego cargar las fotos reales: hoy todos los productos muestran el placeholder.
3. **Mercado Pago.** Verificado el 4 de octubre contra la API real de sandbox: se crea la preferencia de pago (`POST /checkout/preferences`), un pago rechazado llega como `rejected` (`cc_rejected_other_reason`) y deja el pedido esperando, un pago aprobado llega como `approved`/`accredited` y confirma el pedido, y la referencia externa (id del intento de pago) vincula el pago con el pedido. El aviso del webhook se simuló firmado con la clave local; la firma real de Mercado Pago solo se puede probar ya desplegado con una URL pública. Los tokens de prueba y de producción empiezan los dos con `APP_USR-`: se distinguen consultando `GET /users/me` (la cuenta de prueba se llama `TESTUSER...` y trae la etiqueta `test_user`). Para producción: crear la aplicación Checkout Pro con la cuenta del cliente, activar sus credenciales de producción, suscribir el webhook al evento **Pagos** con el dominio definitivo, cargar token y clave secreta solo en EasyPanel y hacer un pago real chico con devolución.
4. **Migraciones.** Stock y destacados agregan `20261002_product_stock` y `20261003_product_featured`; solo agregan columnas, no tocan datos. La migración viaja dentro de la imagen nueva, así que el orden es: backup de la base, redeploy de `main`, y enseguida `npm run db:deploy` desde la consola de la app. Entre el redeploy y el `db:deploy` la carta y el staff pueden dar error.
5. **Cron y secreto interno.** Definir `INTERNAL_SECRET` en producción y programar el cron de `docs/runbooks/deployment.md`. Sin eso no corren el corte nocturno ni el vencimiento de pedidos sin pagar.
6. **Merge.** Hecho el 4 de octubre: la rama `work/pedidos-qr` está en `main` (pull request #1, CI en verde). `next-env.d.ts` no se commitea: lo modifica `next dev`.

## Seguridad y operación

Resuelto el 4 de octubre: CSRF (el proxy bloquea escrituras de otro sitio), cierre de sesiones al cambiar la contraseña (también las demás sesiones de quien cambia la propia) y purga de sesiones y límites vencidos (corre dentro del cron de `session-cleanup`, por eso el cron es obligatorio).

- Límite de intentos de login: ya hay un límite por email e IP (5 cada 15 minutos) y otro solo por email (20). Falta confirmar que el proxy de EasyPanel pisa `x-forwarded-for`, para que el cliente no pueda falsear la IP.
- CSP: `script-src` permite `'unsafe-inline'` en producción.
- Las páginas `/staff/*` solo comprueban que exista la cookie; son cascarones estáticos sin datos y todas las APIs validan la sesión, así que una cookie falsa muestra una pantalla vacía y redirige al login.
- Backups: automatizar el backup diario y probar una restauración; el runbook solo lo describe.
- Pago aprobado sobre un pedido ya cancelado: el inicio de Staff muestra el aviso "Dinero para devolver" y el administrador lo marca con "Ya lo devolví" una vez que devuelve el dinero. La devolución en sí (por ejemplo desde el panel de Mercado Pago) sigue siendo manual; no hay reembolso automático.
- CI: ya corre lint, typecheck, tests unitarios, de integración y build. Faltan los e2e (requieren sembrar la base e instalar Chromium), `npm audit` (hoy fallaría por avisos de dependencias de desarrollo) y el build de Docker.
- Imagen Docker: copia `node_modules` completo; las migraciones son manuales.
- Tests de integración: se reemplazaron los que comparaban un literal consigo mismo. Ahora hay pruebas reales de conciliación de Mercado Pago contra la base (acreditado, duplicado, monto distinto, rechazo, pago sobre pedido cancelado, pago inexistente), de autorización de usuarios, de sesiones y de concurrencia entre operadores sobre una misma comanda. Esta última encontró un bug real (dos operadores podían aplicar la misma transición y una cancelación doble reponía el stock dos veces), corregido bloqueando la fila del pedido.
- El test de límite de sesiones por QR puede superar los 5 segundos con la máquina cargada.

## Diseño

- Variables de color: la paleta central está en `:root` de `globals.css` (staff) y el menú del cliente usa sus propios tokens en `src/app/m/customer-menu.css`. Quedan colores sueltos de uso único en `globals.css`.
- Pedidos (Staff) en celular: el nombre del producto y el precio quedan apretados en la misma fila.
- Reportes, Usuarios y Auditoría solo aparecen en el menú desde Inicio y desde sus propias pantallas; las demás pantallas de Staff no reciben el rol.
- Caja marca los productos sin stock como "Agotado" (botón deshabilitado), avisa "Quedan N" con stock bajo y limita la cantidad al stock disponible.
- Tailwind está importado y casi no se usa.

## Decisiones del cliente

- **Autoservicio.** Las hamburguesas están configuradas como "Entrega en mesa", así que el aviso dice "Te lo llevamos a Mesa 1". Para autoservicio hay que pasarlas a "Retiro" desde Staff > Carta.
- Precio real del medallón extra (hoy $2.500) y lista definitiva de ingredientes para sacar. Se editan desde Staff > Carta.
- Tiempos de vencimiento de pedidos sin pagar (30 minutos y 2 horas).
- Stock: confirmar que alcanza con unidades por producto (no insumos ni recetas) y el umbral de aviso de stock bajo (5 unidades).
- Reportes: hoy solo los ve el rol Administrador. Definir si Caja también debe verlos.
- Stock, reportes, comprobante, recomendados y llamador quedaron fuera del alcance original: cotizarlos aparte.
- Facturación: el cliente pidió "una pequeña factura". Se hizo un comprobante no fiscal. Emitir facturas con ARCA es otro proyecto; confirmarlo con su contador.
- Logo y foto de portada del local para el encabezado de la carta: pendiente de que los manden.
- La pantalla `/pantalla` es pública y muestra solo números de pedido. Definir si alcanza o si debe mostrar el nombre.
- Los QR impresos dependen de `APP_URL`: imprimirlos con el dominio definitivo ya configurado.

## Validar con las transcripciones

- Confirmar el comportamiento de horario QR abierto, modo solo barra/caja y modo pausado.
- Confirmar si el modelo operativo es autoabastecimiento, atención de moza o una combinación según horario.
- Definir cuándo se cierra una sesión o una mesa; no confundirlo con marcar un pedido como `Entregado`.
- Confirmar el recorrido esperado de pedidos iniciados antes del corte horario.

## Entorno de desarrollo

- Trabajar desde el filesystem de WSL (`~/projects/App-qr-wsl`) y no desde `/mnt/c`: en `/mnt/c` la primera carga tardó 107 segundos contra 1,2 en WSL, y `next dev` no detecta los cambios de archivos. La copia de `/mnt/c` quedó atrasada; actualizarla con `git pull` si se vuelve a usar. `~/projects/App-qr` es una copia vieja y no debe usarse.

## Próxima prueba

Completar un segundo pedido desde la misma mesa después de entregar el primero y verificar que el QR siga operativo mientras la sesión o mesa continúe abierta.

## Noche de prueba supervisada

Antes de abrir al público, una noche con el equipo avisado y alguien mirando:

1. Migraciones aplicadas, `/api/health` y `/api/ready` en verde.
2. Cron de `session-cleanup` funcionando (revisar que un pedido sin pagar venza).
3. Subir una foto de producto en producción y verla en la carta (R2).
4. Pago real chico con Mercado Pago, con devolución desde su panel y marcado en "Dinero para devolver".
5. Un pedido completo desde un iPhone (Safari) y un Android reales, en modo claro y oscuro.
6. Dos o tres celulares pidiendo a la vez, de la misma mesa y de mesas distintas.
7. Confirmar que el proxy de EasyPanel pisa `x-forwarded-for` (seis logins fallidos con encabezados falsos distintos: el sexto debe dar 429).
8. Backup de la base y restauración probada en una base temporal.

Sin resolver todavía: monitoreo de errores (hoy un fallo en producción se conoce por un cliente) y pruebas de carga.

## Ideas para después del lanzamiento (cotizar aparte)

- Entrega por horario: que la app decida sola entre "Entrega en mesa" y "Retiro" según la franja con moza.
- Alérgenos y etiquetas (sin TACC, vegetariano, picante), propina opcional y reportes por hora con exportación a Excel.
- Dashboard con ventas del día, stock bajo, pedidos y comprobantes.
- Impresión de comandas en cocina, promos y happy hour, aviso por WhatsApp.
- Cuenta abierta por mesa y dividir la cuenta (solo si hay atención con moza), stock por insumos, facturación con ARCA.
- QR dinámico de Mercado Pago en Caja, para cobrar desde cualquier billetera con confirmación automática. Falta confirmar con Mercado Pago que su QR de Argentina sea interoperable y las comisiones.
