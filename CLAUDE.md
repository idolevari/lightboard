# Lightboard — Shopify Hydrogen Storefront

Hebrew-first (RTL) Shopify Hydrogen + Oxygen storefront. Migrating from a WordPress + WooCommerce + Elementor site at `lightboard.co.il` (previously hosted on uPress). Brand direction is California coast / surf / van-life / chill — warm earthy tones, handcrafted feel. Reference: @timberwave on Instagram.

## Stack

- **Framework:** Hydrogen (React Router v7, Vite)
- **Hosting:** Shopify Oxygen
- **Store:** `kqyxee-us.myshopify.com` (storefront ID `1000130179`)
- **Language:** TypeScript (strict)
- **Package manager:** npm

## URLs

- **GitHub:** https://github.com/idolevari/lightboard
- **Admin:** https://kqyxee-us.myshopify.com/admin
- **Production domain:** https://lightboard.co.il (DNS at box.co.il, A record → 23.227.38.65, CNAME www → shops.myshopify.com)
- **Oxygen environments** (`shopify hydrogen env list`):
  - Production — branch `main` → https://lightboard.co.il
  - dev — branch `dev` → https://dev-a273e0006171877d729c.o2.myshopify.dev (requires Shopify login)
  - Preview — no branch
  - Legacy preview URL https://lightboard-87fade0f9f524bc506fc.o2.myshopify.dev still responds and is still attached as a store domain
- **GraphiQL (local):** http://localhost:3000/graphiql

## Accounts & CLI access

- **GitHub CLI:** log in as `idolevari` (repo owner). A second account `Ido-Lev-Ari` exists — not the owner.
- **Shopify CLI:** `shopify auth login` as `levarido@gmail.com` (store owner, org "Lightboard"). Other accounts get 403 on `hydrogen env list`.
- **Admin reads:** `shopify store auth -s kqyxee-us.myshopify.com --scopes <read_*>` then `shopify store execute --store kqyxee-us.myshopify.com --query '...'` (mutations need `--allow-mutations`).
- **Pulling Oxygen env vars:** use `./node_modules/.bin/shopify hydrogen env pull --env <handle> --env-file <path>` — via `npx`, node swallows `--env-file`.

## Task tracker (Notion)

All product/dev tasks live in this Notion board — sync with it whenever closing or opening work, not just an internal TaskList:

- **Board URL:** https://www.notion.so/6a1aa6009185487caa4c238823ea97a2?v=0a578964423546daab4063c84501992b
- **Database ID:** `6a1aa6009185487caa4c238823ea97a2`
- **Data source (collection):** `collection://0a55c71d-b5c3-492f-ab91-760d4bf2846e`

**Schema (status type):**

- `Status` (status: Not started / In progress / Done) — the canonical column. The Board view groups by it.
- `Category` (select: Storefront / Data Migration / Design / Operations / Marketing)
- `Priority` (select: High / Medium / Low)
- `Task name` (title)
- `Created` (auto)

There was historically a duplicate `Status 1` column — it's been removed. Only update `Status`. The Board view may still reference `Status 1` in its group-by config; if cards appear in "No status", re-bind the Board's groupBy to `Status`.

**Workflow when closing a task:**

