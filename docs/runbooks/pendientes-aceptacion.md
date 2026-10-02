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

Verificación del 2 de octubre: typecheck, lint, 91 tests unitarios, 27 de integración y los e2e del cliente (`cart-multi-item` y `customer-traditional`). No se corrieron los e2e de Staff, Mercado Pago, corte horario ni privacidad, ni `next build`.

## Bloqueantes para producción

1. **Dependencias.** Ejecutar `npm uninstall mercadopago && npm audit fix`. Actualiza Next (aviso crítico GHSA-vcvr-r3jv-pc5j) y quita el paquete `mercadopago`, que no se usa: la integración llama a la API con `fetch`. Después correr typecheck, tests y `npm run build`.
2. **Imágenes.** Con `IMAGE_STORAGE_DRIVER=local` la subida falla en el contenedor (`/app` es de root y el proceso corre como `appuser`) y las fotos se pierden en cada redeploy. Crear una cuenta en Cloudflare R2 o Cloudinary, pasar las credenciales y adaptar el driver. Luego cargar las fotos reales: hoy todos los productos muestran el placeholder.
3. **Mercado Pago.** Probar en sandbox con credenciales de prueba. Confirmar la firma del webhook: `validateMercadoPagoSignature` usa `data.id` tal cual llega y Mercado Pago lo pide en minúsculas cuando es alfanumérico. Agregar timeout al `fetch` de `MercadoPagoGateway`.
4. **Cron y secreto interno.** Definir `INTERNAL_SECRET` en producción y programar el cron de `docs/runbooks/deployment.md`. Sin eso no corren el corte nocturno ni el vencimiento de pedidos sin pagar.
5. **Commit y merge.** Todo el trabajo de esta rama está sin commitear. `next-env.d.ts` no se commitea: lo modifica `next dev`.

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
- Usuarios y Auditoría no aparecen en el menú de varias pantallas de Staff porque no reciben el rol.
- Tailwind está importado y casi no se usa.

## Decisiones del cliente

- **Autoservicio.** Las hamburguesas están configuradas como "Entrega en mesa", así que el aviso dice "Te lo llevamos a Mesa 1". Para autoservicio hay que pasarlas a "Retiro" desde Staff > Carta.
- Precio real del medallón extra (hoy $2.500) y lista definitiva de ingredientes para sacar. Se editan desde Staff > Carta.
- Tiempos de vencimiento de pedidos sin pagar (30 minutos y 2 horas).
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
