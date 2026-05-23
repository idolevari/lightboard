# Lightboard — Shopify Hydrogen Storefront

Hebrew-first (RTL) Shopify Hydrogen + Oxygen storefront. Migrating from a WordPress + WooCommerce + Elementor site at `lightboard.co.il` (previously hosted on uPress). Brand direction is California coast / surf / van-life / chill — warm earthy tones, handcrafted feel. Reference: @timberwave on Instagram.

## Stack

- **Framework:** Hydrogen (React Router v7, Vite)
- **Hosting:** Shopify Oxygen
- **Store:** `kqyxee-us.myshopify.com` (storefront ID `1000130179`)
- **Language:** JavaScript (not TypeScript)
- **Package manager:** npm

## URLs

- **GitHub:** https://github.com/idolevari/lightboard
- **Admin:** https://kqyxee-us.myshopify.com/admin
- **Oxygen preview:** https://lightboard-87fade0f9f524bc506fc.o2.myshopify.dev
- **Production domain:** https://lightboard.co.il (DNS at box.co.il, A record → 23.227.38.65, CNAME www → shops.myshopify.com)
- **GraphiQL (local):** http://localhost:3000/graphiql

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

Every push to `main` auto-deploys to Oxygen via `.github/workflows/oxygen-deployment.yml`. Secret name: `OXYGEN_DEPLOYMENT_TOKEN_1000130179`.

## Coming Soon / Launch Gate

When the launch gate is on, public visitors see `app/components/ComingSoon.jsx` and no other route can fetch data. Gate logic lives in `app/lib/coming-soon.js` and is enforced server-side by:

- `app/root.jsx` — returns minimal data (no header/footer/cart/shop/consent) when gated
- `app/routes/($locale).jsx` — redirects every non-`/` customer-facing path to `/`
- `app/routes/($locale)._index.jsx` — short-circuits the homepage loader
- `app/routes/api.photos.upload.jsx` — returns 404 while gated

**Controls:**

- `env.COMING_SOON='true'` → enables the gate (any other value = off)
- **Localhost** (`localhost` / `127.0.0.1`) → always bypasses, so `npm run dev` works
- **Bypass cookie** `lb_preview=1` (httpOnly, Secure, SameSite=Lax, 30 days) → set by `/preview`
- **`/preview?token=<env.PREVIEW_TOKEN>`** → constant-time check, sets the cookie, redirects to `/`. Unknown/missing token returns 404. Set `PREVIEW_TOKEN` in the Oxygen env to enable bypass; without it nobody can preview.

**Launching:** set `COMING_SOON=false` (or remove the env var). No code change needed.

## Brand

- **Palette** (in `app/styles/app.css`): `--color-sand` `#FDF8F0`, `--color-cream` `#F5EBD8`, `--color-wood` `#2D2419`, `--color-terracotta` `#C67B5C`, `--color-sage` `#8FA68E`, `--color-tan` `#D4A574`
- **Fonts** (Google Fonts, loaded in `app/root.jsx`): Heebo (body), Rubik (display), DM Serif Display (accents)
- **Logo:** `public/favicon.png` (teal LIGHT / lime BOARD with sun rays — from the original WordPress site)
- **Tagline:** "living · design · surfing"

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

- `app/lib/productOptionLabels.js` — `OPTION_VALUE_HEX` swatch hex fallback map
- `app/lib/photo-canvas.js` — ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES
- `app/routes/api.photos.upload.jsx` — magic-byte signatures (JPEG/PNG/WebP)
- `app/lib/brand.js` — `formatPhoneDisplay()` Israeli phone format helper
- `app/lib/coming-soon.js` — gate cookie name, TTL constants
- `app/routes/($locale)._index.jsx` — `HERO_SLIDES` constant as fallback when no `hero_slide` metaobjects are configured

## Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `PUBLIC_STORE_DOMAIN` | `kqyxee-us.myshopify.com` | Yes |
| `PUBLIC_STOREFRONT_ID` | `1000130179` | Yes |
| `PUBLIC_STOREFRONT_API_TOKEN` | Storefront API public token | Yes |
| `PRIVATE_STOREFRONT_API_TOKEN` | Server-only storefront token | Yes |
| `PRIVATE_SHOPIFY_ADMIN_API_TOKEN` | Used by `api.photos.upload.jsx` for Files upload | Yes |
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

- **Customers:** 970 / 972 imported via Shopify CSV (2 skipped due to invalid phone numbers)
- **Orders:** ~1,131 in SQL dump, not yet migrated. Shopify has no native CSV order import — use Admin API or the Shopify Store Importer app
- **Products:** 1 created manually (Lightboard). ~17 more to migrate from WooCommerce

Migration CSV generator is kept locally at `scripts/woo-to-shopify.py` (gitignored). Outputs to `~/Downloads/shopify-import/`.

## Project Conventions

- **TypeScript, strict** — see `tsconfig.json`. All sources are `.ts`/`.tsx`. JSDoc `@type`/`@typedef` is no longer used.
- **RTL + Hebrew** — `<html lang="he" dir="rtl">` set in `app/root.jsx`
- **Flat repo structure** — app is at the root, not in a subdirectory (keeps CI and Shopify CLI assumptions aligned)
- **Gitignored:** `.env`, `.shopify/`, `.claude/`, `.idea/`, `.cursor/`, `scripts/`, `node_modules/`, build artifacts

