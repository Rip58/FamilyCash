import { describe, expect, it } from "vitest";
import { indentLine, makeBullet, outdentLine } from "@/lib/protocol-edit";

describe("ayudas del editor", () => {
  it("makeBullet añade guion y mueve el cursor", () => {
    expect(makeBullet("uno\ndos", 5, 5)).toEqual({ text: "uno\n- dos", start: 7, end: 7 });
  });
  it("makeBullet no duplica", () => {
    expect(makeBullet("- a", 1, 1).text).toBe("- a");
  });
  it("indentLine sangra y limita a 3 niveles", () => {
    let r = { text: "- a", start: 3, end: 3 };
    for (let i = 0; i < 5; i++) r = indentLine(r.text, r.start, r.end);
    expect(r.text).toBe("      - a");
  });
  it("indentLine convierte texto suelto en sub-viñeta", () => {
    expect(indentLine("hola", 0, 0).text).toBe("  - hola");
  });
  it("outdentLine quita sangría", () => {
    expect(outdentLine("  - a", 4, 4)).toEqual({ text: "- a", start: 2, end: 2 });
    expect(outdentLine("- a", 1, 1).text).toBe("- a");
  });
});
