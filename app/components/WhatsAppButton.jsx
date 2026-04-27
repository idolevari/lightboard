import {useI18n} from '~/lib/useI18n';

const PHONE = '972557209448';

export function WhatsAppButton() {
  const {dict} = useI18n();
  const w = dict.whatsapp ?? {};
  const href = `https://wa.me/${PHONE}${
    w.prefill ? `?text=${encodeURIComponent(w.prefill)}` : ''
  }`;

  return (
    <a
      href={href}
      className="wa-fab"
      target="_blank"
      rel="noreferrer"
      aria-label={w.label ?? 'WhatsApp'}
    >
      <img src="/whatsapp.svg" alt="" width="56" height="56" />
    </a>
  );
}
