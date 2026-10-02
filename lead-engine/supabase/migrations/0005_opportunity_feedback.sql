-- Lead Engine Phase 2 — spätná väzba operátora na predpoklady Opportunity Engine.
-- Iba additive, idempotentné. Existujúce leady fungujú aj bez stĺpca (null).
-- Obsah JSONB validuje aplikácia (lib/types.ts OpportunityFeedbackSchema).

alter table leads add column if not exists opportunity_feedback jsonb;
