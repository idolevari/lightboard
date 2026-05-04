import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {useId} from 'react';
import {useI18n} from '~/lib/useI18n';

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 * @param {{
 *   children?: React.ReactNode;
 *   type: AsideType;
 *   heading: React.ReactNode;
 * }}
 */
export function Aside({children, heading, type}) {
  const {type: activeType, close} = useAside();
  const {dict} = useI18n();
  const expanded = type === activeType;
  const id = useId();
  const asideRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    triggerRef.current = document.activeElement;
    const abortController = new AbortController();
    document.addEventListener(
      'keydown',
      function handler(event) {
        if (event.key === 'Escape') {
          close();
          return;
        }
        if (event.key !== 'Tab' || !asideRef.current) return;
        const focusables = asideRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      },
      {signal: abortController.signal},
    );

    const focusTimer = setTimeout(() => {
      const focusables = asideRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const target = focusables?.[1] ?? focusables?.[0];
      target?.focus();
    }, 50);

    return () => {
      abortController.abort();
      clearTimeout(focusTimer);
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    };
  }, [close, expanded]);

  return (
    <div
      aria-modal={expanded ? 'true' : undefined}
      aria-hidden={expanded ? undefined : 'true'}
      className={`overlay ${expanded ? 'expanded' : ''}`}
      role="dialog"
      aria-labelledby={id}
    >
      <button
        type="button"
        className="close-outside"
        onClick={close}
        tabIndex={expanded ? 0 : -1}
        aria-label={dict.common.close}
      />
      <aside ref={asideRef} {...(expanded ? {} : {inert: ''})}>
        <header>
          <h3 id={id}>{heading}</h3>
          <button
            type="button"
            className="close reset"
            onClick={close}
            aria-label={dict.common.close}
          >
            &times;
          </button>
        </header>
        <main>{children}</main>
      </aside>
    </div>
  );
}

const AsideContext = createContext(null);

Aside.Provider = function AsideProvider({children}) {
  const [type, setType] = useState('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}

/** @typedef {'search' | 'cart' | 'mobile' | 'closed'} AsideType */
/**
 * @typedef {{
 *   type: AsideType;
 *   open: (mode: AsideType) => void;
 *   close: () => void;
 * }} AsideContextValue
 */

/** @typedef {import('react').ReactNode} ReactNode */
