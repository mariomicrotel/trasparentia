import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { diffWords } from "diff";
import { Icon } from "./icons.jsx";

// ── Utility testo ↔ HTML (retrocompatibilità col contenuto testo semplice) ──
export function looksLikeHtml(s) {
  return /<\/?[a-z][\s\S]*>/i.test(s || "");
}

export function textToHtml(text) {
  if (!text) return "";
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (text)
    .split(/\n{2,}/)
    .map((par) => "<p>" + esc(par).replace(/\n/g, "<br>") + "</p>")
    .join("");
}

export function toEditorHtml(content) {
  return looksLikeHtml(content) ? content : textToHtml(content || "");
}

export function htmlToText(html) {
  if (!html) return "";
  if (!looksLikeHtml(html)) return html; // già testo semplice (legacy)
  let s = html
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value.replace(/\n{3,}/g, "\n\n").trim();
}

// ── Toolbar button ──────────────────────────────────────────────────────────
function TB({ onClick, active, disabled, icon, label, title }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={"rte__btn" + (active ? " rte__btn--active" : "")}>
      {icon ? <Icon name={icon} size={16} stroke={2} /> : <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>}
    </button>
  );
}

// ── Editor ricco (TipTap / ProseMirror) ──────────────────────────────────────
export function RichEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sincronizza contenuto esterno (es. dopo rigenerazione AI) senza loop:
  // setContent solo quando il valore differisce davvero da quello dell'editor.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) return null;
  const c = editor.chain().focus();

  return (
    <div className="rte">
      <div className="rte__toolbar">
        <TB icon="undo" title="Annulla" onClick={() => c.undo().run()} disabled={!editor.can().undo()} />
        <TB icon="redo" title="Ripeti" onClick={() => c.redo().run()} disabled={!editor.can().redo()} />
        <span className="rte__sep" />
        <TB icon="bold" title="Grassetto" active={editor.isActive("bold")} onClick={() => c.toggleBold().run()} />
        <TB icon="italic" title="Corsivo" active={editor.isActive("italic")} onClick={() => c.toggleItalic().run()} />
        <span className="rte__sep" />
        <TB label="H2" title="Titolo" active={editor.isActive("heading", { level: 2 })} onClick={() => c.toggleHeading({ level: 2 }).run()} />
        <TB label="H3" title="Sottotitolo" active={editor.isActive("heading", { level: 3 })} onClick={() => c.toggleHeading({ level: 3 }).run()} />
        <span className="rte__sep" />
        <TB icon="list" title="Elenco puntato" active={editor.isActive("bulletList")} onClick={() => c.toggleBulletList().run()} />
        <TB icon="listOrdered" title="Elenco numerato" active={editor.isActive("orderedList")} onClick={() => c.toggleOrderedList().run()} />
        <TB icon="quote" title="Citazione" active={editor.isActive("blockquote")} onClick={() => c.toggleBlockquote().run()} />
      </div>
      <EditorContent editor={editor} className="rte__content" />
    </div>
  );
}

// ── Vista diff (parola per parola) tra due testi ─────────────────────────────
export function DiffView({ before, after }) {
  const parts = diffWords(before || "", after || "");
  const invariato = parts.every((p) => !p.added && !p.removed);
  return (
    <div className="diffview">
      {invariato && (
        <div className="diffview__empty">Nessuna differenza rispetto alla bozza AI.</div>
      )}
      {parts.map((p, i) =>
        p.added ? <ins key={i} className="diff-ins">{p.value}</ins>
        : p.removed ? <del key={i} className="diff-del">{p.value}</del>
        : <span key={i}>{p.value}</span>
      )}
    </div>
  );
}
