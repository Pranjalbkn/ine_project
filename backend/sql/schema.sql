create table if not exists tracked_products (
  product_id integer primary key check (product_id > 0),
  name text not null,
  brand text not null,
  category text not null,
  sku text not null,
  tracked_at timestamptz not null default now()
);

create table if not exists price_history (
  id bigint generated always as identity primary key,
  product_id integer not null references tracked_products(product_id) on delete cascade,
  price integer not null check (price > 0),
  currency text not null,
  stock integer not null check (stock >= 0),
  scraped_at timestamptz not null,
  unique (product_id, scraped_at)
);
create index if not exists price_history_product_time_idx
  on price_history (product_id, scraped_at desc);

create table if not exists scrape_log (
  id bigint generated always as identity primary key,
  product_id integer not null references tracked_products(product_id) on delete cascade,
  run_id uuid not null,
  attempt integer not null check (attempt > 0),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  outcome text not null check (outcome in ('success', 'retried', 'failed')),
  error text,
  unique (run_id, attempt)
);
create index if not exists scrape_log_product_time_idx
  on scrape_log (product_id, started_at desc);
