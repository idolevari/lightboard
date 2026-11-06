import {useI18n} from '~/lib/useI18n';

export type ProductSpec = {id: string; label: string; value: string};

/** "Specs" definition list under the buy box. */
export function ProductSpecs({specs}: {specs: Array<ProductSpec>}) {
  const {dict} = useI18n();
  if (specs.length === 0) return null;
  return (
    <section className="pdp-specs" aria-labelledby="pdp-specs-title">
      <h2 id="pdp-specs-title" className="pdp-h2">
        {dict.product.specsTitle}
      </h2>
      <dl className="feat3-ticker">
        {specs.map((spec) => (
          <div className="feat3-tick" key={spec.id}>
            <dt className="k">{spec.label}</dt>
            <dd className="v">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
