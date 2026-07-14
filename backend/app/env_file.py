"""Aggiornamento sicuro di un file .env: aggiorna/inserisce chiavi preservando
commenti, ordine e le altre righe. Scrive IN PLACE (compatibile con il bind-mount
di un singolo file su Docker Desktop, dove il rename atomico romperebbe il mount)."""
import os
import re


def scrivi(path: str, updates: dict) -> None:
    """Applica {CHIAVE: valore} al file .env in `path`. Le chiavi già presenti
    vengono sostituite sul posto; quelle nuove aggiunte in coda."""
    righe: list[str] = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            righe = f.read().splitlines()

    fatte: set[str] = set()
    out: list[str] = []
    for riga in righe:
        sostituita = False
        for k, v in updates.items():
            if k not in fatte and re.match(rf"^\s*{re.escape(k)}\s*=", riga):
                out.append(f"{k}={v}")
                fatte.add(k)
                sostituita = True
                break
        if not sostituita:
            out.append(riga)
    for k, v in updates.items():
        if k not in fatte:
            out.append(f"{k}={v}")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
