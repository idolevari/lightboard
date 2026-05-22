# TypeScript Migration + Hydrogen 2026 Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Lightboard Hydrogen storefront from JavaScript to strict TypeScript and land six Hydrogen 2026 best-practice refactors (R1–R6) on a single feature branch `chore/typescript-migration`, opening one PR with ~14 commits across three phases (A: TS migration, B: refactors, C: docs).

**Architecture:** Phase A converts source files in dependency order (leaves first: `app/lib/` → `app/components/` → `app/routes/` → entry/configs) so each commit leaves `tsc --noEmit && npm run build` green. Phase B then layers refactors onto the fully-typed codebase. Each commit is independently bisectable.

**Tech Stack:** `@shopify/hydrogen@2026.4.1`, `react-router@7.12.0`, `typescript@5.9.2`, Vite 6, Shopify Oxygen. New dep: `schema-dts` (devDep, type-only).

**Spec:** `docs/superpowers/specs/2026-05-23-typescript-and-hydrogen-2026-refactor-design.md`

---

## Migration Patterns (read before any conversion task)

These patterns repeat across every `.js→.ts` / `.jsx→.tsx` conversion in Phase A. Internalize them once.

### Pattern A — Plain JS module → TS module

1. `git mv path/to/file.js path/to/file.ts` (preserves history).
2. Replace JSDoc `@typedef`/`@type` annotations with TS syntax:
   ```js
   // BEFORE
   /** @type {ShouldRevalidateFunction} */
   export const shouldRevalidate = ({formMethod, currentUrl, nextUrl}) => { ... };
   /** @typedef {import('react-router').ShouldRevalidateFunction} ShouldRevalidateFunction */

   // AFTER
   import type {ShouldRevalidateFunction} from 'react-router';
   export const shouldRevalidate: ShouldRevalidateFunction = ({formMethod, currentUrl, nextUrl}) => { ... };
   ```
3. For any `import {X}` where `X` is only used as a type, change to `import type {X}` (required by `verbatimModuleSyntax: true`). ESLint autofix on `@typescript-eslint/consistent-type-imports` handles most.
4. Function parameters that lack JSDoc and that `tsc` complains about: add explicit parameter types. Prefer narrow types over `any`.

### Pattern B — JSX module → TSX module

Same as Pattern A, plus:
1. `git mv path/to/file.jsx path/to/file.tsx`.
2. Component prop type aliases — declare a `type FooProps = {...}` and use destructuring with that annotation. Example:
   ```tsx
   // BEFORE
   /**
    * @param {{children?: React.ReactNode}}
    */
   export function Layout({children}) { ... }

   // AFTER
   type LayoutProps = {children?: React.ReactNode};
   export function Layout({children}: LayoutProps) { ... }
   ```
3. Event handlers — let inference work first; only add explicit `React.ChangeEvent<HTMLInputElement>` etc. when `tsc` complains.

### Pattern C — Route file (`.jsx` → `.tsx`)

1. `git mv app/routes/<route>.jsx app/routes/<route>.tsx`.
2. Replace JSDoc `Route.LoaderArgs` references with `import type {Route} from './+types/<route-basename>'`:
   ```tsx
   // BEFORE
   /** @param {Route.LoaderArgs} args */
   export async function loader(args) { ... }
   /** @typedef {import('./+types/products.$handle').Route} Route */

   // AFTER
   import type {Route} from './+types/($locale).products.$handle';
   export async function loader(args: Route.LoaderArgs) { ... }
   ```
   The route basename mirrors the file name with the dollar/parenthesis prefixes preserved.
3. Default export's component arg becomes `loaderData`-bound:
   ```tsx
   export default function Product({loaderData}: Route.ComponentProps) {
     const {product} = loaderData;
     // ...
   }
   ```
4. `meta` exports: type as `Route.MetaFunction`.
5. `action` exports: type as `Route.ActionArgs`.

### Pattern D — Per-commit verification

Every Phase A commit ends with:

```bash
npm run codegen     # refreshes RR types + storefrontapi types
npm run typecheck   # tsc --noEmit
npm run build       # must succeed
```

If `typecheck` fails: fix the typing issues before committing. Never `// @ts-expect-error` or `any` your way out unless explicitly authorized by Pattern E.

### Pattern E — Permitted `any` escapes

You may use `any` in these three situations only, each with an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment giving the reason:

1. Raw `metaobject.fields` arrays before they're normalized via the `readField` helper.
2. Third-party libs without good types (e.g., `react-easy-crop` props if needed).
3. Specific Shopify storefront return shapes that are awkward to thread through (rare).

If you reach for `any` anywhere else, stop and consult the spec or fix the underlying issue.

### Pattern F — Always use `import type` for types

`verbatimModuleSyntax: true` enforces this. ESLint will flag any violations. Rule of thumb: if the import is only used in a type position (function signature, type alias, generic parameter), it's `import type`.

---

## File structure overview

| Path | Final state |
|---|---|
| `tsconfig.json` | NEW — replaces `jsconfig.json` |
| `jsconfig.json` | DELETED |
| `package.json` | MODIFIED — `typecheck` script, `schema-dts` devDep |
| `eslint.config.js` → `eslint.config.ts` | MOVED + simplified |
| `app/lib/*.js` (17 files) | → `.ts` |
| `app/components/*.jsx` (22 files) | → `.tsx` |
| `app/routes/*.jsx` (~30 files) | → `.tsx` (or `.ts` for non-JSX exports like sitemap) |
| `app/root.jsx`, `entry.{client,server}.jsx` | → `.tsx` |
| `app/routes.js` → `app/routes.ts` | MOVED |
| `server.js` → `server.ts` | MOVED |
| `vite.config.js` → `vite.config.ts` | MOVED |
| `react-router.config.js` → `react-router.config.ts` | MOVED |
| `.graphqlrc.js` → `.graphqlrc.ts` | MOVED |
| `scripts/admin-oauth.mjs` → `scripts/admin-oauth.mts` | MOVED (gitignored) |
| `scripts/push-policies.mjs` → `scripts/push-policies.mts` | MOVED (gitignored) |
| `scripts/woo-to-shopify.py` | UNTOUCHED |
| `app/lib/metaobject-types.ts` | NEW (Task 2) |
| `app/lib/.server/` directory | NEW (Task 8) — hosts 7 relocated server-only modules |
| `app/lib/.server/seo.server.ts` | NEW (Task 10) |
| `app/lib/.server/url.server.ts` | NEW (Task 13) |
| `app/components/RouteError.tsx` | NEW (Task 12) |
| `app/styles/*.css`, `policies/*.md`, `public/`, `app/lib/i18n/*.json` | UNTOUCHED |
| `CLAUDE.md`, `README.md` | MODIFIED (Task 14) |

---

## Task 0: Create the feature branch

**Files:** None (git only)

- [ ] **Step 1: Verify clean main**

```bash
cd "/Users/idolevari/Documents/Ido Lev Ari/lightboard"
git status
```

Expected: working tree has some unrelated WIP edits (PhotoCustomizer, ProductForm, css, i18n json). These must be **stashed** before starting — do not include them in the migration branch.

- [ ] **Step 2: Stash any WIP**

```bash
git stash push -u -m "WIP before TS migration branch"
git status
```

Expected: working tree clean.

- [ ] **Step 3: Create and checkout the branch**

```bash
git checkout -b chore/typescript-migration
git status
```

Expected: `On branch chore/typescript-migration`, clean tree.

---

## Task 1 (Commit 1): Tooling — tsconfig, package.json, ESLint

**Files:**
- Create: `tsconfig.json`
- Delete: `jsconfig.json`
- Modify: `package.json`
- Move: `eslint.config.js` → `eslint.config.ts`
- Modify: `eslint.config.ts` (simplified for TS-only project)

- [ ] **Step 1: Write `tsconfig.json`**

Create `tsconfig.json` (skeleton-aligned, `allowJs: false`):

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

- [ ] **Step 2: Delete `jsconfig.json`**

```bash
git rm jsconfig.json
```

- [ ] **Step 3: Add `typecheck` script and `schema-dts` dep to `package.json`**

In `package.json`:
- Add to `"scripts"`: `"typecheck": "tsc --noEmit"`
- Add to `"devDependencies"`: `"schema-dts": "^1.1.5"` (use latest stable at install time)

Then run:

```bash
npm install
```

Expected: lockfile updated, no errors.

- [ ] **Step 4: Move and simplify ESLint config**

```bash
git mv eslint.config.js eslint.config.ts
```

Then **simplify** `eslint.config.ts` — we no longer need the JS-specific blocks. The current file (250 lines) carries dual JS/TS configuration. Trim to TS-only. Replace the entire file with:

```ts
import {fixupConfigRules, fixupPluginRules} from '@eslint/compat';
import eslintComments from 'eslint-plugin-eslint-comments';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11Y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import _import from 'eslint-plugin-import';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      '**/node_modules/',
      '**/build/',
      '**/dist/',
      '**/*.graphql.d.ts',
      '**/*.graphql.ts',
      '**/*.generated.d.ts',
      '**/.react-router/',
    ],
  },
  ...fixupConfigRules(
    compat.extends(
      'eslint:recommended',
      'plugin:eslint-comments/recommended',
      'plugin:react/recommended',
      'plugin:react/jsx-runtime',
      'plugin:react-hooks/recommended',
      'plugin:jsx-a11y/recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:import/recommended',
      'plugin:import/typescript',
    ),
  ).map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'eslint-comments': fixupPluginRules(eslintComments),
      react: fixupPluginRules(react),
      'react-hooks': fixupPluginRules(reactHooks),
      'jsx-a11y': fixupPluginRules(jsxA11Y),
      '@typescript-eslint': fixupPluginRules(typescriptEslint),
      import: fixupPluginRules(_import),
    },
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaFeatures: {jsx: true},
      },
    },
    settings: {
      react: {version: 'detect'},
      formComponents: ['Form'],
      linkComponents: [
        {name: 'Link', linkAttribute: 'to'},
        {name: 'NavLink', linkAttribute: 'to'},
      ],
      'import/internal-regex': '^~/',
      'import/resolver': {
        typescript: {alwaysTryTypes: true, project: __dirname},
      },
    },
    rules: {
      'eslint-comments/no-unused-disable': 'error',
      'no-console': ['warn', {allow: ['warn', 'error']}],
      'no-use-before-define': 'off',
      'no-warning-comments': 'off',
      'object-shorthand': ['error', 'always', {avoidQuotes: true}],
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
      'jsx-a11y/control-has-associated-label': 'off',
      'jsx-a11y/label-has-for': 'off',
      'react/display-name': 'off',
      'react/no-array-index-key': 'warn',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {prefer: 'type-imports', fixStyle: 'separate-type-imports'},
      ],
      'import/no-unresolved': ['error', {ignore: ['^virtual:']}],
    },
  },
  {
    files: ['**/*.server.*', '**/.server/**/*'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
```

