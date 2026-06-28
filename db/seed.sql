create table if not exists customers (
  id serial primary key,
  name text not null,
  email text not null unique,
  city text not null,
  tier text not null check (tier in ('standard', 'gold', 'platinum')),
  created_at date not null
);

create table if not exists products (
  id serial primary key,
  sku text not null unique,
  name text not null,
  category text not null,
  unit_price numeric(10, 2) not null,
  inventory_count integer not null
);

create table if not exists orders (
  id serial primary key,
  customer_id integer not null references customers (id),
  product_id integer not null references products (id),
  quantity integer not null check (quantity > 0),
  ordered_at timestamp not null
);

truncate table orders, customers, products restart identity;

insert into customers (name, email, city, tier, created_at) values
  ('Ava Carter', 'ava@example.com', 'Seattle', 'gold', '2024-02-10'),
  ('Leo Kim', 'leo@example.com', 'Austin', 'standard', '2024-03-21'),
  ('Mia Patel', 'mia@example.com', 'Chicago', 'platinum', '2024-01-06'),
  ('Noah Diaz', 'noah@example.com', 'Denver', 'gold', '2024-04-18'),
  ('Ella Brown', 'ella@example.com', 'Boston', 'standard', '2024-05-02');

insert into products (sku, name, category, unit_price, inventory_count) values
  ('ESP-001', 'Espresso Machine', 'appliances', 249.00, 18),
  ('GRN-002', 'Coffee Grinder', 'appliances', 89.00, 44),
  ('MUG-003', 'Stoneware Mug', 'home', 18.50, 140),
  ('BEAN-004', 'Colombian Beans 1kg', 'grocery', 27.00, 72),
  ('FLT-005', 'Paper Filter Pack', 'grocery', 9.50, 220);

insert into orders (customer_id, product_id, quantity, ordered_at) values
  (1, 1, 1, '2025-01-03 09:15:00'),
  (1, 4, 2, '2025-01-17 11:20:00'),
  (2, 3, 4, '2025-02-02 15:40:00'),
  (3, 2, 1, '2025-02-09 08:55:00'),
  (3, 1, 1, '2025-03-14 10:05:00'),
  (4, 5, 6, '2025-03-18 13:25:00'),
  (4, 4, 3, '2025-04-01 17:10:00'),
  (5, 3, 2, '2025-04-22 14:48:00'),
  (2, 4, 1, '2025-05-11 16:05:00'),
  (5, 5, 8, '2025-05-24 09:32:00'),
  (1, 2, 1, '2025-06-02 12:12:00'),
  (3, 4, 2, '2025-06-17 18:44:00');
