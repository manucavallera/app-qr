# Despliegue

Configurar `DATABASE_URL`, `APP_URL` HTTPS, `SESSION_SECRET` de 32+ caracteres, `INTERNAL_SECRET` aleatorio de 32+ caracteres, `PAYMENT_PROVIDER`, credenciales de Mercado Pago y, si corresponde, S3. El webhook es `https://DOMINIO/api/payments/mercado-pago/webhook`.

Ejecutar migraciones (`npm run db:deploy`) antes de iniciar la nueva revisión. Verificar `/api/health`, `/api/ready`, login de staff, escaneo de QR y un pago de prueba. Para rollback, volver a la imagen anterior y no revertir migraciones destructivas sin backup.

## Limpieza de sesiones QR

Configurar un cron externo cada minuto con las mismas variables de entorno `APP_URL` e `INTERNAL_SECRET` que la app:

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer $INTERNAL_SECRET" \
  "$APP_URL/api/internal/session-cleanup"
```

La respuesta esperada es `{"ok":true,"closed":0}` o un número mayor si cerró sesiones inactivas. No exponer `INTERNAL_SECRET` en URLs, repositorios ni registros de comandos.
