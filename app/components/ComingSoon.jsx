import {mailtoHref, useBusiness, whatsappHref} from '~/lib/brand';

export function ComingSoon() {
  const b = useBusiness();
  const whatsapp = whatsappHref(b);
  const mailto = mailtoHref(b);

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
          אתר <em>חדש</em> בדרך.
        </h1>

        <div className="coming-soon-contact">
          {whatsapp && (
            <a
              className="coming-soon-link"
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
          {mailto && (
            <a className="coming-soon-link" href={mailto}>
              Email
            </a>
          )}
          {b?.instagram && (
            <a
              className="coming-soon-link"
              href={b.instagram}
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
