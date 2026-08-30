/**
 * Minimal RFC 4180 CSV reader. The Superstore export quotes any field holding a
 * comma and escapes embedded quotes by doubling them.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let dirty = false;

  const endField = () => {
    row.push(field);
    field = "";
    dirty = false;
  };

  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      dirty = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n") {
      endRow();
    } else if (char !== "\r") {
      field += char;
      dirty = true;
    }
  }

  if (dirty || field.length > 0 || row.length > 0) {
    endRow();
  }

  return rows;
}