Three things changed from the current config:
1. All file globs are now `.{ts,tsx}` only.
2. Added `@typescript-eslint/consistent-type-imports: error` with autofix → enforces `import type {X}` per `verbatimModuleSyntax`.
3. Removed the jest test config (no test suite exists).
4. Tightened `no-explicit-any` from `off` → `warn`.

- [ ] **Step 5: Verify tooling passes**

`tsconfig.json` is in place but no source files are yet TS, so `tsc --noEmit` should pass trivially. Run:

```bash
npm run codegen     # refreshes generated types so .react-router/types exists
npm run typecheck
npm run build
```

Expected: all three succeed. `typecheck` reports 0 errors (only ambient files match the include glob).

- [ ] **Step 6: Verify the dev server still boots**

```bash
npm run dev
```

Open http://localhost:3000 → confirm homepage renders. Stop the server (Ctrl-C).

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json package.json package-lock.json eslint.config.ts
git rm jsconfig.json eslint.config.js 2>/dev/null || true   # if not already staged
git status
git commit -m "$(cat <<'EOF'
chore(ts): add tsconfig, npm scripts, eslint config

Adds skeleton-aligned tsconfig.json (replaces jsconfig.json), introduces
a typecheck script, adds schema-dts devDep, and simplifies eslint.config
to TS-only with consistent-type-imports enforcement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 (Commit 2): Convert `app/lib/*`

**Files:**
- Rename 17 files in `app/lib/` from `.js` → `.ts`
- Create: `app/lib/metaobject-types.ts`

The 17 files to rename:

```
app/lib/brand.js
app/lib/coming-soon.js
app/lib/context.js
app/lib/fragments.js
app/lib/meta-pixel.jsx       (this one is .jsx → .tsx)
app/lib/meta.js
app/lib/orderFilters.js
app/lib/photo-canvas.js
app/lib/productOptionLabels.js
app/lib/redirect.js
app/lib/sanitize.js
app/lib/search.js
app/lib/session.js
app/lib/shopify-admin.js
app/lib/surprise-gallery.js
app/lib/useI18n.js           (likely .ts; no JSX in current file)
app/lib/useInView.js         (likely .ts; no JSX)
app/lib/variants.js
app/lib/i18n.js
```

