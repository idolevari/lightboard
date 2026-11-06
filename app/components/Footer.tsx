import {NavLink, useNavigate} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {useBusiness, whatsappHref} from '~/lib/brand';
import {openCookiePreferences} from '~/lib/consent';
import {WaveDivider} from '~/components/illustrations';

export function Footer() {
  const {dict, to} = useI18n();
  const f = dict.footer;
  const b = useBusiness();
  const whatsapp = whatsappHref(b);

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
          {(b?.instagram || whatsapp) && (
            <div className="footer-social">
              {b?.instagram && (
                <a
                  href={b.instagram}
                  aria-label="Instagram"
                  target="_blank"
                  rel="noreferrer"
                >
                  <InstagramIcon />
                </a>
              )}
              {whatsapp && (
                <a
                  href={whatsapp}
                  aria-label="WhatsApp"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src="/whatsapp.svg" alt="" width="40" height="40" />
                </a>
              )}
            </div>
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

/** Instagram app icon (official gradient), drawn inline so it stays crisp. */
function InstagramIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad" cx="0.3" cy="1.07" r="1.2">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset="0.05" stopColor="#fdf497" />
          <stop offset="0.45" stopColor="#fd5949" />
          <stop offset="0.6" stopColor="#d6249f" />
          <stop offset="0.9" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#ig-grad)" />
      <rect
        x="9.5"
        y="9.5"
        width="21"
        height="21"
        rx="6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
      />
      <circle
        cx="20"
        cy="20"
        r="5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
      />
      <circle cx="26.2" cy="13.8" r="1.5" fill="#fff" />
    </svg>
  );
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
