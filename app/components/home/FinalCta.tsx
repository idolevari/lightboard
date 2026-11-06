import {Link} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {PHOTOS, cropSrcSet, widthSrcSet, withParams} from '~/lib/photos';
import type {BrandPhoto} from '~/lib/photos';
import {LiveLoop, SunRays} from '~/components/illustrations';
import {Reveal} from './Reveal';

/** Full-bleed brand photo: portrait crop on phones, landscape above. */
function PhotoBandImage({
  photo,
  focalX,
  className,
}: {
  photo: BrandPhoto;
  focalX: string;
  className: string;
}) {
  return (
    <picture className={className}>
      <source
        media="(max-aspect-ratio: 4/5)"
        srcSet={cropSrcSet(photo.url, {
          ratio: 4 / 5,
          focalX,
          srcW: photo.w,
          srcH: photo.h,
          widths: [480, 720, 960, 1200],
        })}
        sizes="100vw"
      />
      <img
        src={withParams(photo.url, 'width=1200')}
        srcSet={widthSrcSet(photo.url, [720, 1200, 1800, 2400], photo.w)}
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

/** Closing photo band with the main call to action. */
export function FinalCta({handle}: {handle?: string | null}) {
  const {dict, to} = useI18n();
  const c = dict.finalCta;
  if (!c?.title) return null;
  const href = handle ? to(`/products/${handle}`) : '#featured';
  return (
    <section className="final-cta" aria-labelledby="final-cta-title">
      <PhotoBandImage
        photo={PHOTOS.surferDusk}
        focalX="52%"
        className="band-photo"
      />
      <LiveLoop className="final-cta-sun">
        <SunRays />
      </LiveLoop>
      <div className="container final-cta-inner">
        <Reveal>
          <h2 id="final-cta-title" className="final-cta-title">
            {c.title}
          </h2>
        </Reveal>
        <Reveal delay={100}>
          {c.kicker && <p className="final-cta-kicker">{c.kicker}</p>}
          <Link to={href} prefetch="intent" className="hero-cta final-cta-btn">
            <span>{c.cta}</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
