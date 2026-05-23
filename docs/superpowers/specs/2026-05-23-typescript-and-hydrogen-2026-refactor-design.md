# TypeScript Migration + Hydrogen 2026 Refactor — Design Spec

**Date:** 2026-05-23
**Author:** idolevari (with Claude)
**Status:** Design approved — pending implementation plan

## Goal

Convert the Lightboard Hydrogen storefront from JavaScript to **strict TypeScript** in a single branch + PR, and in the same branch land six targeted refactors that close the gap between our current code and Hydrogen 2026 best practices. The endpoint is a fully typed, state-of-the-art Hydrogen storefront on `@shopify/hydrogen@2026.4.x`.

## Context

- Codebase: 84 `.jsx`/`.js` source files under `app/`, plus 6 top-level config files and 4 entry files. Hebrew-first (RTL), live at `lightboard.co.il`, deployed on Shopify Oxygen.
- TypeScript is already installed (5.9.2) as a devDep alongside `@types/react`, `@total-typescript/ts-reset`, `@typescript-eslint/*`, `vite-tsconfig-paths`. `env.d.ts` already exists with the correct ambient refs. Hydrogen codegen already produces `storefrontapi.generated.d.ts` and `customer-accountapi.generated.d.ts`.
- Project convention in `CLAUDE.md` currently reads "JavaScript, not TypeScript — scaffold uses `.jsx`". This PR flips that convention.
- No test suite exists. Verification relies on `tsc --noEmit`, `npm run build`, `npm run lint`, and a manual dev-server smoke.

## Research basis

Before designing, three parallel research streams ran:

1. **Hydrogen 2026 official best practices.** 17 documented patterns surfaced from `shopify.dev` API docs, the Hydrogen 2026.4 changelog, and the skeleton template at `github.com/Shopify/hydrogen/tree/main/templates/skeleton`. Key 2026.4 breaking change: backend consent mode is now default, and `proxyStandardRoutes` was removed.
2. **Reference Hydrogen storefronts on GitHub.** Six production stores audited and verified. Three pinned as primary references: Shopify Skeleton (baseline), Weaverse Pilot (production patterns), Frontvibe Fluid (closest stack analogue — uses `($locale).*.tsx` file-based routing like us).
3. **Internal Lightboard audit.** Grep-based audit against the 17 patterns above. The store is in much better shape than expected: `<Image>` with `aspectRatio`, CSP with nonces, `Analytics.Provider`, `useOptimisticCart`, `CartForm`, `shouldRevalidate`, `prefetch="intent"`, sitemap helpers, and `Promise.all`-parallelized loaders are all already in place.

**Verified directly from source** (not just agent claims):
- The skeleton's `tsconfig.json` — confirmed `strict: true`, `verbatimModuleSyntax: true`, `types` array including `@shopify/hydrogen/react-router-types`, `rootDirs: [".", "./.react-router/types"]`.
- The skeleton's `app/root.tsx` — confirmed `loadCriticalData` (awaited, `Promise.all`) + `loadDeferredData` (returns unresolved promises with `.catch()` → `null`) pattern.

## Scope decisions (already locked)

| Decision | Choice |
|---|---|
| Strictness | Strict from day one. `strict: true`, no implicit `any`. |
| File scope | All of `app/`, all top-level configs (`server.ts`, `vite.config.ts`, `eslint.config.ts`, `react-router.config.ts`, `.graphqlrc.ts`, `app/routes.ts`), and gitignored `scripts/*.mts`. `scripts/woo-to-shopify.py` stays Python. |
| `allowJs` | `false` — no JS holdouts. Deviates from skeleton (which has `allowJs: true`); this is intentional since we are converting everything. |
| Refactor bundling | Bundled into the same PR as the TS migration (per explicit user decision after weighing the diff-size tradeoff). |
| PR shape | One feature branch (`chore/typescript-migration`), one PR, ~14 commits across 3 phases. |

---

## Section 1 — Tooling & config

### `tsconfig.json` (skeleton-aligned)

Replace `jsconfig.json`. Direct port of the Hydrogen 2026.4.2 skeleton, with `allowJs: false` as the only intentional deviation:

