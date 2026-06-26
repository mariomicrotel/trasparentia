import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "setup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.authSetupNeeded()
      .then(({ needed }) => { if (needed) setMode("setup"); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let res;
      if (mode === "setup") {
        if (!nome.trim()) { setError("Il nome è obbligatorio"); setLoading(false); return; }
        if (password.length < 8) { setError("Password troppo breve (minimo 8 caratteri)"); setLoading(false); return; }
        res = await api.authSetup({ nome: nome.trim(), email: email.trim(), password });
      } else {
        res = await api.authLogin(email.trim(), password);
      }
      onLogin(res.access_token, res.user);
    } catch (err) {
      setError(err.message || "Errore di autenticazione");
    } finally {
      setLoading(false);
    }
  }

  const isSetup = mode === "setup";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-page, #f5f6fa)", fontFamily: "Titillium Web, sans-serif",
    }}>
      <div style={{
        background: "var(--bg-card, #fff)", borderRadius: 12, padding: "40px 40px 32px",
        width: "100%", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,.10)",
      }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: 14, background: "#0066cc",
            marginBottom: 14,
          }}>
            <Icon name="sparkles" size={26} stroke={2} style={{ color: "#fff" }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 22, color: "var(--text, #1a1a2e)" }}>
            TrasParent<span style={{ color: "#0066cc" }}>IA</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted, #6b7280)", marginTop: 4 }}>
            {isSetup ? "Configura il primo amministratore" : "Accedi alla piattaforma"}
          </div>
        </div>

        {isSetup && (
          <div style={{
            background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
            padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#1d4ed8",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <Icon name="info" size={16} stroke={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Primo avvio: crea l'account del Segretario Comunale. Potrai aggiungere altri utenti dal pannello di gestione.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="on">
          {isSetup && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nome completo</label>
              <input
                type="text" value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Es. Anna Bianchi" required autoFocus
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email istituzionale</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="nome@comune.it" required autoFocus={!isSetup}
              autoComplete="username"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={isSetup ? "Minimo 8 caratteri" : ""}
                required autoComplete={isSetup ? "new-password" : "current-password"}
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: "var(--text-muted, #6b7280)",
                }}>
                <Icon name={showPwd ? "eyeOff" : "eye"} size={17} stroke={2} />
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626",
              display: "flex", gap: 8, alignItems: "center",
            }}>
              <Icon name="alertCircle" size={16} stroke={2} />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
            background: loading ? "#93c5fd" : "#0066cc", color: "#fff",
            fontWeight: 700, fontSize: 15, cursor: loading ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background .15s",
          }}>
            {loading
              ? <><Icon name="loader" size={17} stroke={2} />Attendere…</>
              : isSetup
                ? <><Icon name="check" size={17} stroke={2.5} />Crea account e accedi</>
                : <><Icon name="arrowRight" size={17} stroke={2.5} />Accedi</>
            }
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--text-muted, #6b7280)" }}>
          <Icon name="shield" size={13} stroke={2} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Accesso riservato al personale del Comune
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", marginBottom: 6, fontSize: 13.5,
  fontWeight: 600, color: "var(--text, #1a1a2e)",
};
const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8, boxSizing: "border-box",
  border: "1.5px solid var(--border, #d1d5db)", fontSize: 14,
  background: "var(--bg-input, #fff)", color: "var(--text, #1a1a2e)",
  outline: "none", transition: "border-color .15s",
};