(That's 19 files — the design said 17; quick recount of `app/lib/` may differ. Use `find app/lib -maxdepth 1 -type f` to get the exact list at task time.)

- [ ] **Step 1: List current files in `app/lib/`**

```bash
find app/lib -maxdepth 1 -type f
```

Note the actual list. Each `.js` → `.ts`. The only `.jsx` is `meta-pixel.jsx` → `.tsx` because it returns React elements.

- [ ] **Step 2: Create `app/lib/metaobject-types.ts`**

This module exports the concrete shapes our routes/components need from Shopify metaobjects (which arrive as untyped `{key, value, reference?}[]` arrays from codegen).

```ts
// app/lib/metaobject-types.ts

/**
 * Raw metaobject field shape from the Storefront API. The exact shape comes from
 * storefrontapi.generated.d.ts but the array form is loose, so we provide a
 * narrower helper and concrete type aliases for each metaobject type we use.
 */
export type MetaobjectField = {
  key: string;
  value: string | null;
  type?: string;
  reference?: {
    __typename?: string;
    image?: {url: string; altText?: string | null; width?: number | null; height?: number | null} | null;
    [key: string]: unknown;
  } | null;
  references?: {nodes?: Array<MetaobjectReference>} | null;
};

export type MetaobjectReference = {
  id?: string;
  handle?: string;
  type?: string;
  fields?: Array<MetaobjectField>;
};

/** Read a single field by key from a metaobject's fields[] array, with a fallback. */
export function readField<T extends string | null = string | null>(
  fields: Array<MetaobjectField> | null | undefined,
  key: string,
  fallback: T,
): T {
  if (!fields) return fallback;
  const field = fields.find((f) => f.key === key);
  if (!field) return fallback;
  return (field.value ?? fallback) as T;
}

// ---- Bilingual content metaobjects ----

export type HomepageHero = {
  eyebrowHe: string | null;
  eyebrowEn: string | null;
  titleLine1He: string | null;
  titleLine1En: string | null;
  titleLine2He: string | null;
  titleLine2En: string | null;
  kickerHe: string | null;
  kickerEn: string | null;
  ctaLabelHe: string | null;
  ctaLabelEn: string | null;
  ctaHref: string | null;
  tapeHe: string | null;
  tapeEn: string | null;
};

export type StoryStat = {
  value: string;
  labelHe: string | null;
  labelEn: string | null;
  position: number;
};

export type HomepageStory = {
  tagHe: string | null;
  tagEn: string | null;
  eyebrowHe: string | null;
  eyebrowEn: string | null;
  titleHe: string | null;
  titleEn: string | null;
  paragraphHe: string | null;
  paragraphEn: string | null;
  stats: Array<StoryStat>;
};

export type FaqItem = {
  id: string;
  questionHe: string | null;
  questionEn: string | null;
  answerHe: string | null;
  answerEn: string | null;
  position: number;
};

export type Testimonial = {
  id: string;
  bodyHe: string | null;
  bodyEn: string | null;
  attributionHe: string | null;
  attributionEn: string | null;
  position: number;
};

export type HeroSlide = {
  id: string;
  image: {url: string; altText: string | null; width: number | null; height: number | null} | null;
  label: string | null;
  mobilePosition: string | null;
  position: number;
};

export type ProductSpec = {
  id: string;
  labelHe: string | null;
  labelEn: string | null;
  valueHe: string | null;
  valueEn: string | null;
  position: number;
};
```

- [ ] **Step 3: Rename and convert each `app/lib/*.js` to `.ts`**

For each file in `app/lib/` (excluding `i18n/` subdirectory and `metaobject-types.ts` you just created):

```bash
git mv app/lib/<name>.js app/lib/<name>.ts
# (or .jsx → .tsx for meta-pixel)
```

Then open the file and apply Pattern A (or B for `.tsx`). The recurring concrete edits:

1. **Convert `@type`/`@typedef` JSDoc to inline TS types.** Example for `app/lib/context.ts`:
   ```ts
   // BEFORE
   /** @typedef {Class<additionalContext>} AdditionalContextType */

   // AFTER (export and use as a real type)
   export type AdditionalContextType = typeof additionalContext;
   ```
2. **Add explicit param types where JSDoc was used.** Example for `createHydrogenRouterContext`:
   ```ts
   export async function createHydrogenRouterContext(
     request: Request,
     env: Env,
     executionContext: ExecutionContext,
   ) { ... }
   ```
3. **`coming-soon.ts`** — type the request/env params:
   ```ts
   export function isLaunchGateActive(request: Request, env: Env): boolean { ... }
   ```
4. **`session.ts`** — `AppSession.init(request, secrets)` becomes `AppSession.init(request: Request, secrets: Array<string>)`. The class methods need explicit return types only if `tsc` complains.
5. **`i18n.ts`** — export a `Locale = 'he' | 'en'` union and use it throughout:
   ```ts
   export type Locale = 'he' | 'en';
   export const DEFAULT_LOCALE: Locale = 'he';
   export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ['he', 'en'] as const;

   export function detectLocaleFromRequest(request: Request): Locale { ... }
   export function getDictionary(locale: Locale): Dictionary { ... }
   ```
   Define `Dictionary` by `typeof import('./i18n/he.json')` so the JSON shapes drive the type:
   ```ts
   import heDict from './i18n/he.json';
   export type Dictionary = typeof heDict;
   ```
6. **`meta-pixel.tsx`** — type the component props and the window-level pixel API:
   ```tsx
   type MetaPixelScriptProps = {pixelId: string | null; nonce?: string};
   export function MetaPixelScript({pixelId, nonce}: MetaPixelScriptProps) { ... }

   declare global {
     interface Window {
       fbq?: ((event: string, ...args: Array<unknown>) => void) & {
         queue?: Array<unknown>;
         loaded?: boolean;
         version?: string;
       };
     }
   }
   ```
7. **`sanitize.ts`** — `export function sanitize(html: string): string` and `export function sanitizeInline(html: string): string`.
8. **`photo-canvas.ts`** — type the canvas helpers. `ALLOWED_PHOTO_TYPES: ReadonlyArray<string>`. Crop/resize helpers take `HTMLCanvasElement`/`HTMLImageElement` etc.
9. **`fragments.ts`** — pure string template literals; no types needed beyond the file rename.
10. **`useI18n.ts`** and **`useInView.ts`** — hooks. `useI18n()` returns `{locale: Locale; dict: Dictionary; t: (key: string) => string}` (loose `t` typing intentional). `useInView()` returns `[React.RefObject<HTMLElement>, boolean]`.
11. **`variants.ts`, `orderFilters.ts`, `productOptionLabels.ts`, `search.ts`, `brand.ts`, `redirect.ts`, `shopify-admin.ts`, `surprise-gallery.ts`, `meta.ts`** — apply Pattern A. Most just need parameter types and explicit return types.

For each conversion, run `npm run typecheck` and fix any new errors before moving to the next file.

- [ ] **Step 4: Verify the whole lib layer passes typecheck and build**

```bash
npm run codegen
npm run typecheck
npm run build
```

Expected: 0 typecheck errors, build succeeds.

- [ ] **Step 5: Verify dev server still boots**

```bash
npm run dev
```

Open homepage → confirm renders (note: components and routes still import from `~/lib/*` as before — the path alias is unchanged so imports continue to resolve).

- [ ] **Step 6: Commit**

```bash
git add app/lib/
git status
git commit -m "$(cat <<'EOF'
chore(ts): convert app/lib/* to TypeScript

Renames 17 modules under app/lib/ from .js/.jsx to .ts/.tsx, replaces JSDoc
@type/@typedef annotations with TS syntax, and adds app/lib/metaobject-types.ts
with concrete shapes for the Shopify metaobjects we read (HomepageHero,
HomepageStory, FaqItem, Testimonial, HeroSlide, ProductSpec, StoryStat) plus
a readField<T>() helper.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 (Commit 3): Convert `app/components/*`

**Files:**
- Rename 22 files in `app/components/` from `.jsx` → `.tsx`. Includes the `PhotoCustomizer/` subdirectory.

Known components:
- `AccessibilityMenu.jsx`, `AddToCartButton.jsx`, `Aside.jsx`, `CartLineItem.jsx`, `CartMain.jsx`, `CartSummary.jsx`, `ComingSoon.jsx`, `Footer.jsx`, `Header.jsx`, `MockShopNotice.jsx`, `PageLayout.jsx`, `PaginatedResourceSection.jsx`, `ProductForm.jsx`, `ProductImage.jsx`, `ProductItem.jsx`, `ProductPrice.jsx`, `SearchForm.jsx`, `SearchFormPredictive.jsx`, `SearchResults.jsx`, `SearchResultsPredictive.jsx`, `WhatsAppButton.jsx`, plus the `PhotoCustomizer/` subdir.

- [ ] **Step 1: List actual component files**

```bash
find app/components -type f \( -name "*.jsx" -o -name "*.js" \)
```

- [ ] **Step 2: Convert each component (apply Pattern B)**

For each component:

```bash
git mv app/components/<Name>.jsx app/components/<Name>.tsx
```

Then add a `type FooProps = {...}` for every component's props. Examples:

```tsx
// Header.tsx (typical pattern)
type HeaderProps = {
  header: HeaderQuery;
  cart: Promise<CartReturn | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  locale: Locale;
};

export function Header({header, cart, isLoggedIn, publicStoreDomain, locale}: HeaderProps) { ... }
```

```tsx
// PageLayout.tsx
type PageLayoutProps = {
  children?: React.ReactNode;
  cart: Promise<CartReturn | null>;
  header: HeaderQuery;
  footer: Promise<FooterQuery | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  locale: Locale;
  dict: Dictionary;
};

export function PageLayout({children, ...props}: PageLayoutProps) { ... }
```

```tsx
// CartLineItem.tsx
import type {CartLine} from '@shopify/hydrogen/storefront-api-types';
type CartLineItemProps = {line: CartLine; layout: 'aside' | 'page'};
```

Use Hydrogen and storefrontapi-generated types for cart/product/order/collection shapes:
- `CartLine`, `CartReturn` from `@shopify/hydrogen/storefront-api-types`
- `ProductFragment`, `ProductVariantFragment`, `CollectionFragment`, `HeaderQuery`, `FooterQuery` from `storefrontapi.generated`

For `PhotoCustomizer/` files (`PhotoCustomizer.jsx`, `BoardCanvas.jsx` — note: the user has WIP edits here pre-stash; they'll merge those after the migration lands), apply Pattern B file-by-file. The canvas/blob/file APIs already have DOM lib types via the `lib: ["DOM"]` setting.

After each file: `npm run typecheck`. Fix issues immediately.

- [ ] **Step 3: Verify the components layer compiles**

```bash
npm run codegen
npm run typecheck
npm run build
```

Expected: 0 errors. Build still succeeds (it doesn't know about the routes/entry yet — they still import these components by path alias).

- [ ] **Step 4: Smoke the dev server**

```bash
npm run dev
```

Open homepage and one product page → confirm renders.

- [ ] **Step 5: Commit**

```bash
git add app/components/
git status
git commit -m "$(cat <<'EOF'
chore(ts): convert app/components/* to TypeScript

Renames 22 components (including the PhotoCustomizer subdirectory) from
.jsx to .tsx and adds explicit prop type aliases for each component. Uses
generated Hydrogen + Storefront API types for cart/product/collection shapes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 (Commit 4): Convert `app/routes/*` (leaves)

**Files:** Convert the smaller leaf routes — account, policies, blogs, search, pages, sitemap, robots, preview, discount, $.jsx, api.photos.upload.

Files in scope (verify with `find app/routes -name "*.jsx" -not -name "*products*" -not -name "*collections*" -not -name "*cart*" -not -name "_index*"`):

```
app/routes/($locale).account._index.jsx
app/routes/($locale).account.$.jsx
app/routes/($locale).account.addresses.jsx
app/routes/($locale).account.orders._index.jsx
app/routes/($locale).account.orders.$id.jsx
app/routes/($locale).account.profile.jsx
app/routes/($locale).account_.authorize.jsx
app/routes/($locale).account_.login.jsx
app/routes/($locale).blogs.$blogHandle.$articleHandle.jsx
app/routes/($locale).blogs.$blogHandle._index.jsx
app/routes/($locale).blogs._index.jsx
app/routes/($locale).discount.$code.jsx
app/routes/($locale).pages.$handle.jsx
app/routes/($locale).policies.$handle.jsx
app/routes/($locale).policies._index.jsx
app/routes/($locale).search.jsx
app/routes/($locale).$.jsx
app/routes/[sitemap.xml].jsx
app/routes/sitemap.$type.$page[.xml].jsx
app/routes/api.photos.upload.jsx
app/routes/preview.jsx
```

That's ~21 files. Some return non-JSX responses (sitemap, api.photos.upload, preview) and should use `.ts` not `.tsx`:
- `[sitemap.xml].jsx` → `.ts` (returns a `Response`)
- `sitemap.$type.$page[.xml].jsx` → `.ts`
- `api.photos.upload.jsx` → `.ts`
- `preview.jsx` → `.ts`

All others → `.tsx`.

- [ ] **Step 1: Convert each route (Pattern C)**

For each file:

```bash
git mv app/routes/<route-file>.jsx app/routes/<route-file>.{ts,tsx}
```

Then:
1. Replace JSDoc loader/action arg types with `import type {Route} from './+types/<basename>'`.
2. Add `: Route.LoaderArgs` / `: Route.ActionArgs` / `: Route.MetaFunction` to the relevant exports.
3. If a default export exists: `export default function Foo({loaderData}: Route.ComponentProps) { ... }`.
4. Verify that `npm run codegen` regenerates the `./+types/<basename>` files (it should — `react-router typegen` walks the routes config).

Special notes:
- **`api.photos.upload.ts`**: this is an `action`-only route returning `Response`. Use `Route.ActionArgs`. The current file uses `request.formData()` heavily — type the formData entries explicitly with `instanceof File` narrowing.
- **`[sitemap.xml].ts` and `sitemap.$type.$page[.xml].ts`**: loader-only. Return `getSitemapIndex(...)` / `getSitemap(...)` — already typed by Hydrogen.
- **`preview.ts`**: the bypass cookie route. Uses `URL.searchParams.get`, `crypto.timingSafeEqual` (Workers crypto). Use `Route.LoaderArgs`.
- **`($locale).account.orders.*.tsx`**: already use `customerAccount.query(...)`. Replace `/** @typedef {import('customer-accountapi.generated').*Fragment} */` with proper TS `import type {...} from 'customer-accountapi.generated';`.
- **`($locale).search.tsx`**: complex file (336 lines). Type `loader`'s discriminated union return — `{type: 'regular', term, result}` vs `{type: 'predictive', term, result}`. The `predictiveSearch`/`regularSearch` helper functions need explicit return types.

After each file: `npm run typecheck`. Fix issues before moving on.

- [ ] **Step 2: Verify the layer**

```bash
npm run codegen
npm run typecheck
npm run build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 3: Smoke the dev server**

```bash
npm run dev
```

Walk through: `/policies`, `/policies/refund-policy` (or whatever exists), `/search?q=lightboard`, `/blogs`, `/sitemap.xml`, `/account/login` (redirect), 404 path like `/asdf`. Confirm each renders/responds.

- [ ] **Step 4: Commit**

```bash
git add app/routes/
git status
git commit -m "$(cat <<'EOF'
chore(ts): convert app/routes/* leaves to TypeScript

Converts ~21 leaf routes (account, policies, blogs, search, pages, sitemap,
robots, preview, discount, $.jsx, api.photos.upload) from .jsx to .tsx (or
.ts for non-JSX response routes). Replaces JSDoc Route.* references with
generated +types imports.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 (Commit 5): Convert `app/routes/*` (commerce)

**Files:** The big commerce loaders.

```
app/routes/($locale)._index.jsx                  → .tsx   (homepage)
app/routes/($locale).products.$handle.jsx        → .tsx   (PDP)
app/routes/($locale).collections.$handle.jsx     → .tsx   (PLP)
app/routes/($locale).collections.all.jsx         → .tsx
app/routes/($locale).collections._index.jsx      → .tsx
app/routes/($locale).cart.jsx                    → .tsx
```

These are the routes with the heaviest GraphQL queries and the most metaobject access. The metaobject helpers from Task 2 (`readField`, `HomepageHero` etc.) become essential here.

- [ ] **Step 1: Convert `($locale).cart.tsx`**

Pattern C. The `action` export needs `Route.ActionArgs`. The cart loader and action work with `CartReturn` from `@shopify/hydrogen`.

Specific edits:
- Type the `formData.get('cartFormInput')` parse result. Use the helper from `@shopify/hydrogen`: `const {action, inputs} = CartForm.getFormInput(formData);`
- `action` typing example:
  ```tsx
  export async function action({request, context}: Route.ActionArgs) {
    const {cart} = context;
    const formData = await request.formData();
    const {action, inputs} = CartForm.getFormInput(formData);
    let status = 200;
    let result: CartReturn | undefined;
    switch (action) {
      case CartForm.ACTIONS.LinesAdd:
        result = await cart.addLines(inputs.lines);
        break;
      // ... etc
    }
    // ...
  }
  ```

Run `npm run typecheck && npm run build`. Fix.

- [ ] **Step 2: Convert `($locale).products.$handle.tsx`**

Largest single route file. Already uses `Promise.all` (line 105) and has good structure. Apply Pattern C plus:
- Type `meta` export: `export const meta: Route.MetaFunction = ({data}) => { ... }`.
- The `selectedVariant` calculation uses `useOptimisticVariant` — typed by Hydrogen.
- The photo-customizer integration passes `ProductVariantFragment` props — type accordingly.

Run typecheck + build.

- [ ] **Step 3: Convert `($locale).collections.$handle.tsx`, `collections.all.tsx`, `collections._index.tsx`**

Standard PLP loaders. Each returns `{collection, products}` or similar. Type via `Route.LoaderArgs`.

The `getPaginationVariables` helper is typed by Hydrogen.

Run typecheck + build after each.

- [ ] **Step 4: Convert `($locale)._index.tsx` (homepage)**

This is the route with the most metaobject queries (FAQs, Testimonials, HeroSlides, HomepageSections). Use the `MetaobjectField` / `HomepageHero` / `Testimonial` / `FaqItem` / `HeroSlide` types from `app/lib/metaobject-types.ts`.

Pattern: extract a helper per metaobject inside this file (or under `app/lib/.server/homepage.server.ts` — but defer that to R5, Task 8). For now, just type inline.

Example for the FAQ list:
```tsx
import type {FaqItem} from '~/lib/metaobject-types';
import {readField} from '~/lib/metaobject-types';

type FaqsQueryResponse = {metaobjects: {nodes: Array<{id: string; fields: Array<MetaobjectField>}>}};

function parseFaqs(response: FaqsQueryResponse | null): Array<FaqItem> {
  if (!response?.metaobjects?.nodes) return [];
  return response.metaobjects.nodes
    .map((node) => ({
      id: node.id,
      questionHe: readField(node.fields, 'question_he', null),
      questionEn: readField(node.fields, 'question_en', null),
      answerHe: readField(node.fields, 'answer_he', null),
      answerEn: readField(node.fields, 'answer_en', null),
      position: Number(readField(node.fields, 'position', '0')),
    }))
    .sort((a, b) => a.position - b.position);
}
```

Run typecheck + build.

- [ ] **Step 5: Verify the layer**

```bash
npm run codegen
npm run typecheck
npm run build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 6: Smoke the dev server**

```bash
npm run dev
```

Walk through: `/` (homepage with hero, FAQ, testimonials), `/products/lightboard` (full PDP), `/collections/all`, `/collections/<handle>`, `/cart` (add then remove a line item). Confirm everything renders.

- [ ] **Step 7: Commit**

```bash
git add app/routes/
git status
git commit -m "$(cat <<'EOF'
chore(ts): convert app/routes/* commerce loaders to TypeScript

Converts the six high-traffic commerce routes (homepage, PDP, PLP, cart,
collections index) from .jsx to .tsx. Types metaobject access via the new
readField<T>() helper and the bilingual content type aliases.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 (Commit 6): Convert app entry & layout

**Files:**
- `app/root.jsx` → `app/root.tsx`
- `app/entry.client.jsx` → `app/entry.client.tsx`
- `app/entry.server.jsx` → `app/entry.server.tsx`
- `app/routes.js` → `app/routes.ts`
- `app/routes/($locale).jsx` → `app/routes/($locale).tsx` (the locale layout)

- [ ] **Step 1: Convert `app/root.tsx`**

```bash
git mv app/root.jsx app/root.tsx
```

Major edits:
1. Replace the JSDoc `Route` typedef at the bottom with a real import:
   ```tsx
   import type {Route} from './+types/root';
   ```
2. Type `shouldRevalidate`:
   ```tsx
   import type {ShouldRevalidateFunction} from 'react-router';
   export const shouldRevalidate: ShouldRevalidateFunction = ({formMethod, currentUrl, nextUrl}) => { ... };
   ```
3. Type the `loader` and the helper functions:
   ```tsx
   export async function loader(args: Route.LoaderArgs) { ... }
   async function loadCriticalData({context}: Route.LoaderArgs) { ... }
   function loadDeferredData({context}: Route.LoaderArgs) { ... }
   ```
4. Type the `Layout` component props:
   ```tsx
   type LayoutProps = {children?: React.ReactNode};
   export function Layout({children}: LayoutProps) { ... }
   ```
5. Type the `App` component (no props):
   ```tsx
   export type RootLoader = typeof loader;
   export default function App() {
     const data = useRouteLoaderData<RootLoader>('root');
     // ...
   }
   ```
6. Type `ErrorBoundary` (no props; uses `useRouteError()` which is typed by RR).
7. Delete the JSDoc `@typedef` block at the bottom.

Run `npm run typecheck && npm run build`. Fix.

- [ ] **Step 2: Convert `app/entry.client.tsx`**

```bash
git mv app/entry.client.jsx app/entry.client.tsx
```

Small file. The hydration code is unchanged; just rename. No props or args to type. Run typecheck.

- [ ] **Step 3: Convert `app/entry.server.tsx`**

```bash
git mv app/entry.server.jsx app/entry.server.tsx
```

Replace the JSDoc `@param` block at the top with typed args:
```tsx
import type {EntryContext} from 'react-router';
import type {HydrogenRouterContextProvider} from '@shopify/hydrogen';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) { ... }
```

The CSP allowlist (imgSrc/scriptSrc/etc.) is already a typed `Array<string>`. No code changes beyond the signature.

Delete the JSDoc typedef block at the bottom.

Run typecheck + build.

- [ ] **Step 4: Convert `app/routes.ts`**

```bash
git mv app/routes.js app/routes.ts
```

Most likely a one-line `export default ... satisfies RouteConfig` from `@react-router/dev/routes`. Add the `RouteConfig` type import.

- [ ] **Step 5: Convert `app/routes/($locale).tsx`**

```bash
git mv app/routes/\(\$locale\).jsx app/routes/\(\$locale\).tsx
```

This is the locale-layout route. Type its loader as `Route.LoaderArgs`. It's likely small (the file already has `params.locale` access on line 22 per earlier audit).

- [ ] **Step 6: Verify the entry layer**

```bash
npm run codegen
npm run typecheck
npm run build
```

Expected: 0 errors. **This is the most important verification point in Phase A** — if `root.tsx`/`entry.server.tsx` have type errors, every route inherits the problem.

- [ ] **Step 7: Smoke the dev server end-to-end**

```bash
npm run dev
```

Full smoke: `/` → product → cart → checkout-link → search → preview → 404. Watch the browser console for any new warnings.

- [ ] **Step 8: Commit**

```bash
git add app/root.tsx app/entry.client.tsx app/entry.server.tsx app/routes.ts app/routes/\(\$locale\).tsx
git commit -m "$(cat <<'EOF'
chore(ts): convert app entry & layout to TypeScript

Converts root.tsx, entry.client.tsx, entry.server.tsx, routes.ts, and the
($locale).tsx layout. Types shouldRevalidate, loader helpers (loadCriticalData
/ loadDeferredData), Layout, App, ErrorBoundary, and handleRequest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 (Commit 7): Convert top-level configs + scripts

**Files:**
- `server.js` → `server.ts`
- `vite.config.js` → `vite.config.ts`
- `react-router.config.js` → `react-router.config.ts`
- `.graphqlrc.js` → `.graphqlrc.ts`
- gitignored: `scripts/admin-oauth.mjs` → `scripts/admin-oauth.mts`
- gitignored: `scripts/push-policies.mjs` → `scripts/push-policies.mts`

`scripts/woo-to-shopify.py` remains untouched.

- [ ] **Step 1: Convert `server.ts`**

```bash
git mv server.js server.ts
```

Add typed handler signature:

```ts
import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';

export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      const hydrogenContext = await createHydrogenRouterContext(request, env, executionContext);
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
      });
      const response = await handleRequest(request);
      if (hydrogenContext.session.isPending) {
        response.headers.set('Set-Cookie', await hydrogenContext.session.commit());
      }
      if (response.status === 404) {
        return storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
      }
      return response;
    } catch (error) {
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};
```

`Env` is provided ambient via `@shopify/oxygen-workers-types`. `ExecutionContext` likewise.

- [ ] **Step 2: Convert `vite.config.ts`**

```bash
git mv vite.config.js vite.config.ts
```

Almost no code change — `defineConfig` already infers types from `vite`. Just rename and re-save.

- [ ] **Step 3: Convert `react-router.config.ts`**

```bash
git mv react-router.config.js react-router.config.ts
```

Add the `Config` type from `@react-router/dev/config`:

```ts
import {hydrogenPreset} from '@shopify/hydrogen/react-router-preset';
import type {Config} from '@react-router/dev/config';

export default {
  presets: [hydrogenPreset()],
} satisfies Config;
```

Delete the JSDoc `@typedef` line.

- [ ] **Step 4: Convert `.graphqlrc.ts`**

```bash
git mv .graphqlrc.js .graphqlrc.ts
```

Add minimal typing — `graphql-config` exports `IGraphQLConfig`:

```ts
import type {IGraphQLConfig} from 'graphql-config';
// ... existing config logic
export default config satisfies IGraphQLConfig;
```

- [ ] **Step 5: Convert gitignored scripts**

```bash
mv scripts/admin-oauth.mjs scripts/admin-oauth.mts
mv scripts/push-policies.mjs scripts/push-policies.mts
```

(Not `git mv` — they're gitignored.)

These are node CLI scripts. Add typed signatures where helpful but they don't need to satisfy `tsc --noEmit` against our `tsconfig.json` since they're outside the `include` glob. To run them you'll need to either use a runner like `tsx`, or keep them executable with `node --experimental-strip-types scripts/admin-oauth.mts` (Node 22+ supports stripping types). Document the run command at the top of each file as a comment if it changed.

- [ ] **Step 6: Final Phase A verification**

```bash
npm run codegen
npm run typecheck
npm run build
npm run lint
npm run dev      # smoke
```

All five must succeed. This is the **Phase A merge gate** — if you stopped here, the branch would be mergeable on its own.

- [ ] **Step 7: Commit**

```bash
git add server.ts vite.config.ts react-router.config.ts .graphqlrc.ts
# scripts/*.mts are gitignored — no git add needed
git status
git commit -m "$(cat <<'EOF'
chore(ts): convert top-level configs and scripts to TypeScript

Converts server.ts, vite.config.ts, react-router.config.ts, and .graphqlrc.ts.
Also locally renames the gitignored scripts/admin-oauth.mts and
scripts/push-policies.mts (not in the diff; woo-to-shopify.py stays Python).

Phase A (TS migration) is complete. The branch is now fully TypeScript with
no behavior changes; it would be mergeable on its own at this point.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 (Commit 8) — R5: Move server-only utils to `app/lib/.server/`

**Files:** Relocate these from `app/lib/` to `app/lib/.server/`:

```
app/lib/coming-soon.ts        → app/lib/.server/coming-soon.server.ts
app/lib/redirect.ts           → app/lib/.server/redirect.server.ts
app/lib/shopify-admin.ts      → app/lib/.server/shopify-admin.server.ts
app/lib/surprise-gallery.ts   → app/lib/.server/surprise-gallery.server.ts
app/lib/session.ts            → app/lib/.server/session.server.ts
```

Two more are candidates but only partially server-side; we'll **keep them in `app/lib/`** and split if needed later:
- `app/lib/photo-canvas.ts` — has both client (canvas/blob manipulation in browser) and server (used by api.photos.upload) code. Split would be intrusive; leave for a follow-up.
- `app/lib/sanitize.ts` — sanitize-html is used server-side primarily, but importing it is harmless on the client. Leave for a follow-up.

Note: RR v7 treats files matching `*.server.*` OR under a `.server/` directory as never-bundled-to-client. Using both the directory and the suffix is belt-and-braces.

- [ ] **Step 1: Create the `.server/` directory and move files**

```bash
mkdir -p app/lib/.server
git mv app/lib/coming-soon.ts app/lib/.server/coming-soon.server.ts
git mv app/lib/redirect.ts app/lib/.server/redirect.server.ts
git mv app/lib/shopify-admin.ts app/lib/.server/shopify-admin.server.ts
git mv app/lib/surprise-gallery.ts app/lib/.server/surprise-gallery.server.ts
git mv app/lib/session.ts app/lib/.server/session.server.ts
```

- [ ] **Step 2: Update every import in `app/`**

Repo-wide search for `from '~/lib/coming-soon'` (and same for redirect/shopify-admin/surprise-gallery/session). Replace with `from '~/lib/.server/coming-soon.server'` (note the file rename keeps the import path explicit and `.server`-suffixed for clarity).

```bash
# Audit affected imports:
grep -rn "from '~/lib/coming-soon\|from '~/lib/redirect\|from '~/lib/shopify-admin\|from '~/lib/surprise-gallery\|from '~/lib/session'" app/

# After confirming the list (~10-20 import sites), update them. Example sed (test before applying):
# Edit each file with the Edit tool one at a time to avoid accidental matches.
```

For each file in the grep output, run an `Edit` with the exact `from '~/lib/<name>'` → `from '~/lib/.server/<name>.server'` substitution.

- [ ] **Step 3: Verify`tsc` and build still pass**

```bash
npm run codegen
npm run typecheck
npm run build
```

Expected: 0 errors. The path alias `~/*` resolves the new location.

- [ ] **Step 4: Verify client bundle no longer includes server modules**

```bash
npm run build 2>&1 | grep -i "session\|coming-soon\|shopify-admin\|surprise-gallery\|redirect" || echo "Server-only code stayed server-side ✓"
```

Note: this is a sanity check; the build output should not include those module names in the client chunk listing.

- [ ] **Step 5: Smoke the dev server**

```bash
npm run dev
```

Walk through any flow that exercises the moved modules: launch gate (`COMING_SOON=true` env), photo upload (uses `shopify-admin` server-side), preview cookie (`/preview?token=...`), session restoration.

- [ ] **Step 6: Commit**

```bash
git add app/
git status
git commit -m "$(cat <<'EOF'
refactor(server): move server-only utils to app/lib/.server/

Relocates coming-soon, redirect, shopify-admin, surprise-gallery, and session
modules into app/lib/.server/ with *.server.ts suffix. RR v7 + Vite guarantee
.server/ modules never bundle to the client, reducing client JS and preventing
accidental import of server-only secrets into components.

Updates all import sites across app/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 (Commit 9) — R1: `loadCriticalData` / `loadDeferredData` split

**Files:**
- Modify: `app/routes/($locale)._index.tsx` — defer FAQ, testimonials, hero slides
- Modify: `app/routes/($locale).products.$handle.tsx` — defer below-fold metaobject queries
- Modify: `app/routes/($locale).collections.$handle.tsx` — defer below-fold queries if any

Root already uses the split (we verified — `root.tsx:117-120, 152-195`). This task is about extending the pattern to **route loaders**.

- [ ] **Step 1: Refactor homepage loader (`($locale)._index.tsx`)**

The current homepage loader (per audit) issues 5 queries in `Promise.all`: header (already in root), featured product, FAQs, testimonials, hero slides, homepage sections. The critical-vs-deferred split:

- **Critical (await):** featured product, hero slides (above the fold), homepage sections (likely hero/story above the fold)
- **Deferred (return promise with `.catch()`):** FAQs (footer area), testimonials (mid-page below fold)

Restructure the loader:

```tsx
export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;
  const [featured, heroSlides, sections] = await Promise.all([
    storefront.query(FEATURED_PRODUCT_QUERY, {cache: storefront.CacheShort()}),
    storefront.query(HERO_SLIDES_QUERY, {cache: storefront.CacheLong()}),
    storefront.query(HOMEPAGE_SECTIONS_QUERY, {cache: storefront.CacheLong()}),
  ]);
  return {featured, heroSlides, sections};
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront} = context;
  const faqs = storefront
    .query(FAQS_QUERY, {cache: storefront.CacheLong()})
    .catch((error: Error) => {
      console.error(error);
      return null;
    });
  const testimonials = storefront
    .query(TESTIMONIALS_QUERY, {cache: storefront.CacheLong()})
    .catch((error: Error) => {
      console.error(error);
      return null;
    });
  return {faqs, testimonials};
}
```

In the component (`export default function Index({loaderData}: Route.ComponentProps)`), the deferred fields are promises. Render them via `<Suspense fallback={...}><Await resolve={loaderData.faqs}>{(faqs) => ...}</Await></Suspense>`:

```tsx
import {Suspense} from 'react';
import {Await} from 'react-router';

// ... existing JSX ...

<section id="faq">
  <Suspense fallback={<FaqSkeleton />}>
    <Await resolve={loaderData.faqs}>
      {(faqsResponse) => {
        if (!faqsResponse) return null;
        const items = parseFaqs(faqsResponse);
        return <FaqList items={items} />;
      }}
    </Await>
  </Suspense>
</section>

<section id="testify">
  <Suspense fallback={<TestimonialsSkeleton />}>
    <Await resolve={loaderData.testimonials}>
      {(response) => {
        if (!response) return null;
        const items = parseTestimonials(response);
        return <TestimonialList items={items} />;
      }}
    </Await>
  </Suspense>
</section>
```

Add minimal `FaqSkeleton` / `TestimonialsSkeleton` inline as 2-line placeholder divs that match the section's eventual height (avoid layout shift).

- [ ] **Step 2: Refactor PDP loader (`($locale).products.$handle.tsx`)**

The PDP critical data is the product itself. Defer:
- Product specs metaobject query (if currently in a parallel query — verify by reading the file)
- Anything fetched for non-PDP-critical sections

If the current PDP only queries `{product}` and `{cart}`, there may be nothing to defer here — the loader is already lean. Confirm by reading the current loader. If lean, **leave PDP alone** for this commit; don't manufacture deferred work.

- [ ] **Step 3: Refactor PLP loader (`($locale).collections.$handle.tsx`)**

Same pattern. The critical data is the collection metadata + first page of products. Defer the filter facets metaobject query if one exists.

- [ ] **Step 4: Typecheck + build**

```bash
npm run codegen
npm run typecheck
npm run build
```

- [ ] **Step 5: Smoke verification (R1-specific)**

```bash
npm run dev
```

Open Chrome DevTools → Network panel → throttle to "Slow 3G". Load `/`. Observe:
- The initial HTML response should include the hero + featured product + sections (critical data).
- The FAQ and testimonials sections should arrive as separate streamed chunks (visible in Network as additional payloads on the same document request, or as Suspense boundary resolution).
- The skeleton placeholders should be visible briefly before the deferred data resolves.

Take a screenshot for the PR description if useful.

- [ ] **Step 6: Commit**

```bash
git add app/routes/\(\$locale\)._index.tsx app/routes/\(\$locale\).products.\$handle.tsx app/routes/\(\$locale\).collections.\$handle.tsx
git status
git commit -m "$(cat <<'EOF'
feat(perf): split loadCriticalData/loadDeferredData with defer()

Restructures the homepage (and PLP/PDP where applicable) loaders to split
critical above-fold data (awaited) from deferred below-fold data (returned
as unresolved promises with .catch() → null). Below-fold sections render
inside <Suspense fallback={...}><Await resolve={...}>.

First paint is no longer bounded by the slowest query.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 (Commit 10) — R2: `getSeoMeta` + `schema-dts` JSON-LD

**Files:**
- Create: `app/lib/.server/seo.server.ts`
- Modify: `app/root.tsx`, every route with a `meta` export (17 routes)

- [ ] **Step 1: Create `app/lib/.server/seo.server.ts`**

```ts
// app/lib/.server/seo.server.ts
import type {SeoConfig} from '@shopify/hydrogen';
import type {
  Organization,
  Product as ProductLd,
  CollectionPage,
  BreadcrumbList,
  WebSite,
  Offer,
  Article,
} from 'schema-dts';
import type {Locale} from '~/lib/i18n';
import {SUPPORTED_LOCALES, getLocaleConfig, localizedPath} from '~/lib/i18n';

const SITE_NAME = 'Lightboard';
const SITE_URL = 'https://lightboard.co.il';

/** Build the alternate hreflang link tags for a given pathname (no locale prefix). */
export function buildAlternates(pathnameNoLocale: string): Array<{rel: 'alternate'; hrefLang: string; href: string}> {
  return SUPPORTED_LOCALES.map((locale) => ({
    rel: 'alternate' as const,
    hrefLang: getLocaleConfig(locale).htmlLang,
    href: `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`,
  }));
}

/** Root-level SEO defaults (applied via getSeoMeta in root meta export). */
export function rootSeo(locale: Locale, pathnameNoLocale: string): SeoConfig {
  const orgLd: Organization = {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    sameAs: ['https://www.instagram.com/timberwave'],
  };
  const siteLd: WebSite = {
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: getLocaleConfig(locale).htmlLang,
  };
  return {
    title: SITE_NAME,
    titleTemplate: `%s · ${SITE_NAME}`,
    description: 'Lightboard — living · design · surfing',
    url: SITE_URL + pathnameNoLocale,
    jsonLd: [orgLd, siteLd],
  };
}

export type ProductSeoInput = {
  title: string;
  description: string;
  imageUrl?: string;
  url: string;
  price?: {amount: string; currencyCode: string};
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
};

/** Product PDP SEO with JSON-LD product schema. */
export function productSeo(input: ProductSeoInput): SeoConfig {
  const offer: Offer | undefined = input.price
    ? {
        '@type': 'Offer',
        price: input.price.amount,
        priceCurrency: input.price.currencyCode,
        availability: `https://schema.org/${input.availability ?? 'InStock'}`,
        url: input.url,
      }
    : undefined;

  const productLd: ProductLd = {
    '@type': 'Product',
    name: input.title,
    description: input.description,
    image: input.imageUrl,
    url: input.url,
    offers: offer,
  };

  return {
    title: input.title,
    description: input.description,
    url: input.url,
    media: input.imageUrl
      ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
      : undefined,
    jsonLd: productLd,
  };
}

export type CollectionSeoInput = {
  title: string;
  description: string;
  url: string;
};

export function collectionSeo(input: CollectionSeoInput): SeoConfig {
  const pageLd: CollectionPage = {
    '@type': 'CollectionPage',
    name: input.title,
    description: input.description,
    url: input.url,
  };
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    jsonLd: pageLd,
  };
}

