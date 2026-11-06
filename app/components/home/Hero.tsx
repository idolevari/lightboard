import {useEffect, useState} from 'react';
import type {CSSProperties} from 'react';
import {useI18n} from '~/lib/useI18n';
import {useInView} from '~/lib/useInView';
import {cropSrcSet, widthSrcSet, withParams} from '~/lib/photos';
import type {HeroSection, HeroSlide} from '~/lib/home/types';
import {AutoLang} from '~/components/AutoLang';
import {WaveLayers} from '~/components/illustrations';
import {HERO_SLIDES} from './hero-slides';
import type {HeroSlideForRender} from './hero-slides';
import {useAutoRotate} from './useAutoRotate';

const HERO_DESKTOP_WIDTHS = [900, 1400, 2000, 2800];
const HERO_MOBILE_WIDTHS = [540, 720, 900, 1080, 1350];

function portrait(
  url: string,
  focalX: string | undefined,
  w?: number,
  h?: number,
) {
  return cropSrcSet(url, {
    ratio: 9 / 16,
    focalX: focalX ?? '50%',
    srcW: w,
    srcH: h,
    widths: HERO_MOBILE_WIDTHS,
  });
}

/** Spread helper: React 18 warns on camelCase `fetchPriority`. */
function fetchPriority(value: 'high' | 'low' | 'auto') {
  return {fetchpriority: value} as Record<string, string>;
}

function HeroPicture({
  slide,
  eager,
}: {
  slide: HeroSlideForRender;
  eager: boolean;
}) {
  const m = slide.mobile;
  return (
    <picture>
      <source
        media="(max-aspect-ratio: 4/5)"
        srcSet={
          m
            ? portrait(m.img, m.pos, m.w, m.h)
            : portrait(slide.img, slide.mobilePos, slide.w, slide.h)
        }
        sizes="100vw"
      />
      <img
        src={withParams(slide.img, 'width=2000')}
        srcSet={widthSrcSet(slide.img, HERO_DESKTOP_WIDTHS, slide.w)}
        // Landscape photo on a viewport narrower than 3:2 is shown at
        // ~150% of the viewport height wide (object-fit: cover).
        sizes="(max-aspect-ratio: 3/2) 150svh, 100vw"
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        {...fetchPriority(eager ? 'high' : 'low')}
        draggable={false}
      />
    </picture>
  );
}

