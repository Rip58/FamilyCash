import { describe, expect, it } from "vitest";
import { noteHistoryItem, KIND_META, groupHistory, historyCounts } from "@/lib/employee-history";
import { type NoteView, noteLabel } from "@/lib/notes";
import { saveNoteSchema } from "@/lib/notes-schema";

const note = (o: Partial<NoteView>): NoteView => ({
  id: "n", date: "2026-11-03", time: null, type: "NOTIFICATION", done: false, text: "Llegó tarde", employeeId: "e1", employeeIds: ["e1"],
  employeeName: "Ana", departmentId: null, departmentName: null, sectionId: null, sectionName: null, photos: [], ...o,
});

describe("notificaciones", () => {
  it("la etiqueta dice si está firmada y si es conforme", () => {
    expect(noteLabel(note({}))).toBe("Notificación · sin firmar");
    expect(noteLabel(note({ agreement: "AGREE", signedAt: "2026-11-03T22:00:00.000Z" }))).toBe("Notificación · conforme");
    expect(noteLabel(note({ agreement: "DISAGREE", signedAt: "2026-11-03T22:00:00.000Z" }))).toBe("Notificación · no conforme");
  });

  it("queda en el historial del empleado, con su filtro propio", () => {
    const item = noteHistoryItem(note({ agreement: "AGREE", signedAt: "2026-11-03T22:00:00.000Z" }));
    expect(item.kind).toBe("notification");
    expect(item.label).toBe("Notificación · conforme");
    expect(item.note?.id).toBe("n");
    expect(KIND_META.notification.label).toBe("Notificaciones");
    expect(historyCounts([item])).toEqual([{ kind: "notification", count: 1 }]);
    expect(groupHistory([item], 2026, "", ["notification"])).toHaveLength(1);
    expect(groupHistory([item], 2026, "", ["note"])).toHaveLength(0);
  });

  const base = { date: "2026-11-03", type: "NOTIFICATION", text: "Texto", employeeIds: ["e1"] } as const;
  const png = "data:image/png;base64,iVBORw0KGgo=";
  it("la firma lleva conformidad y quién firma", () => {
    expect(saveNoteSchema.safeParse({ ...base, sign: { signature: png, agreement: "AGREE", signedById: "e1" } }).success).toBe(true);
    expect(saveNoteSchema.safeParse({ ...base, sign: { signature: png, agreement: "TAL", signedById: "e1" } }).success).toBe(false);
    expect(saveNoteSchema.safeParse({ ...base, sign: { signature: "http://x/firma.png", agreement: "AGREE", signedById: "e1" } }).success).toBe(false);
    expect(saveNoteSchema.safeParse({ ...base }).success).toBe(true);
  });
});
