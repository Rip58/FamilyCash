import { notFound } from "next/navigation";
import { DaysView } from "@/components/week/DaysView";
import { WeekShell } from "@/components/week/WeekShell";
import type { PeopleGridData, WeekViewMode } from "@/components/week/types";
import { isDateStr } from "@/lib/dates";
import { loadWeekData } from "@/lib/week-queries";

export const metadata = { title: "Semana" };
export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ week?: string[] }>;
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { week } = await params;
  const { v } = await searchParams;
  if (week && (week.length !== 1 || !isDateStr(week[0]!))) notFound();

  const data = await loadWeekData(week?.[0] ?? null);
  const initialView: WeekViewMode | null = v === "personas" ? "personas" : v === "dias" ? "dias" : null;

  const groups: PeopleGridData["groups"] = data.grid.groups.map((g) => ({
    id: g.department?.id ?? "sin-departamento",
    name: g.department?.name ?? "Sin departamento",
    color: g.department?.color ?? null,
    rows: g.rows.map((r) => ({
      employeeId: r.employee.id,
      name: r.employee.name,
      alias: r.employee.alias ?? null,
      departmentName: g.department?.name ?? null,
      cells: r.cells.map((c) => ({
        // Semana muestra SIEMPRE el planning; lo que pasó en Hoy, si difiere, es solo un aviso.
        statusId: (c.planned ?? c.status).id,
        reason: c.reason,
        extraMinutes: c.extraMinutes,
        extraNote: c.extraNote,
        actual: c.planned ? c.status.label : null,
        pending: data.pending[`${r.employee.id}|${c.date}`] ?? null,
      })),
    })),
  }));
  // Orden del Excel (se guarda al cargar una semana desde imagen); quien no lo tenga, al final en su orden habitual.
  const rotaOrder = new Map(data.grid.rows.map((r) => [r.employee.id, r.employee.rotaOrder ?? null]));
  const all = groups.flatMap((g) => g.rows);
  const flatRows = all
    .map((r, i) => ({ r, i, o: rotaOrder.get(r.employeeId) ?? null }))
    .sort((a, b) => (a.o ?? Infinity) - (b.o ?? Infinity) || a.i - b.i)
    .map((x) => x.r);
  const people: PeopleGridData = {
    days: data.days,
    today: data.today,
    daysOffPerWeek: data.daysOffPerWeek,
    statuses: data.statusTypes.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.label,
      color: s.color,
      isWorking: s.isWorking,
      active: s.active !== false,
      sortOrder: s.sortOrder,
    })),
    groups,
    flatGroups: [{ id: "todos", name: "Toda la plantilla · orden del Excel", color: null, rows: flatRows }],
  };

  return (
    <WeekShell
      weekStart={data.weekStart}
      today={data.today}
      initialView={initialView}
      people={people}
      daysView={<DaysView rosters={data.rosters} notes={[...data.notes]} today={data.today} />}
    />
  );
}
