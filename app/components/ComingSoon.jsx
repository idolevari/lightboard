export function ComingSoon() {
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
          <a
            className="coming-soon-link"
            href="https://wa.me/972557209448"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
          <a className="coming-soon-link" href="mailto:lightboardshop@gmail.com">
            Email
          </a>
          <a
            className="coming-soon-link"
            href="https://www.instagram.com/lightboardshop/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </div>
      </main>
    </div>
  );
}
