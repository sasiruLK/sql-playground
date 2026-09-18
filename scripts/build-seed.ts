/**
 * Builds public/seed.sqlite from the LankaKart retail workbook.
 *
 * Run locally with `npm run build:seed` and commit the result. The deployed
 * build never runs this: it just serves the committed database file.
 */
import { readFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeWorkbook } from "../lib/seed/normalize";
import { TABLES, createStatements } from "../lib/seed/schema";
import { readWorkbook } from "../lib/seed/xlsx";
import { readZip } from "../lib/seed/zip";

// npm scripts always run from the package root.
const ROOT = process.cwd();
const WORKBOOK = join(ROOT, "LankaKart_Retail_Dataset.xlsx");
const OUTPUT = join(ROOT, "public", "seed.sqlite");

const seed = normalizeWorkbook(readWorkbook(readZip(readFileSync(WORKBOOK))));

mkdirSync(join(ROOT, "public"), { recursive: true });
rmSync(OUTPUT, { force: true });

const db = new DatabaseSync(OUTPUT);
db.exec("pragma journal_mode = delete");
// Enforced only while seeding: it turns a broken reference in the workbook into
// a failed build. The Sandbox students get leaves them free to break it.
db.exec("pragma foreign_keys = on");
db.exec(createStatements());

db.exec("begin");
for (const table of TABLES) {
  const rows = seed.get(table.name) ?? [];
  const placeholders = table.columns.map(() => "?").join(", ");
  const insert = db.prepare(`insert into ${table.name} values (${placeholders})`);

  for (const row of rows) {
    insert.run(...row);
  }
}
db.exec("commit");
db.exec("vacuum");
db.close();

const bytes = statSync(OUTPUT).size;
console.log(
  [
    ...TABLES.map(
      (table) => `${table.name.padEnd(12)}${seed.get(table.name)?.length ?? 0}`,
    ),
    `-> public/seed.sqlite (${(bytes / 1024).toFixed(0)} KB)`,
  ].join("\n"),
);
