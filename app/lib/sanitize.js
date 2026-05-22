import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize HTML coming back from the Shopify Storefront API (product
 * descriptions, article bodies, page/policy bodies) before rendering with
 * `dangerouslySetInnerHTML`.
 *
 * Shopify does not guarantee the HTML is XSS-safe — admins author it, and any
 * Admin API app with write access can change it. CSP blocks inline <script>
 * via nonces, but event-handler attributes (onerror=, onload=) and
 * javascript: URLs are not blocked by the script CSP. This pass strips them.
 *
 * The allowlist is intentionally narrow: prose tags, lists, images, links.
 * Forms, iframes, scripts, and style/event attributes are all stripped.
 *
 * Uses sanitize-html instead of DOMPurify because Oxygen runs in a Workers
 * environment without jsdom; sanitize-html is pure JS and works there.
 */
const ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'q',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'name', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  '*': ['class', 'id', 'dir', 'lang'],
};

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  // Force external links to be safe.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {rel: 'noreferrer noopener'}),
  },
};

export function sanitizeShopifyHtml(html) {
  if (typeof html !== 'string' || html.length === 0) return '';
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
