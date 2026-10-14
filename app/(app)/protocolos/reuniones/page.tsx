import { MeetingBoard } from "@/components/protocols/MeetingBoard";
import { madridToday } from "@/lib/dates";
import { findMeetingTopics } from "@/lib/meeting-queries";
import { getDepartments, getEmployees } from "@/lib/queries";

export const metadata = { title: "Reuniones" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const [topics, employees, departments, { nuevo }] = await Promise.all([findMeetingTopics(), getEmployees(), getDepartments(), searchParams]);
  return (
    <MeetingBoard
      topics={topics}
      employees={employees
        .filter((e) => e.active)
        .map((e) => ({ id: e.id, name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"))}
      departments={departments.filter((d) => d.active !== false).map((d) => ({ id: d.id, name: d.name, color: d.color }))}
      today={madridToday()}
      startCreating={nuevo === "1"}
    />
  );
}
