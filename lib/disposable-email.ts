import exactDomains from 'disposable-email-domains/index.json';
import wildcardDomains from 'disposable-email-domains/wildcard.json';

// Providers to block that the upstream list has not caught yet. This is the
// code-level fallback; day-to-day the team manages domains from the admin
// dashboard (sl_disposable_overrides, see lib/domain-rules.ts) with no deploy.
// Lowercase, registrable domain only (e.g. 'newtempmail.com', not '@newtempmail.com').
const EXTRA_DISPOSABLE_DOMAINS: readonly string[] = [];

// Built once per server/lambda cold start. Membership lookups are O(1).
const staticBlockList = new Set<string>([
  ...(exactDomains as string[]),
  ...(wildcardDomains as string[]),
  ...EXTRA_DISPOSABLE_DOMAINS,
]);

// Admin-managed rules, resolved per request from the database.
// `allow` always wins over any block (static or admin), so a legitimate domain
// wrongly flagged by the list can always be rescued without a code change.
export interface DomainOverrides {
  block?: Set<string>;
  allow?: Set<string>;
}

export function extractEmailDomain(email: string): string {
  return email.toLowerCase().trim().split('@')[1] ?? '';
}

// The domain plus each parent, down to the registrable domain (last two
// labels) so a bare TLD can never match. e.g. "a.b.mailinator.com" ->
// ["a.b.mailinator.com", "b.mailinator.com", "mailinator.com"].
export function candidateDomains(email: string): string[] {
  const domain = extractEmailDomain(email);
  if (!domain) return [];
  const labels = domain.split('.');
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join('.'));
  return out;
}

// True when the email's domain — or any parent domain — is a known disposable /
// temporary mailbox provider. Precedence: an `allow` override beats everything;
// otherwise the static list or a `block` override triggers a block.
export function isDisposableEmail(email: string, overrides: DomainOverrides = {}): boolean {
  const candidates = candidateDomains(email);
  if (candidates.length === 0) return false;

  const { allow, block } = overrides;
  if (allow && candidates.some((d) => allow.has(d))) return false;

  return candidates.some((d) => staticBlockList.has(d) || (block ? block.has(d) : false));
}