export function breadcrumbs(items: Array<{name: string; url: string}>): BreadcrumbList {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function articleSeo(input: {title: string; description: string; url: string; imageUrl?: string; publishedAt?: string}): SeoConfig {
  const articleLd: Article = {
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: input.imageUrl,
    url: input.url,
    datePublished: input.publishedAt,
  };
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    media: input.imageUrl ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200} : undefined,
    jsonLd: articleLd,
  };
}
```

- [ ] **Step 2: Refactor root.tsx `meta` and add the loader `seo` field**

In `app/root.tsx`:

```tsx
import {getSeoMeta} from '@shopify/hydrogen';
import {rootSeo, buildAlternates} from '~/lib/.server/seo.server';

// In the loader, add `seo` to the returned object:
return {
  // ... existing fields ...
  seo: rootSeo(locale, pathnameNoLocale),
};

// At the end of the file (or near `links`):
export const meta: Route.MetaFunction = ({data, matches}) => {
  const rootData = data;
  const baseMeta = getSeoMeta(rootData?.seo);
  const alternates = data?.pathnameNoLocale
    ? buildAlternates(data.pathnameNoLocale).map((a) => ({tagName: 'link' as const, ...a}))
    : [];
  return [...baseMeta, ...alternates];
};
```

Remove the hand-rolled `<link rel="alternate" hreflang>` block from `Layout` — it's now part of `meta` so React Router handles it.

- [ ] **Step 3: Refactor product route `meta` (`($locale).products.$handle.tsx`)**

```tsx
import {getSeoMeta} from '@shopify/hydrogen';
import {productSeo, breadcrumbs} from '~/lib/.server/seo.server';

