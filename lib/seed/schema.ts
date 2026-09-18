/**
 * The shape of the LankaKart database.
 *
 * One declaration drives everything: the CREATE TABLE statements, the header
 * check against each worksheet, and how each cell is converted. Table and
 * column names are kept exactly as the workbook spells them, because the
 * workbook's own ReadMe is what students read while they write queries.
 */

/** How a cell is converted on the way into SQLite. */
export type ColumnKind =
  /** Verbatim text. */
  | "text"
  /** A whole number. */
  | "integer"
  /** A number that may carry a fractional part - all the LKR money columns. */
  | "real"
  /** An Excel date serial, stored as an ISO `YYYY-MM-DD` string. */
  | "date";

export type Column = {
  name: string;
  kind: ColumnKind;
  /** Blank cells are allowed and land as NULL. */
  nullable?: boolean;
  primaryKey?: boolean;
  /** `Table (Column)` this column points at. */
  references?: string;
  /** The only values the workbook may carry, rejected at build time otherwise. */
  oneOf?: readonly string[];
};

export type Table = {
  /** Both the SQLite table name and the worksheet it is read from. */
  name: string;
  columns: readonly Column[];
  /** Columns worth an index: the foreign keys students join on. */
  indexed?: readonly string[];
};

/** Ordered so that a table is created and filled after everything it references. */
export const TABLES: readonly Table[] = [
  {
    name: "Categories",
    columns: [
      { name: "CategoryID", kind: "text", primaryKey: true },
      { name: "CategoryName", kind: "text" },
      { name: "Description", kind: "text" },
    ],
  },
  {
    name: "Suppliers",
    columns: [
      { name: "SupplierID", kind: "text", primaryKey: true },
      { name: "SupplierName", kind: "text" },
      { name: "ContactPerson", kind: "text" },
      { name: "Phone", kind: "text" },
      { name: "Email", kind: "text" },
      { name: "City", kind: "text" },
      { name: "Country", kind: "text" },
    ],
  },
  {
    name: "Customers",
    columns: [
      { name: "CustomerID", kind: "text", primaryKey: true },
      { name: "FirstName", kind: "text" },
      { name: "LastName", kind: "text" },
      { name: "Gender", kind: "text", oneOf: ["F", "M"] },
      { name: "Email", kind: "text" },
      { name: "Phone", kind: "text" },
      { name: "City", kind: "text" },
      { name: "District", kind: "text" },
      { name: "JoinDate", kind: "date" },
    ],
  },
  {
    name: "Warehouses",
    columns: [
      { name: "WarehouseID", kind: "text", primaryKey: true },
      { name: "WarehouseName", kind: "text" },
      { name: "City", kind: "text" },
    ],
  },
  {
    name: "Products",
    columns: [
      { name: "ProductID", kind: "text", primaryKey: true },
      { name: "ProductName", kind: "text" },
      { name: "CategoryID", kind: "text", references: "Categories (CategoryID)" },
      { name: "SupplierID", kind: "text", references: "Suppliers (SupplierID)" },
      { name: "UnitPrice_LKR", kind: "real" },
      { name: "UnitCost_LKR", kind: "real" },
      { name: "ReorderLevel", kind: "integer" },
      // Kept as the workbook's own 'Yes'/'No' rather than a 0/1 flag, so the
      // value a student sees in the dictionary is the value they compare to.
      { name: "Discontinued", kind: "text", oneOf: ["No", "Yes"] },
    ],
    indexed: ["CategoryID", "SupplierID"],
  },
  {
    name: "OrderHeader",
    columns: [
      { name: "OrderID", kind: "text", primaryKey: true },
      { name: "CustomerID", kind: "text", references: "Customers (CustomerID)" },
      { name: "OrderDate", kind: "date" },
      // Blank until an order ships, and left blank when one is cancelled.
      { name: "ShipDate", kind: "date", nullable: true },
      {
        name: "OrderStatus",
        kind: "text",
        oneOf: ["Cancelled", "Delivered", "Processing", "Shipped"],
      },
      {
        name: "PaymentMethod",
        kind: "text",
        oneOf: ["Bank Transfer", "Card", "Cash on Delivery", "Mobile Wallet"],
      },
      { name: "ShippingCity", kind: "text" },
      { name: "ShippingFee_LKR", kind: "real" },
      { name: "OrderTotal_LKR", kind: "real" },
    ],
    indexed: ["CustomerID"],
  },
  {
    name: "OrderItems",
    columns: [
      { name: "OrderItemID", kind: "text", primaryKey: true },
      { name: "OrderID", kind: "text", references: "OrderHeader (OrderID)" },
      { name: "ProductID", kind: "text", references: "Products (ProductID)" },
      { name: "Quantity", kind: "integer" },
      // The price actually paid, which may undercut the product's list price.
      { name: "UnitPrice_LKR", kind: "real" },
      { name: "LineTotal_LKR", kind: "real" },
    ],
    indexed: ["OrderID", "ProductID"],
  },
  {
    name: "Stock",
    columns: [
      { name: "StockID", kind: "text", primaryKey: true },
      { name: "ProductID", kind: "text", references: "Products (ProductID)" },
      { name: "WarehouseID", kind: "text", references: "Warehouses (WarehouseID)" },
      { name: "QuantityOnHand", kind: "integer" },
      { name: "LastStockTake", kind: "date" },
    ],
    indexed: ["ProductID", "WarehouseID"],
  },
];

const SQL_TYPE: Record<ColumnKind, string> = {
  text: "text",
  integer: "integer",
  real: "real",
  date: "text",
};

function columnDefinition(column: Column): string {
  const parts = [column.name, SQL_TYPE[column.kind]];

  if (column.primaryKey) parts.push("primary key");
  else if (!column.nullable) parts.push("not null");

  if (column.references) parts.push(`references ${column.references}`);

  return `  ${parts.join(" ")}`;
}

/** The DDL for the whole database, in dependency order. */
export function createStatements(): string {
  const statements: string[] = [];

  for (const table of TABLES) {
    statements.push(
      `create table ${table.name} (\n${table.columns.map(columnDefinition).join(",\n")}\n);`,
    );

    for (const column of table.indexed ?? []) {
      statements.push(
        `create index ${table.name}_${column} on ${table.name} (${column});`,
      );
    }
  }

  return statements.join("\n\n");
}
