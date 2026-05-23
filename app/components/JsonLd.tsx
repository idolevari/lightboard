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
 * Multiple JSON-LD blocks on a page (e.g. root emits Organization + WebSite
 * and the PDP also emits Product + BreadcrumbList) are valid and supported
 * by search engines; we render them as separate <script> tags rather than
 * trying to merge.
 */
export function JsonLd({data}: JsonLdProps) {
  if (!data) return null;
  const json = Array.isArray(data) ? data : [data];
  if (json.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      // eslint-disable-next-line react/no-danger -- JSON.stringify output is safe; we control the inputs
      dangerouslySetInnerHTML={{__html: JSON.stringify(json)}}
    />
  );
}
