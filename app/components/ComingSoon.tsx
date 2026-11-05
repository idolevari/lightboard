import {mailtoHref, useBusiness, whatsappHref} from '~/lib/brand';
import {useI18n} from '~/lib/useI18n';

export function ComingSoon() {
  const b = useBusiness();
  const whatsapp = whatsappHref(b);
  const mailto = mailtoHref(b);
  const {dict} = useI18n();
  const c = dict.comingSoon;
  const contact = dict.contact;

  return (
    <div className="coming-soon">
      <div className="coming-soon-bg" aria-hidden="true" />
      <div className="coming-soon-overlay" aria-hidden="true" />

      <main className="coming-soon-content">
        <img
          src="/lightboard-text.svg"
          alt="Lightboard"
          className="coming-soon-logo"
          width="320"
          height="44"
        />

        <h1 className="coming-soon-title">
          {c.titleBefore} <em>{c.titleEm}</em> {c.titleAfter}
        </h1>

        <div className="coming-soon-contact">
          {whatsapp && (
            <a
              className="coming-soon-link"
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              {contact.whatsapp}
            </a>
          )}
          {mailto && (
            <a className="coming-soon-link" href={mailto}>
              {contact.email}
            </a>
          )}
          {b?.instagram && (
            <a
              className="coming-soon-link"
              href={b.instagram}
              target="_blank"
              rel="noreferrer"
            >
              {contact.instagram}
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
