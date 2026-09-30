import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
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

async function main() {
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
