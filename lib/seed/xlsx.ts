/**
 * Minimal SpreadsheetML reader: enough of the .xlsx format to pull each
 * worksheet out as a grid of strings.
 *
 * Only what a data export uses is supported - shared and inline strings,
 * numbers, and sparse rows. Formatting, formulas and dates-as-dates are
 * ignored: a date cell arrives as its raw serial number, which
 * `lib/seed/normalize.ts` converts.
 */

/** Every worksheet in the workbook, keyed by sheet name, in workbook order. */
export type Workbook = Map<string, string[][]>;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body.startsWith("#x")
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);

      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }

    return NAMED_ENTITIES[body] ?? whole;
  });
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? decodeXml(match[1]) : null;
}

/** Concatenates the `<t>` runs inside a shared-string or inline-string cell. */
function readRuns(fragment: string): string {
  let text = "";

  for (const run of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    text += decodeXml(run[1]);
  }

  return text;
}

function readSharedStrings(xml: string): string[] {
  const strings: string[] = [];

  for (const item of xml.matchAll(/<si(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/si>)/g)) {
    strings.push(item[1] === undefined ? "" : readRuns(item[1]));
  }

  return strings;
}

/** "A" -> 0, "Z" -> 25, "AA" -> 26. Digits in a cell reference end the name. */
function columnIndex(reference: string): number {
  let index = 0;

  for (const character of reference) {
    const letter = character.toUpperCase().charCodeAt(0) - 64;
    if (letter < 1 || letter > 26) break;

    index = index * 26 + letter;
  }

  return index - 1;
}

function readSheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];

  for (const row of xml.matchAll(/<row(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = [];

    for (const cell of (row[1] ?? "").matchAll(
      /<c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const tag = cell[1] ?? "";
      const body = cell[2] ?? "";
      const type = attribute(tag, "t") ?? "n";
      const reference = attribute(tag, "r");

      let value: string;
      if (type === "inlineStr") {
        value = readRuns(body);
      } else {
        const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
        const literal = raw ? decodeXml(raw[1]) : "";

        if (type === "s") {
          const shared = sharedStrings[Number(literal)];
          if (shared === undefined) {
            throw new Error(`Shared string ${literal} is missing from the workbook.`);
          }
          value = shared;
        } else {
          value = literal;
        }
      }

      // A blank cell is simply absent from the XML, so the reference - not the
      // cell's position in the row - decides which column it belongs to.
      const at = reference ? columnIndex(reference) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = value;
    }

    rows.push(cells);
  }

  return rows;
}

/**
 * Reads a workbook out of the unpacked parts of an .xlsx file.
 *
 * Sheets are resolved through the workbook relationships rather than by
 * guessing at `sheetN.xml`: the file order and the display order differ.
 */
export function readWorkbook(parts: Map<string, Buffer>): Workbook {
  const text = (name: string): string | null => parts.get(name)?.toString("utf8") ?? null;

  const workbookXml = text("xl/workbook.xml");
  const relationshipsXml = text("xl/_rels/workbook.xml.rels");

  if (!workbookXml || !relationshipsXml) {
    throw new Error("Not an .xlsx workbook (xl/workbook.xml is missing).");
  }

  const sharedStringsXml = text("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml ? readSharedStrings(sharedStringsXml) : [];

  const targets = new Map<string, string>();
  for (const relationship of relationshipsXml.matchAll(/<Relationship\s[^>]*\/?>/g)) {
    const id = attribute(relationship[0], "Id");
    const target = attribute(relationship[0], "Target");

    if (id && target) {
      targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
    }
  }

  const sheets: Workbook = new Map();
  for (const sheet of workbookXml.matchAll(/<sheet\s[^>]*\/?>/g)) {
    const name = attribute(sheet[0], "name");
    const id = attribute(sheet[0], "r:id");
    const target = id ? targets.get(id) : null;

    if (!name || !target) continue;

    const sheetXml = text(target);
    if (!sheetXml) {
      throw new Error(`Worksheet ${name} points at ${target}, which is not in the file.`);
    }

    sheets.set(name, readSheet(sheetXml, sharedStrings));
  }

  return sheets;
}
