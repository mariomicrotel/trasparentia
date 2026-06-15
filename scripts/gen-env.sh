#!/usr/bin/env bash
# Genera un file .env con segreti casuali forti.
# Uso: bash scripts/gen-env.sh [--force]
# Richiede: openssl (standard su Linux/macOS; su Windows usare Git Bash o WSL)

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"
EXAMPLE_FILE="$(dirname "$0")/../.env.example"

if [[ -f "$ENV_FILE" && "${1:-}" != "--force" ]]; then
  echo "ERRORE: $ENV_FILE esiste già. Usa --force per sovrascrivere." >&2
  exit 1
fi

rand32() { openssl rand -base64 40 | tr -d '+/=\n' | head -c 32; }
rand48() { openssl rand -base64 64 | tr -d '+/=\n' | head -c 48; }

# Copia l'esempio come base
cp "$EXAMPLE_FILE" "$ENV_FILE"

# Sostituisce i segnaposto con segreti generati
sed -i \
  -e "s|CAMBIA_QUESTA_PASSWORD_DB|$(rand32)|g" \
  -e "s|CAMBIA_QUESTO_ACCESSO_MINIO|$(rand32)|g" \
  -e "s|CAMBIA_QUESTA_CHIAVE_MINIO|$(rand48)|g" \
  -e "s|CAMBIA_QUESTA_PASSWORD_KC|$(rand48)|g" \
  -e "s|CAMBIA_QUESTA_CHIAVE_RESTIC|$(rand48)|g" \
  "$ENV_FILE"

echo "File $ENV_FILE generato con segreti casuali."
echo ""
echo "AZIONI OBBLIGATORIE prima di avviare:"
echo "  1. Imposta OLLAMA_BASE_URL con l'IP del server AI (es. https://192.168.1.10)"
echo "  2. Imposta AI_API_KEY con la chiave del reverse proxy Ollama"
echo "  3. Imposta PEC_HOST/PEC_USER/PEC_PASSWORD se usi PEC"
echo "  4. Imposta SMTP_* se vuoi notifiche email"
echo "  5. Verifica ENTE_NOME"
echo ""
echo "IMPORTANTE: non aggiungere mai .env al commit git."
