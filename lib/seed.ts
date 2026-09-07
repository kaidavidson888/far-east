/** Facet values, in the order the catalogue filters should present them. */
export const FACET_ORDER = {
  strength: ['Full', 'Medium', 'Light', 'Ultra light'],
  flavour: ['Regular', 'Menthol', 'Clove', 'Capsule', 'Aromatic'],
  format: ['King size', '100s', 'Shorts', 'Super slims'],
  filterType: ['Filtered', 'Charcoal', 'Unfiltered'],
} as const;

export const FACET_LABELS: Record<keyof typeof FACET_ORDER | 'country' | 'brand', string> = {
  country: 'Country',
  brand: 'Brand',
  strength: 'Strength',
  flavour: 'Flavour',
  format: 'Format',
  filterType: 'Filter',
};
