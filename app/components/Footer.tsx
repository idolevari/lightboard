import {NavLink, useNavigate} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {telHref, useBusiness, whatsappHref} from '~/lib/brand';

export function Footer() {
  const {dict, to} = useI18n();
  const f = dict.footer;
  const b = useBusiness();
  const businessName = b?.legalName;
  const hasMeta = b?.address || b?.phoneDisplay || b?.email || businessName;
  const whatsapp = whatsappHref(b);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid footer-grid--single">
          <div className="footer-brand">
            <img
              src="/lightboard-text.svg"
              alt="Lightboard"
              className="footer-wordmark"
              width="240"
              height="33"
              decoding="async"
            />
            <p>{f.brandDesc}</p>
            <div className="footer-social">
              {b?.instagram && (
                <a href={b.instagram} aria-label="Instagram" target="_blank" rel="noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                  </svg>
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} aria-label="WhatsApp" target="_blank" rel="noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                    <path d="M4 20l1.5-5A8 8 0 1 1 9 19.5L4 20Z" />
                    <path d="M9 10c0 3 2 5 5 5" strokeLinecap="round" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {hasMeta && (
          <address className="footer-meta">
            {businessName && <span className="footer-meta-name">{businessName}</span>}
            {b.address && (
              <span>
                {f.metaAddressLabel}: {b.address}
              </span>
            )}
            {b.phoneDisplay && (
              <span>
                {f.metaPhoneLabel}:{' '}
                <a href={telHref(b) ?? `tel:${b.phoneDisplay}`} dir="ltr">
                  {b.phoneDisplay}
                </a>
              </span>
            )}
            {b.email && (
              <span>
                {f.metaEmailLabel}:{' '}
                <a href={`mailto:${b.email}`} dir="ltr">
                  {b.email}
                </a>
              </span>
            )}
          </address>
        )}

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {f.rights}</span>
          <nav aria-label={f.legalNavLabel}>
            <ul className="footer-legal">
              {f.legal.map((l) => (
                <li key={l.to}>
                  <NavLink to={to(l.to)} prefetch="intent">
                    {l.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <CookieSettingsButton label={f.cookieSettings} />
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

type PrivacyBannerWindow = Window & {
  privacyBanner?: {showPreferences?: () => void};
};

/**
 * Cookie-settings link in the footer: lets a visitor reopen consent choices.
 *
 * TODO(consent): when fix/platform-security merges, replace this component's
 * body with the helper from `~/lib/consent`:
 *   const canOpen = useCookiePreferencesAvailable();
 *   <button type="button" className="footer-cookie-btn"
 *     onClick={openCookiePreferences} hidden={!canOpen}>{label}</button>
 * and drop the fallbacks below. Until then we use Shopify's privacy-banner
 * API if it is loaded, otherwise we send the visitor to the privacy policy.
 */
function CookieSettingsButton({label}: {label: string}) {
  const {to} = useI18n();
  const navigate = useNavigate();
  function openCookieSettings() {
    const w = window as PrivacyBannerWindow;
    if (typeof w.privacyBanner?.showPreferences === 'function') {
      w.privacyBanner.showPreferences();
      return;
    }
    void navigate(to('/policies/privacy-policy'));
  }
  return (
    <button
      type="button"
      className="footer-cookie-btn"
      data-consent-hook="cookie-settings"
      onClick={openCookieSettings}
    >
      {label}
    </button>
  );
}
