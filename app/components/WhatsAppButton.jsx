import {useI18n} from '~/lib/useI18n';
import {useBusiness, whatsappHref} from '~/lib/brand';

export function WhatsAppButton() {
  const {dict} = useI18n();
  const w = dict.whatsapp ?? {};
  const href = whatsappHref(useBusiness(), w.prefill);
  if (!href) return null;

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