```jsonc
{
  "include": [
    "env.d.ts",
    "app/**/*.ts",
    "app/**/*.tsx",
    "app/**/*.d.ts",
    "*.ts",
    "*.tsx",
    "*.d.ts",
    ".graphqlrc.ts",
    ".react-router/types/**/*"
  ],
  "exclude": ["node_modules", "dist", "build"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "verbatimModuleSyntax": true,
    "allowJs": false,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true,
    "incremental": true,
    "composite": false,
    "baseUrl": ".",
    "paths": {"~/*": ["app/*"]},
    "rootDirs": [".", "./.react-router/types"],
    "types": [
      "@shopify/oxygen-workers-types",
      "react-router",
      "@shopify/hydrogen/react-router-types",
      "vite/client"
    ]
  }
}
```

The `types` array's fourth entry — `@shopify/hydrogen/react-router-types` — is what makes `context.storefront`, `context.cart`, `context.customerAccount` auto-typed on `Route.LoaderArgs`. Already referenced ambiently in our `env.d.ts`; promoting it to `types` makes inference stronger.

### `package.json` script additions

```jsonc
"typecheck": "tsc --noEmit",
"codegen": "shopify hydrogen codegen && react-router typegen"
```

(`codegen` is unchanged; `typecheck` is new.) The `dev` and `build` scripts already chain `--codegen`, so RR v7 typegen runs automatically before any compile pass.

### New dependency

- `schema-dts` (devDep) — types for JSON-LD payloads in **R2**. Type-only; no runtime cost.

### ESLint

- Rename `eslint.config.js` → `eslint.config.ts` (already valid because `typescript-eslint` packages are installed).
- Update parser config to target `.ts`/`.tsx`, trim JS-only globs.
- Enable `@typescript-eslint/consistent-type-imports` (autofix → mass-rewrites `import {SomeType}` to `import type {SomeType}` per `verbatimModuleSyntax`).

---

## Section 2 — Typing approach at the boundaries

### Route loaders/actions

Use React Router v7's generated route types:

```ts
// app/routes/($locale).products.$handle.tsx
import type {Route} from './+types/($locale).products.$handle';

export async function loader({context, params}: Route.LoaderArgs) {
  const {handle} = params;
  if (!handle) throw new Response(null, {status: 404});
  // ...
}

export default function Product({loaderData}: Route.ComponentProps) {
  const {product} = loaderData; // fully typed
}
```

Generated at codegen time into `.react-router/types/**`. No manual loader-return interfaces.

### GraphQL queries

Hydrogen codegen auto-types `#graphql` template literals via TypeScript's template literal mechanism once `tsconfig.json` exists:

```ts
const {product} = await storefront.query(PRODUCT_QUERY, {
  variables: {handle},
}); // `product` is auto-typed from storefrontapi.generated.d.ts
```

No manual `<TypeName>` generics needed in 90% of cases.

### Component props

Explicit type aliases, exported only when reused across files:

```ts
type ProductFormProps = {
  product: ProductFragment;
  variants: Array<ProductVariantFragment>;
  onAddToCart?: () => void;
};
export function ProductForm({product, variants, onAddToCart}: ProductFormProps) { /* */ }
```

### Metaobjects

Shopify's metaobject `fields` array is structurally weak from codegen. Add **one** shared module `app/lib/metaobject-types.ts` exporting concrete shapes:

```ts
export type MetaobjectField = {key: string; value: string | null; reference?: ...};
export type HomepageHero = {/* ... */};
export type HomepageStory = {/* ... */};
export type FaqItem = {/* ... */};
export type Testimonial = {/* ... */};
export type HeroSlide = {/* ... */};
export type ProductSpec = {/* ... */};
export type StoryStat = {/* ... */};
```

Plus a helper `readField<T>(fields, key, fallback)` so the access pattern in routes/components stays tight.

### Utilities (`app/lib/*`)

Typed normally. `sanitize.ts` → `string`. `i18n.ts` → `Locale = 'he' | 'en'` union. `coming-soon.ts` → typed cookie helpers. `useI18n.tsx` returns `t: (key: string) => string` (loose typing intentional — large hand-curated JSON dicts, narrow typing would explode).

### Where `any` is grudgingly allowed

Only at three boundaries, each annotated with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and a reason:

1. The raw `metaobject.fields` array before it's normalized through `readField`.
2. Third-party libs without good types (e.g., `react-easy-crop` if it bites).
3. Specific Shopify return shapes that are awkward to thread through.

Goal: zero implicit `any` in `app/`.

---

## Section 3 — State-of-the-art refactor items (overlay on TS migration)

Six concrete items, each gets its own commit *after* the TS migration so refactors happen against a fully typed codebase.

### R1. `loadCriticalData` / `loadDeferredData` split + `defer()`

**Files:** `app/routes/($locale)._index.tsx`, `app/routes/($locale).products.$handle.tsx`, `app/routes/($locale).collections.$handle.tsx`

