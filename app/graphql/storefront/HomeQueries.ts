/**
 * Storefront API documents for the homepage loader
 * (app/routes/($locale)._index.tsx).
 */

/**
 * Everything a homepage product block needs. The carousel photos are picked
 * from `images` on the server (see pickCarouselImages) and `variants` is
 * only read to skip per-variant renders.
 */
const HOME_PRODUCT_CARD_FRAGMENT = `#graphql
  fragment HomeProductCard on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice { amount currencyCode }
    }
    featuredImage { id url altText width height }
    images(first: 12) {
      nodes { id url altText width height }
    }
    variants(first: 50) {
      nodes { id image { url } }
    }
    options {
      id
      name
      optionValues {
        id
        name
        swatch { color }
      }
    }
    eyebrow_he: metafield(namespace: "marketing", key: "eyebrow_he") { value }
    eyebrow_en: metafield(namespace: "marketing", key: "eyebrow_en") { value }
    headline_he: metafield(namespace: "marketing", key: "headline_he") { value }
    headline_en: metafield(namespace: "marketing", key: "headline_en") { value }
    description_he: metafield(namespace: "marketing", key: "description_he") { value }
    description_en: metafield(namespace: "marketing", key: "description_en") { value }
    shipNote_he: metafield(namespace: "marketing", key: "ship_note_he") { value }
    shipNote_en: metafield(namespace: "marketing", key: "ship_note_en") { value }
    specs: metafield(namespace: "marketing", key: "specs") {
      references(first: 20) {
        nodes {
          ... on Metaobject {
            id
            label_he: field(key: "label_he") { value }
            label_en: field(key: "label_en") { value }
            value_he: field(key: "value_he") { value }
            value_en: field(key: "value_en") { value }
            position: field(key: "position") { value }
          }
        }
      }
    }
  }
`;

export const FEATURED_PRODUCT_QUERY = `#graphql
  query FeaturedProduct($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      featured: metafield(namespace: "custom", key: "featured_product") {
        reference {
          ...HomeProductCard
        }
      }
    }
  }
  ${HOME_PRODUCT_CARD_FRAGMENT}
`;

export const HOME_PRODUCT_BY_HANDLE_QUERY = `#graphql
  query HomeProductByHandle(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...HomeProductCard
    }
  }
  ${HOME_PRODUCT_CARD_FRAGMENT}
`;

export const FAQS_QUERY = `#graphql
  query FAQs {
    metaobjects(type: "faq", first: 20, sortKey: "position") {
      nodes {
        id
        handle
        fields { key value }
      }
    }
  }
`;

export const HERO_SLIDES_QUERY = `#graphql
  query HeroSlides {
    metaobjects(type: "hero_slide", first: 10, sortKey: "position") {
      nodes {
        id
        handle
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url altText width height }
            }
          }
        }
      }
    }
  }
`;

export const HOMEPAGE_SECTIONS_QUERY = `#graphql
  query HomepageSections {
    shop {
      hero: metafield(namespace: "homepage", key: "hero") {
        reference {
          ... on Metaobject {
            eyebrow_he: field(key: "eyebrow_he") { value }
            eyebrow_en: field(key: "eyebrow_en") { value }
            title_line_1_he: field(key: "title_line_1_he") { value }
            title_line_1_en: field(key: "title_line_1_en") { value }
            title_line_2_he: field(key: "title_line_2_he") { value }
            title_line_2_en: field(key: "title_line_2_en") { value }
            kicker_he: field(key: "kicker_he") { value }
            kicker_en: field(key: "kicker_en") { value }
            cta_he: field(key: "cta_he") { value }
            cta_en: field(key: "cta_en") { value }
            tape_items_he: field(key: "tape_items_he") { value }
            tape_items_en: field(key: "tape_items_en") { value }
          }
        }
      }
      story: metafield(namespace: "homepage", key: "story") {
        reference {
          ... on Metaobject {
            tag: field(key: "tag") { value }
            eyebrow_he: field(key: "eyebrow_he") { value }
            eyebrow_en: field(key: "eyebrow_en") { value }
            title_line_1_he: field(key: "title_line_1_he") { value }
            title_line_1_en: field(key: "title_line_1_en") { value }
            title_line_2_he: field(key: "title_line_2_he") { value }
            title_line_2_en: field(key: "title_line_2_en") { value }
            p1_he: field(key: "p1_he") { value }
            p1_en: field(key: "p1_en") { value }
            p2_he: field(key: "p2_he") { value }
            p2_en: field(key: "p2_en") { value }
            stats: field(key: "stats") {
              references(first: 10) {
                nodes {
                  ... on Metaobject {
                    id
                    value: field(key: "value") { value }
                    label_he: field(key: "label_he") { value }
                    label_en: field(key: "label_en") { value }
                    position: field(key: "position") { value }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
