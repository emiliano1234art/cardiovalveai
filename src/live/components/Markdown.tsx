import type { ReactNode } from 'react';

/** Convierte **negrita** dentro de una línea en elementos React (sin HTML crudo). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

const isTableRow = (l: string) => l.trim().startsWith('|') && l.trim().endsWith('|');
const cells = (l: string) => l.trim().slice(1, -1).split('|').map((c) => c.trim());

/** Renderizador mínimo de Markdown (títulos, listas, tablas, negrita). */
export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }

    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      const level = Math.min(4, Math.max(2, h[1].length)); // # y ## → h2
      const Tag = (`h${level}` as 'h2' | 'h3' | 'h4');
      out.push(<Tag key={key++}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (isTableRow(t)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i].trim())) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div className="lv-table-wrap" key={key++}>
          <table className="lv-table">
            <thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
            <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} style={{ whiteSpace: 'normal' }}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^([-*•])\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordered = /^\d+[.)]\s+/.test(t);
      const items: string[] = [];
      while (i < lines.length && (/^([-*•])\s+/.test(lines[i].trim()) || /^\d+[.)]\s+/.test(lines[i].trim()))) {
        items.push(lines[i].trim().replace(/^([-*•]|\d+[.)])\s+/, ''));
        i++;
      }
      const L = ordered ? 'ol' : 'ul';
      out.push(<L key={key++}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</L>);
      continue;
    }
    if (/^---+$/.test(t)) { out.push(<hr key={key++} />); i++; continue; }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*•]\s|\d+[.)]\s|\|)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(<p key={key++}>{inline(para.join(' '))}</p>);
  }
  return <div className="lv-md">{out}</div>;
}
