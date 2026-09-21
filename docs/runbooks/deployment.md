# Despliegue

Configurar `DATABASE_URL`, `APP_URL` HTTPS, `SESSION_SECRET` de 32+ caracteres, `PAYMENT_PROVIDER`, credenciales de Mercado Pago y, si corresponde, S3. El webhook es `https://DOMINIO/api/payments/mercado-pago/webhook`.

Ejecutar migraciones (`npm run db:deploy`) antes de iniciar la nueva revisión. Verificar `/api/health`, `/api/ready`, login de staff, escaneo de QR y un pago de prueba. Para rollback, volver a la imagen anterior y no revertir migraciones destructivas sin backup.
