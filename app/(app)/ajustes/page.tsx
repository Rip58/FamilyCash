import Link from "next/link";
import { aiProviderLabel } from "@/lib/ai-import-format";
import { db } from "@/lib/db";
import { getDepartments, getEmployees, getSections, getSettings, getStatusTypes } from "@/lib/queries";
import { VersionCard } from "@/components/settings/VersionCard";
import { Icon, type IconName, tint } from "@/components/ui/icons";

export const metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

export default async function Page() {
  // Los recuentos salen de los datos de referencia en caché: solo 2 consultas reales.
  const [employees, departments, sections, statuses, locs, settings] = await Promise.all([
    getEmployees(),
    getDepartments(),
    getSections(),
    getStatusTypes(),
    db.shelfLocation.count({ where: { active: true } }),
    getSettings(),
  ]);
  const active = (rows: { active?: boolean }[]) => rows.filter((r) => r.active !== false).length;
  const [emps, deps, secs, sts] = [active(employees), active(departments), active(sections), active(statuses)];
  const shift = settings ? `${settings.shiftStart}–${settings.shiftEnd}` : "21:30–06:30";
  const groups: { items: { href: string; label: string; detail?: string; badge?: number; icon: IconName; color: string }[] }[] = [
    {
      items: [
        { href: "/ajustes/empleados", label: "Empleados", detail: String(emps), icon: "users", color: "#3b82f6" },
        { href: "/ajustes/departamentos", label: "Departamentos", detail: String(deps), icon: "tag", color: "#f97316" },
        { href: "/ajustes/secciones", label: "Secciones", detail: String(secs), icon: "route", color: "#14b8a6" },
        { href: "/ajustes/estados", label: "Estados", detail: String(sts), icon: "swatch", color: "#8b5cf6" },
        { href: "/ajustes/ubicaciones", label: "Ubicaciones", detail: String(locs), icon: "pin", color: "#ec4899" },
      ],
    },
    {
      items: [
        { href: "/ajustes/turno", label: "Turno", detail: shift, icon: "moon", color: "#6366f1" },
        { href: "/ajustes/nomina", label: "Nómina", detail: "Importes", icon: "wallet", color: "#16a34a" },
        {
          href: "/ajustes/ia",
          label: "Importar con IA",
          detail: aiProviderLabel(settings.aiProvider),
          icon: "sparkles",
          color: "#d97757",
        },
      ],
    },
    {
      items: [
        { href: "/ajustes/seguridad", label: "Seguridad", icon: "lock", color: "#64748b" },
        { href: "/ajustes/datos", label: "Datos", detail: "Exportar CSV", icon: "database", color: "#22c55e" },
        { href: "/ajustes/almacenamiento", label: "Almacenamiento", detail: "Fotos", icon: "images", color: "#0ea5e9" },
      ],
    },
  ];
  return (
    <div className="pt-4">
      <h1 className="mb-4 text-[28px] font-bold tracking-tight">Ajustes</h1>
      <div className="flex flex-col gap-6">
        {groups.map((g, i) => (
          <div key={i} className="overflow-hidden rounded-card bg-surface">
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="flex min-h-12 items-center gap-3 border-b border-line px-4 py-1.5 last:border-b-0 active:bg-surface-2"
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-[9px]"
                  style={{ backgroundColor: tint(it.color, 15), color: it.color }}
                >
                  <Icon name={it.icon} className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="flex-1 text-[17px]">{it.label}</span>
                {it.detail && <span className="text-[15px] text-muted">{it.detail}</span>}
                {it.badge ? (
                  <span
                    data-testid="pending-badge"
                    aria-label={`${it.badge} pendientes`}
                    className="flex h-6 min-w-6 items-center justify-center rounded-full bg-warning px-1.5 text-[13px] font-bold text-black"
                  >
                    {it.badge}
                  </span>
                ) : null}
                <span aria-hidden className="text-muted">›</span>
              </Link>
            ))}
          </div>
        ))}
        <VersionCard />
      </div>
    </div>
  );
}
