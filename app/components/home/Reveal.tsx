import type {CSSProperties, ReactNode} from 'react';
import {useInView} from '~/lib/useInView';

type RevealProps = {
  className?: string;
  delay?: number;
  children: ReactNode;
  style?: CSSProperties;
};

/** Fade-up on first scroll into view (`.reveal` / `.is-in` in base.css). */
export function Reveal({
  className = '',
  delay = 0,
  children,
  style,
}: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal${inView ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={{transitionDelay: `${delay}ms`, ...style}}
    >
      {children}
    </div>
  );
}
