/**
 * Curated "Atomic Age Bauhaus" category color palette.
 * Every category color is drawn from the brand system so the whole app
 * reads as one cohesive palette instead of a generic Material rainbow.
 */
export interface PaletteColor {
  name: string;
  value: string;
}

export const CATEGORY_PALETTE: PaletteColor[] = [
  { name: 'Burnt Orange', value: '#D9662E' },
  { name: 'Bright Orange', value: '#E88347' },
  { name: 'Mustard', value: '#D9A63E' },
  { name: 'Petrol Teal', value: '#2F6E6A' },
  { name: 'Olive', value: '#7C8F6B' },
  { name: 'Brick Red', value: '#A63D2F' },
  { name: 'Clay', value: '#B5744B' },
  { name: 'Sand', value: '#C9A86A' },
  { name: 'Slate', value: '#4A5B5C' },
  { name: 'Ink', value: '#3A322C' },
];

/** Default color for a new category. */
export const DEFAULT_CATEGORY_COLOR = CATEGORY_PALETTE[0].value;
