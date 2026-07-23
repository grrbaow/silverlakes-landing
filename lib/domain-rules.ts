import { supabaseAdmin } from '@/lib/supabase';
import type { DomainOverrides } from '@/lib/disposable-email';

// Resolve the admin-managed block/allow rules that apply to one email's
// candidate domains. Also treats any matching sl_allowlist domain as `allow`,
// so a domain an admin explicitly trusts is never blocked as "disposable".
//
// Fail-safe: on any DB error this returns empty sets, so validation degrades to
// the static disposable list rather than failing open and letting everything in.
export async function fetchDomainOverrides(candidates: string[]): Promise<DomainOverrides> {
  const block = new Set<string>();
  const allow = new Set<string>();
  if (candidates.length === 0) return { block, allow };

  const [overrides, allowlist] = await Promise.all([
    supabaseAdmin.from('sl_disposable_overrides').select('domain, action').in('domain', candidates),
    supabaseAdmin.from('sl_allowlist').select('email').in('email', candidates),
  ]);

  for (const row of overrides.data ?? []) {
    if (row.action === 'allow') allow.add(row.domain);
    else block.add(row.domain);
  }
  // An admin-allowlisted domain is, by definition, trusted — never disposable.
  for (const row of allowlist.data ?? []) allow.add(row.email);

  return { block, allow };
}
