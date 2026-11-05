const LATIN_ONLY_RE = /^[\p{Script=Latin}\d\s.,'’&·:\-–—()!?]+$/u;

/**
 * Wraps Latin-only strings (e.g. the Shopify product title "Lightboard" or a
 * mono slide label) in `<bdi lang="en">` so Hebrew screen readers switch
 * voice instead of spelling them letter by letter (WCAG 3.1.2), and the
 * run never reorders against surrounding Hebrew.
 */
export function AutoLang({text}: {text: string | null | undefined}) {
  if (!text) return null;
  if (LATIN_ONLY_RE.test(text)) {
    return (
      <bdi lang="en" dir="ltr">
        {text}
      </bdi>
    );
  }
  return <>{text}</>;
}
