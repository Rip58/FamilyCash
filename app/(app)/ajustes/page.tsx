import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [emps, deps, secs, sts, settings] = await Promise.all([
    db.employee.count({ where: { active: true } }),
    db.department.count({ where: { active: true } }),
    db.section.count({ where: { active: true } }),
    db.statusType.count({ where: { active: true } }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  const shift = settings ? `${settings.shiftStart}–${settings.shiftEnd}` : "21:30–06:30";
  const groups: { items: { href: string; label: string; detail?: string; icon: string; color: string }[] }[] = [
    {
      items: [
        { href: "/ajustes/empleados", label: "Empleados", detail: String(emps), icon: "👤", color: "#3b82f6" },
        { href: "/ajustes/departamentos", label: "Departamentos", detail: String(deps), icon: "🏷️", color: "#f97316" },
        { href: "/ajustes/secciones", label: "Secciones", detail: String(secs), icon: "🧭", color: "#14b8a6" },
        { href: "/ajustes/estados", label: "Estados", detail: String(sts), icon: "🎨", color: "#8b5cf6" },
      ],
    },
    { items: [{ href: "/ajustes/turno", label: "Turno", detail: shift, icon: "🌙", color: "#6366f1" }] },
    {
      items: [
        { href: "/ajustes/seguridad", label: "Seguridad", icon: "🔒", color: "#64748b" },
        { href: "/ajustes/datos", label: "Datos", detail: "Exportar CSV", icon: "📄", color: "#22c55e" },
        { href: "/ajustes/almacenamiento", label: "Almacenamiento", detail: "Avisos y fotos", icon: "🗂️", color: "#0ea5e9" },
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
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[16px]"
                  style={{ backgroundColor: it.color }}
                >
                  {it.icon}
                </span>
                <span className="flex-1 text-[17px]">{it.label}</span>
                {it.detail && <span className="text-[15px] text-muted">{it.detail}</span>}
                <span aria-hidden className="text-muted">›</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
