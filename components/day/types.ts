import type { SegmentLite } from "@/lib/schedule";

export interface SectionLite {
  id: string;
  name: string;
  departmentId: string | null;
}

export interface SegmentInput {
  sectionId: string | null;
  label: string | null;
  start: string;
  end: string;
}

export type SegmentWithId = SegmentLite & { id: string };

/** Operaciones que la hoja del empleado pide a DayView (guardado optimista). */
export interface SheetOps {
  setStatus: (statusTypeId: string, reason?: string | null, present?: boolean) => void;
  setReason: (reason: string) => void;
  /** departmentId null = el habitual; `extraDepartmentIds` = otros que también cubre esa noche. */
  setDepartment: (departmentId: string | null, extraDepartmentIds?: string[]) => void;
  setTimes: (t: { arrivedAt: string; leftAt: string; timeReason: string }) => void;
  /** minutes 0 = sin horas extra. */
  setOvertime: (minutes: number, note: string) => void;
  addSegment: (s: SegmentInput) => void;
  updateSegment: (id: string, s: SegmentInput) => void;
  deleteSegment: (id: string) => void;
}
