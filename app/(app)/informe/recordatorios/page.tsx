import Link from "next/link";
import { RemindersManager } from "@/components/reminders/RemindersManager";
import { madridParts } from "@/lib/dates";
import { listReminders } from "@/lib/reminder-queries";

export const metadata = { title: "Recordatorios" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const reminders = await listReminders();
  const { date, hour, minute } = madridParts(new Date());
  const now = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return (
    <div className="space-y-3 pb-4 pt-2">
      <header className="flex min-h-12 items-center gap-1">
        <Link href="/informe" aria-label="Volver al informe" className="-ml-2 flex min-h-11 min-w-11 items-center justify-center text-accent">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 2 2 10l8 8" />
          </svg>
        </Link>
        <h1 className="flex-1 truncate text-[22px] font-bold tracking-tight">Recordatorios</h1>
      </header>
      <RemindersManager reminders={reminders} today={date} now={now} />
    </div>
  );
}
