import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { MAX_EXPORT_DAYS, buildExportRows, daysInRange, toCsv } from "@/lib/export";
import { isDateStr } from "@/lib/dates";
import { getDepartments, getEmployees, getEntriesBetween, getSections, getStatusTypes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!isDateStr(from) || !isDateStr(to) || from > to) {
    return new NextResponse("Rango de fechas no válido", { status: 400 });
  }
  if (daysInRange(from, to).length > MAX_EXPORT_DAYS) {
    return new NextResponse(`El rango máximo es de ${MAX_EXPORT_DAYS} días`, { status: 400 });
  }
  const [employees, departments, statusTypes, sections, entries] = await Promise.all([
    getEmployees(),
    getDepartments(),
    getStatusTypes(),
    getSections(),
    getEntriesBetween(from, to),
  ]);
  const csv = toCsv(buildExportRows({ from, to, employees, departments, statusTypes, sections, entries }));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plantilla_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
