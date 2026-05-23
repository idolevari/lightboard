import {useRouteError, isRouteErrorResponse, Link} from 'react-router';

type RouteErrorProps = {context?: string};

const HE = {
  oops: 'אופס',
  notFoundTitle: 'הדף לא נמצא',
  notFoundKicker: 'נראה שהקישור שבחרת כבר לא קיים',
  generic: 'אירעה תקלה בלתי צפויה',
  retry: 'חזרה לדף הבית',
};

const EN = {
  oops: 'Oops',
  notFoundTitle: 'Page not found',
  notFoundKicker: 'The page you were looking for could not be found.',
  generic: 'An unexpected error occurred.',
  retry: 'Back home',
};

/**
 * Per-route ErrorBoundary content. Uses hardcoded HE strings with EN fallback
 * — the i18n dictionary may not be loaded during a render error.
 */
export function RouteError({context: _context}: RouteErrorProps) {
  const error = useRouteError();
  let status: number | undefined;
  let message: string | undefined;
  if (isRouteErrorResponse(error)) {
    status = error.status;
    message =
      typeof error.data === 'string'
        ? error.data
        : (error.data?.message as string | undefined);
  } else if (error instanceof Error) {
    message = error.message;
  }
  const isNotFound = status === 404;
  // Detect locale from <html lang>, default to HE.
  const lang =
    typeof document !== 'undefined' ? document.documentElement.lang : 'he';
  const dict = lang.startsWith('en') ? EN : HE;

  return (
    <div
      className="route-error"
      style={{
        padding: '120px 24px 80px',
        maxWidth: 720,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          marginBottom: 24,
        }}
      >
        {status ?? '500'}
      </p>
      <h1
        style={{
          fontFamily: 'var(--serif)',
          fontWeight: 300,
          fontSize: 'clamp(40px, 6vw, 80px)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
          margin: '0 0 16px',
        }}
      >
        {isNotFound ? dict.notFoundTitle : dict.oops}
      </h1>
      <p style={{color: 'var(--ink-soft)', marginBottom: 32}}>
        {isNotFound ? dict.notFoundKicker : (message ?? dict.generic)}
      </p>
      <Link
        to="/"
        className="hero-cta"
        style={{
          display: 'inline-flex',
          background: 'var(--ink)',
          color: 'var(--white)',
        }}
      >
        <span>{dict.retry}</span>
        <span className="arrow" aria-hidden="true">
          →
        </span>
      </Link>
      {!isNotFound && message && (
        <fieldset style={{marginTop: 40, textAlign: 'start'}}>
          <pre>{message}</pre>
        </fieldset>
      )}
    </div>
  );
}
