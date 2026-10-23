import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Todas las Server Actions comprueban quién llama (el proxy solo protege rutas, y la página pública del compañero,
 * /turno, puede invocar cualquier acción). Si añades una acción, empieza por `requireOwner()` o, si es de Hoy,
 * `authorizeNight(fecha)`; las de la página de vacaciones de los empleados, `authorizeVacation()`.
 */
describe("acciones del servidor", () => {
  it("todas (salvo el login) comprueban la sesión o el enlace del compañero", () => {
    const sinControl: string[] = [];
    for (const name of readdirSync("app/actions")) {
      if (name === "auth.ts") continue;
      const file = `app/actions/${name}`;
      const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      sf.forEachChild((n) => {
        if (ts.isFunctionDeclaration(n) && n.body && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          if (!/requireOwner\(|authorizeNight\(|authorizeOwnerOrGuest\(|withNight\(|authorizeVacation\(/.test(n.body.getText())) {
            sinControl.push(`${file} → ${n.name?.text}`);
          }
        }
      });
    }
    expect(sinControl).toEqual([]);
  });
});
