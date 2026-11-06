/**
 * Reshape merchant-edited homepage metaobjects into the locale-resolved
 * objects the section components render. Hebrew is canonical: an empty
 * English value falls back to Hebrew so the storefront never renders blank.
 */
import type {
  AliasedField,
  FieldMapping,
  HeroAliasedNode,
  HeroSection,
  HeroSlide,
  HeroSlideField,
  HeroSlideNode,
  MetaobjectFieldRecord,
  SimpleMetaobjectNode,
  StoryAliasedNode,
  StorySection,
  StorySectionStat,
} from './types';

/**
 * Pick the locale-appropriate value from a `{<base>_he, <base>_en}` field
 * pair on a metaobject reference response. Falls back to Hebrew when the
 * English value is empty so the storefront never renders a blank.
 */
function pickField(
  node: Record<string, AliasedField> | null | undefined,
  base: string,
  locale: string,
): string {
  const he = node?.[`${base}_he`]?.value;
  const en = node?.[`${base}_en`]?.value;
  return locale === 'en' ? en || he || '' : he || '';
}

export function extractHeroSection(
  node: HeroAliasedNode | null | undefined,
  locale: string,
): HeroSection | null {
  if (!node) return null;
  let tapeItems: Array<string> = [];
  const tapeRaw = (node as Record<string, AliasedField>)[
    `tape_items_${locale === 'en' ? 'en' : 'he'}`
  ]?.value;
  const tapeFallback = node.tape_items_he?.value;
  try {
    const parsed: unknown = JSON.parse(tapeRaw ?? tapeFallback ?? '[]');
    tapeItems = Array.isArray(parsed) ? (parsed as Array<string>) : [];
  } catch {
    tapeItems = [];
  }
  return {
    eyebrow: pickField(node as Record<string, AliasedField>, 'eyebrow', locale),
    titleLine1: pickField(
      node as Record<string, AliasedField>,
      'title_line_1',
      locale,
    ),
    titleLine2: pickField(
      node as Record<string, AliasedField>,
      'title_line_2',
      locale,
    ),
    kicker: pickField(node as Record<string, AliasedField>, 'kicker', locale),
    cta: pickField(node as Record<string, AliasedField>, 'cta', locale),
    tape: tapeItems,
  };
}

export function extractStorySection(
  node: StoryAliasedNode | null | undefined,
  locale: string,
): StorySection | null {
  if (!node) return null;
  const statRefs = node?.stats?.references?.nodes ?? [];
  const stats: Array<StorySectionStat> = statRefs
    .map((s) => ({
      id: s.id,
      n: s.value?.value ?? '',
      k:
        locale === 'en'
          ? s.label_en?.value || s.label_he?.value || ''
          : s.label_he?.value || '',
      position: parseInt(s.position?.value ?? '0', 10) || 0,
    }))
    .sort((a, b) => a.position - b.position);
  return {
    tag: node?.tag?.value ?? '',
    eyebrow: pickField(node as Record<string, AliasedField>, 'eyebrow', locale),
    titleLine1: pickField(
      node as Record<string, AliasedField>,
      'title_line_1',
      locale,
    ),
    titleLine2: pickField(
      node as Record<string, AliasedField>,
      'title_line_2',
      locale,
    ),
    p1: pickField(node as Record<string, AliasedField>, 'p1', locale),
    p2: pickField(node as Record<string, AliasedField>, 'p2', locale),
    stats,
  };
}

/**
 * Reshape the hero_slide metaobjects into the {img, label, mobilePos} shape
 * the <Hero> component expects. Returns empty when no entries exist so the
 * component can fall back to the in-code defaults.
 */
export function extractHeroSlides(
  nodes: Array<HeroSlideNode> | null | undefined,
): Array<HeroSlide> {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const items: Array<HeroSlide> = nodes
    .map((node) => {
      const byKey: Record<string, HeroSlideField> = Object.fromEntries(
        (node.fields ?? []).map((f) => [f.key, f]),
      );
      const imageField = byKey.image;
      const image = imageField?.reference?.image;
      return {
        id: node.id,
        img: image?.url ?? null,
        width: image?.width ?? null,
        height: image?.height ?? null,
        label: byKey.label?.value ?? '',
        mobilePos: byKey.mobile_position?.value ?? undefined,
        position: parseInt(byKey.position?.value ?? '0', 10) || 0,
      };
    })
    .filter((s) => s.img);
  items.sort((a, b) => a.position - b.position);
  return items;
}

/**
 * Reduce a metaobject result list to plain JS objects keyed by the chosen
 * locale's text. Falls back to the Hebrew variant when an English value is
 * empty so the storefront never renders a blank.
 */
export function extractMetaobjectFields(
  nodes: Array<SimpleMetaobjectNode> | null | undefined,
  locale: string,
  mapping: Array<FieldMapping>,
): Array<MetaobjectFieldRecord> {
  if (!Array.isArray(nodes)) return [];
  const items: Array<MetaobjectFieldRecord> = nodes.map((node) => {
    const byKey: Record<string, string | null | undefined> = Object.fromEntries(
      (node.fields ?? []).map((f) => [f.key, f.value]),
    );
    const result: MetaobjectFieldRecord = {
      id: node.id,
      position: parseInt(byKey.position ?? '0', 10) || 0,
    };
    for (const {target, heKey, enKey} of mapping) {
      const he = byKey[heKey] ?? '';
      const en = byKey[enKey] ?? '';
      result[target] = locale === 'en' ? en || he : he;
    }
    return result;
  });
  items.sort((a, b) => a.position - b.position);
  return items;
}
