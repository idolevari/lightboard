import {Suspense, useEffect, useState} from 'react';
import {Await, Link, NavLink, useAsyncValue, useLocation} from 'react-router';
import {useAnalytics, useOptimisticCart} from '@shopify/hydrogen';
import type {CartReturn} from '@shopify/hydrogen';
import {asideDomId, useAside} from '~/components/Aside';
import {useI18n} from '~/lib/useI18n';
import {
  SUPPORTED_LOCALES,
  getLocaleConfig,
  parseLocaleFromPath,
  swapLocaleInPath,
} from '~/lib/i18n';
import {useBusiness, telHref, whatsappHref} from '~/lib/brand';
import type {
  CartApiQueryFragment,
  HeaderQuery,
} from 'storefrontapi.generated';

const HOME_PATH_RE = /^\/([a-z]{2}\/?)?$/;

/** The one product the store sells — "Shop" goes straight to it. */
export const SHOP_PATH = '/products/lightboard';

type ResolvedCart = CartApiQueryFragment | CartReturn | null;
type HeaderCart = Promise<ResolvedCart> | ResolvedCart;

export type HeaderProps = {
  header: HeaderQuery;
  cart: HeaderCart;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
};

type NavItem = {
  key: string;
  to: string;
  label: string;
  /** Homepage anchor this item points at ('' for none). */
  hash: string;
};

/**
 * Curated primary navigation. Labels come from i18n rather than the Shopify
 * `main-menu` (whose item titles are English-only), so HE and EN both read
 * natively and the drawer never shows mixed-language links.
 */
export function usePrimaryNav(): NavItem[] {
  const {dict, to} = useI18n();
  return [
    {key: 'shop', to: to(SHOP_PATH), label: dict.nav.shop, hash: ''},
    {key: 'about', to: to('/#story'), label: dict.nav.about, hash: '#story'},
    {key: 'faq', to: to('/#faq'), label: dict.nav.faq, hash: '#faq'},
    {
      key: 'contact',
      to: to('/pages/contact'),
      label: dict.nav.contact,
      hash: '',
    },
  ];
}

/**
 * NavLink's isActive ignores the hash, so on the homepage `/#story` and
 * `/#faq` would both match. Resolve the single active item ourselves.
 */
function useActiveNavKey(items: NavItem[]): string | null {
  const location = useLocation();
  const isHome = HOME_PATH_RE.test(location.pathname);
  if (isHome) {
    return items.find((i) => i.hash && i.hash === location.hash)?.key ?? null;
  }
  // Root data doesn't revalidate on client navigation, so derive the
  // locale-less path from the live location.
  const path = parseLocaleFromPath(location.pathname).rest || '/';
  if (path.startsWith(SHOP_PATH)) return 'shop';
  if (path.startsWith('/pages/contact')) return 'contact';
  return null;
}

