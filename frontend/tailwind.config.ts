import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#09090b',
        'surface-elevated': '#121215',
        border: '#27272a',
        'border-hover': '#3f3f46',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(255, 255, 255, 0.05)',
        glow: '0 0 25px -5px rgba(255, 255, 255, 0.15)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.7)',
      },
    },
  },
  plugins: [],
};

export default config;
