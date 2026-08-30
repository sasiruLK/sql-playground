/**
 * Builds public/seed.sqlite from the Kaggle Superstore archive.
 *
 * Run locally with `npm run build:seed` and commit the result. The deployed
 * build never runs this: it just serves the committed database file.
 */
import { readFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseCsv } from "../lib/seed/csv";
import { normalizeSuperstore } from "../lib/seed/normalize";

// npm scripts always run from the package root.
const ROOT = process.cwd();
const ARCHIVE = join(ROOT, "archive.zip");
const OUTPUT = join(ROOT, "public", "seed.sqlite");

const SCHEMA = `
create table customers (
  id       text primary key,
  name     text not null,
  segment  text not null
);

create table products (
  id           text primary key,
  name         text not null,
  category     text not null,
  sub_category text not null
);

create table orders (
  id          text primary key,
  customer_id text not null references customers (id),
  order_date  text not null,
  ship_date   text not null,
  ship_mode   text not null,
  country     text not null,
  city        text not null,
  state       text not null,
  postal_code text,
  region      text not null
);

create table order_items (
  id         integer primary key,
  order_id   text not null references orders (id),
  product_id text not null references products (id),
  sales      real not null,
  quantity   integer not null,
  discount   real not null,
  profit     real not null
);

create index orders_customer_id on orders (customer_id);
create index order_items_order_id on order_items (order_id);
create index order_items_product_id on order_items (product_id);
`;

/** Reads one file out of a zip archive via its central directory. */
function readFromZip(archivePath: string, wantedName: string): Buffer {
  const zip = readFileSync(archivePath);

  let end = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error(`${archivePath} is not a zip archive (no end-of-central-directory).`);
  }

  const entryCount = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);

  for (let entry = 0; entry < entryCount; entry++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Corrupt zip central directory.");
    }

    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (name === wantedName) {
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = zip.subarray(start, start + compressedSize);

      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`Unsupported zip compression method ${method}.`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`${wantedName} is not in ${archivePath}.`);
}

const csv = readFromZip(ARCHIVE, "Sample - Superstore.csv");

// The Kaggle export is latin-1: customer names carry accented characters that
// would otherwise decode as replacement characters.
const seed = normalizeSuperstore(parseCsv(new TextDecoder("latin1").decode(csv)));

mkdirSync(join(ROOT, "public"), { recursive: true });
rmSync(OUTPUT, { force: true });

const db = new DatabaseSync(OUTPUT);
db.exec("pragma journal_mode = delete");
db.exec(SCHEMA);

const insert = {
  customers: db.prepare("insert into customers values (?, ?, ?)"),
  products: db.prepare("insert into products values (?, ?, ?, ?)"),
  orders: db.prepare("insert into orders values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  orderItems: db.prepare("insert into order_items values (?, ?, ?, ?, ?, ?, ?)"),
};

db.exec("begin");
for (const customer of seed.customers) {
  insert.customers.run(customer.id, customer.name, customer.segment);
}
for (const product of seed.products) {
  insert.products.run(product.id, product.name, product.category, product.sub_category);
}
for (const order of seed.orders) {
  insert.orders.run(
    order.id,
    order.customer_id,
    order.order_date,
    order.ship_date,
    order.ship_mode,
    order.country,
    order.city,
    order.state,
    order.postal_code,
    order.region,
  );
}
for (const item of seed.orderItems) {
  insert.orderItems.run(
    item.id,
    item.order_id,
    item.product_id,
    item.sales,
    item.quantity,
    item.discount,
    item.profit,
  );
}
db.exec("commit");
db.exec("vacuum");
db.close();

const bytes = statSync(OUTPUT).size;
console.log(
  [
    `customers   ${seed.customers.length}`,
    `products    ${seed.products.length}`,
    `orders      ${seed.orders.length}`,
    `order_items ${seed.orderItems.length}`,
    `-> public/seed.sqlite (${(bytes / 1024 / 1024).toFixed(2)} MB)`,
  ].join("\n"),
);
