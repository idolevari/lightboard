import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {JsonLd} from '~/components/JsonLd';

function scriptBody(html: string): string {
  const match =
    /^<script type="application\/ld\+json">([\s\S]*)<\/script>$/.exec(html);
  expect(match).not.toBeNull();
  return match![1];
}

describe('<JsonLd>', () => {
  it('renders nothing for null or an empty list', () => {
    expect(renderToStaticMarkup(<JsonLd data={null} />)).toBe('');
    expect(renderToStaticMarkup(<JsonLd data={[]} />)).toBe('');
  });

  it('escapes <, > and & so Shopify text cannot close the script tag', () => {
    const data = {
      '@type': 'Thing',
      description: '</script><script>alert(1)</script> & <!-- x -->',
    };
    const body = scriptBody(renderToStaticMarkup(<JsonLd data={data} />));
    expect(body).not.toMatch(/[<>&]/);
    expect(body).toContain('\\u003c/script\\u003e');
    expect(body).toContain('\\u0026');
    // The escaping is invisible once the JSON is parsed.
    expect(JSON.parse(body)).toEqual(data);
  });

  it('unwraps a single payload and keeps several as an array', () => {
    const one = scriptBody(renderToStaticMarkup(<JsonLd data={[{a: 1}]} />));
    expect(JSON.parse(one)).toEqual({a: 1});
    const two = scriptBody(
      renderToStaticMarkup(<JsonLd data={[{a: 1}, {b: 2}]} />),
    );
    expect(JSON.parse(two)).toEqual([{a: 1}, {b: 2}]);
  });
});
