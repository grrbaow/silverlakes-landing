# SilverLakes Landing Page — CLAUDE.md

## Project Overview
Investor landing page for SilverLakes Equestrian & Sports Park (Norco, CA). Built for Three Lions Capital. Deployed to Vercel.

- **Repo:** github.com/shrey987/silverlakes-landing
- **Vercel project:** `silverlakes-landing` (team: grrow, ID: `prj_JXxpO6lTqZHcMbZagsBoyDQGxY5p`)
- **Deploy:** Push to `main` on GitHub — Vercel auto-deploys. NEVER use manual Vercel API trigger.
- **Framework:** Next.js 14 App Router

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
9. Team section (4 columns: 4 team members including Iain Gulin)
10. Data Room CTA / footer

### Team
4 members: Brett Johnson (CEO), Berke Bakay (COO), [other], Iain Gulin (Partner — iain@threelionscapital.com)
Team grid: `repeat(4, 1fr)` in globals.css

### CSS Classes (key additions)
`.prog-grid`, `.prog-col`, `.prog-col-header`, `.prog-item` — Programming section
`.rv-grid`, `.rv-card`, `.rv-phase`, `.rv-title`, `.rv-amount`, `.rv-margin` — Revenue Vectors
`.map-frame` — iframe styling (height: 480px)
`.access-bullets` — bullet points below Strategically Accessible map
`.entitled-grid`, `.entitled-item` — Fully Entitled section
`.shovel-grid`, `.shovel-card` — Shovel-Ready section

---

## Deployment Process
1. Make changes to files
2. `git add <files>`
3. `git commit -m "message"`
4. `git push origin main`
5. Vercel auto-deploys. Done.

**Do NOT** use `vercel deploy` CLI or manual Vercel REST API — GitHub push triggers auto-deploy.

---

## Last Updated
2026-05-08 — Map fixes: catchment center corrected, stat cards removed, Disney CA Adventure removed from accessible map, labels got opaque backgrounds, both maps now scroll-zoomable.
