import type { Config } from 'tailwindcss';

// Visual identity: two primary colours + warm neutrals.
//
//   Warm Cream   #FAF3E8  -> cream-100 (page background)
//   Deep Orange  #963820  -> brand-600 (primary buttons, active states,
//                                       chart series, highlighted KPI)
//
// Everything else is derived from those two (tints of Deep Orange, shades of
// cream) or neutral (warm whites, beige borders, readable dark text), so no
// unrelated accent colour is introduced. Existing `brand-*`, `cream-*` and
// `gray-*` utilities pick this up everywhere without per-page edits.
//
// The only non-palette colours left in the app are semantic status colours
// (green = good, red = error/cancelled) used for meaning, not decoration.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep Orange scale. 600 is exactly #963820.
        brand: {
          50: '#fbf1ea',
          100: '#f5e1d5',
          200: '#e9c6b2',
          300: '#d49c82',
          400: '#c0603f',
          500: '#ac4426',
          600: '#963820',
          700: '#7f2f1a',
          800: '#672614',
          900: '#4f1d0f',
        },
        // Warm Cream scale. 100 is exactly #FAF3E8.
        cream: {
          50: '#fffcf7', // warm white (cards, sidebar, header)
          100: '#faf3e8', // page background
          200: '#f0e6d6', // subtle beige borders, tracks
          300: '#e4d6c0', // gridlines, stronger beige borders
        },
        // Warm neutral scale (text and lines). 400/500 are darker than stock
        // so small secondary text stays readable (WCAG AA) on cream.
        gray: {
          50: '#faf6ee',
          100: '#f4ecdf',
          200: '#eadfce',
          300: '#dccdb6',
          400: '#78726c',
          500: '#6b6560',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
      },
      boxShadow: {
        // Restrained, warm-tinted shadow for cards.
        card: '0 1px 2px 0 rgba(90, 55, 35, 0.07)',
      },
    },
  },
  plugins: [],
};

export default config;
