/**
 * Shapes shared by the homepage loader (server) and its section components
 * (client). The raw Storefront responses are reshaped by
 * `app/lib/home/content.ts` and `app/lib/.server/home.server.ts`.
 */
import type {HomeProductCardFragment} from 'storefrontapi.generated';
import type {CarouselImage} from '~/components/ProductCarousel';

// ---- Raw metaobject response shapes (aliased `<field>_he` / `_en` pairs) ----

export type AliasedField = {value?: string | null} | null | undefined;

export type HeroAliasedNode = {
  eyebrow_he?: AliasedField;
  eyebrow_en?: AliasedField;
  title_line_1_he?: AliasedField;
  title_line_1_en?: AliasedField;
  title_line_2_he?: AliasedField;
  title_line_2_en?: AliasedField;
  kicker_he?: AliasedField;
  kicker_en?: AliasedField;
  cta_he?: AliasedField;
  cta_en?: AliasedField;
  tape_items_he?: AliasedField;
  tape_items_en?: AliasedField;
};

export type StoryStatNode = {
  id: string;
  value?: AliasedField;
  label_he?: AliasedField;
  label_en?: AliasedField;
  position?: AliasedField;
};

export type StoryAliasedNode = {
  tag?: AliasedField;
  eyebrow_he?: AliasedField;
  eyebrow_en?: AliasedField;
  title_line_1_he?: AliasedField;
  title_line_1_en?: AliasedField;
  title_line_2_he?: AliasedField;
  title_line_2_en?: AliasedField;
  p1_he?: AliasedField;
  p1_en?: AliasedField;
  p2_he?: AliasedField;
  p2_en?: AliasedField;
  stats?: {references?: {nodes?: Array<StoryStatNode>} | null} | null;
};

export type HeroSlideField = {
  key: string;
  value?: string | null;
  reference?: {
    image?: {url: string; width?: number | null; height?: number | null} | null;
  } | null;
};

export type HeroSlideNode = {
  id: string;
  handle?: string;
  fields?: Array<HeroSlideField>;
};

export type SimpleMetaobjectField = {key: string; value?: string | null};

export type SimpleMetaobjectNode = {
  id: string;
  handle?: string;
  fields?: Array<SimpleMetaobjectField>;
};

export type SimpleMetaobjectQueryResponse = {
  metaobjects?: {nodes?: Array<SimpleMetaobjectNode>} | null;
} | null;

export type FieldMapping = {target: string; heKey: string; enKey: string};

// ---- Locale-resolved shapes the components render ----

export type HeroSection = {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  kicker: string;
  cta: string;
  tape: Array<string>;
};

export type StorySectionStat = {
  id: string;
  n: string;
  k: string;
  position: number;
};

export type StorySection = {
  tag: string;
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  p1: string;
  p2: string;
  stats: Array<StorySectionStat>;
};

export type HeroSlide = {
  id: string;
  img: string | null;
  width: number | null;
  height: number | null;
  label: string;
  mobilePos: string | undefined;
  position: number;
};

export type MetaobjectFieldRecord = {
  id: string;
  position: number;
  [key: string]: string | number;
};

/** Card data shipped to the client: the product minus the raw image lists. */
export type HomeProductCard = Omit<
  HomeProductCardFragment,
  'images' | 'variants'
> & {carousel: Array<CarouselImage>};
