type JsonLdProps = {
  data: object | ReadonlyArray<object> | null | undefined;
};

/**
 * Renders schema.org JSON-LD as a <script> tag. We render JSON-LD as a route
 * component child rather than via React Router's `<Meta />` because RR's
 * `script:ld+json` meta descriptor produces a hydration mismatch on the
 * `type` attribute ("Server: null Client: application/ld+json") — the
 * resulting HTML is byte-identical but the reconciler disagrees on the
 * normalized prop value. `suppressHydrationWarning` is the React-sanctioned
 * escape hatch for this exact case: we know the HTML matches and we are
 * intentionally opting out of attribute-level reconciliation for this node.
 *
 * Multiple JSON-LD blocks on a page (the root's site-wide @graph plus, e.g.,
 * a collection's CollectionPage) are valid and supported by search engines;
 * we render them as separate <script> tags rather than trying to merge.
 */
export function JsonLd({data}: JsonLdProps) {
  if (!data) return null;
  const json = (Array.isArray(data) ? data : [data]) as ReadonlyArray<object>;
  if (json.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      // eslint-disable-next-line react/no-danger -- output is escaped by serializeJsonLd
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(json.length === 1 ? json[0] : json),
      }}
    />
  );
}

/**
 * JSON.stringify for an inline <script>. Values come from Shopify (product
 * descriptions, FAQ answers, metafields), so a "</script>" or "<!--" inside
 * a string must not end the script element early. Escaping "<", ">" and "&"
 * as \u-sequences keeps the JSON identical once parsed.
 */
function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
