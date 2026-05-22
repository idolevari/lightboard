/**
 * Translate a Shopify product option name (e.g. "Color") or value
 * (e.g. "Turquoise") using the active locale's product dictionary.
 * Falls back to the original Shopify string when no translation exists.
 */
export function translateOptionName(dict, name) {
  return dict?.product?.optionLabels?.[name] ?? name;
}

export function translateOptionValue(dict, value) {
  return dict?.product?.optionValues?.[value] ?? value;
}

// Hex swatches keyed by the Shopify variant value name. Locale-independent.
// Configured here rather than in Shopify because Shopify's native color swatch
// pipeline (shopify--color-pattern metaobjects) requires per-color taxonomy
// references — overkill for our 3 finishes.
export const OPTION_VALUE_HEX = {
  Turquoise: '#3bb7c4',
  Cream: '#f5ebd8',
  Pink: '#e8a097',
};

export function getOptionValueHex(value) {
  return OPTION_VALUE_HEX[value] ?? null;
}
