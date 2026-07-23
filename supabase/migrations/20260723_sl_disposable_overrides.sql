-- Admin-managed overrides for disposable-email detection at the data-room gate.
-- One row per domain. action='block' adds a temp-mail provider the bundled list
-- misses; action='allow' force-permits a domain the list wrongly flags.
-- Managed from /admin (Email Rules tab). See lib/domain-rules.ts.

create table if not exists sl_disposable_overrides (
  id       uuid primary key default gen_random_uuid(),
  domain   text not null unique,
  action   text not null default 'block' check (action in ('block', 'allow')),
  notes    text,
  added_at timestamptz not null default now()
);

create index if not exists sl_disposable_overrides_domain_idx
  on sl_disposable_overrides (domain);