function MotionToggle({
  stopped,
  onToggle,
  pauseLabel,
  playLabel,
}: {
  stopped: boolean;
  onToggle: () => void;
  pauseLabel: string;
  playLabel: string;
}) {
  return (
    <button
      type="button"
      className="motion-toggle"
      onClick={onToggle}
      aria-label={stopped ? playLabel : pauseLabel}
    >
      {stopped ? (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.5" y="2.5" width="3" height="11" fill="currentColor" />
          <rect x="9.5" y="2.5" width="3" height="11" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

export function Hero({
  slides,
  content,
}: {
  slides: Array<HeroSlide>;
  content: HeroSection | null;
}) {
  const {dict} = useI18n();
  // Slides + section copy both live in Shopify (metaobjects + shop metafield).
  // The slides have a code fallback so the page never renders empty; the
  // section copy renders only when the merchant has configured the
  // `homepage.hero` metafield.
  const activeSlides: Array<HeroSlideForRender> =
    Array.isArray(slides) && slides.length > 0
      ? slides
          .filter((s): s is HeroSlide & {img: string} => Boolean(s.img))
          .map((s) => ({
            id: s.id,
            img: s.img,
            label: s.label,
            mobilePos: s.mobilePos,
            w: s.width ?? undefined,
            h: s.height ?? undefined,
          }))
      : HERO_SLIDES;
  const tape = content?.tape ?? [];
  const rotate = useAutoRotate(activeSlides.length, 5200);
  const i = rotate.index;
  const setI = rotate.setIndex;
  // Only slide 0 is in the server HTML (it is the LCP image). The others
  // are mounted after window load + idle time, or on first interaction, so
  // they never compete with it.
  const [mountAll, setMountAll] = useState(false);
  useEffect(() => {
    if (mountAll) return undefined;
    let idleId: number | undefined;
    let timer: number | undefined;
    const mount = () => {
      const ric = (
        window as Window & {
          requestIdleCallback?: (
            cb: () => void,
            o?: {timeout: number},
          ) => number;
        }
      ).requestIdleCallback;
      if (ric) idleId = ric(() => setMountAll(true), {timeout: 3000});
      else timer = window.setTimeout(() => setMountAll(true), 1500);
    };
    if (document.readyState === 'complete') {
      timer = window.setTimeout(mount, 1200);
    } else {
      window.addEventListener('load', mount, {once: true});
    }
    return () => {
      window.removeEventListener('load', mount);
      if (timer) window.clearTimeout(timer);
      const cic = (
        window as Window & {cancelIdleCallback?: (id: number) => void}
      ).cancelIdleCallback;
      if (idleId && cic) cic(idleId);
    };
  }, [mountAll]);
  useEffect(() => {
    if (i !== 0) setMountAll(true);
  }, [i]);
  // Wave loops pause while the hero is off-screen.
  const [liveRef, live] = useInView<HTMLElement>({
    once: false,
    threshold: 0,
    rootMargin: '0px',
  });
  const hasVisibleTitle = Boolean(content?.titleLine1 || content?.titleLine2);

  return (
    <section
      ref={liveRef}
      className={`hero${rotate.paused ? ' is-paused' : ''}${rotate.stopped ? ' is-stopped' : ''}${live ? ' is-live' : ''}`}
      aria-label={dict.hero.regionLabel}
      {...rotate.handlers}
    >
      <div className="hero-stage">
        {activeSlides.map(
          (s, j) =>
            (j === 0 || mountAll) && (
              <div
                key={s.id ?? s.img}
                className={`hero-media${j === i ? ' is-active' : ''}`}
                aria-hidden={j !== i}
                style={
                  s.deskPos
                    ? ({'--hero-pos': s.deskPos} as CSSProperties)
                    : undefined
                }
              >
                <HeroPicture slide={s} eager={j === 0} />
              </div>
            ),
        )}
      </div>
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-inner">
        {(content?.eyebrow || activeSlides[i]?.label) && (
          <div className="hero-eyebrow">
            <span className="tick" />
            {content?.eyebrow && <span>{content.eyebrow}</span>}
            {content?.eyebrow && activeSlides[i]?.label && (
              <span className="hero-eyebrow-sep">/</span>
            )}
            {activeSlides[i]?.label && (
              <span className="hero-eyebrow-label">
                <AutoLang text={activeSlides[i].label} />
              </span>
            )}
          </div>
        )}
        {/* Exactly one h1 on the homepage: when the merchant clears the
            hero title, keep a visually-hidden one for structure and SEO. */}
        {!hasVisibleTitle && <h1 className="sr-only">{dict.hero.srTitle}</h1>}
        {hasVisibleTitle && (
          <h1 className="hero-title">
            {content?.titleLine1}
            {content?.titleLine1 && content?.titleLine2 && <br />}
            {content?.titleLine2 && <em>{content.titleLine2}</em>}
          </h1>
        )}
        <div className="hero-meta">
          {content?.kicker && <p className="hero-kicker">{content.kicker}</p>}
          {content?.cta && (
            <a href="#featured" className="hero-cta">
              <span>{content.cta}</span>
              <span className="arrow" aria-hidden="true">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </a>
          )}
        </div>
        <div
          className="hero-dots"
          role="group"
          aria-label={dict.hero.slideAria}
        >
          {activeSlides.map((s, j) => (
            <button
              key={s.id ?? s.img}
              onClick={() => setI(j)}
              aria-label={`${dict.hero.slideAria} ${j + 1}`}
              aria-current={j === i ? 'true' : undefined}
              className={j === i ? 'on' : ''}
              type="button"
            />
          ))}
          <span className="count" dir="ltr" aria-hidden="true">
            {String(i + 1).padStart(2, '0')} /{' '}
            {String(activeSlides.length).padStart(2, '0')}
          </span>
          {activeSlides.length > 1 && (
            <MotionToggle
              stopped={rotate.stopped}
              onToggle={rotate.toggle}
              pauseLabel={dict.hero.pause}
              playLabel={dict.hero.play}
            />
          )}
        </div>
      </div>

      <div className="scroll-hint" aria-hidden="true">
        SCROLL
      </div>

      {tape.length > 0 && (
        <div className="hero-tape" aria-hidden="true">
          <div className="hero-tape-track">
            <span>
              {[...tape, ...tape, ...tape].map((s, k) => (
                // The tape is intentionally tripled for seamless scroll; index
                // is the only stable key since each string repeats three times.
                // eslint-disable-next-line react/no-array-index-key
                <span key={k} className="hero-tape-item">
                  <span>{s}</span>
                  <span className="dot-sep" />
                </span>
              ))}
            </span>
          </div>
        </div>
      )}

      <WaveLayers className="hero-waves" />
    </section>
  );
}
