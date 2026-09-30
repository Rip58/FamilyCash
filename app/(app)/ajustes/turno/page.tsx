import { ShiftForm } from "@/components/settings/ShiftForm";
import { getSettings } from "@/lib/queries";

export const metadata = { title: "Turno" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { id: _id, ...values } = await getSettings();
  void _id;
  return <ShiftForm initial={values} />;
}
