import {useEffect, useId, useRef, useState} from 'react';
import {useI18n} from '~/lib/useI18n';

const STORAGE_KEY = 'lb-a11y';
const DEFAULTS = {
  textSize: 'normal',
  highContrast: false,
  highlightLinks: false,
  readableFont: false,
};

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    return {...DEFAULTS, ...JSON.parse(stored)};
  } catch {
    return DEFAULTS;
  }
}

function applyToBody(s) {
  if (typeof document === 'undefined') return;
  const c = document.body.classList;
  c.toggle('a11y-larger-text', s.textSize === 'larger');
  c.toggle('a11y-much-larger-text', s.textSize === 'much-larger');
  c.toggle('a11y-high-contrast', s.highContrast);
  c.toggle('a11y-highlight-links', s.highlightLinks);
  c.toggle('a11y-readable-font', s.readableFont);
}

export function AccessibilityMenu() {
  const {dict, to} = useI18n();
  const a = dict.a11y ?? {};
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const panelId = useId();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applyToBody(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyToBody(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // localStorage may be unavailable (Safari private mode, quota) — fail silently.
    }
  }, [settings, hydrated]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          buttonRef.current?.focus();
          return;
        }
        if (e.key !== 'Tab' || !panelRef.current) return;
        const focusables = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      },
      {signal: ctrl.signal},
    );
    const closeBtn = panelRef.current?.querySelector('.a11y-close');
    closeBtn?.focus();
    return () => ctrl.abort();
  }, [open]);

  const update = (patch) => setSettings((s) => ({...s, ...patch}));
  const reset = () => setSettings(DEFAULTS);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="a11y-toggle"
        aria-label={a.open}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="4.2" r="1.6" fill="currentColor" stroke="none" />
          <path d="M5 8h14" />
          <path d="M12 8v5" />
          <path d="M8.5 13.2L7 20" />
          <path d="M15.5 13.2L17 20" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="a11y-backdrop"
            aria-label={a.close}
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
          />
          <div
            ref={panelRef}
            className="a11y-panel"
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={a.title}
          >
            <div className="a11y-panel-header">
              <h2>{a.title}</h2>
              <button
                type="button"
                className="a11y-close"
                aria-label={a.close}
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <fieldset className="a11y-group">
              <legend>{a.textSize}</legend>
              <div className="a11y-radio-row">
                <label>
                  <input
                    type="radio"
                    name="a11y-text"
                    checked={settings.textSize === 'normal'}
                    onChange={() => update({textSize: 'normal'})}
                  />
                  <span>{a.textNormal}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="a11y-text"
                    checked={settings.textSize === 'larger'}
                    onChange={() => update({textSize: 'larger'})}
                  />
                  <span>{a.textLarger}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="a11y-text"
                    checked={settings.textSize === 'much-larger'}
                    onChange={() => update({textSize: 'much-larger'})}
                  />
                  <span>{a.textMuchLarger}</span>
                </label>
              </div>
            </fieldset>

            <div className="a11y-toggles">
              <label>
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={(e) => update({highContrast: e.target.checked})}
                />
                <span>{a.highContrast}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.highlightLinks}
                  onChange={(e) => update({highlightLinks: e.target.checked})}
                />
                <span>{a.highlightLinks}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.readableFont}
                  onChange={(e) => update({readableFont: e.target.checked})}
                />
                <span>{a.readableFont}</span>
              </label>
            </div>

            <div className="a11y-actions">
              <button type="button" className="a11y-reset" onClick={reset}>
                {a.reset}
              </button>
              <a className="a11y-statement-link" href={to('/pages/accessibility')}>
                {a.statementLink}
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
