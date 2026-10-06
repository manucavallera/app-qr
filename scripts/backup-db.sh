#!/usr/bin/env bash
# Backup diario de PostgreSQL: dump comprimido, cifrado con AES-256, retención de 30 días.
# Variables requeridas: DATABASE_URL, BACKUP_PASSPHRASE. Opcional: BACKUP_DIR (default ./backups).
set -euo pipefail

: "${DATABASE_URL:?falta DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?falta BACKUP_PASSPHRASE}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/appqr-$(date -u +%Y%m%dT%H%M%SZ).sql.gz.enc"
partial="$out.partial"
# Un dump que falla no debe dejar un archivo que parezca un backup válido.
trap 'rm -f "$partial"' EXIT

# pg_dump tiene que ser de la misma versión mayor que el servidor o más nueva
# (si no, aborta con "server version mismatch").
pg_dump --no-owner --no-privileges "$DATABASE_URL" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE \
  > "$partial"
mv "$partial" "$out"

find "$BACKUP_DIR" -name 'appqr-*.sql.gz.enc' -mtime +"$RETENTION_DAYS" -delete
echo "backup ok: $out ($(du -h "$out" | cut -f1))"

# Restaurar:
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in ARCHIVO.enc | gunzip | psql "$DATABASE_URL_AISLADA"
