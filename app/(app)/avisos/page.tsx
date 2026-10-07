import { redirect } from "next/navigation";

// Los avisos con foto ahora son notas: se ven en Informe → lupa → «Todas las notas» (filtro «Con foto»).
export default function Page() {
  redirect("/informe/empleado?s=all");
}
