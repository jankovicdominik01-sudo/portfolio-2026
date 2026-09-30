-- Lead Engine 3.0 / Lead Radar — overená entita, stav webu, kvalita dát, routing na operátora, feedback.
-- Produkcia beží na Vercel Blob; tento súbor drží Supabase adaptér v zhode s modelom.

alter table companies add column if not exists country text;
alter table companies add column if not exists profile jsonb;
create index if not exists companies_country_idx on companies (country);

alter table leads add column if not exists website_resolution text;
alter table leads add column if not exists data_quality text;
alter table leads add column if not exists recommended_caller text;
alter table leads add column if not exists caller_fit jsonb;
alter table leads add column if not exists commercial_problem text;
alter table leads add column if not exists exploration boolean;
alter table leads add column if not exists feedback jsonb not null default '[]';
alter table leads add column if not exists needs_reverify boolean;
alter table leads add column if not exists stage_at jsonb;
