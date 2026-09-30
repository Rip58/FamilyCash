import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

import { MISSING_DB_MESSAGE, directDatabaseUrl } from "../lib/db-url";

const url = directDatabaseUrl();
if (!url) throw new Error(MISSING_DB_MESSAGE);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const STATUSES = [
  { code: "WORK", label: "Trabaja", color: "#64748b", isWorking: true },
  { code: "OFF", label: "Fiesta", color: "#22c55e", isWorking: false },
  { code: "PAID_OFF", label: "Fiesta retribuida", color: "#eab308", isWorking: false },
  { code: "SICK", label: "Baja laboral", color: "#ef4444", isWorking: false },
  { code: "VACATION", label: "Vacaciones", color: "#3b82f6", isWorking: false },
];

const DEPARTMENTS = [
  { id: "seed-drogueria", name: "Droguería", color: "#0ea5e9", targetStaff: 4 },
  { id: "seed-botelleria", name: "Botellería", color: "#a855f7", targetStaff: 1 },
];

const SECTIONS = [
  { id: "seed-cerveza", name: "Cerveza" },
  { id: "seed-chocolate", name: "Chocolate" },
];

const EMPLOYEES = [
  "Gerard Deu", "Jose Alexander Roman", "Alejandro Erwin", "Hennry Arteta",
  "Mimount Zarioh", "Ricardo Luis Ayazo Baldovino", "Claudia Caceres",
  "Juan Pablo Zambrano", "Cintya Sanchez", "Mariluz Carvajal",
  "Anya Damary Ramirez", "Alejandro Gomez", "Neibis Vitoria", "Joan Colldeforns",
  "Jorge Alarcon", "Fabian", "Alex Rivero", "Osmani Corominas", "Mikael Antunes",
  "Joao Marco Rosadas", "Sebastian Cerda", "Sergi Ben Amor",
];

const PROTOCOLS = [
  {
    id: "seed-protocolo-apertura",
    title: "Apertura del turno",
    category: "Turno",
    body: [
      "- Fichar y **saludar** al responsable saliente",
      "- Revisar la nota del día en la app",
      "  - Ver quién falta y por qué",
      "  - Reasignar personal si un departamento queda vacío",
      "- Repartir las secciones del turno",
      "  - Cerveza y Chocolate primero",
      "- Recordar el descanso de 02:00 a 03:00",
    ].join("\n"),
  },
  {
    id: "seed-protocolo-producto-roto",
    title: "Incidencia con producto roto",
    category: "Incidencias",
    body: [
      "- Avisar al responsable **de inmediato**",
      "- Asegurar la zona",
      "  - Señalizar el suelo mojado",
      "  - Recoger cristales con guantes",
      "- Hacer foto y registrar un aviso en la app",
      "- Anotar producto, cantidad y sección",
    ].join("\n"),
  },
];

async function main() {
  // Solo siembra una base vacía: si ya existe Settings, no recrea lo que se haya borrado en Ajustes.
  // SEED_FORCE=1 fuerza el upsert (no sobrescribe datos existentes).
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing && process.env.SEED_FORCE !== "1") {
    console.log("Seed omitido: la base de datos ya está inicializada.");
    return;
  }

  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  for (const [i, s] of STATUSES.entries()) {
    await prisma.statusType.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s, sortOrder: i },
    });
  }

  for (const [i, d] of DEPARTMENTS.entries()) {
    await prisma.department.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, sortOrder: i },
    });
  }

  for (const [i, s] of SECTIONS.entries()) {
    await prisma.section.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, sortOrder: i },
    });
  }

  for (const [i, p] of PROTOCOLS.entries()) {
    await prisma.protocol.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, sortOrder: i },
    });
  }

  for (const [i, name] of EMPLOYEES.entries()) {
    await prisma.employee.upsert({
      where: { id: `seed-emp-${String(i + 1).padStart(2, "0")}` },
      update: {},
      create: { id: `seed-emp-${String(i + 1).padStart(2, "0")}`, name, sortOrder: i },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
