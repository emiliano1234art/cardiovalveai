import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/** Ecuación LaTeX renderizada con KaTeX (sin conexión externa). */
export function Tex({ children, display = false, size }: { children: string; display?: boolean; size?: number }) {
  const html = useMemo(() => katex.renderToString(children, { displayMode: display, throwOnError: false, strict: false }), [children, display]);
  return <span className="v-tex" style={size ? { fontSize: size } : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}
