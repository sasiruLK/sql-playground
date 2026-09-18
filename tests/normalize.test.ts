import { test } from "node:test";
import assert from "node:assert/strict";
import { fromExcelSerial, normalizeWorkbook } from "@/lib/seed/normalize";
import { TABLES } from "@/lib/seed/schema";
import type { Workbook } from "@/lib/seed/xlsx";

/** One valid row per table, so a test only has to state what it changes. */
const ROWS: Record<string, string[]> = {
  Categories: ["CAT-01", "Electronics", "Gadgets and accessories"],
  Suppliers: [
    "SUP-01",
    "TechLanka Distributors",
    "Ruwan Jayasuriya",
    "011-2547890",
    "sales@techlanka.lk",
    "Colombo",
    "Sri Lanka",
  ],
  Customers: [
    "CUST-1001",
    "Ruwan",
    "Perera",
    "M",
    "ruwan.perera95@yahoo.com",
    "072-2719583",
    "Gampaha",
    "Gampaha",
    "45155",
  ],
  Warehouses: ["WH-01", "Colombo Main Warehouse", "Colombo"],
  Products: [
    "PROD-101",
    "Wireless Optical Mouse",
    "CAT-01",
    "SUP-01",
    "4500",
    "3100",
    "25",
    "No",
  ],
  OrderHeader: [
    "ORD-10188",
    "CUST-1001",
    "45663",
    "45667",
    "Delivered",
    "Mobile Wallet",
    "Galle",
    "450",
    "69540",
  ],
  OrderItems: ["ITM-50001", "ORD-10188", "PROD-101", "3", "690", "2070"],
  Stock: ["STK-5001", "PROD-101", "WH-01", "161", "46247"],
};

/** A workbook with every sheet the schema needs, before any test edits it. */
function workbook(overrides: Record<string, string[][]> = {}): Workbook {
  const sheets: Workbook = new Map();

  for (const table of TABLES) {
    const header = table.columns.map((column) => column.name);
    sheets.set(table.name, [header, ...(overrides[table.name] ?? [ROWS[table.name]])]);
  }

  return sheets;
}

/** The value of one column of the first row of one table. */
function cell(sheets: Workbook, table: string, column: string) {
  const columns = TABLES.find((candidate) => candidate.name === table)!.columns;
  const at = columns.findIndex((candidate) => candidate.name === column);

  return normalizeWorkbook(sheets).get(table)![0][at];
}

test("reads every table in the workbook", () => {
  const seed = normalizeWorkbook(workbook());

  assert.deepEqual(
    [...seed.keys()],
    TABLES.map((table) => table.name),
  );
  assert.deepEqual(seed.get("Categories"), [
    ["CAT-01", "Electronics", "Gadgets and accessories"],
  ]);
});

test("converts Excel date serials to ISO dates", () => {
  assert.equal(fromExcelSerial("45663", "OrderDate"), "2025-01-06");
  assert.equal(fromExcelSerial("45155", "JoinDate"), "2023-08-17");
  // 1900-03-01, the first day after Excel's phantom 1900-02-29.
  assert.equal(fromExcelSerial("61", "JoinDate"), "1900-03-01");
});

test("rejects a date serial from before Excel's leap-year bug", () => {
  // Serials 1-60 are a day out, so converting them would be silently wrong.
  assert.throws(() => fromExcelSerial("59", "JoinDate"), /Unrecognised date/);
  assert.throws(() => fromExcelSerial("", "JoinDate"), /Unrecognised date/);
  assert.throws(() => fromExcelSerial("45663.5", "JoinDate"), /Unrecognised date/);
});

test("keeps money as a number, including fractions", () => {
  const rows = { OrderItems: [["ITM-1", "ORD-10188", "PROD-101", "2", "593.75", "1187.5"]] };

  assert.equal(cell(workbook(rows), "OrderItems", "UnitPrice_LKR"), 593.75);
  assert.equal(cell(workbook(rows), "OrderItems", "LineTotal_LKR"), 1187.5);
});

test("a blank ShipDate becomes NULL", () => {
  const processing = [...ROWS.OrderHeader];
  processing[3] = "";

  assert.equal(cell(workbook({ OrderHeader: [processing] }), "OrderHeader", "ShipDate"), null);
});

test("a blank cell in a required column fails the build", () => {
  const nameless = [...ROWS.Products];
  nameless[1] = "";

  assert.throws(
    () => normalizeWorkbook(workbook({ Products: [nameless] })),
    /Products\.ProductName is blank/,
  );
});

test("a value outside the allowed set fails the build", () => {
  const unknownStatus = [...ROWS.OrderHeader];
  unknownStatus[4] = "Refunded";

  assert.throws(
    () => normalizeWorkbook(workbook({ OrderHeader: [unknownStatus] })),
    /OrderHeader\.OrderStatus is "Refunded"/,
  );
});

test("a fractional quantity fails the build", () => {
  const fractional = [...ROWS.OrderItems];
  fractional[3] = "2.5";

  assert.throws(
    () => normalizeWorkbook(workbook({ OrderItems: [fractional] })),
    /Unrecognised number in OrderItems\.Quantity/,
  );
});

test("a renamed column fails the build rather than shifting the data", () => {
  const sheets = workbook();
  const header = [...sheets.get("Customers")![0]];
  header[1] = "GivenName";
  sheets.set("Customers", [header, ROWS.Customers]);

  assert.throws(() => normalizeWorkbook(sheets), /Customers worksheet has columns/);
});

test("a missing worksheet fails the build", () => {
  const sheets = workbook();
  sheets.delete("Stock");

  assert.throws(() => normalizeWorkbook(sheets), /no Stock worksheet/);
});

test("skips the blank rows a spreadsheet leaves behind", () => {
  const sheets = workbook({ Warehouses: [ROWS.Warehouses, [], ["", "  ", ""]] });

  assert.equal(normalizeWorkbook(sheets).get("Warehouses")!.length, 1);
});