// In loader: build seo from the product
const seo = productSeo({
  title: product.title,
  description: product.description ?? '',
  imageUrl: product.featuredImage?.url,
  url: `https://lightboard.co.il${localizedPath('/products/' + product.handle, locale)}`,
  price: product.selectedOrFirstAvailableVariant?.price
    ? {amount: product.selectedOrFirstAvailableVariant.price.amount, currencyCode: product.selectedOrFirstAvailableVariant.price.currencyCode}
    : undefined,
  availability: product.selectedOrFirstAvailableVariant?.availableForSale ? 'InStock' : 'OutOfStock',
});

// Add breadcrumb JSON-LD via a second jsonLd entry (getSeoMeta merges jsonLd arrays):
const breadcrumbLd = breadcrumbs([
  {name: 'Home', url: 'https://lightboard.co.il'},
  {name: product.title, url: seo.url ?? ''},
]);
const seoWithCrumbs = {...seo, jsonLd: [seo.jsonLd, breadcrumbLd].filter(Boolean)};

return {product, seo: seoWithCrumbs};

// Replace the existing meta export:
export const meta: Route.MetaFunction = ({data, matches}) => {
  const rootSeo = matches[0]?.data?.seo;
  return getSeoMeta(rootSeo, data?.seo);
};
```

Delete all the hand-rolled `og:`/`twitter:` tags from the previous `meta` body — `getSeoMeta` emits them.

- [ ] **Step 4: Refactor collection routes' `meta`**

For `($locale).collections.$handle.tsx`:

```tsx
import {collectionSeo} from '~/lib/.server/seo.server';
const seo = collectionSeo({
  title: collection.title,
  description: collection.description ?? '',
  url: `https://lightboard.co.il${localizedPath('/collections/' + collection.handle, locale)}`,
});
return {collection, products, seo};

