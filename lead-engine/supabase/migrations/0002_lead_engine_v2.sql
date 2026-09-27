-- Lead Engine 2.0 — súhlas s kontaktom, predaj, provízie, nastavenia.
-- Produkcia dnes beží na Vercel Blob; tento súbor drží Supabase adaptér v zhode s modelom.
-- Prístup ostáva iba cez server (service role); RLS zapnuté bez politík.

alter table companies add column if not exists ico text;
alter table companies add column if not exists sources jsonb not null default '[]';
alter table companies add column if not exists do_not_call boolean not null default false;
create index if not exists companies_ico_idx on companies (ico);

alter table leads add column if not exists website_status text;
alter table leads add column if not exists website_issue text;
alter table leads add column if not exists website_checked_at timestamptz;
alter table leads add column if not exists business_check text;
alter table leads add column if not exists score jsonb;
alter table leads add column if not exists consent jsonb;
alter table leads add column if not exists sale jsonb;
alter table leads add column if not exists lost_reason text;
alter table leads add column if not exists assigned_history jsonb not null default '[]';

alter table calls add column if not exists by_user text;
alter table calls add column if not exists attempt int;

create table if not exists commissions (
  id           text primary key,
  "user"       text not null,
  lead_id      text not null references leads(id) on delete cascade,
  kind         text not null,
  amount       numeric,
  state        text not null,
  reason       text not null,
  sale_price   numeric,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  paid_at      timestamptz
);
create index if not exists commissions_user_idx on commissions ("user", created_at desc);

create table if not exists settings (
  id    text primary key,
  value jsonb not null
);

alter table commissions enable row level security;
alter table settings    enable row level security;