**Change:** Adopt the skeleton's pattern. Above-the-fold queries → `loadCriticalData` (awaited inside `Promise.all`). Below-the-fold (homepage: FAQs, testimonials, hero slides if not first paint; PDP: any non-critical metaobject queries; PLP: filters metadata) → `loadDeferredData` (returns unresolved promises). Each deferred query wraps `.catch((e) => { console.error(e); return null; })` per skeleton convention so a deferred failure does not 500 the page. Consume in JSX via `<Suspense fallback={...}><Await resolve={deferred}>...</Await></Suspense>`.

**Why:** First paint becomes bounded by the slowest *critical* query, not the slowest *any* query. Material LCP win.

### R2. `getSeoMeta` + `schema-dts` JSON-LD

**Files:** `app/root.tsx`, new `app/lib/.server/seo.server.ts`, every route that exports `meta`.

**Change:** New `seoPayload` builder per route returns a `SeoConfig` typed via `schema-dts` (`Organization` at root, `Product` on PDP, `CollectionPage` on PLP, `BreadcrumbList` everywhere). Route `meta` exports collapse to `getSeoMeta(...matches.map(m => m.data?.seo).filter(Boolean))`. Bilingual `alternates`/`hreflang` emitted from `params.locale`.

**Why:** Replace 17 hand-rolled OG/Twitter blocks. Add structured data for Google. Centralize SEO logic.

### R3. `useCustomerPrivacy` + Meta Pixel consent gating

**Files:** `app/root.tsx`, `app/lib/meta-pixel.tsx`.

**Change:** Root calls `useCustomerPrivacy({storefrontAccessToken, checkoutDomain, onVisitorConsentCollected})`. Meta Pixel firing moves inside the `onVisitorConsentCollected` callback so it only fires after consent is recorded server-side (2026.4 backend consent mode).

**Why:** GDPR + Israeli Privacy Protection Law compliance. Without this, the Pixel may fire before consent is captured.

### R4. Per-route `ErrorBoundary` exports

**Files:** ~15 routes with a `loader` but no `ErrorBoundary`. New `app/components/RouteError.tsx`.

**Change:** Each affected route exports a 3-line `ErrorBoundary` that delegates to `RouteError`, which branches on `isRouteErrorResponse` and renders a Hebrew error UI (hardcoded strings, not the i18n hook — i18n may not be loaded during a render error).

**Why:** A failed product route should not blow up the layout. Granular error UI per route.

### R5. `.server/` directory split

**Files:** Move `app/lib/coming-soon.ts`, `redirect.ts`, `shopify-admin.ts`, `surprise-gallery.ts`, `session.ts`, server-only bits of `photo-canvas.ts` and `sanitize.ts` into `app/lib/.server/`. Update imports across `app/`.

**Why:** Vite/RR v7 guarantees `.server/` modules never bundle to the client. Smaller client bundle; defense in depth against accidentally importing server-only secrets into a component.

### R6. `checkForTrailingEncodedSpaces` WooCommerce URL guard

**Files:** New `app/lib/.server/url.server.ts`. Used in `($locale).products.$handle.tsx`, `($locale).collections.$handle.tsx`, `($locale).blogs.$blogHandle.$articleHandle.tsx`, `($locale).pages.$handle.tsx`.

**Change:** Helper detects URLs ending in `%20` or trailing whitespace and 301-redirects to the canonical form before any data fetch.

**Why:** We migrated from `lightboard.co.il` on WordPress. Old indexed URLs may carry legacy encoding artifacts. Pattern lifted from `packdigital/pack-hydrogen-theme-blueprint`.

---

## Section 4 — Branch, commits & conversion order

**Branch:** `chore/typescript-migration` off `main`.

**One PR.** Three phases, 14 commits. Each commit leaves `npm run typecheck && npm run build` green so the branch is bisectable.

### Phase A — TS migration only (no behavior changes)

