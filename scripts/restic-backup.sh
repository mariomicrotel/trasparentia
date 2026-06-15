#!/bin/sh
# Backup incrementale cifrato con restic. Eseguito ogni 24h dal container restic-backup.
# Variabili attese nell'ambiente: RESTIC_REPOSITORY, RESTIC_PASSWORD
set -e

log() { echo "[restic $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Init del repository se non esiste (prima esecuzione o volume vergine)
if ! restic snapshots --quiet 2>/dev/null; then
  log "Inizializzazione repository restic..."
  restic init
  log "Repository inizializzato."
fi

while true; do
  log "Backup avviato"
  restic backup /data/backup --tag trasparentia --compression max
  log "Backup completato. Applicazione retention policy..."
  restic forget \
    --keep-daily  7 \
    --keep-weekly 4 \
    --prune
  log "Retention applicata. Verifica integrità..."
  restic check --read-data-subset=5%
  log "Prossimo backup tra 24h"
  sleep 86400
done
