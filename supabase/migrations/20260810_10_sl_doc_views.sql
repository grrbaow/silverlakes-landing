-- Build 6.2 / A4 — per-document DWELL time (how long a doc stayed open in the in-app viewer).
-- Written by /api/track-dwell, scoped to the viewer's own session email. Already applied on
-- the project via the management API; kept here for repo record. Feeds the CRM engagement loop.
create table if not exists sl_doc_views (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  file_path    text not null,
  opened_at    timestamptz not null default now(),
  duration_ms  integer not null default 0,
  pages        integer,
  closed_reason text,           -- 'close' | 'hidden' | 'unload' | 'switch'
  ip_address   text,
  created_at   timestamptz not null default now()
);
alter table sl_doc_views enable row level security;  -- service-role only, like the access_log
create index if not exists idx_sl_doc_views_email on sl_doc_views (email, opened_at desc);
create index if not exists idx_sl_doc_views_file  on sl_doc_views (file_path);
