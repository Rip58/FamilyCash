import { describe, expect, it } from "vitest";
import { findRanges, normalize, parseInline, parseProtocol, protocolPlainText } from "@/lib/protocol-markdown";

describe("parseProtocol", () => {
  it("anida listas por sangría de 2 espacios", () => {
    const blocks = parseProtocol("- A\n  - A1\n  - A2\n    - A2a\n- B");
    expect(blocks).toHaveLength(1);
    const b = blocks[0]!;
    if (b.type !== "list") throw new Error("lista esperada");
    expect(b.items).toHaveLength(2);
    expect(b.items[0]!.children).toHaveLength(2);
    expect(b.items[0]!.children[1]!.children[0]!.inline).toEqual([{ type: "text", text: "A2a" }]);
    expect(b.items[1]!.children).toHaveLength(0);
  });

  it("acepta * y líneas sin guion como párrafos", () => {
    const blocks = parseProtocol("Introducción\n* uno\n* dos\n\nFin");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "paragraph"]);
  });

  it("un salto de sangría demasiado grande solo baja un nivel", () => {
    const b = parseProtocol("- A\n      - X")[0]!;
    if (b.type !== "list") throw new Error();
    expect(b.items[0]!.children).toHaveLength(1);
  });

  it("empieza con sangría sin padre: queda al nivel raíz", () => {
    const b = parseProtocol("  - X\n- Y")[0]!;
    if (b.type !== "list") throw new Error();
    expect(b.items).toHaveLength(2);
  });

  it("cuerpo vacío no genera bloques", () => {
    expect(parseProtocol("  \n\n")).toEqual([]);
  });
});

describe("parseInline", () => {
  it("negrita y enlaces http/https", () => {
    expect(parseInline("a **b** [c](https://x.es) d")).toEqual([
      { type: "text", text: "a " },
      { type: "bold", text: "b" },
      { type: "text", text: " " },
      { type: "link", text: "c", href: "https://x.es" },
      { type: "text", text: " d" },
    ]);
  });

  it("rechaza javascript: y otros esquemas", () => {
    const r = parseInline("[x](javascript:alert(1)) [y](mailto:a@b.c)");
    expect(r.every((n) => n.type === "text")).toBe(true);
  });

  it("no interpreta HTML", () => {
    expect(parseInline("<b>hola</b>")).toEqual([{ type: "text", text: "<b>hola</b>" }]);
  });
});

describe("búsqueda", () => {
  it("normaliza acentos y mayúsculas", () => {
    expect(normalize("Droguería ÁÉ")).toBe("drogueria ae");
  });
  it("encuentra rangos ignorando acentos", () => {
    expect(findRanges("Apertura del Turno; turno", "TURNO")).toEqual([
      [13, 18],
      [20, 25],
    ]);
    expect(findRanges("Botellería", "eria")).toEqual([[6, 10]]);
  });
  it("consulta vacía no da rangos", () => {
    expect(findRanges("abc", "  ")).toEqual([]);
  });
  it("texto plano", () => {
    expect(protocolPlainText("- **a** [b](https://x.es)\n  - c")).toBe("a b\nc");
  });
});
