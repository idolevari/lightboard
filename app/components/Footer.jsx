import {NavLink} from 'react-router';
import {useI18n} from '~/lib/useI18n';

export function Footer() {
  const {dict, to} = useI18n();
  const f = dict.footer;

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h3 className="wordmark">
              Lightboard<em>.</em>
            </h3>
            <p>{f.brandDesc}</p>
            <div className="footer-social">
              <a href="https://instagram.com/lightboard.co.il" aria-label="Instagram" target="_blank" rel="noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              </a>
              <a href="https://facebook.com/lightboard" aria-label="Facebook" target="_blank" rel="noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2V3Z" />
                </svg>
              </a>
              <a href="https://wa.me/972000000000" aria-label="WhatsApp" target="_blank" rel="noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M4 20l1.5-5A8 8 0 1 1 9 19.5L4 20Z" />
                  <path d="M9 10c0 3 2 5 5 5" strokeLinecap="round" />
                </svg>
              </a>
              <a href="https://tiktok.com/@lightboard" aria-label="TikTok" target="_blank" rel="noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 4l7 10-7 6h3l5.5-4.7L17 20h3l-7.3-10.5L19 4h-3l-5 4.3L8 4H4Z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterCol heading={f.shopHeading} items={f.shop} to={to} />
          <FooterCol heading={f.helpHeading} items={f.help} to={to} />
          <FooterCol heading={f.companyHeading} items={f.company} to={to} />
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {f.rights}</span>
          <span style={{display: 'flex', gap: 20}}>
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

function FooterCol({heading, items, to}) {
  return (
    <div className="footer-col">
      <h4>{heading}</h4>
      <ul>
        {items.map((i) => (
          <li key={i.to + i.label}>
            <NavLink to={to(i.to)} prefetch="intent">
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
