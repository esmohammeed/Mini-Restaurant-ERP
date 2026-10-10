import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f6f4',
          100: '#dde7e0',
          500: '#3f7a52',
          600: '#336343',
          700: '#2a5137',
        },
      },
    },
  },
  plugins: [],
};

export default config;