| # | Commit | Files |
|---|---|---|
| 1 | `chore(ts): add tsconfig, npm scripts, eslint config` | `tsconfig.json` (new), delete `jsconfig.json`, `package.json` (+`typecheck` script + `schema-dts` dep), `eslint.config.ts` (renamed) |
| 2 | `chore(ts): convert app/lib/*` | 17 `.js` → `.ts` (still in `app/lib/`). Adds `app/lib/metaobject-types.ts`. |
| 3 | `chore(ts): convert app/components/*` | 22 `.jsx` → `.tsx` |
| 4 | `chore(ts): convert app/routes/* (leaves)` | account, policies, blogs, search, pages, sitemap, robots, preview, discount, `$.jsx`, `api.photos.upload.jsx` |
| 5 | `chore(ts): convert app/routes/* (commerce)` | products.$handle, collections.$handle, collections.all, collections._index, cart, `($locale)._index` |
| 6 | `chore(ts): convert app entry & layout` | `root.tsx`, `entry.client.tsx`, `entry.server.tsx`, `routes.ts`, `($locale).tsx` |
| 7 | `chore(ts): convert top-level configs + scripts` | `server.ts`, `vite.config.ts`, `react-router.config.ts`, `.graphqlrc.ts`, `eslint.config.ts` (final), gitignored `scripts/*.mts` |

**Gate after Phase A:** Branch would be mergeable on its own — full TS, no behavior changes.

### Phase B — State-of-the-art refactors

| # | Commit | Item |
|---|---|---|
| 8 | `refactor(server): move server-only utils to app/lib/.server/` | R5 |
| 9 | `feat(perf): split loadCriticalData/loadDeferredData with defer()` | R1 |
| 10 | `feat(seo): migrate to getSeoMeta + schema-dts JSON-LD` | R2 |
| 11 | `feat(privacy): add useCustomerPrivacy + gate Meta Pixel` | R3 |
| 12 | `feat(errors): add per-route ErrorBoundary exports` | R4 |
| 13 | `feat(migration): WooCommerce URL trailing-space guard` | R6 |

### Phase C — Docs

| # | Commit | Files |
|---|---|---|
| 14 | `docs: flip TS convention + add Notion task` | In `CLAUDE.md` under "Project Conventions", replace the line `**JavaScript, not TypeScript** — scaffold uses `.jsx`` with `**TypeScript, strict** — see \`tsconfig.json\`. All sources are `.ts`/`.tsx`.`. Update `README.md` if it repeats the JS claim. Create a Notion task "Convert codebase to TypeScript + Hydrogen 2026 refactor" with `Status: Done` linked to this PR's URL per the `CLAUDE.md` Notion workflow. |

### Within each commit

1. `git mv` to rename (preserves file history).
2. Run `npm run codegen && npm run typecheck` — fix all errors before staging.
3. Run `npm run build` (commits 2+).
4. Commit message uses the conventional-commit prefix shown above so commits group cleanly in the PR.

---

## Section 5 — Verification

### Per-commit gate

Every commit on the branch must pass before being pushed:

```bash
npm run codegen     # refreshes RR types + storefrontapi types
npm run typecheck   # tsc --noEmit
npm run build       # commits 2+
npm run lint        # final commit; spot-checks on others
```

### Phase B additional gates

| Commit | Smoke check |
|---|---|
| 9 (R1 defer) | Dev server + DevTools Network panel: deferred queries arrive as separate streaming chunks, not blocking initial HTML. Test with Slow 3G throttling. |
| 10 (R2 SEO) | View source on `/`, `/products/lightboard`, `/collections/all`: confirm OG tags + JSON-LD blocks. Validate at `search.google.com/test/rich-results`. |
| 11 (R3 privacy) | Incognito → DevTools Network → reject consent → confirm no requests to `connect.facebook.net` / `fbevents.js`. Accept → confirm Pixel fires once. |
| 12 (R4 ErrorBoundary) | Force 404 on `/products/nonexistent` and `/collections/nonexistent`: confirm Hebrew error UI renders, not layout-less 500. |
| 13 (R6 URL guard) | Visit `/products/lightboard%20` and `/collections/all%20`: confirm 301 to canonical. |

### Final pre-merge gate

1. `npm run codegen && npm run typecheck && npm run build && npm run lint` — all green.
2. `npm run dev` → manual smoke through: `/` (homepage hero + story + FAQ + testimonials), `/products/lightboard` (add to cart with photo upload), `/cart` (line item, qty, checkout link), `/search` + predictive, `/preview?token=...` gate (set + unset cookie path), `/account/login`, 404 path.
3. Open the PR as **draft** first; walk through commit-by-commit on GitHub to validate the per-layer story holds before marking ready-for-review.

---

## Section 6 — Risks & out of scope

### Risks