export function Header({isLoggedIn, cart}: HeaderProps) {
  const {dict, to} = useI18n();
  const location = useLocation();
  const isHome = HOME_PATH_RE.test(location.pathname);
  const [scrolled, setScrolled] = useState(!isHome);
  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const items = usePrimaryNav();
  const activeKey = useActiveNavKey(items);
  const startItems = items.filter((i) => i.key !== 'contact');
  const endItems = items.filter((i) => i.key === 'contact');

  const renderLink = (item: NavItem) => {
    const isActive = item.key === activeKey;
    return (
      <NavLink
        key={item.key}
        to={item.to}
        prefetch="intent"
        aria-current={isActive ? 'page' : undefined}
        className={() =>
          `lb-nav-link lb-nav-link--desktop${isActive ? ' active' : ''}`
        }
      >
        {item.label}
      </NavLink>
    );
  };

  return (
    <header className={`header lb-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container lb-nav-inner">
        <nav className="lb-nav-left" aria-label={dict.nav.primaryLabel}>
          <MenuToggle label={dict.nav.menu} />
          {startItems.map(renderLink)}
        </nav>

        <NavLink
          to={to('/')}
          prefetch="intent"
          end
          aria-label="Lightboard"
          className="lb-logo-link"
        >
          <img
            src="/lightboard-text.svg"
            alt="Lightboard"
            className="lb-logo-img"
            width="200"
            height="27"
            decoding="async"
          />
        </NavLink>

        <div className="lb-nav-right">
          {endItems.map(renderLink)}
          <LangToggle className="lb-lang-toggle--desktop" />
          <SearchToggle label={dict.nav.search} />
          <AccountLink isLoggedIn={isLoggedIn} label={dict.nav.account} />
          <CartToggle cart={cart} label={dict.nav.cart} />
        </div>
      </div>
    </header>
  );
}

export function LangToggle({className = ''}: {className?: string}) {
  const {locale, dict} = useI18n();
  const location = useLocation();
  return (
    <div
      className={`lb-lang-toggle ${className}`.trim()}
      role="group"
      aria-label={dict.nav.language}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const cfg = getLocaleConfig(code);
        const href = swapLocaleInPath(
          location.pathname + location.search,
          code,
        );
        const isActive = code === locale;
        return (
          <Link
            key={code}
            to={href}
            prefetch="intent"
            className={`lb-lang-btn${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'true' : undefined}
            lang={cfg.htmlLang}
            hrefLang={cfg.htmlLang}
          >
            <span aria-hidden="true">{cfg.shortLabel}</span>
            <span className="sr-only">{cfg.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Body of the mobile menu drawer: large primary links, then utilities
 * (search, account, language), then the human channels (WhatsApp / phone)
 * and the policy links shoppers look for before buying.
 */
export function MobileMenu() {
  const {close, open} = useAside();
  const {dict, to} = useI18n();
  const items = usePrimaryNav();
  const activeKey = useActiveNavKey(items);
  const business = useBusiness();
  const whatsapp = whatsappHref(business, dict.whatsapp?.prefill);
  const tel = telHref(business);

  return (
    <div className="mobile-menu">
      <nav aria-label={dict.nav.primaryLabel}>
        <ul className="mobile-menu__list">
          {items.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <li key={item.key}>
                <NavLink
                  to={item.to}
                  prefetch="intent"
                  onClick={close}
                  aria-current={isActive ? 'page' : undefined}
                  className={() =>
                    `mobile-menu__link${isActive ? ' is-active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mobile-menu__utils">
        <button
          type="button"
          className="mobile-menu__util"
          onClick={() => open('search')}
        >
          <SearchIcon />
          <span>{dict.nav.search}</span>
        </button>
        <NavLink
          to={to('/account')}
          prefetch="intent"
          onClick={close}
          className="mobile-menu__util"
        >
          <AccountIcon />
          <span>{dict.nav.account}</span>
        </NavLink>
        <LangToggle className="lb-lang-toggle--menu" />
      </div>

      {(whatsapp || tel) && (
        <div className="mobile-menu__contact">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="mobile-menu__wa"
            >
              <img src="/whatsapp.svg" alt="" width="24" height="24" />
              <span>{dict.whatsapp?.label}</span>
            </a>
          )}
          {tel && business.phoneDisplay && (
            <a href={tel} className="mobile-menu__tel">
              <span>{dict.footer.metaPhoneLabel}: </span>
              <bdi dir="ltr">{business.phoneDisplay}</bdi>
            </a>
          )}
        </div>
      )}

      <ul className="mobile-menu__legal">
        {dict.footer.legal.map((l) => (
          <li key={l.to}>
            <NavLink to={to(l.to)} prefetch="intent" onClick={close}>
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MenuToggle({label}: {label: string}) {
  const {open, type} = useAside();
  return (
    <button
      type="button"
      className="lb-nav-burger"
      aria-label={label}
      aria-expanded={type === 'mobile'}
      aria-controls={asideDomId('mobile')}
      aria-haspopup="dialog"
      onClick={() => open('mobile')}
    >
      <span aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function SearchToggle({label}: {label: string}) {
  const {open, type} = useAside();
  return (
    <button
      className="lb-icon-btn"
      onClick={() => open('search')}
      aria-label={label}
      aria-expanded={type === 'search'}
      aria-controls={asideDomId('search')}
      aria-haspopup="dialog"
      type="button"
    >
      <SearchIcon />
    </button>
  );
}

function AccountLink({
  isLoggedIn,
  label,
}: {
  isLoggedIn: Promise<boolean>;
  label: string;
}) {
  const {to} = useI18n();
  return (
    <NavLink
      to={to('/account')}
      prefetch="intent"
      className="lb-icon-btn"
      aria-label={label}
    >
      <Suspense fallback={<AccountIcon />}>
        <Await resolve={isLoggedIn} errorElement={null}>
          {() => <AccountIcon />}
        </Await>
      </Suspense>
    </NavLink>
  );
}

function CartBadge({count, label}: {count: number; label: string}) {
  const {open, type} = useAside();
  const {dict} = useI18n();
  const {publish, shop, cart, prevCart} = useAnalytics();
  return (
    <button
      className="lb-cart-btn"
      onClick={() => {
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: (typeof window !== 'undefined' && window.location.href) || '',
        });
      }}
      aria-expanded={type === 'cart'}
      aria-controls={asideDomId('cart')}
      aria-haspopup="dialog"
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
        <path d="M8 8V6a1.5 1.5 0 0 1 3 0v2" />
        <path d="M13 8V6a1.5 1.5 0 0 1 3 0v2" />
      </svg>
      {/* Visible on desktop, visually hidden on phones — never display:none,
          so the accessible name always reads "סל, 2 פריטים". */}
      <span className="lb-cart-label">{label}</span>
      <span aria-live="polite" aria-atomic="true">
        {count > 0 ? (
          <>
            {/* Keyed on the count so the badge re-mounts and pops (M11). */}
            <span className="lb-cart-count" key={count}>
              {count}
            </span>
            <span className="sr-only"> {dict.cart.lineItems}</span>
          </>
        ) : null}
      </span>
    </button>
  );
}

function CartToggle({cart, label}: {cart: HeaderCart; label: string}) {
  return (
    <Suspense fallback={<CartBadge count={0} label={label} />}>
      <Await resolve={cart}>
        <CartBanner label={label} />
      </Await>
    </Suspense>
  );
}

function CartBanner({label}: {label: string}) {
  const originalCart = useAsyncValue() as ResolvedCart;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} label={label} />;
}
