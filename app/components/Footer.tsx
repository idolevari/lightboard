import {NavLink, useNavigate} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {useBusiness} from '~/lib/brand';
import {openCookiePreferences} from '~/lib/consent';
import {WaveDivider} from '~/components/illustrations';

export function Footer() {
  const {dict, to} = useI18n();
  const f = dict.footer;
  const b = useBusiness();

  return (
    <footer className="footer">
      <WaveDivider className="footer-wave" />
      <div className="container">
        <div className="footer-brand">
          <img
            src="/lightboard-text.svg"
            alt="Lightboard"
            className="footer-wordmark"
            width="240"
            height="33"
            decoding="async"
          />
          <p className="footer-desc">{f.brandDesc}</p>
          {b?.instagram && (
            <a
              className="footer-ig"
              href={b.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <InstagramIcon />
              <span lang="en" dir="ltr">
                @{instagramHandle(b.instagram)}
              </span>
            </a>
          )}
        </div>

        <div className="footer-bottom">
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
          <span className="footer-copy">
            © {new Date().getFullYear()} {f.rights}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Instagram glyph, single-colour line style to match the brand. */
function InstagramIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function instagramHandle(url: string) {
  return url.replace(/\/+$/, '').split('/').pop() ?? 'lightboardshop';
}

/**
 * Cookie-settings link in the footer: lets a visitor reopen consent choices.
 * Opens Shopify's privacy-banner preferences when the banner script is loaded;
 * otherwise falls back to the privacy policy so the link is never dead.
 */
function CookieSettingsButton({label}: {label: string}) {
  const {to} = useI18n();
  const navigate = useNavigate();
  function openCookieSettings() {
    if (openCookiePreferences()) return;
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
