import type { SampleQuery } from "@/lib/types";

export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: "recent-orders",
    title: "Recent orders by customer",
    description: "Join customers and products to inspect the newest orders.",
    sql: `select
  o.id,
  c.name as customer_name,
  p.name as product_name,
  o.quantity,
  o.ordered_at
from orders o
join customers c on c.id = o.customer_id
join products p on p.id = o.product_id
order by o.ordered_at desc
limit 12;`,
  },
  {
    id: "revenue-by-category",
    title: "Revenue by category",
    description: "Aggregate estimated revenue grouped by product category.",
    sql: `select
  p.category,
  round(sum(o.quantity * p.unit_price), 2) as revenue
from orders o
join products p on p.id = o.product_id
group by p.category
order by revenue desc;`,
  },
  {
    id: "vip-customers",
    title: "VIP customer snapshot",
    description: "See higher-tier customers and how many orders they placed.",
    sql: `select
  c.name,
  c.city,
  c.tier,
  count(o.id) as orders_placed
from customers c
left join orders o on o.customer_id = c.id
where c.tier in ('gold', 'platinum')
group by c.id
order by orders_placed desc, c.name asc;`,
  },
];
