import type { ReactNode } from "react";
import { findRanges, parseProtocol, type Inline, type ListItem } from "@/lib/protocol-markdown";

/** Resalta las coincidencias de `query` dentro de `text` (sin acentos / mayúsculas). */
export function Highlight({ text, query }: { text: string; query?: string }): ReactNode {
  const ranges = query ? findRanges(text, query) : [];
  if (ranges.length === 0) return text;
  const out: ReactNode[] = [];
  let last = 0;
  ranges.forEach(([s, e], i) => {
    if (s > last) out.push(text.slice(last, s));
    out.push(
      <mark key={i} className="rounded-sm bg-warning/40 px-0.5 text-inherit">
        {text.slice(s, e)}
      </mark>,
    );
    last = e;
  });
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Inlines({ nodes, query }: { nodes: Inline[]; query?: string }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "bold")
          return (
            <strong key={i} className="font-semibold">
              <Highlight text={n.text} query={query} />
            </strong>
          );
        if (n.type === "link")
          return (
            <a
              key={i}
              href={n.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              <Highlight text={n.text} query={query} />
            </a>
          );
        return <Highlight key={i} text={n.text} query={query} />;
      })}
    </>
  );
}

function Items({ items, query, depth }: { items: ListItem[]; query?: string; depth: number }) {
  return (
    <ul className={depth === 0 ? "list-disc space-y-1.5 pl-5" : "mt-1.5 list-[circle] space-y-1.5 pl-5"}>
      {items.map((it, i) => (
        <li key={i} className="pl-0.5 marker:text-muted">
          <Inlines nodes={it.inline} query={query} />
          {it.children.length > 0 && <Items items={it.children} query={query} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/** Renderiza el Markdown limitado de un protocolo como elementos React (sin HTML crudo). */
export function ProtocolBody({ body, query }: { body: string; query?: string }) {
  const blocks = parseProtocol(body);
  if (blocks.length === 0) return <p className="text-muted">Este protocolo aún no tiene contenido.</p>;
  return (
    <div className="space-y-2 text-[16px] leading-snug">
      {blocks.map((b, i) =>
        b.type === "list" ? (
          <Items key={i} items={b.items} query={query} depth={0} />
        ) : (
          <p key={i}>
            <Inlines nodes={b.inline} query={query} />
          </p>
        ),
      )}
    </div>
  );
}
