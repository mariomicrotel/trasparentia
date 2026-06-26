#!/bin/sh
# test-backup-restore.sh — verifica end-to-end del ciclo backup/restore.
# Eseguire PRIMA del go-live per validare che il gate P2 sia soddisfatto.
#
# Utilizzo:
#   ./scripts/test-backup-restore.sh [BASE_URL] [X_ROLE]
#
# Esempi:
#   ./scripts/test-backup-restore.sh http://localhost:8008 bianchi   # demo mode
#   BASE_URL=http://localhost:8008 TOKEN=eyJ... ./scripts/test-backup-restore.sh
#
# Il ripristino vero e proprio (distruttivo) NON viene eseguito automaticamente:
# lo script verifica che il file esista e sia integro, poi mostra il comando da eseguire.

set -e

BASE_URL="${1:-${BASE_URL:-http://localhost:8008}}"
X_ROLE="${2:-${X_ROLE:-bianchi}}"
TOKEN="${TOKEN:-}"

PASS=0
FAIL=0

green() { printf '\033[32m✓\033[0m %s\n' "$*"; }
red()   { printf '\033[31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
info()  { printf '\033[34m·\033[0m %s\n' "$*"; }

auth_header() {
  if [ -n "$TOKEN" ]; then
    echo "-H 'Authorization: Bearer $TOKEN'"
  else
    echo "-H 'X-Role: $X_ROLE'"
  fi
}

info "Server:  $BASE_URL"
info "Auth:    $([ -n "$TOKEN" ] && echo 'Bearer token' || echo "X-Role: $X_ROLE")"
echo ""

# ── 1. health ────────────────────────────────────────────────────────────────
info "[1/6] Health check..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$STATUS" = "200" ]; then
  green "Health OK (HTTP 200)"
  PASS=$((PASS+1))
else
  red "Health fallito (HTTP $STATUS)"
fi

# ── 2. readiness ─────────────────────────────────────────────────────────────
info "[2/6] Readiness check..."
BODY=$(curl -s "$BASE_URL/readiness")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/readiness")
if [ "$STATUS" = "200" ]; then
  green "Readiness OK — $BODY"
  PASS=$((PASS+1))
else
  red "Readiness degradata (HTTP $STATUS) — $BODY"
fi

# ── 3. crea backup ───────────────────────────────────────────────────────────
info "[3/6] Creazione backup..."
if [ -n "$TOKEN" ]; then
  BACKUP_RESP=$(curl -s -X POST "$BASE_URL/api/backup" \
    -H "Authorization: Bearer $TOKEN")
else
  BACKUP_RESP=$(curl -s -X POST "$BASE_URL/api/backup" \
    -H "X-Role: $X_ROLE")
fi

OK=$(echo "$BACKUP_RESP" | grep -o '"ok": *true' | head -1)
FNAME=$(echo "$BACKUP_RESP" | grep -o '"file": *"[^"]*"' | sed 's/"file": *"//' | sed 's/"//')
FSIZE=$(echo "$BACKUP_RESP" | grep -o '"size": *[0-9]*' | sed 's/"size": *//')

if [ -n "$OK" ] && [ -n "$FNAME" ]; then
  green "Backup creato: $FNAME ($FSIZE byte)"
  PASS=$((PASS+1))
else
  red "Backup fallito: $BACKUP_RESP"
  FNAME=""
fi

# ── 4. lista backup ──────────────────────────────────────────────────────────
info "[4/6] Lista backup..."
if [ -n "$TOKEN" ]; then
  LIST_RESP=$(curl -s "$BASE_URL/api/backup" -H "Authorization: Bearer $TOKEN")
else
  LIST_RESP=$(curl -s "$BASE_URL/api/backup" -H "X-Role: $X_ROLE")
fi

COUNT=$(echo "$LIST_RESP" | grep -o '"file"' | wc -l | tr -d ' ')
if [ "$COUNT" -gt 0 ]; then
  green "Lista OK — $COUNT backup trovati"
  PASS=$((PASS+1))
else
  red "Lista backup vuota o errore: $LIST_RESP"
fi

# ── 5. presenza del file appena creato ───────────────────────────────────────
info "[5/6] Verifica presenza del backup appena creato..."
if [ -n "$FNAME" ]; then
  FOUND=$(echo "$LIST_RESP" | grep -o "\"$FNAME\"" | head -1)
  if [ -n "$FOUND" ]; then
    green "File $FNAME presente nella lista"
    PASS=$((PASS+1))
  else
    red "File $FNAME NON trovato nella lista"
  fi
else
  info "Salto verifica presenza (backup non creato)"
fi

# ── 6. protezione path-traversal ─────────────────────────────────────────────
info "[6/6] Test protezione path-traversal..."
if [ -n "$TOKEN" ]; then
  PT_RESP=$(curl -s -X POST "$BASE_URL/api/backup/ripristina" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"file": "../../etc/passwd"}')
else
  PT_RESP=$(curl -s -X POST "$BASE_URL/api/backup/ripristina" \
    -H "X-Role: $X_ROLE" \
    -H "Content-Type: application/json" \
    -d '{"file": "../../etc/passwd"}')
fi

if echo "$PT_RESP" | grep -q '"ok": *false'; then
  green "Path-traversal bloccato correttamente"
  PASS=$((PASS+1))
else
  red "Path-traversal NON bloccato: $PT_RESP"
fi

# ── risultato ────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
printf "  Risultato: %d OK, %d FALLITI\n" "$PASS" "$FAIL"
echo "══════════════════════════════════════════"

if [ -n "$FNAME" ]; then
  echo ""
  info "Per testare il RIPRISTINO (operazione DISTRUTTIVA — eseguire solo su ambiente di test):"
  if [ -n "$TOKEN" ]; then
    echo "  curl -X POST $BASE_URL/api/backup/ripristina \\"
    echo "    -H 'Authorization: Bearer \$TOKEN' \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"file\": \"$FNAME\"}'"
  else
    echo "  curl -X POST $BASE_URL/api/backup/ripristina \\"
    echo "    -H 'X-Role: $X_ROLE' \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"file\": \"$FNAME\"}'"
  fi
fi

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
