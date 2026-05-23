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
