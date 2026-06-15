# Backup & Disaster Recovery — TrasParentIA

## Architettura del backup

Il sistema opera su **due livelli**:

| Livello | Strumento | Frequenza | Dove |
|---------|-----------|-----------|------|
| L1 — Dump PostgreSQL | `pg_dump` + gzip | On-demand (API `/api/backup`) + schedulato | Volume Docker `backupdata` |
| L2 — Backup cifrato incrementale | restic | Ogni 24h automatico | Volume Docker `resticrepo` |

Il **container `restic-backup`** monitora il volume `backupdata` (dove confluiscono i dump pg_dump) e ne esegue backup incrementali cifrati con retention:
- **7 giornalieri** + **4 settimanali** → massimo ~35 giorni di storia

La chiave di cifratura restic (`RESTIC_PASSWORD`) è l'unica protezione contro accesso non autorizzato ai dati cifrati: va custodita fuori dalla macchina (es. password manager, safe fisico).

---

## Prerequisiti

```bash
# .env deve contenere:
RESTIC_PASSWORD=<chiave-forte-min-32-caratteri>
```

---

## Eseguire un backup manuale L1

```bash
# Tramite API (richiede autenticazione con ruolo segretario/responsabile)
curl -X POST http://localhost/api/backup/esegui \
  -H "Authorization: Bearer <token>"

# Oppure direttamente nel container backend
docker compose exec backend python -c "from app.backup import esegui; print(esegui())"
```

Il file `trasparentia_YYYYMMDD_HHMMSS.sql.gz` viene scritto in `/data/backup/` (volume `backupdata`). Restic includerà questo file nel successivo ciclo notturno.

---

## Forzare un backup restic immediato

```bash
docker compose exec restic-backup restic backup /data/backup --tag trasparentia-manuale
```

---

## Elenco snapshot restic

```bash
docker compose exec restic-backup restic snapshots
```

Output di esempio:
```
ID        Time                 Host              Tags
---------------------------------------------------------------
a1b2c3d4  2026-06-12 02:00:00  restic-backup     trasparentia
e5f6g7h8  2026-06-11 02:00:00  restic-backup     trasparentia
```

---

## Procedura di ripristino (Restore)

### Scenario A — Ripristino su ambiente esistente (dati corrotti)

```bash
# 1. Ferma il backend per evitare scritture concorrenti
docker compose stop backend worker beat

# 2. Elenca gli snapshot e scegli l'ID da ripristinare
docker compose exec restic-backup restic snapshots

# 3. Estrai il dump dal snapshot restic in una directory temporanea
docker compose exec restic-backup \
  restic restore <SNAPSHOT_ID> --target /tmp/restore

# 4. Trova il file dump più recente estratto
docker compose exec restic-backup ls /tmp/restore/data/backup/

# 5. Ripristina il database dal dump scelto
#    (es. trasparentia_20260611_020000.sql.gz)
docker compose exec db sh -c \
  "zcat /dev/stdin | psql -U $POSTGRES_USER -d $POSTGRES_DB" \
  < /tmp/restore/data/backup/trasparentia_20260611_020000.sql.gz

# 6. Riavvia i servizi
docker compose start backend worker beat
```

### Scenario B — Disaster Recovery su ambiente vergine

```bash
# 1. Clona il repo sul nuovo server
git clone <repo> trasparentia && cd trasparentia/platform

# 2. Genera il .env (poi inserisci manualmente i segreti reali, inclusa RESTIC_PASSWORD)
bash scripts/gen-env.sh

# 3. Avvia solo db e restic-backup (senza backend, che cercherebbe dati)
docker compose up -d db restic-backup

# 4. Copia il volume resticrepo dal vecchio server:
#    Sul vecchio server:
#      docker run --rm -v platform_resticrepo:/src alpine tar czf - /src > resticrepo.tar.gz
#    Sul nuovo server:
#      cat resticrepo.tar.gz | docker run --rm -i -v platform_resticrepo:/dst alpine tar xzf - -C /

# 5. Verifica il repository restic
docker compose exec restic-backup restic snapshots

# 6. Ripristina l'ultimo snapshot
docker compose exec restic-backup \
  restic restore latest --target /tmp/restore

# 7. Importa il dump nel db (già in esecuzione)
docker compose exec db sh -c \
  "zcat /dev/stdin | psql -U $POSTGRES_USER -d $POSTGRES_DB" \
  < /tmp/restore/data/backup/<ultimo_dump>.sql.gz

# 8. Avvia tutti i servizi
docker compose up -d
```

---

## RTO — Recovery Time Objective

| Scenario | Stima |
|----------|-------|
| Ripristino dati corrotti su server esistente (Scenario A) | < 15 minuti |
| Disaster recovery su server vergine (Scenario B) | 30–60 minuti (dipende da copia volume e download immagini) |

Misurazione effettiva: eseguire una prova DR in ambiente di staging prima del go-live (criterio di accettazione P2).

---

## Verifica periodica

```bash
# Verifica integrità (automatica ogni 24h dal container, 5% campionamento)
docker compose exec restic-backup restic check --read-data-subset=5%

# Verifica completa (trimestrale, richiede più tempo)
docker compose exec restic-backup restic check --read-data
```

---

## Sicurezza

- `RESTIC_PASSWORD` è l'unica chiave per decifrare il repository — custodirla in un luogo separato dalla macchina (es. KeePass del responsabile IT, cassaforte).
- Il volume `resticrepo` dovrebbe essere copiato periodicamente su storage esterno (NAS, server remoto del comune). Aggiungere uno step post-backup al crontab del sistema host:
  ```bash
  rsync -az /var/lib/docker/volumes/platform_resticrepo/_data/ backup-nas:/trasparentia/restic/
  ```
- I dump pg_dump (L1) non sono cifrati — il volume `backupdata` va protetto a livello OS o copiato solo verso destinazioni sicure.
