import exactDomains from 'disposable-email-domains/index.json';
import wildcardDomains from 'disposable-email-domains/wildcard.json';

// Providers to block that the upstream list has not caught yet. Add a domain
// here and redeploy to block a newly-spotted temp-mail service immediately,
// without waiting for a `disposable-email-domains` package bump. Lowercase,
// registrable domain only (e.g. 'newtempmail.com', not '@newtempmail.com').
const EXTRA_DISPOSABLE_DOMAINS: readonly string[] = [];

// Built once per server/lambda cold start. Membership lookups are O(1).
const blockedDomains = new Set<string>([
  ...(exactDomains as string[]),
  ...(wildcardDomains as string[]),
  ...EXTRA_DISPOSABLE_DOMAINS,
]);

export function extractEmailDomain(email: string): string {
  return email.toLowerCase().trim().split('@')[1] ?? '';
}

// True when the email's domain — or any of its parent domains — is a known
// disposable / temporary mailbox provider. Walking parents catches subdomain
// addresses (e.g. user@x.mailinator.com), stopping at the registrable domain
// (last two labels) so a bare TLD can never match.
export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  const labels = domain.split('.');
  for (let i = 0; i <= labels.length - 2; i++) {
    if (blockedDomains.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}
