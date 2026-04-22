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

## Deployment

Every push to `main` auto-deploys to Oxygen via `.github/workflows/oxygen-deployment.yml`. Secret name: `OXYGEN_DEPLOYMENT_TOKEN_1000130179`.

## Coming Soon Page

Public visitors see `app/components/ComingSoon.jsx` by default. Bypass logic lives in `app/root.jsx` loader:

- **Localhost** (`npm run dev`) → always shows the real storefront
- **`?comingsoon=1`** on any URL → force-renders Coming Soon (for previewing it during dev)
- **Production** → Coming Soon unless cookie `lb_preview=true` is set
- **To unlock production:** visit `/preview?token=surfsup2026` once — sets a 30-day cookie. Token is in `app/routes/preview.jsx`.

Remove the Coming Soon gate at launch by reverting the conditional in `app/root.jsx` → `App()`.

## Brand

- **Palette** (in `app/styles/app.css`): `--color-sand` `#FDF8F0`, `--color-cream` `#F5EBD8`, `--color-wood` `#2D2419`, `--color-terracotta` `#C67B5C`, `--color-sage` `#8FA68E`, `--color-tan` `#D4A574`
- **Fonts** (Google Fonts, loaded in `app/root.jsx`): Heebo (body), Rubik (display), DM Serif Display (accents)
- **Logo:** `public/favicon.png` (teal LIGHT / lime BOARD with sun rays — from the original WordPress site)
- **Tagline:** "living · design · surfing"

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

- **JavaScript, not TypeScript** — scaffold uses `.jsx`
- **RTL + Hebrew** — `<html lang="he" dir="rtl">` set in `app/root.jsx`
- **Flat repo structure** — app is at the root, not in a subdirectory (keeps CI and Shopify CLI assumptions aligned)
- **Gitignored:** `.env`, `.shopify/`, `.claude/`, `.idea/`, `.cursor/`, `scripts/`, `node_modules/`, build artifacts

## Environment

`.env` (gitignored) is populated by `npx shopify hydrogen link`. After running link, restart `npm run dev` to pick up the new env.
