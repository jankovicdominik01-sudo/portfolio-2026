-- Lead Engine 4.0 — polia pridané po Lead Radar 3.0 / Opportunity Engine.
-- Táto migrácia dorovnáva Supabase schému s aktuálnym LeadSchema pred presunom produkcie z Vercel Blob.

alter table leads add column if not exists interest jsonb;
alter table leads add column if not exists opportunity jsonb;
alter table leads add column if not exists channel_decision jsonb;
alter table leads add column if not exists demo jsonb;
alter table leads add column if not exists ads_check jsonb;

create index if not exists leads_assigned_to_idx on leads (assigned_to);
create index if not exists leads_next_action_idx on leads (next_action);