export const meta: Route.MetaFunction = ({data, matches}) =>
  getSeoMeta(matches[0]?.data?.seo, data?.seo);
```

Same for `collections.all.tsx` and `collections._index.tsx` (use the index's title from i18n dict).

- [ ] **Step 5: Refactor remaining routes' `meta`**

For each of: `($locale)._index.tsx` (homepage), `cart.tsx`, `search.tsx`, `pages.$handle.tsx`, `policies.*`, `blogs.*`, `account.*`, `account.addresses.tsx`, `account.profile.tsx`:

Replace the per-route hand-rolled meta with a `getSeoMeta(matches[0]?.data?.seo, data?.seo)` call, and pass a `seo` object from the loader using one of the helpers (`articleSeo` for blog posts; bespoke `SeoConfig` for simple pages — just `{title, description, url}`).

- [ ] **Step 6: Verify**

```bash
npm run codegen
npm run typecheck
npm run build
```

- [ ] **Step 7: Smoke verification (R2-specific)**

```bash
npm run dev
```

Open `/` and view-source: confirm `<script type="application/ld+json">` blocks for Organization + WebSite. Open `/products/lightboard` and view-source: confirm Product + BreadcrumbList JSON-LD plus `og:title`/`og:image`/`twitter:card` tags. Confirm `<link rel="alternate" hreflang="he">` and `hreflang="en">` are present in `<head>`.

Validate the product page JSON-LD at https://search.google.com/test/rich-results (paste the URL or rendered HTML).

- [ ] **Step 8: Commit**

```bash
git add app/
git commit -m "$(cat <<'EOF'
feat(seo): migrate to getSeoMeta + schema-dts JSON-LD

Adds app/lib/.server/seo.server.ts with typed seoPayload builders
(rootSeo, productSeo, collectionSeo, articleSeo, breadcrumbs). Refactors
all route meta exports to use getSeoMeta() for cumulative SEO, emits
schema-dts-typed JSON-LD (Organization, WebSite, Product, CollectionPage,
BreadcrumbList, Article), and centralizes the hreflang alternates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11 (Commit 11) — R3: `useCustomerPrivacy` + gate Meta Pixel

**Files:**
- Modify: `app/root.tsx` — call `useCustomerPrivacy` at the App level
- Modify: `app/lib/meta-pixel.tsx` — gate `fbq('init')` and `fbq('track', 'PageView')` behind the consent callback

- [ ] **Step 1: Update `meta-pixel.tsx` so the Pixel waits for consent**

Refactor so the Pixel SDK script still loads (CSP allows it), but `fbq('init', PIXEL_ID)` and `fbq('track', 'PageView')` only fire after `onVisitorConsentCollected` reports `marketing === true`.

```tsx
// app/lib/meta-pixel.tsx
import {Analytics, useAnalytics} from '@shopify/hydrogen';
import {useEffect, useState} from 'react';

type MetaPixelScriptProps = {pixelId: string | null; nonce?: string};

/** Loads the fbq SDK shim; safe to load before consent. */
export function MetaPixelScript({pixelId, nonce}: MetaPixelScriptProps) {
  if (!pixelId) return null;
  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;t.nonce='${nonce ?? ''}';s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        `,
      }}
    />
  );
}

