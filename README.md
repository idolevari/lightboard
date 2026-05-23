# Lightboard

Hebrew-first (RTL) Shopify storefront built with [Hydrogen](https://hydrogen.io) and deployed on [Oxygen](https://shopify.dev/docs/custom-storefronts/oxygen). Brand direction is California coast / surf / van-life — warm earthy tones, handcrafted feel.

Live: <https://lightboard.co.il> · Oxygen preview: <https://lightboard-87fade0f9f524bc506fc.o2.myshopify.dev>

## Stack

- [Hydrogen](https://hydrogen.io) — Shopify's React-based storefront framework
- [Oxygen](https://shopify.dev/docs/custom-storefronts/oxygen) — Shopify's edge hosting
- [React Router v7](https://reactrouter.com) — routing
- [Vite](https://vitejs.dev) — build tool
- TypeScript (strict); `.tsx`/`.ts` everywhere

## Development

```bash
npm install
npm run dev
```

App at <http://localhost:3000>. GraphiQL at <http://localhost:3000/graphiql>.

Localhost always bypasses the launch gate (see below) so you see the full storefront during development.

## Deployment

Every push to `main` auto-deploys to Oxygen via `.github/workflows/oxygen-deployment.yml`. Deploy token secret: `OXYGEN_DEPLOYMENT_TOKEN_1000130179`.

## Required environment variables

`.env` is gitignored and populated by `npx shopify hydrogen link`. Set the same variables in the Oxygen dashboard for production.

| Variable | Purpose |
|---|---|
| `PUBLIC_STORE_DOMAIN` | `kqyxee-us.myshopify.com` |
| `PUBLIC_STOREFRONT_ID` | `1000130179` |
| `PUBLIC_STOREFRONT_API_TOKEN` | Storefront API public token |
| `PRIVATE_STOREFRONT_API_TOKEN` | Server-only Storefront token |
| `PRIVATE_SHOPIFY_ADMIN_API_TOKEN` | Used by the photo upload endpoint |
| `PUBLIC_CHECKOUT_DOMAIN` | Checkout subdomain |
| `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID` / `_URL` | Customer Account API |
| `SESSION_SECRET` | Session cookie signing |
| `SHOP_ID` | Shopify shop ID |
| `COMING_SOON` | `'true'` enables launch gate; anything else = off |
| `PREVIEW_TOKEN` | Random secret. `/preview?token=<value>` bypasses the gate |
| `META_PIXEL_ID` | Optional — set to enable Meta Pixel |

## Launch gate

When `COMING_SOON=true`, public visitors see `<ComingSoon />` and no route loader returns real data. To preview during the gate:

```
https://lightboard.co.il/preview?token=<PREVIEW_TOKEN>
```

This sets a 30-day cookie (`lb_preview=1`, httpOnly, Secure, SameSite=Lax) and redirects to `/`. Without it, all routes redirect to `/` and the homepage renders the splash. See `app/lib/coming-soon.js` and `CLAUDE.md` for details.

To launch: set `COMING_SOON=false` (or unset) in Oxygen. No code change.

## Content architecture

The guiding rule: **anything a merchant edits without a code change lives in Shopify; only UI plumbing lives in code.**

| Layer | What's there |
|---|---|
| **Shopify Admin** | Product catalog, variants, prices, inventory, customers, orders, policies, pages |
| **Shop metafields** | `business.*` (phone, email, instagram, legal name, address), `custom.featured_product`, `homepage.hero`, `homepage.story` |
| **Product metafields on Lightboard** | `marketing.*` (eyebrow, headline, description, tags, ship note) and `marketing.specs` (list of `product_spec` metaobjects) |
| **Metaobjects** | `faq`, `testimonial`, `hero_slide`, `homepage_hero`, `homepage_story`, `story_stat`, `product_spec` |
| **`app/lib/i18n/{he,en}.json`** | UI plumbing only — button labels, form fields, ARIA labels, photo-customizer copy. No content data. |
| **Hardcoded constants** | Hex swatch fallbacks, magic-byte image signatures, phone format helper, validation rules |

For the full rationale and a per-layer guide, see `CLAUDE.md`.

## Repo layout

```
app/
  components/    UI components (Header, Footer, CartLineItem, PhotoCustomizer, ...)
  lib/           Helpers: i18n, brand, sanitize, coming-soon, meta, fragments
  routes/        File-based routing — ($locale) prefix on customer paths
  styles/        reset.css + app.css (palette, typography, layout)
public/          Static assets (logo SVGs, favicon, fallback images)
```

## Common tasks

- **Edit FAQ / testimonials / hero slides:** Shopify Admin → Content → Metaobjects
- **Edit hero or story copy:** Shopify Admin → Content → Metaobjects → Homepage hero / Homepage story
- **Edit business contact info:** Shopify Admin → Settings → Custom data → Shop → `business` namespace
- **Edit product copy on homepage:** Shopify Admin → Products → Lightboard → metafields (`marketing.*`)
- **Pick a different featured product:** Settings → Custom data → Shop → `custom.featured_product`
- **Update policy bodies:** Settings → Policies
- **UI labels (Hebrew + English):** `app/lib/i18n/he.json` and `en.json`