| Risk | Mitigation |
|---|---|
| Generated GraphQL types disagree with code reading the response (assumes non-null field). | Surface during commits 4–5. Either guard at runtime (preferred) or narrow the type. Do not suppress with `!`. |
| `verbatimModuleSyntax: true` flags many `import {SomeType}` → must become `import type {SomeType}`. | Pure mechanical. ESLint autofix `consistent-type-imports` handles most. |
| RR v7 typegen race — `.react-router/types/**` must exist before `tsc --noEmit`. | `codegen` script runs `react-router typegen`; per-commit gate runs `codegen` first. |
| PR is large (~3-4k lines + the refactors). | Layer-by-layer commits — reviewers step through commit-by-commit. PR description explicitly recommends this. |
| `defer()` failure modes (network error mid-stream). | Every deferred query wraps `.catch((e) => { console.error(e); return null; })` per skeleton convention; `<Await errorElement>` shown in `<Suspense>`. |
| `schema-dts` adds ~20kb to type-only space. | Verify type-only imports; gate behind `import type` if needed. Zero runtime cost expected. |
| `useCustomerPrivacy` racing with Meta Pixel script load. | Use `onVisitorConsentCollected` callback, not `useEffect`. Both skeleton + 2026.4 docs call this out. |
| `.server/` rename breaks imports. | Phase A commit 2 keeps everything in `app/lib/`; the move happens in commit 8 as a single repo-wide search-replace. |
| Per-route `ErrorBoundary` shows untranslated fallback. | `RouteError.tsx` uses hardcoded HE strings with EN fallback, not the i18n hook (which may not be available during render errors). |
| Notion task board sync. | Open "Convert codebase to TypeScript + Hydrogen 2026 refactor" task on the Notion board, mark Done on merge with file refs per `CLAUDE.md` workflow. |

### Out of scope (explicit, will not land in this PR)

- `scripts/woo-to-shopify.py` — stays Python.
- `policies/`, `guides/`, `dist/`, `.shopify/`, `.react-router/` — non-source or generated.
- Generated files (`storefrontapi.generated.d.ts`, `customer-accountapi.generated.d.ts`) — codegen overwrites them.
- No new tests; no Vitest harness.
- No behavior changes outside R1–R6.
- `noUncheckedIndexedAccess: true` — left for a follow-up.
- Pilot-style manual `routes.ts` refactor (collapsing `($locale).*.tsx` into a single config) — Fluid proves this is not required.
- LQIP image wrapper (Fluid pattern) — nice but not load-bearing.
- Zustand cart store with tombstoned line IDs (Pilot pattern) — `useOptimisticCart` already covers our needs.

---

## Section 7 — References

### Official Shopify docs
- https://shopify.dev/changelog/hydrogen-april-2026-release
- https://shopify.dev/docs/api/hydrogen/latest/utilities/createstorefrontclient
- https://shopify.dev/docs/api/hydrogen/latest/utilities/createcontentsecuritypolicy
- https://shopify.dev/docs/api/hydrogen/latest/hooks/usecustomerprivacy
- https://shopify.dev/docs/api/hydrogen/latest/hooks/useoptimisticcart
- https://shopify.dev/docs/api/hydrogen/latest/components/cartform
- https://shopify.dev/docs/api/hydrogen/latest/components/analytics/analytics-provider
- https://shopify.dev/docs/api/hydrogen/latest/utilities/getseometa
- https://shopify.dev/docs/api/hydrogen/latest/utilities/getsitemap
- https://shopify.dev/docs/storefronts/headless/hydrogen/analytics/tracking
- https://shopify.dev/docs/storefronts/headless/hydrogen/performance/on-page-optimizations
- https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/hydrogen

### Shopify source code (verified directly)
- https://github.com/Shopify/hydrogen/tree/main/templates/skeleton — canonical scaffold (`tsconfig.json` verified, `app/root.tsx` verified)
- https://raw.githubusercontent.com/Shopify/hydrogen/main/packages/hydrogen/CHANGELOG.md
- https://raw.githubusercontent.com/Shopify/hydrogen/main/packages/hydrogen/src/cache/strategies.ts
- https://github.com/Shopify/hydrogen/discussions/3248 — React Router v7 upgrade

### Reference production storefronts
- https://github.com/Weaverse/pilot — Hydrogen 2026.5.x production patterns
- https://github.com/frontvibe/fluid — Hydrogen 2026.1.1, closest stack analogue (`($locale).*.tsx` routing)
- https://github.com/packdigital/pack-hydrogen-theme-blueprint — Hydrogen 2026.1.1, WooCommerce URL guard
- https://github.com/sanity-io/hydrogen-sanity/tree/main/examples/storefront — Hydrogen 2026.4.2, tracks skeleton
- https://github.com/commerce-atoms/hydrogen-storefront-starter — Hydrogen 2026.4.2, modular boundaries