1. Verify against the codebase before marking Done (don't trust task titles alone — read the relevant components/routes)
2. Set `Status: "Done"` via the Notion MCP `notion-update-page` tool
3. Add a short note explaining what shipped (commit refs, file paths, behavior) via `insert_content`
4. When adding new outstanding work, prefer creating tasks on this board over an ad-hoc TaskList

## Deployment

Pipeline (`.github/workflows/oxygen-deployment.yml`, reusable `verify.yml`, local action `.github/actions/oxygen-deploy`):

- **Push to `main`** → `verify` → production deploy (GitHub environment `production`, never cancelled mid-flight)
- **Push to `dev`** → `verify` → dev environment deploy
- **PR into `main`/`dev`** → `verify` → Oxygen preview deploy (`--preview`, URL in the run summary) → `e2e` (Playwright against the preview, using an Oxygen auth-bypass token). Fork and Dependabot PRs run `verify` only.
- `verify` = `npm ci` → codegen + fail on `*.generated.d.ts` drift → `npm run typecheck` → `npm run lint` → `npm run build`. Required status check name: `verify / verify`.
- Node is pinned by `.nvmrc` (24). Actions are pinned by commit SHA. Dependabot (`.github/dependabot.yml`) runs weekly against `dev`; majors of Hydrogen / Shopify CLI / react-router / vite are ignored (manual migrations).
- `security-review.yml` runs the Claude security review on same-repo PRs.
- Secret: `OXYGEN_DEPLOYMENT_TOKEN_1000130179`. Optional `E2E_PREVIEW_TOKEN` only if the Preview environment has the launch gate on.

**Workflow:** branch → PR into `main` → check the preview + e2e → merge. Don't push to `main` directly.

## Testing

- **E2E:** Playwright in `e2e/` (`playwright.config.ts`, `tsconfig.e2e.json`). `npm run e2e:install` once, then `E2E_BASE_URL=http://localhost:3120 npm run e2e` against `npx shopify hydrogen preview --build --port 3120`. Projects: mobile (390×844, he-IL, touch) and desktop.
- Suites: `purchase` (home → PDP → color → gallery photos → approve → cart → checkout redirect, aborted — never pays), `navigation`, `platform` (robots, sitemap, llms.txt, legacy 301, JSON-LD, CSP, upload rejection), `accessibility` (axe, fails on serious/critical).
- The photo upload endpoint is always mocked in tests — never write to Shopify Files from tests.

## Coming Soon / Launch Gate

When the launch gate is on, public visitors see `app/components/ComingSoon.tsx` and no other route can fetch data. Gate logic lives in `app/lib/.server/coming-soon.server.ts` and is enforced server-side by:

- `app/root.tsx` — returns minimal data (no header/footer/cart/shop/consent) when gated
- `app/routes/($locale).tsx` — redirects every non-`/` customer-facing path to `/`
- `app/routes/($locale)._index.tsx` — short-circuits the homepage loader
- `app/routes/api.photos.upload.ts` — returns 404 while gated

**Controls:**

- `env.COMING_SOON='true'` → enables the gate (any other value = off)
- **Localhost** (`localhost` / `127.0.0.1`) → always bypasses, so `npm run dev` works
- **Bypass cookie** `lb_preview=<HMAC-SHA256(SESSION_SECRET, "lb_preview:"+PREVIEW_TOKEN)>` (httpOnly, Secure, SameSite=Lax, 30 days) → set by `/preview`; rotating either secret revokes issued cookies
- **`/preview?token=<env.PREVIEW_TOKEN>`** → constant-time check, sets the cookie, redirects to `/`. Unknown/missing token returns 404. Set `PREVIEW_TOKEN` in the Oxygen env to enable bypass; without it nobody can preview.

**Launching:** set `COMING_SOON=false` (or remove the env var). No code change needed.

## Brand

- **Direction:** "Golden Hour Van" — California van-life / surf, warm golden-hour light, hand-drawn illustrations.
- **Palette** (tokens in `app/styles/app.css` `:root`): base `--cream` `#f4ede0` / `--cream-2` / `--cream-3`, `--ink` `#0b3a4a`, `--teal` (brand teal) and `--lime` (brand lime). Warm accents: `--sun` `#f6c95b`, `--sunset`, `--glow`, `--fog`. **Text-safe** variants (≥4.5:1 on cream): `--teal-ink`/`--teal-text` `#0e6f78`, `--sunset-ink`, `--driftwood` `#725a41`. `--sun`/`--sunset` are decorative or ≥24px only. Legacy `--color-*` names alias these.
- **Fonts:** Ploni (self-hosted Hebrew display, `public/fonts`, preloaded), Heebo 400–700 (body), Fraunces (Latin display), JetBrains Mono (labels) via Google Fonts in `app/root.tsx`; Amatic SC loaded lazily with `text=` for a few hand-written notes. Keep the font budget small.
- **Illustrations:** `app/components/illustrations/index.tsx` (SunRays, WaveDivider, WaveLayers, StringLights, StampBadge, Van, Surfboard, Palms) + `public/illustrations/doodles.svg` sprite. Decorative, `aria-hidden`.
- **Photos:** licensed Unsplash photos uploaded to Shopify Files; URLs + licenses in `app/lib/photos.ts`. Hero fallback slides (`HERO_SLIDES` in `app/routes/($locale)._index.tsx`) use them until `hero_slide` metaobjects exist.
- **Motion:** CSS-first, transform/opacity only, paused off-screen, disabled under `prefers-reduced-motion` and by the accessibility menu's "stop animations" switch.
- **Voice (copy):** native Hebrew, plural address (אתם), short and confident, no slash forms; brand spelled **לייטבורד**. Facts: free shipping on all orders in Israel, handmade in Tel Aviv (legal address Hod Hasharon), 7–10 business days, since 2019. Code-side facts live in `app/lib/brand-facts.ts`.
- **Logo:** `public/favicon.png` (teal LIGHT / lime BOARD with sun rays — from the original WordPress site)
- **Tagline:** "living · design · surfing"

## SEO & AI visibility

- **Meta:** `routeMeta()` in `app/lib/seo-urls.ts` (canonical, hreflang he/en/x-default, OG/Twitter); home/product copy in `app/lib/meta.ts`. Hebrew at `/`, English under `/en`.
- **Structured data:** one `@graph` from `siteJsonLd()` in `app/lib/.server/seo.server.ts` (OnlineStore, WebSite, MerchantReturnPolicy, FAQPage, ProductGroup + variants, BreadcrumbList), rendered via `app/components/JsonLd.tsx` (escaped). Brand is always "Lightboard" regardless of the Shopify Vendor field.
- **Crawling:** `[robots.txt].ts` explicitly allows AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, …); custom sitemaps in `[sitemap.xml].ts` + `sitemap.$type.$page[.xml].ts` (always `https://lightboard.co.il`).
- **GEO:** `/llms.txt` and `/llms-full.txt` built from live Shopify data (`app/lib/.server/llms.server.ts`).
- **Legacy URLs:** old WooCommerce/WordPress paths 301 via `app/lib/.server/legacy-redirects.ts` (hooked in `server.ts` before `storefrontRedirect`).

