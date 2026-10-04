# Pendientes de aceptación

Última actualización: 3 de octubre de 2026

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

1. Volver a correr los cinco e2e que se cortaron el 3 de octubre porque el build cerró el servidor de desarrollo: `mercado-pago`, `cart-multi-item` (mobile), la carta a 320 px y los dos de `staff-ux` (mobile). Correrlos con el servidor levantado y sin un build en paralelo.
2. Correr `npm run build` con el servidor de desarrollo cerrado y confirmar que desapareció el aviso de rastreo de `storage.ts`.
3. Reemplazar la foto de prueba de "Hamburguesa clásica" (es una carta astral) por una real.
4. En `/mnt/c`, `next dev` no detecta archivos ni carpetas nuevas. Después de crear rutas: cortar el servidor, borrar `.next/dev` y volver a levantarlo. Trabajar desde `~/projects/App-qr` evita el problema.

## Bloqueantes para producción

1. **Build de producción.** (Verificado el 4 de octubre: `npm run build` termina bien tras el rediseño del cliente.) Las dependencias ya están actualizadas (Next 16.3.8, sin el paquete `mercadopago`). Falta confirmar que `npm run build` termina bien. No ejecutar `npm audit fix --force`: baja Prisma a la versión 6. Los avisos restantes son de `vitest` y del CLI de Prisma, que no corren en la app. Usar Node 24 (`nvm use`).
2. **Imágenes.** Con `IMAGE_STORAGE_DRIVER=local` la subida falla en el contenedor (`/app` es de root y el proceso corre como `appuser`) y las fotos se pierden en cada redeploy. Crear una cuenta en Cloudflare R2 o Cloudinary, pasar las credenciales y adaptar el driver. Luego cargar las fotos reales: hoy todos los productos muestran el placeholder.
3. **Mercado Pago.** Verificado el 4 de octubre contra la API real de sandbox: se crea la preferencia de pago (`POST /checkout/preferences`), un pago rechazado llega como `rejected` (`cc_rejected_other_reason`) y deja el pedido esperando, un pago aprobado llega como `approved`/`accredited` y confirma el pedido, y la referencia externa (id del intento de pago) vincula el pago con el pedido. El aviso del webhook se simuló firmado con la clave local; la firma real de Mercado Pago solo se puede probar ya desplegado con una URL pública. Los tokens de prueba y de producción empiezan los dos con `APP_USR-`: se distinguen consultando `GET /users/me` (la cuenta de prueba se llama `TESTUSER...` y trae la etiqueta `test_user`). Para producción: crear la aplicación Checkout Pro con la cuenta del cliente, activar sus credenciales de producción, suscribir el webhook al evento **Pagos** con el dominio definitivo, cargar token y clave secreta solo en EasyPanel y hacer un pago real chico con devolución.
4. **Migraciones.** Stock y destacados agregan `20261002_product_stock` y `20261003_product_featured`. Ejecutar `npm run db:deploy` en producción antes de iniciar la nueva versión.
5. **Cron y secreto interno.** Definir `INTERNAL_SECRET` en producción y programar el cron de `docs/runbooks/deployment.md`. Sin eso no corren el corte nocturno ni el vencimiento de pedidos sin pagar.
6. **Merge.** Llevar la rama `work/pedidos-qr` a `main`. `next-env.d.ts` no se commitea: lo modifica `next dev`.

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

- Variables de color: la paleta central ya está en `:root` (35 variables). Quedan unos 190 colores sueltos de uso único en `globals.css`.
- Pedidos (Staff) en celular: el nombre del producto y el precio quedan apretados en la misma fila.
- El seguimiento muestra cuatro etapas en una grilla de cuatro columnas aunque el componente define cinco (falta ver dónde queda "Entregado").
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

- Trabajar desde el filesystem de WSL (`~/projects/App-qr`) y no desde `/mnt/c`: en `/mnt/c` los tests tardan varias veces más y `next dev` no detecta los cambios de archivos, así que hay que reiniciarlo a mano.
- Medir la velocidad de la app una vez ubicada ahí.

## Próxima prueba

Completar un segundo pedido desde la misma mesa después de entregar el primero y verificar que el QR siga operativo mientras la sesión o mesa continúe abierta.
