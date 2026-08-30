export type Customer = {
  id: string;
  name: string;
  segment: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  sub_category: string;
};

export type Order = {
  id: string;
  customer_id: string;
  order_date: string;
  ship_date: string;
  ship_mode: string;
  country: string;
  city: string;
  state: string;
  postal_code: string | null;
  region: string;
};

export type OrderItem = {
  id: number;
  order_id: string;
  product_id: string;
  sales: number;
  quantity: number;
  discount: number;
  profit: number;
};

export type SeedData = {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  orderItems: OrderItem[];
};

const REQUIRED_COLUMNS = [
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
] as const;

/** Superstore ships dates as M/D/YYYY, which SQLite's date functions cannot read. */
export function toIsoDate(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());

  if (!match) {
    throw new Error(`Unrecognised date: ${JSON.stringify(value)}`);
  }

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toNumber(value: string, column: string): number {
  // Number("") is 0, which would silently seed a blank cell as a real value.
  const parsed = value === "" ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Unrecognised number in ${column}: ${JSON.stringify(value)}`);
  }

  return parsed;
}

/**
 * Folds the flat Superstore export into four tables.
 *
 * Two quirks of the source data drive the shape here. The shipping address
 * varies per order rather than per customer (780 of 793 customers ship to more
 * than one city), so it lives on `orders`. And 32 product ids carry two
 * different product names, so the first occurrence wins to keep the id a usable
 * primary key.
 */
export function normalizeSuperstore(rows: string[][]): SeedData {
  const [header, ...body] = rows;

  if (!header) {
    throw new Error("The CSV is empty.");
  }

  const index = new Map(header.map((column, position) => [column.trim(), position]));

  for (const column of REQUIRED_COLUMNS) {
    if (!index.has(column)) {
      throw new Error(`The CSV is missing the ${column} column.`);
    }
  }

  const at = (row: string[], column: (typeof REQUIRED_COLUMNS)[number]) =>
    (row[index.get(column)!] ?? "").trim();

  const customers = new Map<string, Customer>();
  const products = new Map<string, Product>();
  const orders = new Map<string, Order>();
  const orderItems: OrderItem[] = [];

  for (const row of body) {
    if (row.length === 1 && row[0] === "") {
      continue;
    }

    const customerId = at(row, "Customer ID");
    if (!customers.has(customerId)) {
      customers.set(customerId, {
        id: customerId,
        name: at(row, "Customer Name"),
        segment: at(row, "Segment"),
      });
    }

    const productId = at(row, "Product ID");
    if (!products.has(productId)) {
      products.set(productId, {
        id: productId,
        name: at(row, "Product Name"),
        category: at(row, "Category"),
        sub_category: at(row, "Sub-Category"),
      });
    }

    const orderId = at(row, "Order ID");
    if (!orders.has(orderId)) {
      const postalCode = at(row, "Postal Code");

      orders.set(orderId, {
        id: orderId,
        customer_id: customerId,
        order_date: toIsoDate(at(row, "Order Date")),
        ship_date: toIsoDate(at(row, "Ship Date")),
        ship_mode: at(row, "Ship Mode"),
        country: at(row, "Country"),
        city: at(row, "City"),
        state: at(row, "State"),
        postal_code: postalCode === "" ? null : postalCode,
        region: at(row, "Region"),
      });
    }

    orderItems.push({
      id: orderItems.length + 1,
      order_id: orderId,
      product_id: productId,
      sales: toNumber(at(row, "Sales"), "Sales"),
      quantity: toNumber(at(row, "Quantity"), "Quantity"),
      discount: toNumber(at(row, "Discount"), "Discount"),
      profit: toNumber(at(row, "Profit"), "Profit"),
    });
  }

  return {
    customers: [...customers.values()],
    products: [...products.values()],
    orders: [...orders.values()],
    orderItems,
  };
}