/** Renders inside <Analytics.Provider>. Bridges consent → fbq init + events. */
export function MetaPixel({pixelId}: {pixelId: string | null}) {
  const [consented, setConsented] = useState(false);
  const {subscribe} = useAnalytics();

  useEffect(() => {
    if (!pixelId) return;
    // Listen for consent collected event from Hydrogen's customer privacy bridge:
    const handler = (event: {marketing?: boolean}) => {
      if (event.marketing && !consented) {
        if (window.fbq) {
          window.fbq('init', pixelId);
          window.fbq('track', 'PageView');
        }
        setConsented(true);
      }
    };
    // Hydrogen exposes the consent event under different names depending on version;
    // this subscription is intentionally loose. If consent collection isn't wired,
    // the pixel will never fire — which is the desired safe default.
    const unsubscribe = subscribe('customerPrivacy.consentCollected' as never, handler as never);
    return () => unsubscribe?.();
  }, [pixelId, consented, subscribe]);

  useEffect(() => {
    if (!consented || !window.fbq) return;
    const trackEvent = (event: {name?: string; payload?: unknown}) => {
      // map a few key events
      if (event.name === Analytics.AnalyticsEvent.PRODUCT_ADD_TO_CART) {
        window.fbq?.('track', 'AddToCart', event.payload);
      } else if (event.name === Analytics.AnalyticsEvent.PRODUCT_VIEWED) {
        window.fbq?.('track', 'ViewContent', event.payload);
      } else if (event.name === Analytics.AnalyticsEvent.SEARCH_VIEWED) {
        window.fbq?.('track', 'Search', event.payload);
      }
    };
    const unsubs = [
      subscribe(Analytics.AnalyticsEvent.PRODUCT_ADD_TO_CART, trackEvent),
      subscribe(Analytics.AnalyticsEvent.PRODUCT_VIEWED, trackEvent),
      subscribe(Analytics.AnalyticsEvent.SEARCH_VIEWED, trackEvent),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [consented, subscribe]);

  return null;
}

declare global {
  interface Window {
    fbq?: ((...args: Array<unknown>) => void) & {
      queue?: Array<unknown>;
      loaded?: boolean;
      version?: string;
    };
  }
}
```

The exact subscribe event name may need adjustment based on the installed Hydrogen version — check `@shopify/hydrogen` exports at task time. If the API doesn't expose a consent-collected subscribe event, fall back to listening for `window.Shopify?.customerPrivacy.userCanBeTracked()` via a polling effect (acceptable interim).

- [ ] **Step 2: Add `useCustomerPrivacy` invocation in `App()` in root.tsx**

`@shopify/hydrogen` exports `useCustomerPrivacy` as a hook. We call it inside the `Analytics.Provider`:

```tsx
import {Analytics, useCustomerPrivacy} from '@shopify/hydrogen';

function PrivacyGate() {
  useCustomerPrivacy({
    checkoutDomain: data.consent.checkoutDomain,
    storefrontAccessToken: data.consent.storefrontAccessToken,
    onVisitorConsentCollected: (consent) => {
      // The MetaPixel component subscribes to the analytics event below;
      // nothing else to do here. Logged for debug.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[consent]', consent);
      }
    },
  });
  return null;
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');
  // ... existing guards ...
  return (
    <Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
      <PrivacyGate />
      <MetaPixel pixelId={data.metaPixelId ?? null} />
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}
```

`PrivacyGate` is a tiny child component because `useCustomerPrivacy` can only be called inside `Analytics.Provider`. Pass the `consent` object's `checkoutDomain` / `storefrontAccessToken` from root data.

- [ ] **Step 3: Typecheck + build**

```bash
npm run codegen
npm run typecheck
npm run build
```

- [ ] **Step 4: Smoke verification (R3-specific)**

```bash
npm run dev
```

Open the homepage in **incognito** Chrome:
1. Open DevTools → Network → filter by `facebook`.
2. Reload `/`. Watch for `connect.facebook.net/.../fbevents.js`. The SDK shim may load (allowed by CSP), but there should be **no** `tr/?id=...` PageView request because `init` has not been called.
3. If a privacy banner is shown by Shopify's privacy API, **reject** all marketing cookies. Watch network → no Facebook tracking requests.
4. Accept marketing cookies. Watch network → exactly one PageView request to `facebook.com/tr`.

If your storefront doesn't surface a privacy banner (because `withPrivacyBanner: false` is in `consent`), then `onVisitorConsentCollected` may need to be triggered manually for testing — fall back to: open `window.Shopify.customerPrivacy.setTrackingConsent({marketing: true})` in the console and verify the pixel fires after.

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "$(cat <<'EOF'
feat(privacy): add useCustomerPrivacy + gate Meta Pixel by consent

Wires Hydrogen's useCustomerPrivacy hook in App() and refactors meta-pixel
so fbq('init') and fbq('track', 'PageView') only fire after the visitor's
marketing consent has been recorded. The pixel SDK shim still loads (it's a
small script) but no tracking events fire until consent.

GDPR + Israeli Privacy Protection Law compliance.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12 (Commit 12) — R4: Per-route `ErrorBoundary` exports

**Files:**
- Create: `app/components/RouteError.tsx`
- Modify: ~15 routes that have a `loader` but no `ErrorBoundary`

Today, only root.tsx, cart.tsx, and products.$handle.tsx export `ErrorBoundary`. Every other route falls through to the root boundary, which loses the page chrome.

- [ ] **Step 1: Create `app/components/RouteError.tsx`**

```tsx
// app/components/RouteError.tsx
import {useRouteError, isRouteErrorResponse, Link} from 'react-router';

type RouteErrorProps = {context?: string};

const HE = {
  oops: 'אופס',
  notFoundTitle: 'הדף לא נמצא',
  notFoundKicker: 'נראה שהקישור שבחרת כבר לא קיים',
  generic: 'אירעה תקלה בלתי צפויה',
  retry: 'חזרה לדף הבית',
};

const EN = {
  oops: 'Oops',
  notFoundTitle: 'Page not found',
  notFoundKicker: 'The page you were looking for could not be found.',
  generic: 'An unexpected error occurred.',
  retry: 'Back home',
};

/**
 * Per-route ErrorBoundary content. Uses hardcoded HE strings with EN fallback,
 * not the i18n hook — the dictionary may not be loaded during a render error.
 */
export function RouteError({context: _context}: RouteErrorProps) {
  const error = useRouteError();
  let status: number | undefined;
  let message: string | undefined;
  const isResponse = isRouteErrorResponse(error);
  if (isResponse) {
    status = error.status;
    message = typeof error.data === 'string' ? error.data : (error.data?.message as string | undefined);
  } else if (error instanceof Error) {
    message = error.message;
  }

  const isNotFound = status === 404;
  // Detect locale from <html lang>, but default to HE.
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'he';
  const dict = lang.startsWith('en') ? EN : HE;

  return (
    <div
      className="route-error"
      style={{
        padding: '120px 24px 80px',
        maxWidth: 720,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          marginBottom: 24,
        }}
      >
        {status ?? '500'}
      </p>
      <h1
        style={{
          fontFamily: 'var(--serif)',
          fontWeight: 300,
          fontSize: 'clamp(40px, 6vw, 80px)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
          margin: '0 0 16px',
        }}
      >
        {isNotFound ? dict.notFoundTitle : dict.oops}
      </h1>
      <p style={{color: 'var(--ink-soft)', marginBottom: 32}}>
        {isNotFound ? dict.notFoundKicker : (message ?? dict.generic)}
      </p>
      <Link
        to="/"
        className="hero-cta"
        style={{
          display: 'inline-flex',
          background: 'var(--ink)',
          color: 'var(--white)',
        }}
      >
        <span>{dict.retry}</span>
        <span className="arrow" aria-hidden="true">→</span>
      </Link>
      {!isNotFound && message && (
        <fieldset style={{marginTop: 40, textAlign: 'start'}}>
          <pre>{message}</pre>
        </fieldset>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `ErrorBoundary` exports to every route missing one**

For each route file in `app/routes/` that has a `loader` or `action` but no `ErrorBoundary`:

Add the 3-line export at the bottom:

```tsx
import {RouteError} from '~/components/RouteError';
export function ErrorBoundary() {
  return <RouteError />;
}
```

Routes to update (each gets the same 3-line addition):

- `($locale)._index.tsx`
- `($locale).collections._index.tsx`
- `($locale).collections.all.tsx`
- `($locale).collections.$handle.tsx`
- `($locale).search.tsx`
- `($locale).pages.$handle.tsx`
- `($locale).policies._index.tsx`
- `($locale).policies.$handle.tsx`
- `($locale).blogs._index.tsx`
- `($locale).blogs.$blogHandle._index.tsx`
- `($locale).blogs.$blogHandle.$articleHandle.tsx`
- `($locale).account._index.tsx`
- `($locale).account.addresses.tsx`
- `($locale).account.profile.tsx`
- `($locale).account.orders._index.tsx`
- `($locale).account.orders.$id.tsx`
- `($locale).$.tsx`
- `($locale).discount.$code.tsx`

(Skip routes that already export `ErrorBoundary`: root.tsx, cart.tsx, products.$handle.tsx — but consider refactoring those to use the shared `RouteError` component too for consistency.)

- [ ] **Step 3: Refactor existing per-route ErrorBoundaries (cart.tsx, products.$handle.tsx) to use shared `RouteError`**

Replace the inline JSX with `<RouteError context="cart" />` / `<RouteError context="product" />`. The `context` prop is currently unused; reserved for future per-context messaging.

- [ ] **Step 4: Verify**

```bash
npm run codegen
npm run typecheck
npm run build
```

- [ ] **Step 5: Smoke verification (R4-specific)**

```bash
npm run dev
```

Force a 404 by visiting `/products/this-does-not-exist`. Confirm:
1. The page chrome (header, footer) is **NOT** shown — `ErrorBoundary` replaces the route component, not the layout. (Hydrogen v2026 behavior.)
2. The Hebrew error UI from `RouteError` renders.
3. The "Back home" link works.

Repeat for `/collections/nonexistent`, `/blogs/nonexistent`, `/pages/nonexistent`.

- [ ] **Step 6: Commit**

```bash
git add app/components/RouteError.tsx app/routes/
git commit -m "$(cat <<'EOF'
feat(errors): add per-route ErrorBoundary exports

Adds app/components/RouteError.tsx with a Hebrew-first error UI using
hardcoded strings (since the i18n dict may not be loaded during a render
error). Adds 3-line ErrorBoundary exports to ~15 routes that previously
fell through to the root boundary, and refactors the existing per-route
boundaries (cart, products) to use the shared component.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13 (Commit 13) — R6: WooCommerce URL trailing-space guard

**Files:**
- Create: `app/lib/.server/url.server.ts`
- Modify: `($locale).products.$handle.tsx`, `($locale).collections.$handle.tsx`, `($locale).blogs.$blogHandle.$articleHandle.tsx`, `($locale).pages.$handle.tsx`

- [ ] **Step 1: Create `app/lib/.server/url.server.ts`**

```ts
// app/lib/.server/url.server.ts

/**
 * Detect WooCommerce-migration URL artifacts (trailing `%20`, trailing whitespace,
 * trailing slashes after handles that shouldn't have them) and 301-redirect to the
 * canonical URL. Returns a Response if a redirect is needed, otherwise null.
 */
export function checkForTrailingEncodedSpaces(request: Request): Response | null {
  const url = new URL(request.url);
  const original = url.pathname;
  let next = original;

  // Strip trailing encoded spaces (any number of them).
  next = next.replace(/(%20)+$/i, '');
  // Strip trailing whitespace (rare; some clients pass raw spaces).
  next = next.replace(/\s+$/, '');
  // Strip trailing slashes from non-root paths.
  if (next.length > 1) {
    next = next.replace(/\/+$/, '');
  }

  if (next !== original) {
    url.pathname = next;
    return new Response(null, {
      status: 301,
      headers: {Location: url.toString()},
    });
  }
  return null;
}
```

- [ ] **Step 2: Call it from each affected route's loader**

In each of the four routes, at the **very top** of the loader (before any GraphQL query):

```tsx
import {checkForTrailingEncodedSpaces} from '~/lib/.server/url.server';

export async function loader({request, params, context}: Route.LoaderArgs) {
  const redirectResponse = checkForTrailingEncodedSpaces(request);
  if (redirectResponse) throw redirectResponse;
  // ... existing loader logic
}
```

(Throwing a `Response` from a loader is RR v7's idiomatic way to short-circuit with a status — it bypasses subsequent data fetching cleanly.)

- [ ] **Step 3: Verify**

```bash
npm run codegen
npm run typecheck
npm run build
```

- [ ] **Step 4: Smoke verification (R6-specific)**

```bash
npm run dev
```

Visit these URLs in the browser. Each should 301-redirect to the canonical form:

- `http://localhost:3000/products/lightboard%20` → `/products/lightboard`
- `http://localhost:3000/products/lightboard%20%20%20` → `/products/lightboard`
- `http://localhost:3000/collections/all%20` → `/collections/all`
- `http://localhost:3000/products/lightboard/` → `/products/lightboard`

Use DevTools Network panel to confirm the response status code is `301`.

Also test the non-redirect path stays clean: `/products/lightboard` returns 200 directly.

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "$(cat <<'EOF'
feat(migration): add WooCommerce URL trailing-space guard

New checkForTrailingEncodedSpaces helper in app/lib/.server/url.server.ts.
Strips trailing %20, whitespace, and slashes from product/collection/blog/
page route paths and 301s to the canonical URL. Handles legacy indexed URLs
from the WordPress → Hydrogen migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14 (Commit 14) — Phase C: Flip docs + add Notion task

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (only if it repeats the JS claim)
- Notion: create new task and mark Done

- [ ] **Step 1: Update `CLAUDE.md`**

Find the line in `CLAUDE.md` under "## Project Conventions":

```markdown
- **JavaScript, not TypeScript** — scaffold uses `.jsx`
```

Replace with:

```markdown
- **TypeScript, strict** — see `tsconfig.json`. All sources are `.ts`/`.tsx`. JSDoc `@type`/`@typedef` is no longer used.
```

- [ ] **Step 2: Update `README.md` if it repeats the JS claim**

Grep first:

```bash
grep -n "JavaScript, not TypeScript\|\.jsx\|JavaScript" README.md
```

If matches exist, replace them with TypeScript references. If not, skip.

- [ ] **Step 3: Verify**

```bash
npm run codegen
npm run typecheck
npm run build
npm run lint
```

All green.

- [ ] **Step 4: Create a Notion task per the CLAUDE.md workflow**

Use the Notion MCP `notion-create-pages` tool to create a new task in the Lightboard board (database `6a1aa6009185487caa4c238823ea97a2`):

- `Task name`: "Convert codebase to TypeScript + Hydrogen 2026 refactor"
- `Category`: Storefront
- `Priority`: High
- `Status`: In progress (will be flipped to Done after PR merges, per the workflow)

Add a short note via `insert_content` describing what shipped: commit refs, file paths, behavior. The note can mention this plan document at `docs/superpowers/plans/2026-05-23-typescript-and-hydrogen-2026-refactor.md`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git status
git commit -m "$(cat <<'EOF'
docs: flip TS convention + add Notion task

Replaces the "JavaScript, not TypeScript" Project Convention line in
CLAUDE.md with the TypeScript-strict statement reflecting the new
codebase shape. Updates README.md if it carried the same claim. Opens
a corresponding task on the Notion board per the project workflow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Final pre-PR verification

- [ ] **Step 1: Full clean rebuild from scratch**

```bash
rm -rf node_modules .react-router dist build
npm install
npm run codegen
npm run typecheck
npm run build
npm run lint
```

All five must complete with zero errors. If `npm install` causes any deprecation warnings, document them in the PR description but don't block on them.

- [ ] **Step 2: End-to-end manual smoke**

```bash
npm run dev
```

Walk through every flow from the spec's "Final pre-merge gate" — `/`, `/products/lightboard` (add to cart with photo upload), `/cart`, `/search`, `/preview?token=...`, `/account/login`, 404. Take screenshots to attach to the PR.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin chore/typescript-migration
```

- [ ] **Step 4: Open the PR as draft**

```bash
gh pr create --draft --title "Convert codebase to TypeScript + Hydrogen 2026 refactor" --body "$(cat <<'EOF'
## Summary
- Phase A (commits 1-7): Convert the entire codebase from JavaScript to strict TypeScript. tsconfig.json aligned with the Hydrogen 2026.4 skeleton; ~84 source files + 6 configs renamed; new metaobject-types.ts for shared bilingual content shapes.
- Phase B (commits 8-13): Six Hydrogen 2026 best-practice refactors layered on top of the typed codebase — R1 defer/Suspense split, R2 getSeoMeta + schema-dts JSON-LD, R3 useCustomerPrivacy + Meta Pixel gating, R4 per-route ErrorBoundary, R5 .server/ split, R6 WooCommerce URL guard.
- Phase C (commit 14): CLAUDE.md convention flip + Notion task.

See the design spec at `docs/superpowers/specs/2026-05-23-typescript-and-hydrogen-2026-refactor-design.md` and the implementation plan at `docs/superpowers/plans/2026-05-23-typescript-and-hydrogen-2026-refactor.md`.

**Recommended review path:** step through commit-by-commit on GitHub's "Commits" tab. Each commit is independently buildable.

## Test plan
- [x] `npm run codegen && npm run typecheck && npm run build && npm run lint` — all green
- [x] `npm run dev` end-to-end smoke (homepage, PDP, PLP, cart, search, preview gate, 404)
- [x] R1: Slow 3G DevTools — confirm deferred sections stream after initial HTML
- [x] R2: View-source + Google Rich Results test on product JSON-LD
- [x] R3: Incognito + reject consent → no fb tracking; accept → fbq fires once
- [x] R4: 404 on `/products/nonexistent` shows Hebrew error UI, not layout-less 500
- [x] R6: 301 redirect on `/products/lightboard%20` to canonical

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Self-review the PR**

Open the PR in the browser. On the "Commits" tab, click through each commit and read the diff. Confirm:
- Each commit's title accurately describes its diff.
- No commit accidentally bundles work from another (e.g., R5 file moves shouldn't appear in the R1 commit).
- The Phase A commits truly contain no behavior changes.
- The Phase B commits each touch only files relevant to their R-item.

If anything is off, **don't squash** — use `git rebase -i` to reorder/split. Then force-push: `git push --force-with-lease`.

- [ ] **Step 6: Mark ready for review**

```bash
gh pr ready
```

Update the Notion task: link the PR URL into the task notes.

After merge:
1. Update Notion task `Status` from "In progress" to "Done".
2. Verify the auto-deploy to Oxygen (`.github/workflows/oxygen-deployment.yml`) succeeded.
3. Smoke the production Oxygen preview URL.

---

## Self-review notes

This plan was reviewed against the spec (`2026-05-23-typescript-and-hydrogen-2026-refactor-design.md`):

- **Spec coverage:** Every numbered section of the spec has at least one task. Section 1 (tooling) → Task 1; Section 2 (typing patterns) → Migration Patterns + Tasks 2-7; Section 3 R1-R6 → Tasks 9-13 and Task 8 (R5); Section 4 (branch/commits) → Tasks 0-7 mirror Phase A, 8-13 mirror Phase B, 14 mirrors Phase C; Section 5 (verification) → in-task gates plus Task 15.
- **Placeholders:** No "TBD"/"TODO" remain. Where loader internals depend on current code shape (e.g., PDP's deferred candidates in R1), the plan instructs the implementer to read the current file and either apply the pattern or leave alone — explicit.
- **Type consistency:** `MetaobjectField`, `readField`, `HomepageHero`, `RouteError`, `RootLoader` are defined once and referenced consistently. `Route.LoaderArgs` / `Route.ComponentProps` are the only RR v7 type entry points used.

### Known plan gaps and how the implementer should handle them

- **Exact list of `app/lib/` files at task time.** The spec said 17; my audit shows 19 (counting `meta-pixel.jsx` and the i18n subdirectory). The plan instructs the implementer to run `find app/lib -maxdepth 1 -type f` and use the live list.
- **Routes' exact `+types/` basename.** Generated by `react-router typegen`. The plan shows the pattern (`./+types/<file-basename-without-extension>`) but the implementer should verify with `ls .react-router/types/app/routes/` after `npm run codegen`.
- **Hydrogen's `useAnalytics().subscribe` event name for consent.** May vary between minor versions. The plan acknowledges this and provides a polling fallback.
