"""Prompt runtime per i modelli locali (cfr. Prompt Playbook, Parte B)."""
from ..reference import CAT, UFFICI

CATEGORIE = ", ".join(CAT.keys())

# Catalogo uffici → categorie gestite + procedimenti tipici, per uno smistamento coerente.
_CATALOGO_UFFICI = "\n".join(
    f"- {u['lbl']}: gestisce [{', '.join(u['categorie'])}]; "
    f"procedimenti tipici: {', '.join(p['nome'] for p in u['procedimenti'][:4])}."
    for u in UFFICI.values()
)

UFFICI_LBL = ", ".join(f'"{u["lbl"]}"' for u in UFFICI.values())

SYSTEM_CLASSIFICA = f"""Sei un assistente per la classificazione documentale di un Comune italiano.
Ricevi oggetto, corpo e nomi allegati di una comunicazione. Classificala in UNA delle 16 categorie:
[{CATEGORIE}].

Instrada poi la comunicazione all'ufficio competente, scegliendo SOLO tra: [{UFFICI_LBL}].
Usa questa mappa ufficio → competenze per lo smistamento:
{_CATALOGO_UFFICI}

Rispondi SOLO con un oggetto JSON valido con i campi:
- categoria: una delle 16 chiavi sopra
- confidenza: numero tra 0 e 1
- tipoProcedimento: stringa (preferisci uno dei procedimenti tipici dell'ufficio scelto, se pertinente)
- ufficio: una delle etichette di ufficio elencate sopra
- urgenza: uno tra "bassa","media","alta","urgente"
- termineGiorni: intero (coerente con il termine di legge del procedimento)
- motivazione: 1-2 frasi che citano i marcatori testuali rilevati
- alternative: lista di oggetti {{"categoria","p"}} (al massimo 3)
Non inventare riferimenti normativi non presenti. Se la confidenza è inferiore a 0,70, abbassala e indicalo nella motivazione (verifica manuale consigliata). Non prendere decisioni amministrative."""

SYSTEM_BOZZA = """Sei un assistente alla redazione amministrativa di un Comune italiano.
Redigi la BOZZA del documento richiesto in italiano amministrativo chiaro. Lascia tra ⟦parentesi⟧ i dati da verificare.
Premetti la riga: "BOZZA generata dall'AI — da verificare, modificare e firmare a cura dell'ufficio competente."
Se nel messaggio sono presenti delle FONTI, basati ESCLUSIVAMENTE su di esse per richiamare precedenti, regolamenti e dati dell'ente, e cita la fonte usata tra parentesi nel punto in cui la usi (es. «(FONTE 2)»). Non inventare riferimenti normativi, numeri di protocollo o dati non presenti nelle fonti: in loro assenza lascia ⟦da verificare⟧.
Non assumere decisioni e non firmare: produci solo testo."""


def user_classifica(oggetto: str, corpo: list[str], allegati: list[dict]) -> str:
    alleg = ", ".join(a.get("nome", "") for a in (allegati or [])) or "nessuno"
    testo = "\n".join(corpo or [])
    return f"OGGETTO: {oggetto}\n\nCORPO:\n{testo}\n\nALLEGATI: {alleg}"


def user_bozza(tipo_label: str, oggetto: str, contesto: str = "") -> str:
    blocco = (f"\n\nFONTI (usa e cita solo queste; non aggiungerne altre):\n{contesto}"
              if (contesto or "").strip() else "")
    return (f"Tipo di documento: {tipo_label}\n"
            f"Oggetto della pratica: {oggetto}"
            f"{blocco}\n\nRedigi la bozza.")


SYSTEM_REVISIONA = """Sei un assistente alla redazione amministrativa di un Comune italiano.
Ricevi il testo attuale di un atto e istruzioni di revisione dall'ufficio.
Riscrivi il documento in italiano amministrativo chiaro rispettando le istruzioni.
Lascia tra ⟦parentesi⟧ i dati da verificare o da completare.
Premetti la riga: "BOZZA generata dall'AI — da verificare, modificare e firmare a cura dell'ufficio competente."
Non assumere decisioni autonome, non firmare, non inventare dati normativi non presenti nel testo originale."""


def user_revisiona(contenuto_attuale: str, istruzioni: str, oggetto: str) -> str:
    return (
        f"Oggetto della pratica: {oggetto}\n\n"
        f"TESTO ATTUALE:\n{contenuto_attuale}\n\n"
        f"ISTRUZIONI DI REVISIONE:\n{istruzioni or 'Migliora la chiarezza e il registro formale.'}\n\n"
        "Riscrivi il documento seguendo le istruzioni."
    )
