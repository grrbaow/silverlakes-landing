# SilverLakes Landing Page — CLAUDE.md

## Project Overview
Investor landing page for SilverLakes Equestrian & Sports Park (Norco, CA). Built for Three Lions Capital. Deployed to Vercel.

- **Repo:** github.com/grrbaow/silverlakes-landing (the old `shrey987/silverlakes-landing`
  remote still works but only via a redirect — update your remote when convenient)
- **Vercel project:** `silverlakes-landing` (team: grrow, ID: `prj_JXxpO6lTqZHcMbZagsBoyDQGxY5p`)
- **Deploy:** `vercel --prod` from a clean `main`. See Deployment Process.
- **Framework:** Next.js 14 App Router
- **Commit identity:** must be `shrey@grrbaow.com` or Vercel blocks the deploy. The repo is
  pinned via `git config user.email`, so do not override it with `-c user.email` on a merge.

---

## Folder Structure

```
app/
  page.tsx          — Main landing page (all sections as JSX)
  globals.css       — All CSS including section-specific classes
  layout.tsx        — Root layout
  LandingScripts.tsx — Client-side scroll/animation scripts
  access/           — Investor access page
  admin/            — Admin dashboard
  data-room/        — Data room viewer
  sign-nda/         — NDA signing flow
  api/
    admin/          — Admin API routes
    check-access/   — Access verification
    data-room/      — Data room API
    send-otp/       — OTP send
    sign-nda/       — NDA submission
    verify-otp/     — OTP verify

public/
  catchment-map.html            — Leaflet map: 30/60/90-mile population rings (standalone HTML, embedded via iframe)
  strategically-accessible-map.html — Leaflet map: cities, airports, attractions around SilverLakes (embedded via iframe)
  img/                          — Images
  nda.pdf                       — NDA document

lib/                — Shared utilities
middleware.ts       — Auth middleware
next.config.js      — Next config (pdf-lib, bcryptjs etc. as external packages)
vercel.json         — Vercel config
```

---

## Key Patterns

### Maps
Both maps are **standalone HTML files** in `public/`, embedded in `page.tsx` via `<iframe src="/catchment-map.html">` etc. This avoids Next.js SSR issues with Leaflet.

- CARTO `light_nolabels` tile layer on strategically-accessible map (no overlapping base labels)
- `scrollWheelZoom: true` on both maps
- SilverLakes coordinates: `[33.9530944, -117.5540374]`

### Sections in page.tsx (order top→bottom)
1. Hero / header
2. Investment highlights / key stats
3. Programming & Revenue Activation (4-column grid: Outdoor Fields, Indoor Arena, Pickleball, Elite Training)
4. Untapped Revenue Vectors (5 cards: Naming Rights, Food Hall, Concerts, Drop-In, Technology)
5. Population Catchment (iframe: catchment-map.html)
6. Strategically Accessible (iframe + 4 bullet points)
7. Fully Entitled section
8. Shovel-Ready Upside section
9. Team section (3 team members, see Team below)
10. Data Room CTA / footer

### Team
3 members, in this order: Brett M. Johnson (Co-Founder & Partner), Berke Bakay (Co-Founder & Partner),
Abdullah Mohsin (Associate).

DO NOT ADD Iain Gulin. He asked to be taken off the site on 10 Aug 2026 and asked again on 11 Aug
after a stale-branch deploy put him back. He stays off until he himself asks to be restored.
Anyone re-adding a fourth card, or deploying a branch cut before 6a0cb3d, reintroduces him.

Team grid: `repeat(4, 1fr)` in globals.css (unchanged, 3 cards sit in it fine)

### CSS Classes (key additions)
`.prog-grid`, `.prog-col`, `.prog-col-header`, `.prog-item` — Programming section
`.rv-grid`, `.rv-card`, `.rv-phase`, `.rv-title`, `.rv-amount`, `.rv-margin` — Revenue Vectors
`.map-frame` — iframe styling (height: 480px)
`.access-bullets` — bullet points below Strategically Accessible map
`.entitled-grid`, `.entitled-item` — Fully Entitled section
`.shovel-grid`, `.shovel-card` — Shovel-Ready section

---

## Deployment Process

**There is NO GitHub auto-deploy on this project.** Verified 15 Aug 2026: the Vercel project
has no git integration at all (`link.type` is null in `GET /v9/projects/<id>`). Pushing to
`main` deploys NOTHING. An earlier version of this file claimed push-to-main auto-deploys and
told you never to use the CLI. That was wrong, and it is how a stale tree reached production.

Deploying is therefore a deliberate manual act from a local tree, which is exactly why the
staleness check below matters.

1. Make changes, `git add`, `git commit`
2. `git push origin main` (source of truth, does not deploy)
3. Confirm the tree is a superset of production, see below
4. `vercel --prod --yes --token="$VERCEL_TOKEN" --scope=grrow`
5. Fetch the live URL and confirm the change is actually served

If someone reconnects the GitHub integration later, update this section.

### Never deploy a branch that is behind main
On 11 Aug 2026 a production deploy was made from `build6-dwell`, a branch cut BEFORE the
commit that removed Iain Gulin. It overwrote the good deploy and put his name back on the
live site. The client noticed and had to ask twice.

`main` is the ONLY production branch. Before promoting any other branch, check what it drops:

    git rev-list --count <branch>..origin/main    # commits main has that this branch LACKS

If that is not 0, the branch is stale and deploying it REMOVES live work. Merge main into it
first. A build is only safe to promote when it is a superset of what production already serves.

---

## Last Updated
2026-08-15 — Iain Gulin removed from the team section for the second time, and the cause fixed.
A `vercel --prod` from the stale `build6-dwell` branch had overwritten the removal. Merged that
branch into `main` (and `main` back into it) so both carry the removal plus the dwell tracking,
corrected the false auto-deploy instructions above, and pinned the commit identity.

2026-05-08 — Map fixes: catchment center corrected, stat cards removed, Disney CA Adventure removed from accessible map, labels got opaque backgrounds, both maps now scroll-zoomable.