## Privacy, consent & security

- Shopify privacy banner is on (`withPrivacyBanner: true` in `app/root.tsx`). Meta Pixel (`app/lib/meta-pixel.tsx`) loads `fbevents.js` only after explicit marketing consent; helpers in `app/lib/consent.ts` (footer "הגדרות עוגיות" uses `openCookiePreferences`). **Requires** Shopify Admin → Customer privacy → Cookie banner → All regions, otherwise nobody can opt in.
- CSP + `Referrer-Policy` + `Permissions-Policy` in `app/entry.server.tsx` (dev check is `process.env.NODE_ENV === 'development'` — Oxygen doesn't set `env.NODE_ENV`).
- `/api/photos/upload`: same-origin only, needs a signed-session upload grant (set by the PDP loader), per-session/IP rate limits, size caps, JPEG GPS/XMP scrub, UUID filenames, generic client errors.
- Shopify HTML is sanitized server-side only (`app/lib/.server/sanitize.server.ts`) — never import sanitize-html into client code.
- react-router is held at 7.18.x via `overrides` (above Hydrogen 2026.4's declared range, for security advisories). Hydrogen 2026.10 / CLI 5 is a planned separate migration.

## Content architecture

Guiding rule: anything a merchant edits without a code deploy lives in Shopify. i18n holds UI plumbing only. Use this section to know where to look or write before editing copy.

### Decision tree

```
1. Would a merchant ever edit this from Shopify Admin?
       YES → Shopify (metafield / metaobject / page / policy / product field)
       NO  → go to step 2

2. Must it vary per locale by design (UI labels)?
       YES → i18n JSON (app/lib/i18n/{he,en}.json)
       NO  → go to step 3

3. Is it a programmatic value (hex code, MIME signature, regex)?
       YES → hardcoded constant in code
       NO  → re-check step 1 — it probably belongs in Shopify
```

### Shopify-managed content inventory

**Shop metafields** (Settings → Custom data → Shop):

| Namespace.key | Type | What |
|---|---|---|
| `business.phone` | text | `+972-55-720-9448` |
| `business.email` | text | `lightboardshop@gmail.com` |
| `business.instagram` | url | Instagram URL |
| `business.legal_name` | text | "Lightboard" |
| `business.address` | text | "הוד השרון, ישראל" |
| `custom.featured_product` | product reference | Which product shows on the homepage hero card |
| `homepage.hero` | metaobject reference (`homepage_hero`) | Hero section copy |
| `homepage.story` | metaobject reference (`homepage_story`) | Story section copy |

**Product metafields on Lightboard** (namespace `marketing`):

- `eyebrow_he` / `eyebrow_en`, `headline_he` / `headline_en` (HTML, sanitized), `description_he` / `description_en`, `tag_made_to_order_he` / `tag_made_to_order_en`, `tag_dimensions`, `ship_note_he` / `ship_note_en`
- `specs` (list reference → `product_spec` metaobjects)

**Metaobject types** (Content → Metaobjects):

| Type | Purpose | Linked from |
|---|---|---|
| `faq` | FAQ items with `question_*`, `answer_*` (HE+EN), position | Queried by homepage |
| `testimonial` | Customer quotes with `body_*`, `attribution_*` (HE+EN), position | Queried by homepage |
| `hero_slide` | Background slides with image + label + mobile_position + position | Queried by homepage |
| `product_spec` | Single key/value spec entry — `label_*`, `value_*` (HE+EN), position | Linked from Lightboard product `marketing.specs` |
| `homepage_hero` | Hero copy: eyebrow, title lines, kicker, CTA, tape (HE+EN) | Linked from shop `homepage.hero` |
| `homepage_story` | Story copy: tag, eyebrow, titles, paragraphs (HE+EN) + list of `story_stat` | Linked from shop `homepage.story` |
| `story_stat` | Single stat: value + label_he/label_en + position | Linked from `homepage_story.stats` |

**Notes on bilingual content:** Metaobjects use `_he`/`_en` paired fields. The Hebrew is canonical; English falls back to Hebrew when empty so the storefront never renders blank. Shopify Markets / Translate & Adapt is **not** set up. The paired-field pattern is intentional for our scale (one editor, two locales, hand-crafted parallel copy). If a third locale is added, or product/policy/page bodies need EN, switch to T&A.

### What stays in i18n JSON

`app/lib/i18n/{he,en}.json` — only UI plumbing:

- Navigation labels (`nav`)
- Common button labels (`common`: save, cancel, load more, ...)
- Cart/account/search/photo-customizer form labels (`cart`, `account`, `search`, `photoCustomizer`)
- ARIA labels and accessibility menu (`a11y`)
- 404 page copy (`notFound`)
- Section-header eyebrow labels (`faq.eyebrow`, `testify.eyebrow`)
- Product UI labels (`product.optionLabels`, `product.optionValues` for HE display of Shopify variant names like Color → צבע)
- Footer meta-row labels ("Address:", "Phone:")

### Hardcoded in code (intentional)

- `app/lib/productOptionLabels.ts` — `OPTION_VALUE_HEX` swatch hex fallback map
- `app/lib/photo-canvas.ts` — ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES
- `app/routes/api.photos.upload.ts` — magic-byte signatures (JPEG/PNG/WebP)
- `app/lib/brand.ts` — `formatPhoneDisplay()` Israeli phone format helper
- `app/lib/.server/coming-soon.server.ts` — gate cookie name, TTL constants
- `app/routes/($locale)._index.tsx` — `HERO_SLIDES` constant as fallback when no `hero_slide` metaobjects are configured

## Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `PUBLIC_STORE_DOMAIN` | `kqyxee-us.myshopify.com` | Yes |
| `PUBLIC_STOREFRONT_ID` | `1000130179` | Yes |
| `PUBLIC_STOREFRONT_API_TOKEN` | Storefront API public token | Yes |
| `PRIVATE_STOREFRONT_API_TOKEN` | Server-only storefront token | Yes |
| `PRIVATE_SHOPIFY_ADMIN_API_TOKEN` | Used by `api.photos.upload.ts` for Files upload (custom app "Lightboard Files", scopes read_files/write_files only) | Yes |
| `PUBLIC_CHECKOUT_DOMAIN` | Checkout subdomain | Yes |
| `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID` | Customer Account API | Yes |
| `PUBLIC_CUSTOMER_ACCOUNT_API_URL` | Customer Account API | Yes |
| `SESSION_SECRET` | Session cookie signing | Yes |
| `SHOP_ID` | Shopify shop ID | Yes |
| `COMING_SOON` | `'true'` enables launch gate | No (off by default) |
| `PREVIEW_TOKEN` | Token for `/preview?token=...` bypass | Required when `COMING_SOON=true` |
| `META_PIXEL_ID` | Enables Meta Pixel when set | Optional |

`.env` (gitignored) is populated by `npx shopify hydrogen link`. After running link, restart `npm run dev` to pick up the new env. Set the same variables in the Oxygen dashboard for production.

## WordPress Backup

Original WordPress site backup — DB dump, uploads, themes, plugins — is at:

```
/Users/idolevari/Library/Mobile Documents/com~apple~CloudDocs/Documents/Lightboard/Website/lightboard.co.il_bm1776845536dm
```

Key files inside:
- `databases/lighgewi_up1.sql` (~46 MB) — full MySQL dump including orders, customers, products
- `wp-content/uploads/YYYY/...` — product images and media organized by year

Tables of interest: `vxd_posts` (products as `post_type='product'`, orders as `post_type='shop_order'`), `vxd_postmeta` (billing info + order totals), `vxd_woocommerce_order_items`, `vxd_users` / `vxd_usermeta`.

## Migration Status

- **Customers:** 970 / 972 imported via Shopify CSV on 2026-04-22 (2 skipped due to invalid phone numbers). Store count on 2026-11-05: **958**
- **Orders:** ~1,131 in SQL dump, not yet migrated (store has **0** orders). Shopify has no native CSV order import — use Admin API or the Shopify Store Importer app
- **Products:** 1 created manually (Lightboard). ~17 more to migrate from WooCommerce

Migration CSV generator is kept locally at `scripts/woo-to-shopify.py` (gitignored). Outputs to `~/Downloads/shopify-import/`.

## Store state (snapshot 2026-11-05)

Re-check with `shopify store execute` before relying on these numbers.

- **Shop:** "Lightboard", Basic plan, ILS, `Asia/Jerusalem`, contact email `lightboardshop@gmail.com`
- **Launch gate:** off in production (`COMING_SOON=false`) — the site is live. `PREVIEW_TOKEN` not set in any environment. Production has no `PUBLIC_CHECKOUT_DOMAIN` (code falls back to `PUBLIC_STORE_DOMAIN`)
- **Languages / markets:** `he` primary + `en` published. One market: Israel
- **Sales channels:** Online Store, Point of Sale, `lightboard` (Hydrogen). The online store theme is the default **Horizon** (MAIN)
- **Product:** Lightboard, ₪279, variants Light Blue / Cream / Pink, tag `requires-photos`, no SKUs. Inventory policy CONTINUE (oversell allowed — made to order)
- **Collections / pages / blogs:** `frontpage` collection; pages `contact`, `accessibility`; blog `news`; all four policies filled
- **Metaobject counts:** faq 5, testimonial 4, product_spec 4, homepage_hero 1, homepage_story 1, story_stat 3, **hero_slide 0** (homepage uses the code fallback `HERO_SLIDES`)
- **Shopify menus** `main-menu` / `footer` still have default items pointing at the myshopify host
- **Shipping:** Domestic (IL) "רגיל" ₪0 on all orders. An International zone (27 countries, ₪60) exists but is unreachable because the only market is Israel

### Known issues in store config

- **Primary domain is still `kqyxee-us.myshopify.com`.** `lightboard.co.il` is connected (SSL on) but not primary — this affects customer emails and checkout links. Extra attached domains: the legacy Oxygen preview URL and `lightboard-9016.myshopify.com`
- **Shipping vs copy mismatch:** shipping is free on all orders, but the `homepage_hero` tape says "Free shipping over ₪299" (and the product is ₪279)
- **Horizon theme is published on the Online Store channel** — anyone visiting the myshopify host may see it instead of Hydrogen

## Project Conventions

- **TypeScript, strict** — see `tsconfig.json`. All sources are `.ts`/`.tsx`. JSDoc `@type`/`@typedef` is no longer used.
- **RTL + Hebrew** — `<html lang="he" dir="rtl">` set in `app/root.tsx`
- **Flat repo structure** — app is at the root, not in a subdirectory (keeps CI and Shopify CLI assumptions aligned)
- **Gitignored:** `.env`, `.shopify/`, `.claude/`, `.idea/`, `.cursor/`, `scripts/`, `node_modules/`, build artifacts

