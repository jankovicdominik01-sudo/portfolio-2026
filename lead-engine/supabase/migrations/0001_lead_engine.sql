-- DJWeby Lead Engine — schéma pre Supabase (Postgres)
-- Aplikácia pristupuje výhradne zo servera cez service role key.
-- RLS je zapnuté bez politík => anon/authenticated kľúč nemá prístup k ničomu.

create table if not exists companies (
  id              text primary key,
  name            text not null,
  category        text not null default 'ine',
  city            text,
  region          text,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  website         text,
  social_profiles text[] not null default '{}',
  dedupe_keys     text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists companies_dedupe_keys_idx on companies using gin (dedupe_keys);

create table if not exists leads (
  id               text primary key,
  company_id       text not null references companies(id) on delete cascade,
  status           text not null default 'new',
  priority         text not null default 'check',
  priority_reasons text[] not null default '{}',
  source           text not null default 'manual',
  source_url       text,
  assigned_to      text,
  analysis         jsonb,
  call_brief       jsonb,
  trust            jsonb not null default '{"web":"unverified","phone":"unverified","company":"unverified","hook":"unverified"}',
  qualification    jsonb,
  next_action      text,
  next_action_at   timestamptz,
  last_contact     timestamptz,
  call_attempts    int not null default 0,
  archive_reason   text,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists leads_status_idx on leads (status);
create index if not exists leads_company_idx on leads (company_id);

create table if not exists calls (
  id               text primary key,
  lead_id          text not null references leads(id) on delete cascade,
  created_at       timestamptz not null default now(),
  "by"             text not null,
  role             text not null,
  outcome          text not null,
  note             text,
  company_said     text,
  dominik_may_call boolean not null default false,
  preferred_time   text,
  email            text
);
create index if not exists calls_lead_idx on calls (lead_id, created_at desc);

create table if not exists lead_events (
  id       text primary key,
  lead_id  text not null references leads(id) on delete cascade,
  at       timestamptz not null default now(),
  actor    text not null,
  kind     text not null,
  label    text not null
);
create index if not exists lead_events_lead_idx on lead_events (lead_id, at);

-- existing_offer: reálne rozpracované weby. available=false => argument sa nezobrazí.
create table if not exists offers (
  id              text primary key,
  category        text not null,
  available       boolean not null default true,
  estimated_price int,
  note            text not null default '',
  preview_url     text,
  created_at      timestamptz not null default now()
);

create table if not exists notifications (
  id       text primary key,
  at       timestamptz not null default now(),
  lead_id  text references leads(id) on delete cascade,
  kind     text not null,
  title    text not null,
  body     text not null default '',
  read     boolean not null default false
);

alter table companies     enable row level security;
alter table leads         enable row level security;
alter table calls         enable row level security;
alter table lead_events   enable row level security;
alter table offers        enable row level security;
alter table notifications enable row level security;

insert into offers (id, category, available, estimated_price, note)
values ('offer_zahradnictvo', 'zahradnictvo', true, 300, 'Rozpracovaný koncept webu pre záhradníctvo / záhradné služby')
on conflict (id) do nothing;
