import { TABLES, type Column, type Table } from "@/lib/seed/schema";
import type { Workbook } from "@/lib/seed/xlsx";

/** A value ready to be bound to an INSERT. */
export type Cell = string | number | null;

/** Every table's rows, keyed by table name, in the order they must be inserted. */
export type SeedData = Map<string, Cell[][]>;

/**
 * Excel counts days from an imaginary 1900-01-00, and treats 1900 as a leap
 * year. Anchoring at 1899-12-30 absorbs both quirks for every serial after the
 * phantom 1900-02-29, which is serial 60.
 */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const FIRST_UNAMBIGUOUS_SERIAL = 61;
const MS_PER_DAY = 86_400_000;

/**
 * Converts an Excel date serial to an ISO `YYYY-MM-DD` string.
 *
 * Dates are stored as text rather than serials so that `strftime`, `between`
 * and plain string ordering all behave the way a student expects.
 */
export function fromExcelSerial(value: string, column: string): string {
  const serial = Number(value);

  if (!Number.isInteger(serial) || serial < FIRST_UNAMBIGUOUS_SERIAL) {
    throw new Error(`Unrecognised date in ${column}: ${JSON.stringify(value)}`);
  }

  return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY).toISOString().slice(0, 10);
}

function toNumber(value: string, column: string, whole: boolean): number {
  // Number("") is 0, which would seed a blank cell as a real figure.
  const parsed = value === "" ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed) || (whole && !Number.isInteger(parsed))) {
    throw new Error(`Unrecognised number in ${column}: ${JSON.stringify(value)}`);
  }

  return parsed;
}

function convert(raw: string, column: Column, table: Table): Cell {
  const value = raw.trim();
  const where = `${table.name}.${column.name}`;

  if (value === "") {
    if (column.nullable) return null;
    throw new Error(`${where} is blank, but the column is required.`);
  }

  if (column.oneOf && !column.oneOf.includes(value)) {
    throw new Error(
      `${where} is ${JSON.stringify(value)}, which is not one of ${column.oneOf.join(", ")}.`,
    );
  }

  switch (column.kind) {
    case "date":
      return fromExcelSerial(value, where);
    case "integer":
      return toNumber(value, where, true);
    case "real":
      return toNumber(value, where, false);
    case "text":
      return value;
  }
}

/**
 * Turns the workbook into rows ready for SQLite, checking as it goes that each
 * worksheet is the table `lib/seed/schema.ts` expects.
 *
 * The workbook is hand-maintained, so a renamed column or a reordered sheet is
 * a real possibility; every one of those fails the build here rather than
 * quietly seeding a database with data in the wrong columns.
 */
export function normalizeWorkbook(workbook: Workbook): SeedData {
  const seed: SeedData = new Map();

  for (const table of TABLES) {
    const sheet = workbook.get(table.name);

    if (!sheet) {
      throw new Error(`The workbook has no ${table.name} worksheet.`);
    }

    const [header, ...body] = sheet;
    const expected = table.columns.map((column) => column.name);
    const actual = (header ?? []).slice(0, expected.length).map((name) => name.trim());

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `The ${table.name} worksheet has columns [${actual.join(", ")}], expected [${expected.join(", ")}].`,
      );
    }

    const rows: Cell[][] = [];
    for (const row of body) {
      // Trailing blank rows are an artefact of how the workbook was saved.
      if (row.every((cell) => cell.trim() === "")) continue;

      rows.push(table.columns.map((column, at) => convert(row[at] ?? "", column, table)));
    }

    seed.set(table.name, rows);
  }

  return seed;
}
