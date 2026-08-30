import type { SampleQuery } from "@/lib/types";

export const DEFAULT_QUERY = `select
  o.region,
  count(distinct o.id) as orders,
  round(sum(i.sales), 2) as sales,
  round(sum(i.profit), 2) as profit
from orders o
join order_items i on i.order_id = o.id
group by o.region
order by profit desc;`;

export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: "browse",
    title: "Browse the products",
    description: "A plain SELECT with a filter and a limit.",
    sql: `select name, category, sub_category
from products
where category = 'Furniture'
limit 20;`,
  },
  {
    id: "aggregate",
    title: "Group and aggregate",
    description: "Count and sum per category.",
    sql: `select
  p.category,
  count(*) as line_items,
  round(sum(i.sales), 2) as sales
from order_items i
join products p on p.id = i.product_id
group by p.category
order by sales desc;`,
  },
  {
    id: "join",
    title: "Join four tables",
    description: "Customers, orders, items and products together.",
    sql: `select
  c.name as customer,
  o.order_date,
  p.name as product,
  i.quantity,
  i.sales
from customers c
join orders o on o.customer_id = c.id
join order_items i on i.order_id = o.id
join products p on p.id = i.product_id
order by o.order_date desc
limit 25;`,
  },
  {
    id: "loss-makers",
    title: "Find the loss makers",
    description: "HAVING on an aggregate, over a join.",
    sql: `select
  p.name as product,
  round(sum(i.profit), 2) as profit,
  sum(i.quantity) as units
from order_items i
join products p on p.id = i.product_id
group by p.id
having sum(i.profit) < -1000
order by profit;`,
  },
  {
    id: "dates",
    title: "Work with dates",
    description: "Dates are stored ISO, so strftime works.",
    sql: `select
  strftime('%Y', o.order_date) as year,
  count(distinct o.id) as orders,
  round(sum(i.sales), 2) as sales
from orders o
join order_items i on i.order_id = o.id
group by year
order by year;`,
  },
  {
    id: "write",
    title: "Change something",
    description: "This is your own database - writes are allowed.",
    sql: `update products
set name = 'My renamed product'
where id = 'FUR-BO-10001798';

select id, name from products where id = 'FUR-BO-10001798';`,
  },
];
