"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderProtocols } from "@/app/actions/protocols";
import { cn } from "@/components/ui";
import { normalize, protocolPlainText } from "@/lib/protocol-markdown";
import { Highlight, ProtocolBody } from "./ProtocolBody";

export interface ProtocolItem {
  id: string;
  title: string;
  category: string | null;
  body: string;
}

const GENERAL = "General";

interface Group {
  name: string;
  items: ProtocolItem[];
}

/** Agrupa por categoría conservando el orden de aparición (los items llegan ya ordenados). */
function groupItems(items: ProtocolItem[]): Group[] {
  const map = new Map<string, ProtocolItem[]>();
  for (const it of items) {
    const key = it.category?.trim() || GENERAL;
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  return Array.from(map, ([name, list]) => ({ name, items: list }));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-90")}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function Accordion({ item, open, onToggle, query }: { item: ProtocolItem; open: boolean; onToggle: () => void; query: string }) {
  const panelId = `panel-${item.id}`;
  return (
    <li className="border-b border-line last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-[17px] font-medium"
        >
          <span>
            <Highlight text={item.title} query={query} />
          </span>
          <Chevron open={open} />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-label={item.title}
        className={cn(
          "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out",
          open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">
            <ProtocolBody body={item.body} query={query} />
            <Link
              href={`/protocolos/${item.id}`}
              className="mt-3 inline-flex min-h-11 items-center rounded-control bg-surface-2 px-4 text-[15px] font-medium text-accent"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function SortableRow({ item }: { item: ProtocolItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-h-[52px] items-center gap-2 border-b border-line bg-surface pl-4 last:border-b-0",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      <span className="flex-1 py-2 text-[17px] font-medium">{item.title}</span>
      <button
        type="button"
        aria-label={`Arrastrar para reordenar ${item.title}`}
        className="flex min-h-11 min-w-11 touch-manipulation select-none items-center justify-center text-muted"
        {...attributes}
        {...listeners}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="7" r="1.6" />
          <circle cx="15" cy="7" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="17" r="1.6" />
          <circle cx="15" cy="17" r="1.6" />
        </svg>
      </button>
    </li>
  );
}

function SortableGroup({ group, onReorder }: { group: Group; onReorder: (ids: string[]) => void }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = group.items.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul>
          {group.items.map((it) => (
            <SortableRow key={it.id} item={it} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function ProtocolList({ initial }: { initial: ProtocolItem[] }) {
  const [items, setItems] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setItems(initial);
  }
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const q = query.trim();
  const nq = normalize(q);

  const visible = useMemo(() => {
    if (!nq) return items;
    return items.filter(
      (it) =>
        normalize(it.title).includes(nq) ||
        normalize(protocolPlainText(it.body)).includes(nq) ||
        normalize(it.category ?? "").includes(nq),
    );
  }, [items, nq]);

  const groups = useMemo(() => groupItems(visible), [visible]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reorderGroup(ids: string[]) {
    // Optimista: se recoloca ese grupo en su sitio dentro de la lista global.
    const byId = new Map(items.map((i) => [i.id, i]));
    const inGroup = new Set(ids);
    let k = 0;
    const next = items.map((i) => (inGroup.has(i.id) ? byId.get(ids[k++]!)! : i));
    setItems(next);
    setError(null);
    startTransition(async () => {
      const res = await reorderProtocols(ids);
      if (!res.ok) {
        setItems(items);
        setError(res.error ?? "No se pudo guardar el orden.");
      }
    });
  }

  const showEmptyAll = items.length === 0;
  const showNoResults = !showEmptyAll && visible.length === 0;

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between gap-3 pt-4">
        <h1 className="text-[28px] font-bold tracking-tight">Protocolos</h1>
        <Link
          href="/protocolos/nuevo"
          className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 text-[15px] font-semibold text-accent-fg"
        >
          + Protocolo
        </Link>
      </div>

      {!showEmptyAll && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar protocolo…"
              aria-label="Buscar protocolos"
              className="min-h-11 w-full rounded-control bg-surface px-4 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="button"
            aria-pressed={sorting}
            onClick={() => setSorting((s) => !s)}
            className={cn(
              "min-h-11 rounded-control px-4 text-[15px] font-medium",
              sorting ? "bg-accent text-accent-fg" : "bg-surface text-accent",
            )}
          >
            {sorting ? "Hecho" : "Ordenar"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {showEmptyAll && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-10 text-center">
          <span className="text-[40px]" aria-hidden="true">
            📖
          </span>
          <p className="text-[17px] font-semibold">Aún no hay protocolos</p>
          <p className="text-muted">Crea el primero para tener a mano cómo se hacen las cosas cada noche.</p>
          <Link
            href="/protocolos/nuevo"
            className="mt-1 inline-flex min-h-11 items-center rounded-control bg-accent px-5 text-[16px] font-semibold text-accent-fg"
          >
            + Crear protocolo
          </Link>
        </div>
      )}

      {showNoResults && (
        <p className="mt-8 text-center text-muted">Ningún protocolo coincide con “{q}”.</p>
      )}

      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <section key={g.name} aria-label={g.name}>
            <h2 className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">{g.name}</h2>
            <div className="overflow-hidden rounded-card bg-surface">
              {sorting && !q ? (
                <SortableGroup group={g} onReorder={(ids) => reorderGroup(ids)} />
              ) : (
                <ul>
                  {g.items.map((it) => (
                    <Accordion
                      key={it.id}
                      item={it}
                      query={q}
                      open={q ? true : openIds.has(it.id)}
                      onToggle={() => toggle(it.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>
      {sorting && q && (
        <p className="mt-3 text-center text-[14px] text-muted">Borra la búsqueda para reordenar.</p>
      )}
    </div>
  );
}
