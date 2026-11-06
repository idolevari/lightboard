import {Image} from '@shopify/hydrogen';
import {useI18n} from '~/lib/useI18n';
import {PHOTOS, cropSrcSet, withParams} from '~/lib/photos';

export type LifestyleImage = {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

/**
 * "In your home" strip: the product's own on-the-wall shot (first product
 * image that isn't a variant render, managed in Shopify) next to a sunlit
 * room from the brand photo set.
 */
export function InYourHome({lifestyle}: {lifestyle: LifestyleImage | null}) {
  const {dict} = useI18n();
  const t = dict.product.inYourHome;
  const room = PHOTOS.sunlitRoom;
  if (!t?.title) return null;
  return (
    <section className="pdp-home" aria-labelledby="pdp-home-title">
      <div className="pdp-home-head">
        <p className="pdp-eyebrow">{t.eyebrow}</p>
        <h2 id="pdp-home-title" className="pdp-home-title">
          {t.title}
        </h2>
      </div>
      <div className={`pdp-home-grid${lifestyle ? '' : ' is-single'}`}>
        {lifestyle ? (
          <figure className="pdp-home-main">
            <Image
              data={lifestyle}
              alt={lifestyle.altText ?? ''}
              sizes="(min-width: 900px) 55vw, 92vw"
              aspectRatio="4/5"
              crop="center"
              loading="lazy"
            />
          </figure>
        ) : null}
        <figure className="pdp-home-room">
          <img
            src={withParams(room.url, 'width=900')}
            srcSet={cropSrcSet(room.url, {
              ratio: 4 / 5,
              focalX: '30%',
              srcW: room.w,
              srcH: room.h,
              widths: [480, 720, 960, 1280],
            })}
            sizes="(min-width: 900px) 38vw, 92vw"
            alt=""
            width={960}
            height={1200}
            loading="lazy"
            decoding="async"
          />
          <figcaption>{t.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

/**
 * Printboard "in your home" strip: the product's own photos of finished
 * boards on real walls (Shopify product images), one large and the rest in
 * a scrolling row on phones / a grid on desktop.
 */
export function PrintboardOnTheWall({images}: {images: Array<LifestyleImage>}) {
  const {dict} = useI18n();
  const t = dict.printboard?.inYourHome;
  if (!t?.title || images.length === 0) return null;
  const [main, ...rest] = images;
  return (
    <section className="pdp-home pb-home" aria-labelledby="pdp-home-title">
      <div className="pdp-home-head">
        <p className="pdp-eyebrow">{t.eyebrow}</p>
        <h2 id="pdp-home-title" className="pdp-home-title">
          {t.title}
        </h2>
        <p className="pb-home-caption">{t.caption}</p>
      </div>
      <div className="pb-home-grid">
        <figure className="pb-home-main">
          <Image
            data={main}
            alt={main.altText ?? ''}
            sizes="(min-width: 900px) 50vw, 92vw"
            aspectRatio="1/1"
            loading="lazy"
          />
        </figure>
        {rest.length > 0 ? (
          // Scrolls sideways on phones, so it must be keyboard-focusable.
          <ul
            className="pb-home-row"
            role="list"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            aria-label={t.title}
          >
            {rest.map((img) => (
              <li key={img.id ?? img.url}>
                <Image
                  data={img}
                  alt={img.altText ?? ''}
                  sizes="(min-width: 900px) 22vw, 44vw"
                  aspectRatio="1/1"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
