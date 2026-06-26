"""Modelli dati (SQLAlchemy). I campi annidati (mittente, allegati, ai,
cronologia, bozze, albo) sono colonne JSON, coerenti con il dominio del prototipo."""
from sqlalchemy import String, Boolean, Text, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from .db import Base
from .config import settings


def _to_dict(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


class Comunicazione(Base):
    __tablename__ = "comunicazioni"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    canale: Mapped[str] = mapped_column(String, default="PEC")
    letto: Mapped[bool] = mapped_column(Boolean, default=False)
    urgente: Mapped[bool] = mapped_column(Boolean, default=False)
    arrivo: Mapped[str] = mapped_column(String)
    mittente: Mapped[dict] = mapped_column(JSON)
    oggetto: Mapped[str] = mapped_column(Text)
    corpo: Mapped[list] = mapped_column(JSON, default=list)
    allegati: Mapped[list] = mapped_column(JSON, default=list)
    ai: Mapped[dict] = mapped_column(JSON, default=dict)
    pratica: Mapped[str | None] = mapped_column(String, nullable=True)

    def dict(self):
        return _to_dict(self)


class Pratica(Base):
    __tablename__ = "pratiche"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    fascicolo: Mapped[str] = mapped_column(String)
    protocollo: Mapped[str] = mapped_column(String)
    oggetto: Mapped[str] = mapped_column(Text)
    categoria: Mapped[str] = mapped_column(String)
    tipoProcedimento: Mapped[str] = mapped_column(String, default="")
    richiedente: Mapped[str] = mapped_column(String, default="")
    ufficio: Mapped[str] = mapped_column(String, default="")
    responsabile: Mapped[str | None] = mapped_column(String, nullable=True)
    stato: Mapped[str] = mapped_column(String, default="assegnata")
    priorita: Mapped[str] = mapped_column(String, default="media")
    apertura: Mapped[str] = mapped_column(String)
    scadenza: Mapped[str | None] = mapped_column(String, nullable=True)
    comId: Mapped[str | None] = mapped_column(String, nullable=True)
    cronologia: Mapped[list] = mapped_column(JSON, default=list)
    bozze: Mapped[list] = mapped_column(JSON, default=list)

    def dict(self):
        return _to_dict(self)


class Atto(Base):
    __tablename__ = "atti"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tipo: Mapped[str] = mapped_column(String)
    numero: Mapped[str | None] = mapped_column(String, nullable=True)
    oggetto: Mapped[str] = mapped_column(Text)
    stato: Mapped[str] = mapped_column(String, default="bozza")
    praticaId: Mapped[str | None] = mapped_column(String, nullable=True)
    autore: Mapped[str] = mapped_column(String, default="")
    generatoAI: Mapped[bool] = mapped_column(Boolean, default=False)
    creato: Mapped[str] = mapped_column(String)
    aggiornato: Mapped[str] = mapped_column(String)
    albo: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    protocollo: Mapped[str | None] = mapped_column(String, nullable=True)
    contenuto: Mapped[str] = mapped_column(Text, default="")
    cronologia: Mapped[list] = mapped_column(JSON, default=list)

    def dict(self):
        return _to_dict(self)


class Documento(Base):
    __tablename__ = "documenti"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    comId: Mapped[str | None] = mapped_column(String, nullable=True)
    filename: Mapped[str] = mapped_column(String)
    contentType: Mapped[str] = mapped_column(String, default="application/octet-stream")
    size: Mapped[int] = mapped_column(default=0)
    objectKey: Mapped[str | None] = mapped_column(String, nullable=True)
    ocr: Mapped[bool] = mapped_column(Boolean, default=False)
    chars: Mapped[int] = mapped_column(default=0)
    stato: Mapped[str] = mapped_column(String, default="acquisito")  # acquisito | eccezione
    errore: Mapped[str | None] = mapped_column(Text, nullable=True)
    creato: Mapped[str] = mapped_column(String)
    testo: Mapped[str] = mapped_column(Text, default="")

    def dict(self):
        return _to_dict(self)


class Indice(Base):
    """Indice di ricerca unificato su comunicazioni, pratiche, atti, documenti.
    `embedding` è popolato (best-effort) tramite il server AI per la ricerca semantica."""
    __tablename__ = "indice"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # "<tipo>:<refId>"
    refTipo: Mapped[str] = mapped_column(String)
    refId: Mapped[str] = mapped_column(String)
    titolo: Mapped[str] = mapped_column(Text)
    testo: Mapped[str] = mapped_column(Text, default="")
    embedding = mapped_column(Vector(settings.EMBED_DIM), nullable=True)

    def dict(self):
        return {"id": self.id, "refTipo": self.refTipo, "refId": self.refId, "titolo": self.titolo}


class Notifica(Base):
    __tablename__ = "notifiche"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tipo: Mapped[str] = mapped_column(String, default="sistema")
    livello: Mapped[str] = mapped_column(String, default="info")   # info | warning | danger
    titolo: Mapped[str] = mapped_column(Text)
    corpo: Mapped[str] = mapped_column(Text, default="")
    praticaId: Mapped[str | None] = mapped_column(String, nullable=True)
    destinatario: Mapped[str | None] = mapped_column(String, nullable=True)  # None = broadcast
    letta: Mapped[bool] = mapped_column(Boolean, default=False)
    inviataEmail: Mapped[bool] = mapped_column(Boolean, default=False)
    creata: Mapped[str] = mapped_column(String)

    def dict(self):
        return _to_dict(self)


class LottoImport(Base):
    """Lotto di importazione massiva documenti storici (Fase 8)."""
    __tablename__ = "lotti_import"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    nome: Mapped[str] = mapped_column(String, default="")
    creato: Mapped[str] = mapped_column(String)
    creatore: Mapped[str] = mapped_column(String, default="")
    totale: Mapped[int] = mapped_column(default=0)
    classificati: Mapped[int] = mapped_column(default=0)
    applicati: Mapped[int] = mapped_column(default=0)
    scartati: Mapped[int] = mapped_column(default=0)
    stato: Mapped[str] = mapped_column(String, default="in_corso")  # in_corso | completato

    def dict(self):
        return _to_dict(self)


class ItemImport(Base):
    """Singolo documento in un lotto di importazione."""
    __tablename__ = "item_import"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    lottoId: Mapped[str] = mapped_column(String)
    filename: Mapped[str] = mapped_column(String)
    contentType: Mapped[str] = mapped_column(String, default="")
    testo: Mapped[str] = mapped_column(Text, default="")
    ai: Mapped[dict] = mapped_column(JSON, default=dict)
    stato: Mapped[str] = mapped_column(String, default="in_coda")  # in_coda|classificato|applicato|scartato
    objectKey: Mapped[str | None] = mapped_column(String, nullable=True)
    comId: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    creato: Mapped[str] = mapped_column(String)

    def dict(self):
        return _to_dict(self)


class ImpostazioneConfig(Base):
    """Impostazioni di configurazione runtime salvate nel DB (sovrascrivono .env senza riavvio)."""
    __tablename__ = "impostazioni_config"
    chiave: Mapped[str] = mapped_column(String, primary_key=True)
    valore: Mapped[str] = mapped_column(Text, default="")
    modificata: Mapped[str] = mapped_column(String, default="")

    def dict(self):
        return _to_dict(self)


class Utente(Base):
    """Utenti di piattaforma. Fonte di verità per R.USERS/R.PERM in memoria."""
    __tablename__ = "utenti"
    id: Mapped[str] = mapped_column(String, primary_key=True)       # username (= KC preferred_username)
    nome: Mapped[str] = mapped_column(String, nullable=False)       # nome completo
    email: Mapped[str] = mapped_column(String, default="")
    ufficio: Mapped[str] = mapped_column(String, default="")
    ruolo_kc: Mapped[str] = mapped_column(String, nullable=False)   # KC role name
    col: Mapped[str] = mapped_column(String, default="#0066cc")     # colore avatar
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    creato: Mapped[str] = mapped_column(String, default="")
    # Hash bcrypt della password (auth nativa). NULL = solo KC o demo.
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)

    def dict(self):
        return _to_dict(self)


class Bene(Base):
    __tablename__ = "beni"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tipo: Mapped[str] = mapped_column(String)
    categoria: Mapped[str] = mapped_column(String)
    denominazione: Mapped[str] = mapped_column(String)
    ubicazione: Mapped[str] = mapped_column(String, default="")
    codice: Mapped[str] = mapped_column(String, default="")
    stato: Mapped[str] = mapped_column(String, default="buono")
    responsabile: Mapped[str | None] = mapped_column(String, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    dati: Mapped[dict] = mapped_column(JSON, default=dict)

    def dict(self):
        return _to_dict(self)
