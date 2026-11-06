import {useState} from 'react';
import {useI18n} from '~/lib/useI18n';
import type {MetaobjectFieldRecord} from '~/lib/home/types';
import {Van} from '~/components/illustrations';
import {Reveal} from './Reveal';

/** Accordion over the `faq` metaobjects (one item open at a time). */
export function Faq({items}: {items: Array<MetaobjectFieldRecord>}) {
  const {dict} = useI18n();
  const f = dict.faq;
  const [open, setOpen] = useState(-1);
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="faq" id="faq">
      <div className="container faq-container">
        <header className="faq-head">
          <Reveal>
            <div className="section-eyebrow">
              <span>{f.eyebrow}</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="section-title faq-title">
              {f.titleLine1}
              <br />
              <em>{f.titleLine2}</em>
            </h2>
          </Reveal>
          <Van className="faq-van" />
        </header>
        <ul className="faq-list" role="list">
          {items.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <li className={`faq-item${isOpen ? ' open' : ''}`} key={item.id}>
                <button
                  type="button"
                  className="faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : idx)}
                >
                  <span className="faq-q-text">{item.question}</span>
                  <span className="faq-mark" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <div className="faq-a-wrap" aria-hidden={!isOpen}>
                  <div className="faq-a">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
