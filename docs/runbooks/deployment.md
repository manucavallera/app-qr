# Despliegue

Configurar `DATABASE_URL`, `APP_URL` HTTPS, `SESSION_SECRET` de 32+ caracteres, `INTERNAL_SECRET` aleatorio de 32+ caracteres, `PAYMENT_PROVIDER`, credenciales de Mercado Pago y, si corresponde, S3. El webhook es `https://DOMINIO/api/payments/mercado-pago/webhook` y en el panel de Mercado Pago (Webhooks de la aplicación) se suscribe al evento **Pagos**. La integración es Checkout Pro: se crea una preferencia de pago (`POST /checkout/preferences`) y el aviso trae el id del pago, que se consulta en `GET /v1/payments/{id}`. Crear la aplicación como **Checkout Pro**.

Ejecutar migraciones (`npm run db:deploy`) antes de iniciar la nueva revisión. Verificar `/api/health`, `/api/ready`, login de staff, escaneo de QR y un pago de prueba. Para rollback, volver a la imagen anterior y no revertir migraciones destructivas sin backup.

## Imágenes de productos (Cloudflare R2)

1. En Cloudflare, R2: crear un bucket (por ejemplo `pedidos-qr`).
2. En el bucket, Configuración: activar el acceso público (subdominio `r2.dev`) o conectar un dominio propio. Copiar esa URL pública.
3. R2 > Administrar tokens de API: crear un token con permiso de lectura y escritura sobre ese bucket. Copiar el Access Key ID y el Secret Access Key.
4. En EasyPanel, variables de la app:

```
IMAGE_STORAGE_DRIVER=s3
S3_ENDPOINT=https://<ID_DE_CUENTA>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=pedidos-qr
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://<la URL pública del paso 2>
```

Reiniciar la app, subir una foto desde Staff > Carta y comprobar que se ve en la carta. Las fotos ya subidas al disco local no se migran: volver a cargarlas.

## Carga inicial de datos de demostración

Después del primer despliegue, desde la consola de la app en EasyPanel ejecutar una vez:

```sh
npm run db:deploy
SEED_ADMIN_EMAIL=demo@pedidosqr.test SEED_ADMIN_PASSWORD='CAMBIAR_POR_UNA_CLAVE_TEMPORAL' npm run db:seed
```

El seed es repetible: crea o conserva la configuración, categorías, productos y mesas de ejemplo, y crea el usuario administrador indicado. No elimina pedidos ni datos existentes. Cambiar la contraseña temporal antes de compartir el acceso y no colocar credenciales reales en el repositorio.

## Limpieza de sesiones QR y pedidos sin pagar

Configurar un cron externo cada minuto con las mismas variables de entorno `APP_URL` e `INTERNAL_SECRET` que la app:

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer $INTERNAL_SECRET" \
  "$APP_URL/api/internal/session-cleanup"
```

La respuesta esperada es `{"ok":true,"closed":0,"cancelledOrders":0}`. `closed` cuenta las sesiones inactivas cerradas y `cancelledOrders` los pedidos cancelados por falta de pago: 30 minutos sin pagar, o 2 horas si hay un pago online en curso. No exponer `INTERNAL_SECRET` en URLs, repositorios ni registros de comandos.
