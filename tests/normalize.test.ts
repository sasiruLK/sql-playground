import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSuperstore, toIsoDate } from "@/lib/seed/normalize";

const HEADER = [
  "Row ID",
  "Order ID",
  "Order Date",
  "Ship Date",
  "Ship Mode",
  "Customer ID",
  "Customer Name",
  "Segment",
  "Country",
  "City",
  "State",
  "Postal Code",
  "Region",
  "Product ID",
  "Category",
  "Sub-Category",
  "Product Name",
  "Sales",
  "Quantity",
  "Discount",
  "Profit",
];

function row(overrides: Record<string, string> = {}): string[] {
  const base: Record<string, string> = {
    "Row ID": "1",
    "Order ID": "CA-2016-152156",
    "Order Date": "11/8/2016",
    "Ship Date": "11/11/2016",
    "Ship Mode": "Second Class",
    "Customer ID": "CG-12520",
    "Customer Name": "Claire Gute",
    Segment: "Consumer",
    Country: "United States",
    City: "Henderson",
    State: "Kentucky",
    "Postal Code": "42420",
    Region: "South",
    "Product ID": "FUR-BO-10001798",
    Category: "Furniture",
    "Sub-Category": "Bookcases",
    "Product Name": "Bush Somerset Bookcase",
    Sales: "261.96",
    Quantity: "2",
    Discount: "0",
    Profit: "41.9136",
    ...overrides,
  };
  return HEADER.map((column) => base[column] ?? "");
}

function normalize(rows: string[][]) {
  return normalizeSuperstore([HEADER, ...rows]);
}

test("converts M/D/YYYY dates to ISO so SQLite date functions work", () => {
  assert.equal(toIsoDate("11/8/2016"), "2016-11-08");
  assert.equal(toIsoDate("1/1/2015"), "2015-01-01");
  assert.equal(toIsoDate("12/31/2017"), "2017-12-31");
});

test("collapses repeated customer rows into one customer", () => {
  const seed = normalize([
    row({ "Row ID": "1" }),
    row({ "Row ID": "2", "Order ID": "CA-2016-999999", City: "Dallas" }),
  ]);

  assert.equal(seed.customers.length, 1);
  assert.deepEqual(seed.customers[0], {
    id: "CG-12520",
    name: "Claire Gute",
    segment: "Consumer",
  });
});

test("puts the shipping address on the order, not the customer", () => {
  const seed = normalize([
    row({ "Row ID": "1", City: "Henderson", State: "Kentucky" }),
    row({
      "Row ID": "2",
      "Order ID": "CA-2016-999999",
      City: "Dallas",
      State: "Texas",
      "Postal Code": "75217",
      Region: "Central",
    }),
  ]);

  assert.equal(seed.orders.length, 2);
  assert.equal(seed.orders[0].city, "Henderson");
  assert.equal(seed.orders[1].city, "Dallas");
  assert.equal(seed.orders[1].state, "Texas");
  assert.equal(seed.orders[1].region, "Central");
  assert.ok(!("city" in seed.customers[0]));
});

test("keeps the first-seen product name when one product id has conflicting names", () => {
  const seed = normalize([
    row({ "Row ID": "1", "Product Name": "Wall Clock" }),
    row({ "Row ID": "2", "Product Name": "DAX Solid Wood Frames" }),
  ]);

  assert.equal(seed.products.length, 1);
  assert.equal(seed.products[0].name, "Wall Clock");
});

test("orders resolve to their customer by id", () => {
  const seed = normalize([row()]);

  assert.equal(seed.orders.length, 1);
  assert.deepEqual(seed.orders[0], {
    id: "CA-2016-152156",
    customer_id: "CG-12520",
    order_date: "2016-11-08",
    ship_date: "2016-11-11",
    ship_mode: "Second Class",
    country: "United States",
    city: "Henderson",
    state: "Kentucky",
    postal_code: "42420",
    region: "South",
  });
});

test("treats a blank postal code as null rather than an empty string", () => {
  const seed = normalize([row({ "Postal Code": "" })]);
  assert.equal(seed.orders[0].postal_code, null);
});

test("keeps both line items when the same product appears twice in one order", () => {
  const seed = normalize([
    row({ "Row ID": "1", Discount: "0", Sales: "10" }),
    row({ "Row ID": "2", Discount: "0.2", Sales: "8" }),
  ]);

  assert.equal(seed.orderItems.length, 2);
  assert.deepEqual(
    seed.orderItems.map((item) => item.id),
    [1, 2],
  );
  assert.equal(seed.orderItems[0].discount, 0);
  assert.equal(seed.orderItems[1].discount, 0.2);
});

test("parses money and quantity as numbers", () => {
  const seed = normalize([
    row({ Sales: "261.96", Quantity: "2", Discount: "0", Profit: "-41.91" }),
  ]);

  assert.deepEqual(seed.orderItems[0], {
    id: 1,
    order_id: "CA-2016-152156",
    product_id: "FUR-BO-10001798",
    sales: 261.96,
    quantity: 2,
    discount: 0,
    profit: -41.91,
  });
});

test("rejects a blank number rather than seeding it as zero", () => {
  assert.throws(() => normalize([row({ Sales: "" })]), /Sales/);
  assert.throws(() => normalize([row({ Profit: "" })]), /Profit/);
});

test("rejects a row whose date cannot be parsed", () => {
  assert.throws(() => normalize([row({ "Order Date": "not-a-date" })]), /date/i);
});

test("rejects a file whose header is missing an expected column", () => {
  const shortHeader = HEADER.filter((column) => column !== "Profit");
  assert.throws(
    () => normalizeSuperstore([shortHeader, shortHeader.map(() => "x")]),
    /Profit/,
  );
});
