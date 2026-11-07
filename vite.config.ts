import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// Content hash of the icon sprite. <use> needs a same-origin URL, so the
// sprite stays in public/ and gets a ?v= query instead of a hashed filename;
// browsers then refetch it whenever an icon is added or changed.
const doodlesVersion = createHash('sha256')
  .update(readFileSync('public/illustrations/doodles.svg'))
  .digest('hex')
  .slice(0, 10);

export default defineConfig({
  plugins: [hydrogen(), oxygen(), reactRouter(), tsconfigPaths()],
  define: {__DOODLES_VERSION__: JSON.stringify(doodlesVersion)},
  build: {
    // Allow a strict Content-Security-Policy
    // without inlining assets as base64:
    assetsInlineLimit: 0,
  },
  ssr: {
    optimizeDeps: {
      /**
       * Include dependencies here if they throw CJS<>ESM errors.
       * For example, for the following error:
       *
       * > ReferenceError: module is not defined
       * >   at /Users/.../node_modules/example-dep/index.js:1:1
       *
       * Include 'example-dep' in the array below.
       * @see https://vitejs.dev/config/dep-optimization-options
       */
      include: [
        'sanitize-html',
        'normalize-wheel',
        'react-router > set-cookie-parser',
        'react-router > cookie',
        'react-router',
      ],
    },
  },
  server: {
    allowedHosts: ['.tryhydrogen.dev'],
  },
});
