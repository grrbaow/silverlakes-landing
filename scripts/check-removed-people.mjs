/**
 * Build-time guard: people who have asked to be off this site must stay off.
 *
 * WHY THIS EXISTS
 * Iain Gulin asked to be removed from the team section three times (27 Jun, 10 Aug,
 * 11 Aug 2026) because he kept reappearing. He was not imagining it. Two different
 * things put him back:
 *
 *   1. The 27 Jun removal was edited into a local working tree and deployed straight
 *      out with `vercel --prod`. It was never committed, so it existed on one machine
 *      only and any clean clone still had him.
 *   2. The 11 Aug 21:26 production deploy was built from `build6-dwell`, a branch cut
 *      BEFORE the removal commit, which silently overwrote it.
 *
 * Both share a root cause: this project has no GitHub integration (verified 15 Aug
 * 2026, `link.type` is null), so deploys come from whatever local tree the operator
 * happens to be on rather than from one source of truth.
 *
 * Branch hygiene and documentation do not cover an unpushed local tree. A build-time
 * assertion does, because it runs inside `npm run build`, which every deploy path goes
 * through including `vercel --prod` from a dirty local directory. That turns "please
 * do not re-add him" into something that cannot ship.
 *
 * TO REMOVE SOMEONE FROM THIS LIST
 * Only when the person themselves asks to be put back. Delete their entry, and their
 * card can then be added to app/page.tsx normally.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BLOCKED = [
  {
    name: 'Iain Gulin',
    // Unambiguous markers only. Do not use a bare "Iain": the disposable-email-domains
    // package contains "iainsinclair.ru", which is unrelated and would false-trip this.
    patterns: [/Iain\s+Gulin/i, /iain@threelionscapital/i],
    asked: 'asked to be removed 27 Jun, 10 Aug and 11 Aug 2026',
  },
];

// Only scan what actually renders. Deliberately excludes markdown, so CLAUDE.md can
// carry the "do not re-add Iain" note without tripping its own guard.
const ROOTS = ['app', 'lib', 'components'];
const EXTS = new Set(['.tsx', '.ts', '.jsx', '.js']);

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // an optional root that does not exist is fine
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (EXTS.has(extname(full))) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap(walk);
const hits = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const person of BLOCKED) {
      if (person.patterns.some((p) => p.test(line))) {
        hits.push({ person, file, line: i + 1, text: line.trim().slice(0, 120) });
      }
    }
  });
}

if (hits.length > 0) {
  console.error('\n\x1b[31mBUILD BLOCKED — a person who asked to be removed is back in the source.\x1b[0m\n');
  for (const h of hits) {
    console.error(`  ${h.person.name} (${h.person.asked})`);
    console.error(`    ${h.file}:${h.line}`);
    console.error(`    ${h.text}\n`);
  }
  console.error('This has already gone out to the client twice. Do not bypass it.');
  console.error('If they asked to come back, remove their entry from');
  console.error('scripts/check-removed-people.mjs and say so in the commit message.\n');
  process.exit(1);
}

console.log(`check-removed-people: OK (${files.length} source files scanned, ${BLOCKED.length} on the list)`);
