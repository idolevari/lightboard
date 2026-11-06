import {useInView} from '~/lib/useInView';
import {PHOTOS, cropSrcSet, withParams} from '~/lib/photos';
import type {StorySection} from '~/lib/home/types';
import {
  LiveLoop,
  SunRays,
  Surfboard,
  WaveDivider,
} from '~/components/illustrations';
import {CountUp} from './CountUp';
import {Reveal} from './Reveal';

function StoryStat({n, k, delay}: {n: string; k: string; delay: number}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`stat reveal${inView ? ' is-in' : ''}`}
      style={{transitionDelay: `${delay}ms`}}
    >
      <b>
        <CountUp value={n} active={inView} />
      </b>
      {k}
    </div>
  );
}

export function Story({content}: {content: StorySection | null}) {
  // All story copy comes from the `homepage_story` metaobject linked via the
  // `homepage.story` shop metafield. The merchant edits everything (paragraph
  // text, stats, eyebrow, title) from Shopify Admin → Content → Metaobjects.
  if (!content) return null;
  const main = PHOTOS.camperCliff;
  const small = PHOTOS.vanBed;
  return (
    <section className="story" id="story">
      <LiveLoop className="story-sun">
        <SunRays />
      </LiveLoop>
      <div className="container">
        <div className="story-grid">
          <div className="story-media-wrap">
            <div className="story-media">
              {content.tag && <span className="tag">{content.tag}</span>}
              <img
                src={withParams(main.url, 'width=900')}
                srcSet={cropSrcSet(main.url, {
                  ratio: 4 / 5,
                  focalX: '45%',
                  focalY: '55%',
                  srcW: main.w,
                  srcH: main.h,
                  widths: [480, 720, 960, 1280],
                })}
                sizes="(min-width: 900px) 40vw, 92vw"
                alt=""
                width={1280}
                height={1600}
                loading="lazy"
                decoding="async"
              />
            </div>
            <figure className="story-polaroid" aria-hidden="true">
              <img
                src={withParams(small.url, 'width=480')}
                srcSet={cropSrcSet(small.url, {
                  ratio: 4 / 5,
                  focalX: '55%',
                  focalY: '60%',
                  srcW: small.w,
                  srcH: small.h,
                  widths: [240, 360, 480],
                })}
                sizes="(min-width: 900px) 16vw, 38vw"
                alt=""
                width={480}
                height={600}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
          <div className="story-copy">
            {content.eyebrow && (
              <Reveal>
                <div className="section-eyebrow" style={{marginBottom: 24}}>
                  <span>{content.eyebrow}</span>
                </div>
              </Reveal>
            )}
            {(content.titleLine1 || content.titleLine2) && (
              <Reveal delay={80}>
                <h2>
                  {content.titleLine1}
                  {content.titleLine1 && content.titleLine2 && <br />}
                  {content.titleLine2 && <em>{content.titleLine2}</em>}
                </h2>
              </Reveal>
            )}
            {(content.p1 || content.p2) && (
              <Reveal delay={160}>
                {content.p1 && <p>{content.p1}</p>}
                {content.p2 && <p>{content.p2}</p>}
              </Reveal>
            )}
            {content.stats?.length > 0 && (
              <div className="story-stats">
                <Surfboard className="story-board" />
                {content.stats.map((st, idx) => (
                  <StoryStat key={st.id} n={st.n} k={st.k} delay={idx * 120} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <WaveDivider className="section-wave" />
    </section>
  );
}
