"""Dati demo (porting da prototipo). Caricati al primo avvio se il DB è vuoto.
Date calcolate relative a oggi, così lo scadenziario è 'vivo'."""
import random
from datetime import date, timedelta

from .db import SessionLocal, engine, Base
from . import models
from .reference import day_from


def _dt(days_ago: int, h: int, m: int = 0) -> str:
    d = date.today() - timedelta(days=days_ago)
    return f"{d.isoformat()}T{h:02d}:{m:02d}:00"


def _lid() -> str:
    return "L" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=6))


def log(days_ago, h, attore, tipo, azione, **opts):
    e = {"id": _lid(), "ts": _dt(days_ago, h, opts.pop("m", 0)), "attoreId": attore, "tipo": tipo, "azione": azione}
    e.update(opts)
    return e


def seed(db):
    # ---------- COMUNICAZIONI (PEC) ----------
    inbox = [
        dict(id="PEC-2026-00188", canale="PEC", letto=False, urgente=False, arrivo=_dt(1, 9, 14),
             mittente={"nome": "Studio Tecnico Geom. M. Verdi", "pec": "m.verdi@pec.geometri.sa.it", "tipo": "Professionista", "perConto": "Sig. Antonio Caputo"},
             oggetto="Istanza di Permesso di Costruire – ristrutturazione edilizia immobile in Via Roma 14",
             corpo=["Il sottoscritto Geom. Marco Verdi, in qualità di tecnico incaricato dal Sig. Antonio Caputo, PRESENTA istanza di Permesso di Costruire ai sensi del DPR 380/2001 per intervento di ristrutturazione edilizia con modifica della sagoma.",
                    "Si allega la documentazione tecnica a corredo dell'istanza."],
             allegati=[{"nome": "Istanza_PdC_firmata.pdf", "tipo": "PDF", "size": "480 KB", "pagine": 3},
                       {"nome": "Relazione_tecnica.pdf", "tipo": "PDF", "size": "1,2 MB", "pagine": 14},
                       {"nome": "Elaborati_grafici.pdf", "tipo": "PDF", "size": "6,8 MB", "pagine": 9},
                       {"nome": "Visura_catastale.pdf", "tipo": "PDF", "size": "210 KB", "pagine": 2}],
             ai={"categoria": "pratica_tecnica", "confidenza": 0.94, "tipoProcedimento": "Permesso di Costruire (art. 10 DPR 380/2001)",
                 "ufficio": "Ufficio Tecnico", "responsabile": "esposito", "urgenza": "media", "scadenzaSuggerita": day_from(59), "termineGiorni": 60,
                 "motivazione": "Oggetto e allegati contengono i marcatori «Permesso di Costruire», «DPR 380/2001», «ristrutturazione edilizia»: classificazione coerente con i procedimenti edilizi dell'Ufficio Tecnico.",
                 "alternative": [{"categoria": "istanza_cittadino", "p": 0.04}, {"categoria": "da_pubblicare", "p": 0.02}],
                 "documentiAttesi": [{"doc": "Istanza firmata digitalmente", "ok": True}, {"doc": "Relazione tecnica", "ok": True},
                                     {"doc": "Elaborati grafici", "ok": True}, {"doc": "Visura catastale aggiornata", "ok": True},
                                     {"doc": "Attestazione versamento diritti di segreteria", "ok": False},
                                     {"doc": "Asseverazione di conformità (Mod. ASE-1)", "ok": False},
                                     {"doc": "Documentazione fotografica stato di fatto", "ok": False}]}),
        dict(id="PEC-2026-00191", canale="PEC", letto=False, urgente=False, arrivo=_dt(1, 11, 38),
             mittente={"nome": "Bar Centrale di Rossi G. & C. snc", "pec": "barcentrale@pec.it", "tipo": "Impresa"},
             oggetto="Richiesta occupazione suolo pubblico per installazione dehors stagionale – Piazza Municipio",
             corpo=["La scrivente attività richiede l'autorizzazione all'occupazione di suolo pubblico per l'installazione di un dehors stagionale antistante l'esercizio in Piazza Municipio 3.",
                    "Si allega planimetria dell'area e si richiede la liquidazione del relativo canone (CUP)."],
             allegati=[{"nome": "Planimetria_dehors.pdf", "tipo": "PDF", "size": "740 KB", "pagine": 2}],
             ai={"categoria": "richiesta_tributi", "confidenza": 0.57, "tipoProcedimento": "Canone Unico Patrimoniale (occupazione suolo)",
                 "ufficio": "Ragioneria / Tributi", "responsabile": None, "urgenza": "media", "scadenzaSuggerita": day_from(28), "termineGiorni": 30,
                 "motivazione": "Confidenza ridotta: marcatori sia tributari («canone», «CUP») sia tecnici («occupazione suolo», «dehors», «planimetria»). Si consiglia verifica manuale dello smistamento.",
                 "alternative": [{"categoria": "pratica_tecnica", "p": 0.34}, {"categoria": "istanza_cittadino", "p": 0.06}],
                 "documentiAttesi": [{"doc": "Planimetria area", "ok": True}, {"doc": "Titolo / SCIA esercizio", "ok": False}]}),
        dict(id="PEC-2026-00190", canale="PEC", letto=False, urgente=True, arrivo=_dt(0, 8, 5),
             mittente={"nome": "Sig.ra Elena Marino", "pec": "elena.marino@pec.it", "tipo": "Cittadino"},
             oggetto="SEGNALAZIONE URGENTE – muro di contenimento pericolante in Via delle Fontane",
             corpo=["Segnalo lo stato di evidente dissesto del muro di contenimento a valle di Via delle Fontane, civ. 22. A seguito delle piogge si sono aperte lesioni profonde con distacco di materiale sulla sede stradale.",
                    "Si chiede un sopralluogo urgente a tutela della pubblica incolumità."],
             allegati=[{"nome": "Foto_lesioni_1.jpg", "tipo": "IMG", "size": "2,1 MB"}, {"nome": "Foto_lesioni_2.jpg", "tipo": "IMG", "size": "1,9 MB"}],
             ai={"categoria": "segnalazione", "confidenza": 0.88, "tipoProcedimento": "Sopralluogo tecnico → possibile ordinanza contingibile e urgente",
                 "ufficio": "Ufficio Tecnico", "responsabile": "esposito", "urgenza": "urgente", "scadenzaSuggerita": day_from(2), "termineGiorni": 2,
                 "motivazione": "Rilevati marcatori di pericolo per la pubblica incolumità («pericolante», «distacco di materiale», «dissesto»). Si suggerisce sopralluogo entro 48h e valutazione di ordinanza ex art. 54 TUEL.",
                 "alternative": [{"categoria": "comunicazione_urgente", "p": 0.09}, {"categoria": "reclamo", "p": 0.03}],
                 "documentiAttesi": [{"doc": "Documentazione fotografica", "ok": True}]}),
        dict(id="PEC-2026-00187", canale="PEC", letto=True, urgente=False, arrivo=_dt(2, 15, 2),
             mittente={"nome": "Provincia di Salerno – Settore Viabilità", "pec": "viabilita@pec.provincia.salerno.it", "tipo": "Altra PA"},
             oggetto="Convocazione Conferenza di Servizi – messa in sicurezza incrocio SP 11",
             corpo=["Si trasmette convocazione della Conferenza di Servizi decisoria relativa all'intervento di messa in sicurezza dell'incrocio sulla SP 11. Si richiede la designazione del referente tecnico."],
             allegati=[{"nome": "Convocazione_CdS.pdf", "tipo": "PDF", "size": "320 KB", "pagine": 4}],
             ai={"categoria": "comunicazione_pa", "confidenza": 0.91, "tipoProcedimento": "Conferenza di Servizi – designazione referente",
                 "ufficio": "Ufficio Tecnico", "responsabile": "esposito", "urgenza": "alta", "scadenzaSuggerita": day_from(6), "termineGiorni": 10,
                 "motivazione": "Mittente PA accreditata e oggetto «Conferenza di Servizi»: comunicazione interistituzionale con termine per la designazione del referente.",
                 "alternative": [{"categoria": "scadenza_amm", "p": 0.06}],
                 "documentiAttesi": [{"doc": "Atto di convocazione", "ok": True}]}),
        dict(id="PEC-2026-00185", canale="PEC", letto=True, urgente=False, arrivo=_dt(3, 10, 47),
             mittente={"nome": "Avv. Paolo Greco", "pec": "p.greco@pec.ordineavvocati.sa.it", "tipo": "Professionista"},
             oggetto="Richiesta di accesso agli atti ex art. 22 L. 241/1990 – pratica edilizia Via Garibaldi",
             corpo=["Per conto del proprio assistito, si richiede l'accesso agli atti relativi alla pratica edilizia n. UT/2024/112 (Via Garibaldi 8), con estrazione di copia del titolo abilitativo."],
             allegati=[{"nome": "Istanza_accesso_atti.pdf", "tipo": "PDF", "size": "180 KB", "pagine": 2}, {"nome": "Delega_assistito.pdf", "tipo": "PDF", "size": "95 KB", "pagine": 1}],
             ai={"categoria": "accesso_atti", "confidenza": 0.90, "tipoProcedimento": "Accesso documentale (L. 241/1990)",
                 "ufficio": "Ufficio Tecnico", "responsabile": "deluca", "urgenza": "media", "scadenzaSuggerita": day_from(27), "termineGiorni": 30,
                 "motivazione": "Riferimento normativo «art. 22 L. 241/1990» e richiesta di «copia degli atti»: accesso documentale con termine ordinario di 30 giorni.",
                 "alternative": [{"categoria": "istanza_cittadino", "p": 0.07}],
                 "documentiAttesi": [{"doc": "Istanza di accesso", "ok": True}, {"doc": "Delega / titolo legittimante", "ok": True}]}),
        dict(id="PEC-2026-00183", canale="PEC", letto=True, urgente=False, arrivo=_dt(3, 16, 20),
             mittente={"nome": "Edilstrade Appalti S.r.l.", "pec": "amministrazione@pec.edilstrade.it", "tipo": "Impresa"},
             oggetto="Trasmissione fattura elettronica n. 142/2026 – SAL lavori manutenzione strade",
             corpo=["Si trasmette la fattura n. 142/2026 relativa al primo Stato Avanzamento Lavori per la manutenzione straordinaria delle strade comunali."],
             allegati=[{"nome": "Fattura_142_2026.xml", "tipo": "XML", "size": "24 KB"}],
             ai={"categoria": "documento_contabile", "confidenza": 0.86, "tipoProcedimento": "Liquidazione fattura (SAL)",
                 "ufficio": "Ragioneria / Tributi", "responsabile": None, "urgenza": "media", "scadenzaSuggerita": day_from(25), "termineGiorni": 30,
                 "motivazione": "Allegato in formato fattura elettronica (XML) e oggetto «fattura / SAL»: documento contabile da indirizzare alla Ragioneria, con verifica tecnica del SAL.",
                 "alternative": [{"categoria": "pratica_tecnica", "p": 0.10}],
                 "documentiAttesi": [{"doc": "Fattura elettronica", "ok": True}]}),
    ]
    for c in inbox:
        db.add(models.Comunicazione(**c))

    # ---------- PRATICHE ----------
    pratiche = [
        dict(id="UT/2026/038", fascicolo="UT/2026/038", protocollo="PG/2026/2890",
             oggetto="Autorizzazione passo carrabile – Via Nazionale 88", categoria="pratica_tecnica",
             tipoProcedimento="Autorizzazione passo carrabile", richiedente="Sig. Giuseppe Romano",
             ufficio="Ufficio Tecnico", responsabile="esposito", stato="in_lavorazione", priorita="alta",
             apertura=day_from(-21), scadenza=day_from(-3), comId=None, bozze=[],
             cronologia=[log(21, 9, "rossi", "protocollo", "Comunicazione protocollata in ingresso", dettaglio="PG/2026/2890"),
                         log(21, 9, "ai", "classificazione", "Classificata come «Pratica ufficio tecnico»", aiBadge="0.89", m=4),
                         log(20, 10, "rossi", "assegnazione", "Assegnata a Geom. Esposito (Ufficio Tecnico)"),
                         log(18, 11, "esposito", "cambio_stato", "Presa in carico — avvio istruttoria", statoNew="in_lavorazione")]),
        dict(id="UT/2026/041", fascicolo="UT/2026/041", protocollo="PG/2026/3012",
             oggetto="Intervento in zona vincolata – richiesta parere Soprintendenza", categoria="pratica_tecnica",
             tipoProcedimento="Autorizzazione paesaggistica", richiedente="Studio Arch. Conti",
             ufficio="Ufficio Tecnico", responsabile="esposito", stato="in_attesa_parere", priorita="media",
             apertura=day_from(-15), scadenza=day_from(12), comId=None, bozze=[],
             cronologia=[log(15, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3012"),
                         log(14, 10, "esposito", "cambio_stato", "Avvio istruttoria", statoNew="in_lavorazione"),
                         log(9, 15, "esposito", "cambio_stato", "Richiesto parere alla Soprintendenza ABAP", statoNew="in_attesa_parere", dettaglio="Termine sospeso.")]),
        dict(id="UT/2026/043", fascicolo="UT/2026/043", protocollo="PG/2026/3098",
             oggetto="SCIA ristrutturazione – immobile Via Mazzini 5", categoria="pratica_tecnica",
             tipoProcedimento="SCIA edilizia", richiedente="Geom. F. Pagano per Sig.ra Lombardi",
             ufficio="Ufficio Tecnico", responsabile="deluca", stato="pronta_firma", priorita="media",
             apertura=day_from(-11), scadenza=day_from(4), comId=None, bozze=[],
             cronologia=[log(11, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3098"),
                         log(10, 11, "deluca", "cambio_stato", "Avvio istruttoria", statoNew="in_lavorazione"),
                         log(2, 16, "deluca", "bozza_approvata", "Predisposta comunicazione di efficacia SCIA", statoNew="pronta_firma")]),
        dict(id="UT/2026/044", fascicolo="UT/2026/044", protocollo="PG/2026/3140",
             oggetto="Richiesta certificato di agibilità – fabbricato Via Kennedy 3", categoria="pratica_tecnica",
             tipoProcedimento="Segnalazione certificata agibilità", richiedente="Impresa Costruzioni Sud S.r.l.",
             ufficio="Ufficio Tecnico", responsabile="deluca", stato="in_lavorazione", priorita="media",
             apertura=day_from(-7), scadenza=day_from(9), comId=None, bozze=[],
             cronologia=[log(7, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3140"),
                         log(6, 10, "deluca", "cambio_stato", "Avvio istruttoria", statoNew="in_lavorazione")]),
        dict(id="UT/2026/036", fascicolo="UT/2026/036", protocollo="PG/2026/2740",
             oggetto="Occupazione suolo pubblico per cantiere – Via Roma 30", categoria="pratica_tecnica",
             tipoProcedimento="Autorizzazione occupazione cantiere", richiedente="Edil Verde S.n.c.",
             ufficio="Ufficio Tecnico", responsabile="esposito", stato="in_attesa_integrazione", priorita="bassa",
             apertura=day_from(-26), scadenza=day_from(8), comId=None, bozze=[],
             cronologia=[log(26, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/2740"),
                         log(24, 11, "esposito", "cambio_stato", "Avvio istruttoria", statoNew="in_lavorazione"),
                         log(20, 14, "esposito", "integrazione", "Inviata richiesta di integrazione documentale", statoNew="in_attesa_integrazione", dettaglio="Mancano: polizza RC, segnaletica cantiere.")]),
        dict(id="UT/2026/039", fascicolo="UT/2026/039", protocollo="PG/2026/2810",
             oggetto="Certificato di destinazione urbanistica – p.lla 512 fg. 8", categoria="pratica_tecnica",
             tipoProcedimento="Rilascio CDU", richiedente="Notaio Dott. Ferraro",
             ufficio="Ufficio Tecnico", responsabile="deluca", stato="conclusa", priorita="media",
             apertura=day_from(-19), scadenza=day_from(-2), comId=None, bozze=[],
             cronologia=[log(19, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/2810"),
                         log(17, 10, "deluca", "cambio_stato", "Avvio istruttoria", statoNew="in_lavorazione"),
                         log(2, 12, "deluca", "cambio_stato", "CDU rilasciato e trasmesso al richiedente", statoNew="conclusa")]),
        dict(id="UT/2026/042", fascicolo="UT/2026/042", protocollo="PG/2026/3060",
             oggetto="Autorizzazione manomissione suolo per allaccio fognario – Via Verdi", categoria="pratica_tecnica",
             tipoProcedimento="Autorizzazione manomissione suolo", richiedente="Sig. Marco Esca",
             ufficio="Ufficio Tecnico", responsabile="esposito", stato="assegnata", priorita="media",
             apertura=day_from(-2), scadenza=day_from(28), comId=None, bozze=[],
             cronologia=[log(2, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3060"),
                         log(2, 10, "rossi", "assegnazione", "Assegnata a Geom. Esposito (Ufficio Tecnico)")]),
    ]
    for pr in pratiche:
        db.add(models.Pratica(**pr))

    # ---------- ATTI ----------
    atti = [
        dict(id="ATTO-2026-061", tipo="ordinanza", numero="ORD/2026/007",
             oggetto="Limitazione di velocità e divieto di sosta in Via Nazionale per lavori di asfaltatura",
             stato="pubblicato", praticaId=None, autore="esposito", generatoAI=False,
             creato=day_from(-12), aggiornato=day_from(-10), albo={"numero": "198/2026", "dal": day_from(-10), "al": day_from(20)},
             protocollo=None, contenuto="ORDINA\n1. l'istituzione del limite di velocità di 30 km/h e del divieto di sosta su ambo i lati di Via Nazionale;\n2. l'installazione della relativa segnaletica a cura dell'impresa esecutrice.",
             cronologia=[log(12, 9, "esposito", "creazione", "Atto creato"), log(10, 12, "rossi", "pubblicazione", "Pubblicato all'Albo Pretorio n. 198/2026", statoNew="pubblicato")]),
        dict(id="ATTO-2026-070", tipo="richiesta_integrazione", numero="PG/2026/2998",
             oggetto="Richiesta integrazione documentale — Occupazione suolo cantiere Via Roma 30",
             stato="protocollato", praticaId="UT/2026/036", autore="esposito", generatoAI=True,
             creato=day_from(-6), aggiornato=day_from(-6), albo=None, protocollo="PG/2026/2998",
             contenuto="In riferimento all'istanza prot. n. PG/2026/2740, si invita a trasmettere entro 30 giorni:\n1. polizza assicurativa RC;\n2. planimetria con segnaletica di cantiere.\nI termini del procedimento restano sospesi.",
             cronologia=[log(6, 14, "ai", "bozza_generata", "Bozza generata dall'AI dall'analisi di completezza", aiBadge="AI"),
                         log(6, 15, "esposito", "pubblicazione", "Protocollata in uscita", statoNew="protocollato", dettaglio="PG/2026/2998")]),
        dict(id="ATTO-2026-072", tipo="determina", numero=None,
             oggetto="Determina di liquidazione 1° SAL — manutenzione strade (fatt. 142/2026)",
             stato="in_revisione", praticaId=None, autore="deluca", generatoAI=True,
             creato=day_from(-1), aggiornato=day_from(-1), albo=None, protocollo=None,
             contenuto="DETERMINA\n1. di liquidare alla ditta Edilstrade Appalti S.r.l. la somma di € ⟦importo SAL⟧;\n2. di dare atto della regolarità del DURC e della verifica tecnica del SAL.",
             cronologia=[log(1, 10, "ai", "bozza_generata", "Bozza generata dall'AI dal documento contabile", aiBadge="AI"),
                         log(1, 11, "deluca", "cambio_stato", "Inviata in revisione", statoNew="in_revisione")]),
        dict(id="ATTO-2026-074", tipo="avvio_procedimento", numero=None,
             oggetto="Comunicazione di efficacia SCIA — immobile Via Mazzini 5",
             stato="pronta_firma", praticaId="UT/2026/043", autore="deluca", generatoAI=True,
             creato=day_from(-2), aggiornato=day_from(-2), albo=None, protocollo=None,
             contenuto="Si comunica che la SCIA prot. n. PG/2026/3098 ha acquisito efficacia, decorsi i termini e completata la verifica documentale di competenza.",
             cronologia=[log(2, 16, "ai", "bozza_generata", "Bozza generata dall'AI", aiBadge="AI"),
                         log(2, 17, "deluca", "cambio_stato", "Pronta per la firma", statoNew="pronta_firma")]),
        dict(id="ATTO-2026-077", tipo="ordinanza", numero=None,
             oggetto="Ordinanza contingibile e urgente — messa in sicurezza muro Via delle Fontane",
             stato="pronta_firma", praticaId=None, autore="esposito", generatoAI=True,
             creato=_dt(0, 9, 30), aggiornato=_dt(0, 9, 30), albo=None, protocollo=None,
             contenuto="ORDINA\n1. l'immediata interdizione del transito nel tratto di Via delle Fontane prospiciente il civico 22;\n2. l'installazione di transenne e segnaletica di pericolo;\n3. al proprietario frontista l'avvio degli interventi di messa in sicurezza, ai sensi dell'art. 54 TUEL.",
             cronologia=[log(0, 9, "ai", "bozza_generata", "Bozza generata dall'AI dalla segnalazione di pericolo", aiBadge="AI", m=30),
                         log(0, 9, "esposito", "cambio_stato", "Verificata — pronta per la firma del Sindaco", statoNew="pronta_firma", m=45)]),
        dict(id="ATTO-2026-066", tipo="determina", numero="DET/2026/041",
             oggetto="Determina a contrarre per affidamento manutenzione straordinaria strade comunali",
             stato="firmato", praticaId=None, autore="esposito", generatoAI=False,
             creato=day_from(-7), aggiornato=day_from(-1), albo=None, protocollo=None,
             contenuto="DETERMINA\n1. di avviare la procedura per l'affidamento dei lavori di manutenzione straordinaria delle strade comunali (base di gara € 48.000,00 oltre IVA);\n2. di approvare il capitolato.",
             cronologia=[log(7, 9, "esposito", "creazione", "Atto creato"),
                         log(1, 11, "esposito", "cambio_stato", "Firmato — in attesa di pubblicazione", statoNew="firmato")]),
    ]
    for a in atti:
        db.add(models.Atto(**a))

    # ---------- BENI ----------
    beni = [
        dict(id="BEN-001", tipo="immobile", categoria="edificio_pubblico", denominazione="Palazzo Municipale",
             ubicazione="Piazza Municipio, 1", codice="IMM/2024/001", stato="buono", responsabile="bianchi",
             lat=40.4162, lon=15.2014,
             dati={"foglio": "8", "particella": "120", "valoreContabile": 480000, "annoAcquisizione": 1952, "ultimaVerifica": day_from(-180), "scadenzaCollaudo": None, "note": "Sede degli uffici comunali."}),
        dict(id="BEN-003", tipo="immobile", categoria="area_verde", denominazione="Villa Comunale",
             ubicazione="Via delle Fontane", codice="IMM/2024/003", stato="discreto", responsabile="esposito",
             lat=40.4148, lon=15.2005,
             dati={"foglio": "11", "particella": "88", "valoreContabile": 95000, "annoAcquisizione": 1935, "ultimaVerifica": day_from(-60), "scadenzaCollaudo": None, "note": "Muro di contenimento perimetrale in ammaloramento (cfr. segnalazione PEC-2026-00190)."}),
        dict(id="BEN-005", tipo="mobile", categoria="veicolo", denominazione="Autocarro — Iveco Daily",
             ubicazione="Rimessa comunale", codice="MOB/2024/005", stato="scarso", responsabile="esposito",
             lat=40.4170, lon=15.1998,
             dati={"targa": "SA 211 KT", "valoreContabile": 22000, "annoAcquisizione": 2015, "ultimaVerifica": day_from(-400), "scadenzaCollaudo": day_from(-10), "note": "Revisione scaduta. Fermo in attesa di intervento."}),
        dict(id="BEN-006", tipo="infrastruttura", categoria="strada", denominazione="Via Nazionale — tratto urbano",
             ubicazione="Via Nazionale (civv. 1–140)", codice="INF/2024/006", stato="discreto", responsabile="esposito",
             lat=40.4158, lon=15.2021,
             dati={"valoreContabile": 340000, "annoAcquisizione": 1988, "ultimaVerifica": day_from(-45), "scadenzaCollaudo": None, "note": "Manto stradale con buche diffuse. Incluso nel piano manutenzione 2026."}),
        dict(id="BEN-011", tipo="infrastruttura", categoria="rete_idrica", denominazione="Rete idrica — dorsale principale",
             ubicazione="Via Garibaldi – Via Mazzini", codice="INF/2024/011", stato="critico", responsabile="esposito",
             lat=40.4172, lon=15.2007,
             dati={"valoreContabile": 520000, "annoAcquisizione": 1975, "ultimaVerifica": day_from(-500), "scadenzaCollaudo": day_from(-60), "note": "Perdite croniche (~18%). Intervento urgente necessario."}),
        dict(id="BEN-008", tipo="immobile", categoria="edificio_pubblico", denominazione="Centro Sociale Anziani",
             ubicazione="Via Cavour, 8", codice="IMM/2024/008", stato="scarso", responsabile="bianchi",
             lat=40.4155, lon=15.1992,
             dati={"foglio": "10", "particella": "305", "valoreContabile": 210000, "annoAcquisizione": 1990, "ultimaVerifica": day_from(-380), "scadenzaCollaudo": day_from(10), "note": "Necessaria perizia per adeguamento antisismico."}),
    ]
    for b in beni:
        db.add(models.Bene(**b))

    db.commit()


def seed_extra_uffici(db):
    """Pratiche demo dei nuovi uffici (Tributi, Anagrafe, Polizia Locale, Servizi Sociali).
    Idempotente: inserisce solo le pratiche il cui id non è già presente, così popola
    anche un DB già inizializzato con i soli dati dell'Ufficio Tecnico."""
    extra = [
        dict(id="TR/2026/012", fascicolo="TR/2026/012", protocollo="PG/2026/3201",
             oggetto="Istanza di rimborso TARI per doppia imposizione – annualità 2024", categoria="richiesta_tributi",
             tipoProcedimento="Rimborso IMU / TARI", richiedente="Sig.ra Teresa Coppola",
             ufficio="Ragioneria / Tributi", responsabile="ferrara", stato="in_lavorazione", priorita="media",
             apertura=day_from(-12), scadenza=day_from(168), comId=None, bozze=[],
             cronologia=[log(12, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3201"),
                         log(12, 9, "ai", "classificazione", "Classificata come «Richiesta tributi» → Ragioneria / Tributi", aiBadge="0.83", m=3),
                         log(10, 10, "ferrara", "cambio_stato", "Avvio istruttoria — verifica versamenti", statoNew="in_lavorazione")]),
        dict(id="AN/2026/058", fascicolo="AN/2026/058", protocollo="PG/2026/3188",
             oggetto="Dichiarazione di cambio di residenza – nucleo familiare Esposito", categoria="richiesta_anagrafica",
             tipoProcedimento="Cambio di residenza / iscrizione APR", richiedente="Sig. Domenico Esposito",
             ufficio="Anagrafe e Stato Civile", responsabile="russo", stato="in_attesa_parere", priorita="media",
             apertura=day_from(-8), scadenza=day_from(37), comId=None, bozze=[],
             cronologia=[log(8, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3188"),
                         log(8, 10, "russo", "cambio_stato", "Registrazione provvisoria — avvio accertamenti", statoNew="in_lavorazione"),
                         log(6, 11, "russo", "cambio_stato", "Richiesto accertamento alla Polizia Locale", statoNew="in_attesa_parere", dettaglio="Termine sospeso in attesa di accertamento.")]),
        dict(id="SS/2026/023", fascicolo="SS/2026/023", protocollo="PG/2026/3155",
             oggetto="Istanza di contributo economico straordinario – sostegno al reddito", categoria="istanza_cittadino",
             tipoProcedimento="Contributo economico straordinario (ISEE)", richiedente="Sig. Salvatore Pagano",
             ufficio="Servizi Sociali", responsabile="ricci", stato="assegnata", priorita="alta",
             apertura=day_from(-4), scadenza=day_from(56), comId=None, bozze=[],
             cronologia=[log(4, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3155"),
                         log(4, 10, "rossi", "assegnazione", "Assegnata ai Servizi Sociali (A.S. Ricci)", statoNew="assegnata")]),
        dict(id="PL/2026/091", fascicolo="PL/2026/091", protocollo="PG/2026/3170",
             oggetto="Esposto per occupazione abusiva di suolo pubblico – mercato settimanale", categoria="reclamo",
             tipoProcedimento="Gestione esposti e segnalazioni", richiedente="Comitato Commercianti Centro",
             ufficio="Polizia Locale", responsabile="moretti", stato="in_lavorazione", priorita="media",
             apertura=day_from(-6), scadenza=day_from(24), comId=None, bozze=[],
             cronologia=[log(6, 9, "rossi", "protocollo", "Protocollata in ingresso", dettaglio="PG/2026/3170"),
                         log(5, 10, "moretti", "cambio_stato", "Avvio accertamenti sul posto", statoNew="in_lavorazione")]),
    ]
    esistenti = {p.id for p in db.query(models.Pratica.id).all()}
    aggiunti = False
    for pr in extra:
        if pr["id"] in esistenti:
            continue
        db.add(models.Pratica(**pr))
        aggiunti = True
    if aggiunti:
        db.commit()


def seed_beni_informatica(db):
    """PC, stampanti e videosorveglianza. Idempotente: inserisce solo gli id mancanti."""
    # Coordinate edifici di riferimento
    _MUN  = (40.4162, 15.2014)   # Palazzo Municipale
    _CSA  = (40.4155, 15.1992)   # Centro Sociale Anziani
    _VIL  = (40.4148, 15.2005)   # Villa Comunale
    _VIA  = (40.4158, 15.2021)   # Via Nazionale

    nuovi = [
        # ---- PC (postazioni informatiche) --------------------------------
        dict(id="PC-001", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Protocollo", ubicazione="Municipio – Ufficio Protocollo",
             codice="PC/2024/001", stato="buono", responsabile="rossi",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "HP EliteDesk 800 G6", "cpu": "Intel i5-10500", "ram": "16 GB",
                   "annoAcquisizione": 2021, "ultimaVerifica": day_from(-90), "note": ""}),
        dict(id="PC-002", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Segreteria", ubicazione="Municipio – Segreteria Generale",
             codice="PC/2024/002", stato="buono", responsabile="bianchi",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Lenovo ThinkCentre M70q", "cpu": "Intel i5-10400T", "ram": "8 GB",
                   "annoAcquisizione": 2021, "ultimaVerifica": day_from(-90), "note": ""}),
        dict(id="PC-003", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Ufficio Tecnico #1", ubicazione="Municipio – Ufficio Tecnico",
             codice="PC/2024/003", stato="buono", responsabile="esposito",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Dell OptiPlex 7090", "cpu": "Intel i7-10700", "ram": "16 GB",
                   "annoAcquisizione": 2022, "ultimaVerifica": day_from(-60), "note": "Workstation CAD/GIS"}),
        dict(id="PC-004", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Ufficio Tecnico #2", ubicazione="Municipio – Ufficio Tecnico",
             codice="PC/2024/004", stato="discreto", responsabile="deluca",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "HP ProDesk 400 G7", "cpu": "Intel i5-10500", "ram": "8 GB",
                   "annoAcquisizione": 2020, "ultimaVerifica": day_from(-120),
                   "note": "Lento sul rendering DWG. Valutare upgrade RAM."}),
        dict(id="PC-005", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Ragioneria / Tributi", ubicazione="Municipio – Ragioneria",
             codice="PC/2024/005", stato="buono", responsabile="ferrara",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Lenovo ThinkCentre M90q Gen 3", "cpu": "Intel i5-1240P", "ram": "16 GB",
                   "annoAcquisizione": 2023, "ultimaVerifica": day_from(-30), "note": ""}),
        dict(id="PC-006", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Anagrafe e Stato Civile", ubicazione="Municipio – Anagrafe",
             codice="PC/2024/006", stato="scarso", responsabile="russo",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Dell OptiPlex 3060", "cpu": "Intel i3-8100", "ram": "4 GB",
                   "annoAcquisizione": 2018, "ultimaVerifica": day_from(-200),
                   "note": "Macchina obsoleta. Lenta con applicativo ANPR. Priorità sostituzione."}),
        dict(id="PC-007", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Polizia Locale", ubicazione="Municipio – Polizia Locale",
             codice="PC/2024/007", stato="buono", responsabile="moretti",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "HP ProDesk 400 G8", "cpu": "Intel i5-11500", "ram": "8 GB",
                   "annoAcquisizione": 2022, "ultimaVerifica": day_from(-60), "note": ""}),
        dict(id="PC-008", tipo="mobile", categoria="informatica",
             denominazione="PC Postazione Servizi Sociali", ubicazione="Municipio – Servizi Sociali",
             codice="PC/2024/008", stato="buono", responsabile="ricci",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Lenovo ThinkCentre M70q Gen 3", "cpu": "Intel i5-1235U", "ram": "8 GB",
                   "annoAcquisizione": 2023, "ultimaVerifica": day_from(-30), "note": ""}),

        # ---- Stampanti ----------------------------------------------------
        dict(id="STM-001", tipo="mobile", categoria="stampante",
             denominazione="Stampante multifunzione – Segreteria / Protocollo", ubicazione="Municipio – Piano terra",
             codice="STM/2024/001", stato="buono", responsabile="rossi",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Canon imageRUNNER ADVANCE DX 4725i", "tipo_stampa": "Laser A3/A4 b/n + colore",
                   "annoAcquisizione": 2022, "ultimaVerifica": day_from(-45), "note": "Contratto manutenzione attivo (scade 2026-12)."}),
        dict(id="STM-002", tipo="mobile", categoria="stampante",
             denominazione="Stampante A4 – Ufficio Tecnico", ubicazione="Municipio – Ufficio Tecnico",
             codice="STM/2024/002", stato="buono", responsabile="esposito",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Brother HL-L8360CDW", "tipo_stampa": "Laser A4 colore",
                   "annoAcquisizione": 2021, "ultimaVerifica": day_from(-90), "note": ""}),
        dict(id="STM-003", tipo="mobile", categoria="stampante",
             denominazione="Plotter A0 – Ufficio Tecnico", ubicazione="Municipio – Ufficio Tecnico",
             codice="STM/2024/003", stato="discreto", responsabile="esposito",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "HP DesignJet T650 36\"", "tipo_stampa": "Inkjet A0",
                   "annoAcquisizione": 2019, "ultimaVerifica": day_from(-180),
                   "note": "Cartucce Magenta in esaurimento. Test colore insoddisfacente."}),
        dict(id="STM-004", tipo="mobile", categoria="stampante",
             denominazione="Stampante A4 – Ragioneria / Anagrafe", ubicazione="Municipio – Piano primo",
             codice="STM/2024/004", stato="scarso", responsabile="ferrara",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "HP LaserJet Pro M404n", "tipo_stampa": "Laser A4 b/n",
                   "annoAcquisizione": 2017, "ultimaVerifica": day_from(-300),
                   "note": "Alimentatore carta difettoso. Spesso inceppamenti. Valutare sostituzione."}),

        # ---- Videosorveglianza -------------------------------------------
        dict(id="VDC-001", tipo="infrastruttura", categoria="videosorveglianza",
             denominazione="Telecamera – Ingresso Palazzo Municipale (est.)", ubicazione="Municipio – Ingresso principale",
             codice="VDC/2024/001", stato="buono", responsabile="moretti",
             lat=40.41625, lon=15.20145,
             dati={"marca": "Hikvision DS-2CD2143G2-I", "risoluzione": "4 MP", "campo_visivo": "120°",
                   "registrazione": "NVR locale – retention 30 gg",
                   "annoAcquisizione": 2022, "ultimaVerifica": day_from(-30), "note": ""}),
        dict(id="VDC-002", tipo="infrastruttura", categoria="videosorveglianza",
             denominazione="Telecamera – Piazza Municipio lato nord", ubicazione="Piazza Municipio – palo lampione",
             codice="VDC/2024/002", stato="buono", responsabile="moretti",
             lat=40.41635, lon=15.20155,
             dati={"marca": "Hikvision DS-2CD2T43G2-4I", "risoluzione": "4 MP", "campo_visivo": "90°",
                   "registrazione": "NVR locale – retention 30 gg",
                   "annoAcquisizione": 2022, "ultimaVerifica": day_from(-30), "note": "Copre accesso da Via Garibaldi."}),
        dict(id="VDC-003", tipo="infrastruttura", categoria="videosorveglianza",
             denominazione="Telecamera – Via Nazionale incrocio SP 11", ubicazione="Via Nazionale – incrocio SP 11",
             codice="VDC/2024/003", stato="buono", responsabile="moretti",
             lat=_VIA[0], lon=_VIA[1],
             dati={"marca": "Axis P3245-V", "risoluzione": "2 MP", "campo_visivo": "110°",
                   "registrazione": "NVR locale – retention 30 gg",
                   "annoAcquisizione": 2021, "ultimaVerifica": day_from(-60), "note": "Installata in seguito all'intervento di messa in sicurezza incrocio SP 11."}),
        dict(id="VDC-004", tipo="infrastruttura", categoria="videosorveglianza",
             denominazione="Telecamera – Villa Comunale ingresso", ubicazione="Villa Comunale – cancello ingresso",
             codice="VDC/2024/004", stato="discreto", responsabile="moretti",
             lat=_VIL[0], lon=_VIL[1],
             dati={"marca": "Dahua IPC-HDW2849H-S-IL", "risoluzione": "8 MP", "campo_visivo": "102°",
                   "registrazione": "NVR locale – retention 30 gg",
                   "annoAcquisizione": 2020, "ultimaVerifica": day_from(-120),
                   "note": "Immagine notturna degradata. Pulizia lente necessaria."}),
        dict(id="VDC-005", tipo="infrastruttura", categoria="videosorveglianza",
             denominazione="Telecamera – Centro Sociale Anziani esterno", ubicazione="Via Cavour, 8 – facciata",
             codice="VDC/2024/005", stato="buono", responsabile="moretti",
             lat=_CSA[0], lon=_CSA[1],
             dati={"marca": "Hikvision DS-2CD2143G2-I", "risoluzione": "4 MP", "campo_visivo": "120°",
                   "registrazione": "NVR locale – retention 30 gg",
                   "annoAcquisizione": 2022, "ultimaVerifica": day_from(-45), "note": ""}),
        dict(id="VDC-006", tipo="infrastruttura", categoria="videosorveglianza",
             denominazione="NVR centrale videosorveglianza", ubicazione="Municipio – Sala server",
             codice="VDC/2024/006", stato="buono", responsabile="moretti",
             lat=_MUN[0], lon=_MUN[1],
             dati={"marca": "Hikvision DS-7616NXI-K2/16P", "capacita": "16 canali, 8 TB",
                   "registrazione": "Retention 30 gg per tutti i canali",
                   "annoAcquisizione": 2022, "ultimaVerifica": day_from(-30),
                   "note": "UPS dedicato. Gestisce VDC-001..VDC-005. Backup configurazione effettuato."}),
    ]
    esistenti = {b.id for b in db.query(models.Bene.id).all()}
    aggiunti = False
    for b in nuovi:
        if b["id"] in esistenti:
            continue
        db.add(models.Bene(**b))
        aggiunti = True
    if aggiunti:
        db.commit()


def init_db():
    from sqlalchemy import text
    if engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            # migrazione non-distruttiva: aggiunge colonne geo se assenti
            conn.execute(text("ALTER TABLE beni ADD COLUMN IF NOT EXISTS lat FLOAT"))
            conn.execute(text("ALTER TABLE beni ADD COLUMN IF NOT EXISTS lon FLOAT"))
            conn.commit()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from . import utenti as utenti_module
        utenti_module.seed(db)
        utenti_module.sync_memory(db)
        if db.query(models.Comunicazione).count() == 0:
            seed(db)
        # Integra le pratiche demo dei nuovi uffici (idempotente).
        seed_extra_uffici(db)
        # Integra PC, stampanti e videosorveglianza (idempotente).
        seed_beni_informatica(db)
        from . import search
        if db.query(models.Indice).count() == 0:
            search.reindex(db)
        try:
            search.embed_pending(db)  # best-effort: popola gli embedding se l'AI è raggiungibile
        except Exception:
            pass
    finally:
        db.close()
