import { notFound } from "next/navigation";
import { isDateStr } from "@/lib/dates";

/**
 * Valida la fecha antes del `loading.tsx` (que hace streaming y ya habría enviado un 200):
 * un layout se renderiza fuera de ese Suspense, así que `notFound()` aquí da un 404 real.
 */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ date?: string[] }>;
}) {
  const { date: segs } = await params;
  if (segs && (segs.length !== 1 || !isDateStr(segs[0]!))) notFound();
  return children;
}
