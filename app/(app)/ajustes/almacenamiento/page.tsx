import { redirect } from "next/navigation";

// Almacenamiento está ahora en Ajustes → Datos y fotos.
export default function Page() {
  redirect("/ajustes/datos");
}
