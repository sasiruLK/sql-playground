# SQL Playground

A teaching sandbox where every student gets their own private copy of the
[Superstore dataset](https://www.kaggle.com/datasets/vivek468/superstore-dataset-final)
and can run any SQL they like against it — including `DELETE`, `DROP` and `CREATE`.

Queries execute in the student's browser, in SQLite compiled to WebAssembly.
There is no server-side database, so one student's `DROP TABLE` cannot reach
anyone else's data, and a class of any size costs the same to run as a single
user. See [docs/adr/0001-client-side-sqlite-wasm.md](docs/adr/0001-client-side-sqlite-wasm.md)
for why.

## The dataset

The flat Superstore export is normalised into four tables so that joins are
worth teaching:

| Table         | Rows  | Notes                                              |
| ------------- | ----- | -------------------------------------------------- |
| `customers`   | 793   | id, name, segment                                   |
| `products`    | 1,862 | id, name, category, sub_category                    |
| `orders`      | 5,009 | one per order id, with the shipping address         |
| `order_items` | 9,994 | one per line of the original CSV; sales and profit  |

Two quirks of the source data shape this schema:

- **The shipping address lives on `orders`, not `customers`.** 780 of the 793
  customers ship to more than one city, so an address is a property of an order.
- **32 product ids carry two different product names.** The first occurrence
  wins, so `products.id` stays a usable primary key.

Dates are stored as ISO `YYYY-MM-DD` strings, so `strftime` and date comparisons
work as students expect.

## Running it

```bash
npm install
npm run dev
```

## Rebuilding the dataset

`public/seed.sqlite` is committed, so builds and deploys never touch the CSV.
Regenerate it only if the source data changes:

```bash
npm run build:seed   # archive.zip -> public/seed.sqlite
```

`archive.zip` is the Kaggle download, unmodified.

## Deploying

Deploys to Vercel with no configuration and no environment variables: the whole
app is static. `npm run build` copies the SQLite WASM runtime out of
`node_modules` into `public/sqlite/` (gitignored) and then builds the site.

## How a student's database works

- On first visit the browser downloads `seed.sqlite` (~2 MB, cached) and copies
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
npm test        # CSV parsing, normalisation, query history
npm run typecheck
```
