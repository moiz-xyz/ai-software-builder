# SiteFactory — template-based software factory

Customers pick a **master template** (Website, CRM or ERP), fill a structured requirements form,
upload their logo/images, and get an **independent project instance** they can preview, edit,
approve and publish. Everything is rule-based: **no AI, no LLMs, no AI API keys.**

```
ADMIN creates master templates → CUSTOMER selects template → fills requirements → uploads images
→ backend validates against the template → independent project created → preview → approve → published
```

## Layout

| Path | What |
|---|---|
| `packages/templates` | Shared TypeScript: 11 master template definitions, theme & module library, and the **rule engine** (`validateSubmission`, `buildProjectConfig`, `validateConfig`, `validateTemplateDefinition`). Used by API *and* browser. |
| `apps/api` | NestJS + Prisma (PostgreSQL) REST API, BullMQ deployment worker, S3 uploads. |
| `apps/web` | Next.js + Tailwind (shadcn-style UI): catalog, wizard, visual editor, CRM/ERP workspace, admin panel, site renderer. |
| `infra/` | Nginx config, SeaweedFS S3 credentials, custom-domain certificate script. |

## How isolation works
* **Master templates** are versioned: admins edit a *draft*; publishing snapshots an immutable `TemplateVersion`. Projects pin the version they were created from — later template changes never alter them, and customer edits never touch the template (verified by tests).
* **Each project** owns its config (+ full version history), copied assets under `projects/<id>/`, roles, members, workspace records, domains and deployments. All access goes through `AccessService`; other customers get 404.
* Editor saves are validated against the pinned template (themes, layouts, fonts, features, feature dependencies, required sections/modules, own-assets-only).
* Free-text "additional instructions" are stored as admin notes — never interpreted.

## Instant Builder (describe → build), still rule-based
Customers can type a few lines about their business at `/build` instead of filling the form. Code: `packages/templates/src/smart/`.
* `lexicon.ts` holds plain word lists: template keywords, cuisines, business types, cities, colours, moods → themes, feature/module words, sample menus and services. **Teaching the builder new words means adding them here.**
* `analyse.ts` scores every template by keywords and extracts facts with text patterns: name, email, phone/WhatsApp, address/city, opening hours, menu items and services with prices, stats, founding year, employees, colours, roles, pipeline stages, lead sources, departments. Every value keeps the words it came from ("evidence").
* `compose.ts` turns facts into normal requirement-form values. Gaps are filled with prepared sentence patterns (picked by a seed, so "New wording" re-picks), library photos, and flagged samples. It never invents reviews or statistics. Values then go through the same `validateSubmission` / project creation as the form.
* The browser shows a real-steps "building" screen, a live draft preview (`/build/frame`), "needs your input" for anything missing, and photo swap/upload. The original description is saved on the project (`sourcePrompt`) so admins can see what the rules missed.

## Image library
Admin → **Image library** manages photos by tag (`food-desi`, `restaurant-interior`, `business-salon`, …). The builder picks photos by tag. When a project is created, chosen photos are **copied** into `projects/<id>/`, so removing a library photo never breaks a customer site. The starter set in `apps/api/prisma/stock/` comes from Wikimedia Commons, **public domain / CC0 only** (title, author, licence and source for each photo are in `manifest.json`). It is seeded only while the library is empty.

## Templates shipped
Websites: Restaurant, Corporate, Business, Agency, Portfolio · CRM: Basic, Sales, Lead management · ERP: Basic, Inventory & Sales, Business management.
Website renderers are real code (`apps/web/src/components/site/SiteRenderer.tsx`); CRM/ERP run on a module/entity engine with business rules (stock movements, PO receipt → stock in, SO fulfilment → stock out + auto-invoice, lead conversion, dashboards).

## Run locally
```bash
cp .env.example .env
pnpm install
pnpm infra:up                      # postgres :5440, redis :6390, S3 (SeaweedFS) :9010
pnpm build:templates
cd apps/api && npx prisma migrate deploy && pnpm seed && cd ../..
pnpm dev:api                       # http://localhost:4100
pnpm dev:web                       # http://localhost:3100
```
Logins (seed): admin `admin@factory.local / Admin123!`, customer `customer@factory.local / Customer123!`.
Published sites: `http://<slug>.localtest.me:3100` (localtest.me resolves to 127.0.0.1) or `http://localhost:3100/s/<slug>`.

## Tests
```bash
pnpm --filter @sf/templates test        # rule engine + Instant Builder unit tests
cd apps/api && npx jest                 # full workflow e2e against the running API (+ worker, DB, S3)
```

## Production (VPS)
`docker compose --profile app up -d --build` runs postgres, redis, S3, api (migrates + seeds on start), web and nginx.
* DNS: `A ROOT_DOMAIN` and `A *.ROOT_DOMAIN` → VPS. Put a wildcard cert (certbot DNS-01) in `infra/nginx/certs/wildcard/`.
* Custom domains: customer adds `CNAME → PUBLIC_INGRESS_HOST` and `TXT _factory-verify.<domain>`; the API verifies DNS; cron `infra/scripts/issue-certs.sh` issues certs and reports SSL status.
* Any S3-compatible store works (set `S3_*`). Set strong `JWT_SECRET` and `INTERNAL_TOKEN`.

## Not included yet
Payment collection (plans are set by admins), email notifications, and per-customer custom code — new designs are added as new renderers/templates by the platform team.
