# SQL Playground

A teaching sandbox where every student gets their own private copy of the
LankaKart online retail dataset and can run any SQL they like against it —
including `DELETE`, `DROP` and `CREATE`.

Queries execute in the student's browser, in SQLite compiled to WebAssembly.
There is no server-side database, so one student's `DROP TABLE` cannot reach
anyone else's data, and a class of any size costs the same to run as a single
user. See [docs/adr/0001-client-side-sqlite-wasm.md](docs/adr/0001-client-side-sqlite-wasm.md)
for why.

## The dataset

LankaKart is a synthetic Sri Lankan online retailer, supplied as
`LankaKart_Retail_Dataset.xlsx` — one worksheet per table. Table and column
names are kept exactly as the workbook spells them, so the dictionary on the
workbook's ReadMe sheet describes the database students are querying.

| Table         | Rows | Key           | Points at                          |
| ------------- | ---- | ------------- | ---------------------------------- |
| `Categories`  | 8    | `CategoryID`  | —                                  |
| `Suppliers`   | 12   | `SupplierID`  | —                                  |
| `Customers`   | 60   | `CustomerID`  | —                                  |
| `Warehouses`  | 3    | `WarehouseID` | —                                  |
| `Products`    | 56   | `ProductID`   | `Categories`, `Suppliers`          |
| `OrderHeader` | 220  | `OrderID`     | `Customers`                        |
| `OrderItems`  | 534  | `OrderItemID` | `OrderHeader`, `Products`          |
| `Stock`       | 111  | `StockID`     | `Products`, `Warehouses`           |

`Stock` resolves the many-to-many between products and warehouses, so the
longest useful chain runs `Customers → OrderHeader → OrderItems → Products →
Categories`.

The data is shaped around cases worth teaching:

- **8 customers have never ordered** and **6 products have never sold**, so an
  `INNER JOIN` and a `LEFT JOIN` give different answers.
- **Supplier `SUP-12` has no products**, which only a `LEFT JOIN` from
  `Suppliers` reveals.
- **Processing and cancelled orders have no `ShipDate`**, for `IS NULL`.
- **`UnitPrice_LKR` lives on both `Products` and `OrderItems`** — the list price
  and the price actually paid — which is why a price has to be copied onto an
  order line.
- **`OrderTotal_LKR` equals the order's line totals plus its shipping fee** for
  all 220 orders, so students can check their own `GROUP BY` against it.

Two conventions to know:

- Dates are stored as ISO `YYYY-MM-DD` text, converted from the workbook's Excel
  serial numbers, so `strftime`, `between` and ordering all work as expected.
- `Products.Discontinued` is the workbook's own `'Yes'`/`'No'` text rather than a
  0/1 flag, so what the dictionary says is what a student compares against.

Money is in Sri Lankan Rupees throughout, and every figure is fictional.

## Running it

```bash
npm install
npm run dev
```

The interface is [shadcn/ui](https://ui.shadcn.com) on Tailwind v4, and follows
the system light/dark setting with a toggle that is remembered per browser.

## Rebuilding the dataset

`public/seed.sqlite` is committed, so builds and deploys never touch the
workbook. Regenerate it only if the source data changes:

```bash
npm run build:seed   # LankaKart_Retail_Dataset.xlsx -> public/seed.sqlite
```

`lib/seed/schema.ts` is the single source of truth for the schema: it generates
the `CREATE TABLE` statements and checks every worksheet's headers against them.
A renamed column, a missing sheet, a blank required cell or a broken foreign key
fails `build:seed` rather than producing a quietly wrong database.

## Deploying

Deploys to Vercel with no configuration and no environment variables: the whole
app is static. `npm run build` copies the SQLite WASM runtime out of
`node_modules` into `public/sqlite/` (gitignored) and then builds the site.

## How a student's database works

- On first visit the browser downloads `seed.sqlite` (~190 KB, cached) and copies
  it into [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system),
  the browser's private file storage.
- Everything after that — including writes — happens in that local copy, so it
  survives refreshes and closing the tab.
- **Reset data** discards the copy and re-imports the seed. Query history is
  kept, because a student who has just wiped their data usually wants the
  statement that did it back.
- If OPFS is unavailable (a private window, an older browser, or the playground
  already being open in a second tab) the database falls back to memory. It
  works identically but is lost on refresh, and the UI says so.

## Guardrails

There is no SQL validation, because there is nothing to protect: the database is
the student's own. The only limits are on rendering — a query returning more
than 200,000 rows is stopped, and at most 500 rows are displayed.

## Tests

```bash
npm test        # workbook reading, normalisation, query history
npm run typecheck
```
