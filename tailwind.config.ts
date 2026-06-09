import type { Config } from 'tailwindcss';

const withAlpha = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Neutral semantic tokens — flip under .dark via CSS variables.
        canvas: withAlpha('--canvas'),
        surface: withAlpha('--surface'),
        elevated: withAlpha('--elevated'),
        sunken: withAlpha('--sunken'),
        border: {
          DEFAULT: withAlpha('--border'),
          strong: withAlpha('--border-strong'),
        },
        fg: {
          DEFAULT: withAlpha('--fg'),
          muted: withAlpha('--fg-muted'),
          subtle: withAlpha('--fg-subtle'),
        },
        sidebar: {
          DEFAULT: withAlpha('--sidebar'),
          fg: withAlpha('--sidebar-fg'),
          muted: withAlpha('--sidebar-muted'),
          hover: withAlpha('--sidebar-hover'),
          active: withAlpha('--sidebar-active'),
          border: withAlpha('--sidebar-border'),
        },
        ring: withAlpha('--ring'),
      },
    },
  },
  plugins: [],
};

export default config;
