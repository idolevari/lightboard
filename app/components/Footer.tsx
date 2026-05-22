import {NavLink} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {useBusiness, whatsappHref} from '~/lib/brand';

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
                {f.metaPhoneLabel}: <a href={`tel:${b.phone || b.phoneDisplay}`}>{b.phoneDisplay}</a>
              </span>
            )}
            {b.email && (
              <span>
                {f.metaEmailLabel}: <a href={`mailto:${b.email}`}>{b.email}</a>
              </span>
            )}
          </address>
        )}

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {f.rights}</span>
          <span style={{display: 'flex', gap: 20, flexWrap: 'wrap'}}>
            {f.legal.map((l) => (
              <NavLink key={l.label} to={to(l.to)} prefetch="intent">
                {l.label}
              </NavLink>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
