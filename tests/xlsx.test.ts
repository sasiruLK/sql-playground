import { test } from "node:test";
import assert from "node:assert/strict";
import { readWorkbook } from "@/lib/seed/xlsx";

const WORKBOOK_XML = `<?xml version="1.0"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Second" sheetId="2" r:id="rId2"/>
    <sheet name="First" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const RELATIONSHIPS_XML = `<?xml version="1.0"?>
<Relationships>
  <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Target="worksheets/sheet2.xml"/>
</Relationships>`;

const SHARED_STRINGS_XML = `<?xml version="1.0"?>
<sst count="3">
  <si><t>Name</t></si>
  <si><t>Kithul &amp; Treacle</t></si>
  <si><r><t>Split </t></r><r><t>run</t></r></si>
</sst>`;

function workbook(sheets: Record<string, string>) {
  const parts = new Map<string, Buffer>([
    ["xl/workbook.xml", Buffer.from(WORKBOOK_XML)],
    ["xl/_rels/workbook.xml.rels", Buffer.from(RELATIONSHIPS_XML)],
    ["xl/sharedStrings.xml", Buffer.from(SHARED_STRINGS_XML)],
  ]);

  for (const [name, xml] of Object.entries(sheets)) {
    parts.set(name, Buffer.from(`<worksheet><sheetData>${xml}</sheetData></worksheet>`));
  }

  return readWorkbook(parts);
}

function sheet(xml: string) {
  return workbook({ "xl/worksheets/sheet1.xml": xml, "xl/worksheets/sheet2.xml": "" }).get(
    "First",
  )!;
}

test("resolves shared strings, numbers and inline strings", () => {
  const rows = sheet(`
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="inlineStr"><is><t>Inline</t></is></c>
      <c r="D1"><v>45663</v></c>
      <c r="E1"><v>1187.5</v></c>
    </row>`);

  assert.deepEqual(rows, [
    ["Name", "Kithul & Treacle", "Inline", "45663", "1187.5"],
  ]);
});

test("joins the runs of a split shared string", () => {
  assert.deepEqual(sheet(`<row r="1"><c r="A1" t="s"><v>2</v></c></row>`), [["Split run"]]);
});

test("a blank cell keeps the columns after it in place", () => {
  // Excel omits empty cells entirely, so only the r="..." reference says which
  // column a value belongs to.
  const rows = sheet(`
    <row r="1">
      <c r="A1"><v>1</v></c>
      <c r="C1"><v>3</v></c>
      <c r="D1"><v>4</v></c>
    </row>`);

  assert.deepEqual(rows, [["1", "", "3", "4"]]);
});

test("reads columns past Z", () => {
  const rows = sheet(`<row r="1"><c r="AB1"><v>28</v></c></row>`);

  assert.equal(rows[0].length, 28);
  assert.equal(rows[0][27], "28");
});

test("decodes XML entities", () => {
  const rows = sheet(
    `<row r="1"><c r="A1" t="inlineStr"><is><t>a &lt; b &amp; &#65;</t></is></c></row>`,
  );

  assert.deepEqual(rows, [["a < b & A"]]);
});

test("keeps sheets under their workbook names, not their file names", () => {
  const sheets = workbook({
    "xl/worksheets/sheet1.xml": `<row r="1"><c r="A1"><v>1</v></c></row>`,
    "xl/worksheets/sheet2.xml": `<row r="1"><c r="A1"><v>2</v></c></row>`,
  });

  assert.deepEqual([...sheets.keys()], ["Second", "First"]);
  assert.deepEqual(sheets.get("First"), [["1"]]);
  assert.deepEqual(sheets.get("Second"), [["2"]]);
});

test("rejects a file that is not a workbook", () => {
  assert.throws(() => readWorkbook(new Map()), /not an \.xlsx workbook/i);
});

test("rejects a worksheet the file does not contain", () => {
  assert.throws(
    () => workbook({ "xl/worksheets/sheet1.xml": "" }),
    /which is not in the file/,
  );
});
