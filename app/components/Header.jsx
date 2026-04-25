import {Suspense, useEffect, useState} from 'react';
import {Await, Link, NavLink, useAsyncValue, useLocation} from 'react-router';
import {useAnalytics, useOptimisticCart} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import {useI18n} from '~/lib/useI18n';
import {
  SUPPORTED_LOCALES,
  getLocaleConfig,
  swapLocaleInPath,
} from '~/lib/i18n';

export function Header({isLoggedIn, cart}) {
  const {dict, to} = useI18n();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const menu = [
    {to: to('/'), label: dict.nav.home, end: true},
    {to: to('/collections'), label: dict.nav.shop},
    {to: to('/pages/about'), label: dict.nav.about},
    {to: to('/blogs/journal'), label: dict.nav.journal},
  ];
  const rightMenu = [{to: to('/pages/contact'), label: dict.nav.contact}];

  return (
    <header className={`header lb-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container lb-nav-inner">
        <nav className="lb-nav-left" role="navigation">
          <MenuToggle label={dict.nav.menu} />
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              prefetch="intent"
              className={({isActive}) =>
                `lb-nav-link lb-nav-link--desktop${isActive ? ' active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <NavLink to={to('/')} prefetch="intent" end aria-label="Lightboard">
          <span className="lb-logo">
            <span>lightboard</span>
            <span className="dot" aria-hidden="true" />
          </span>
        </NavLink>

        <div className="lb-nav-right">
          {rightMenu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              prefetch="intent"
              className={({isActive}) =>
                `lb-nav-link lb-nav-link--desktop${isActive ? ' active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <SearchToggle label={dict.nav.search} />
          <AccountLink isLoggedIn={isLoggedIn} label={dict.nav.account} />
          <CartToggle cart={cart} label={dict.nav.cart} />
        </div>
        <LangToggle />
      </div>
    </header>
  );
}

function LangToggle() {
  const {locale} = useI18n();
  const location = useLocation();
  return (
    <div className="lb-lang-toggle" role="group" aria-label="Language">
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
            aria-label={cfg.label}
          >
            {cfg.shortLabel}
          </Link>
        );
      })}
    </div>
  );
}

export function HeaderMenu({menu, primaryDomainUrl, viewport, publicStoreDomain}) {
  const className = `header-menu-${viewport}`;
  const {close} = useAside();
  const {to, dict} = useI18n();
  const items = (menu || FALLBACK_HEADER_MENU).items;
  return (
    <nav className={className} role="navigation">
      {viewport === 'mobile' && (
        <NavLink end onClick={close} prefetch="intent" to={to('/')}>
          {dict.nav.home}
        </NavLink>
      )}
      {items.map((item) => {
        if (!item.url) return null;
        const url =
          item.url.includes('myshopify.com') ||
          (publicStoreDomain && item.url.includes(publicStoreDomain)) ||
          (primaryDomainUrl && item.url.includes(primaryDomainUrl))
            ? new URL(item.url).pathname
            : item.url;
        const href = url.startsWith('/') ? to(url) : url;
        return (
          <NavLink
            className="header-menu-item"
            end
            key={item.id}
            onClick={close}
            prefetch="intent"
            to={href}
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

function MenuToggle({label}) {
  const {open} = useAside();
  return (
    <button
      type="button"
      className="lb-nav-burger"
      aria-label={label}
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

function SearchToggle({label}) {
  const {open} = useAside();
  return (
    <button
      className="lb-icon-btn"
      onClick={() => open('search')}
      aria-label={label}
      type="button"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </button>
  );
}

function AccountLink({isLoggedIn, label}) {
  const {to} = useI18n();
  return (
    <NavLink
      to={to('/account')}
      prefetch="intent"
      className="lb-icon-btn"
      aria-label={label}
    >
      <Suspense
        fallback={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
        }
      >
        <Await resolve={isLoggedIn} errorElement={null}>
          {() => (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          )}
        </Await>
      </Suspense>
    </NavLink>
  );
}

function CartBadge({count, label}) {
  const {open} = useAside();
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
      aria-label={label}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 7h12l-1 14H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      <span>{label}</span>
      <span className="lb-cart-count">{count}</span>
    </button>
  );
}

function CartToggle({cart, label}) {
  return (
    <Suspense fallback={<CartBadge count={0} label={label} />}>
      <Await resolve={cart}>
        <CartBanner label={label} />
      </Await>
    </Suspense>
  );
}

function CartBanner({label}) {
  const originalCart = useAsyncValue();
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} label={label} />;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {id: '1', resourceId: null, tags: [], title: 'Shop', type: 'HTTP', url: '/collections', items: []},
    {id: '2', resourceId: null, tags: [], title: 'Journal', type: 'HTTP', url: '/blogs/journal', items: []},
    {id: '3', resourceId: null, tags: [], title: 'About', type: 'PAGE', url: '/pages/about', items: []},
  ],
};
