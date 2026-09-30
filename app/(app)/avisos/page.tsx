import Link from "next/link";
import { ReportCard } from "@/components/reports/ReportCard";
import { Card } from "@/components/ui/Card";
import { isDateStr } from "@/lib/dates";
import { getEmployees } from "@/lib/queries";
import { listReports } from "@/lib/report-queries";
import { PAGE_SIZE } from "@/lib/reports";

export const metadata = { title: "Avisos" };
export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string; e?: string; p?: string };

const field =
  "min-h-11 w-full rounded-control bg-surface-2 px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const from = sp.from && isDateStr(sp.from) ? sp.from : undefined;
  const to = sp.to && isDateStr(sp.to) ? sp.to : undefined;
  const employeeId = sp.e || undefined;
  const page = Math.max(1, Number.parseInt(sp.p ?? "1", 10) || 1);

  const [employees, { total, reports }] = await Promise.all([
    getEmployees(),
    listReports({ from, to, employeeId }, page, PAGE_SIZE),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (p: number) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (employeeId) q.set("e", employeeId);
    if (p > 1) q.set("p", String(p));
    const s = q.toString();
    return s ? `/avisos?${s}` : "/avisos";
  };
  const filtered = !!(from || to || employeeId);
  const nav = "flex min-h-11 flex-1 items-center justify-center rounded-control bg-surface text-[16px] font-medium text-accent";

  return (
    <div className="space-y-3 pb-4 pt-2">
      <header className="flex items-center gap-1">
        <Link
          href="/informe"
          aria-label="Volver al Informe"
          className="flex min-h-11 min-w-11 items-center justify-center text-accent"
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 2 2 10l8 8" />
          </svg>
        </Link>
        <h1 className="flex-1 text-[28px] font-bold tracking-tight">Avisos</h1>
      </header>

      <form method="get" action="/avisos" className="rounded-card bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Desde</span>
            <input type="date" name="from" defaultValue={from ?? ""} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Hasta</span>
            <input type="date" name="to" defaultValue={to ?? ""} className={field} />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">Empleado</span>
          <select name="e" defaultValue={employeeId ?? ""} className={field}>
            <option value="">Todos</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex gap-2">
          {filtered && (
            <Link href="/avisos" className="flex min-h-11 flex-1 items-center justify-center rounded-control bg-surface-2 text-[16px] font-medium">
              Quitar filtros
            </Link>
          )}
          <button type="submit" className="min-h-11 flex-1 rounded-control bg-accent text-[16px] font-semibold text-accent-fg">
            Filtrar
          </button>
        </div>
      </form>

      <p className="px-1 text-[13px] text-muted" aria-live="polite">
        {total === 0 ? "Sin avisos" : `${total} ${total === 1 ? "aviso" : "avisos"}`}
        {pages > 1 && ` · página ${page} de ${pages}`}
      </p>

      {reports.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-muted">
            {filtered ? "No hay avisos con estos filtros." : "Aún no hay avisos. Crea uno con el botón 📷 de Hoy."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} showDate />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Paginación" className="flex gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className={nav}>
              ‹ Anteriores
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {page < pages ? (
            <Link href={href(page + 1)} className={nav}>
              Siguientes ›
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      )}
    </div>
  );
}
