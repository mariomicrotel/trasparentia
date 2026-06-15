import React from "react";
import { Icon } from "../icons.jsx";

const LIVELLO_ICO = { danger: "alertCircle", warning: "alertTriangle", info: "info" };
const LIVELLO_COL = { danger: "var(--rosso)", warning: "var(--ambra)", info: "var(--blu)" };

export function NotifPanel({ notifiche, onClose, onLetta, onTuttoLetto, nav }) {
  const nonLette = notifiche.filter((n) => !n.letta).length;

  return (
    <>
      {/* backdrop invisibile per chiudere al click fuori */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99 }}
        onClick={onClose}
      />
      {/* pannello */}
      <div
        style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
          width: 370, maxHeight: 500, display: "flex", flexDirection: "column",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <Icon name="bell" size={16} stroke={2} style={{ color: "var(--blu)" }} />
          <strong style={{ fontSize: 13.5, flex: 1 }}>
            Notifiche{nonLette > 0 ? ` · ${nonLette} non lette` : ""}
          </strong>
          {nonLette > 0 && (
            <button
              className="btn btn--subtle btn--sm"
              onClick={onTuttoLetto}
              style={{ fontSize: 12 }}
            >
              Segna tutto letto
            </button>
          )}
        </div>

        {/* lista */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {notifiche.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
              <Icon name="checkCircle" size={32} stroke={1.5} style={{ color: "var(--verde)", display: "block", margin: "0 auto 10px" }} />
              Nessuna notifica attiva.
            </div>
          ) : (
            notifiche.map((n) => {
              const col = LIVELLO_COL[n.livello] || LIVELLO_COL.info;
              const ico = LIVELLO_ICO[n.livello] || "info";
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.praticaId) {
                      nav("pratica", { id: n.praticaId });
                      onLetta(n.id);
                      onClose();
                    } else {
                      onLetta(n.id);
                    }
                  }}
                  style={{
                    padding: "11px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: n.letta ? "transparent" : "var(--surface-2)",
                    cursor: n.praticaId ? "pointer" : "default",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}
                >
                  <Icon
                    name={ico} size={15} stroke={2}
                    style={{ color: col, flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.letta ? 400 : 700, lineHeight: 1.35, color: "var(--text)" }}>
                      {n.titolo}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
                      {n.corpo}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>
                      {n.creata}
                      {n.praticaId && <span style={{ marginLeft: 6, color: "var(--blu)" }}>→ vai alla pratica</span>}
                    </div>
                  </div>
                  {!n.letta && (
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: col, flexShrink: 0, marginTop: 4,
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
