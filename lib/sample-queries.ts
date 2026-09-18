import type { SampleQuery } from "@/lib/types";

export const DEFAULT_QUERY = `select
  c.CategoryName,
  count(distinct o.OrderID) as orders,
  sum(i.Quantity) as units,
  round(sum(i.LineTotal_LKR), 2) as revenue_lkr
from OrderItems i
join OrderHeader o on o.OrderID = i.OrderID
join Products p on p.ProductID = i.ProductID
join Categories c on c.CategoryID = p.CategoryID
group by c.CategoryName
order by revenue_lkr desc;`;

export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: "browse",
    title: "Browse the catalogue",
    description: "A plain SELECT with a filter and a limit.",
    sql: `select ProductName, UnitPrice_LKR, ReorderLevel
from Products
where Discontinued = 'No'
order by UnitPrice_LKR desc
limit 20;`,
  },
  {
    id: "aggregate",
    title: "Group and aggregate",
    description: "Revenue per payment method, with a running count.",
    sql: `select
  PaymentMethod,
  count(*) as orders,
  round(avg(OrderTotal_LKR), 2) as avg_order_lkr,
  round(sum(OrderTotal_LKR), 2) as total_lkr
from OrderHeader
where OrderStatus <> 'Cancelled'
group by PaymentMethod
order by total_lkr desc;`,
  },
  {
    id: "join",
    title: "Join five tables",
    description: "Customer to order to line to product to supplier.",
    sql: `select
  c.FirstName || ' ' || c.LastName as customer,
  o.OrderDate,
  p.ProductName,
  s.SupplierName,
  i.Quantity,
  i.LineTotal_LKR
from Customers c
join OrderHeader o on o.CustomerID = c.CustomerID
join OrderItems i on i.OrderID = o.OrderID
join Products p on p.ProductID = i.ProductID
join Suppliers s on s.SupplierID = p.SupplierID
order by o.OrderDate desc
limit 25;`,
  },
  {
    id: "left-join",
    title: "Find who is missing",
    description: "Eight customers have never ordered. Only a LEFT JOIN shows them.",
    sql: `select
  c.CustomerID,
  c.FirstName || ' ' || c.LastName as customer,
  c.City,
  count(o.OrderID) as orders
from Customers c
left join OrderHeader o on o.CustomerID = c.CustomerID
group by c.CustomerID
having orders = 0
order by customer;`,
  },
  {
    id: "nulls",
    title: "Work with NULLs",
    description: "Processing and cancelled orders have no ship date.",
    sql: `select
  OrderStatus,
  count(*) as orders,
  sum(ShipDate is null) as awaiting_shipment,
  round(avg(julianday(ShipDate) - julianday(OrderDate)), 1) as avg_days_to_ship
from OrderHeader
group by OrderStatus
order by orders desc;`,
  },
  {
    id: "dates",
    title: "Work with dates",
    description: "Dates are stored ISO, so strftime works.",
    sql: `select
  strftime('%Y-%m', o.OrderDate) as month,
  count(distinct o.OrderID) as orders,
  round(sum(i.LineTotal_LKR), 2) as revenue_lkr
from OrderHeader o
join OrderItems i on i.OrderID = o.OrderID
group by month
order by month;`,
  },
  {
    id: "reorder",
    title: "Which products need restocking",
    description: "Aggregate across warehouses, then compare with HAVING.",
    sql: `select
  p.ProductName,
  p.ReorderLevel,
  sum(st.QuantityOnHand) as on_hand,
  count(st.WarehouseID) as warehouses
from Products p
join Stock st on st.ProductID = p.ProductID
group by p.ProductID
having on_hand < p.ReorderLevel
order by on_hand;`,
  },
  {
    id: "verify",
    title: "Check the order totals",
    description: "Rebuild OrderTotal_LKR from the lines and confirm it matches.",
    sql: `select
  o.OrderID,
  o.OrderTotal_LKR,
  round(sum(i.LineTotal_LKR) + o.ShippingFee_LKR, 2) as rebuilt_lkr
from OrderHeader o
join OrderItems i on i.OrderID = o.OrderID
group by o.OrderID
order by o.OrderID
limit 25;`,
  },
  {
    id: "write",
    title: "Change something",
    description: "This is your own database - writes are allowed.",
    sql: `update Products
set UnitPrice_LKR = UnitPrice_LKR * 1.1
where CategoryID = 'CAT-01';

select ProductID, ProductName, UnitPrice_LKR
from Products
where CategoryID = 'CAT-01'
limit 10;`,
  },
];
