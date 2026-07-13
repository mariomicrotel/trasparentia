import React from "react";

// Renderer markdown leggero per le risposte dell'assistente (nessuna dipendenza).
// Copre il sottoinsieme prodotto dal modello: **grassetto**, *corsivo*/_corsivo_,
// `codice`, titoli #/##/###, elenchi puntati (- * •) e numerati (1. / 1)),
// paragrafi separati da riga vuota e a-capo singoli.

const INLINE_RE = /(\*\*([^*]+)\*\*|`([^`]+)`|(?:\*|_)([^*_\n]+)(?:\*|_))/g;

function inline(text, kb) {
  const nodes = [];
  let last = 0, m, i = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={`${kb}-${i}`}>{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<code key={`${kb}-${i}`} className="md-code">{m[3]}</code>);
    else if (m[4] !== undefined) nodes.push(<em key={`${kb}-${i}`}>{m[4]}</em>);
    last = m.index + m[0].length; i++;
  }
  INLINE_RE.lastIndex = 0;
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function withBreaks(text, kb) {
  return text.split("\n").flatMap((ln, i) =>
    i === 0 ? inline(ln, `${kb}-l${i}`) : [<br key={`${kb}-br${i}`} />, ...inline(ln, `${kb}-l${i}`)]
  );
}

export function Markdown({ text }) {
  const blocks = (text || "").trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        const h = b.match(/^(#{1,3})\s+(.*)$/);
        if (h && lines.length === 1) {
          const Tag = h[1].length === 1 ? "h3" : h[1].length === 2 ? "h4" : "h5";
          return <Tag key={bi} className="md-h">{inline(h[2], `h${bi}`)}</Tag>;
        }
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return <ul key={bi} className="md-ul">
            {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `u${bi}-${li}`)}</li>)}
          </ul>;
        }
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return <ol key={bi} className="md-ol">
            {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `o${bi}-${li}`)}</li>)}
          </ol>;
        }
        return <p key={bi} className="md-p">{withBreaks(b, `p${bi}`)}</p>;
      })}
    </>
  );
}
